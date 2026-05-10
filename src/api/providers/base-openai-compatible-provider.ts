import { Anthropic } from "@anthropic-ai/sdk"
import OpenAI from "openai"
import https from "https"

import type { ModelInfo } from "@roo-code/types"

import { type ApiHandlerOptions, getModelMaxOutputTokens } from "../../shared/api"
import { TagMatcher } from "../../utils/tag-matcher"
import { isMcpTool } from "../../utils/mcp-name"
import { ApiStream, ApiStreamUsageChunk } from "../transform/stream"
import { convertToOpenAiMessages } from "../transform/openai-format"

import type { SingleCompletionHandler, ApiHandlerCreateMessageMetadata } from "../index"
import { DEFAULT_HEADERS } from "./constants"
import { BaseProvider } from "./base-provider"
import { handleOpenAIError } from "./utils/openai-error-handler"
import { calculateApiCostOpenAI } from "../../shared/cost"
import { getApiRequestTimeout } from "./utils/timeout-config"
import { parseXmlToolCalls, hasXmlToolCalls } from "./utils/xml-tool-call-parser"

type BaseOpenAiCompatibleProviderOptions<ModelName extends string> = ApiHandlerOptions & {
	providerName: string
	baseURL: string
	defaultProviderModelId: ModelName
	providerModels: Record<ModelName, ModelInfo>
	defaultTemperature?: number
}

export abstract class BaseOpenAiCompatibleProvider<ModelName extends string>
	extends BaseProvider
	implements SingleCompletionHandler
{
	protected readonly providerName: string
	protected readonly baseURL: string
	protected readonly defaultTemperature: number
	protected readonly defaultProviderModelId: ModelName
	protected readonly providerModels: Record<ModelName, ModelInfo>

	protected readonly options: ApiHandlerOptions

	protected client: OpenAI

	constructor({
		providerName,
		baseURL,
		defaultProviderModelId,
		providerModels,
		defaultTemperature,
		...options
	}: BaseOpenAiCompatibleProviderOptions<ModelName>) {
		super()

		this.providerName = providerName
		this.baseURL = baseURL
		this.defaultProviderModelId = defaultProviderModelId
		this.providerModels = providerModels
		this.defaultTemperature = defaultTemperature ?? 0

		this.options = options

		if (!this.options.apiKey) {
			throw new Error("API key is required")
		}

		const disableSsl =
			process.env.DISABLE_SSL_VERIFICATION === "true" || process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0"

		if (disableSsl) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
		}

		const clientOptions: any = {
			baseURL,
			apiKey: this.options.apiKey,
			defaultHeaders: DEFAULT_HEADERS,
			timeout: getApiRequestTimeout(),
			dangerouslyAllowBrowser: true,
		}

		this.client = new OpenAI(clientOptions)
	}

	/**
	 * Override tool conversion for OpenAI-compatible endpoints.
	 * Removes strict mode field - many endpoints reject it as "Extra inputs not permitted".
	 * Subclasses can override this to customize tool handling for their specific endpoint.
	 */
	protected override convertToolsForOpenAI(tools: any[] | undefined): any[] | undefined {
		if (!tools) {
			return undefined
		}

		return tools.map((tool) => {
			if (tool.type !== "function") {
				console.warn(
					`Tool '${tool.name}' is not of type 'function' and will be passed through without modification. OpenAI-compatible endpoints only support function tools.`,
					tool,
				)
				return tool
			}

			// MCP tools use the 'mcp--' prefix
			const isMcp = isMcpTool(tool.function.name)

			return {
				...tool,
				function: {
					...tool.function,
					// DO NOT include 'strict' field - OpenAI-compatible endpoints reject it
					// as "Extra inputs are not permitted" (field not recognized)
					parameters: isMcp
						? tool.function.parameters
						: this.convertToolSchemaForOpenAI(tool.function.parameters),
				},
			}
		})
	}

	/**
	 * Flattens text-only messages from array format to plain strings.
	 * Many OpenAI-compatible endpoints expect plain strings for text-only messages
	 * instead of the array format [..., { type: "text", text: "..." }].
	 * If content has mixed types (text + images), keeps array format.
	 */
	protected flattenTextOnlyMessages(
		messages: OpenAI.Chat.ChatCompletionMessageParam[],
	): OpenAI.Chat.ChatCompletionMessageParam[] {
		return messages.map((msg) => {
			// Flatten for all message roles that can have array content
			if (msg.role && Array.isArray(msg.content)) {
				// Check if content contains only text blocks (no images or other types)
				const hasNonText = msg.content.some((block: any) => block.type !== "text")

				if (!hasNonText && msg.content.length > 0) {
					// All blocks are text - concatenate them into a single string
					const text = msg.content
						.map((block: any) => (block.type === "text" ? block.text || "" : ""))
						.join("")
						.trim()

					return {
						...msg,
						content: text || "",
					}
				}
			}
			return msg
		})
	}

	protected createStream(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
		requestOptions?: OpenAI.RequestOptions,
	) {
		const { id: model, info } = this.getModel()

		// Centralized cap: clamp to 20% of the context window (unless provider-specific exceptions apply)
		const max_tokens =
			getModelMaxOutputTokens({
				modelId: model,
				model: info,
				settings: this.options,
				format: "openai",
			}) ?? undefined

		const temperature = this.options.modelTemperature ?? info.defaultTemperature ?? this.defaultTemperature

		// Build messages and flatten text-only to strings for compatibility
		let convertedMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{ role: "system", content: systemPrompt },
			...convertToOpenAiMessages(messages),
		]
		convertedMessages = this.flattenTextOnlyMessages(convertedMessages)

		// Build params object, only including defined values to avoid validation errors
		// Many endpoints reject undefined/null values that OpenAI SDK includes in the request
		const params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
			model,
			messages: convertedMessages,
			stream: true,
			stream_options: { include_usage: true },
			// Only include optional parameters if they have meaningful values
			...(temperature !== undefined && { temperature }),
			...(max_tokens !== undefined && { max_tokens }),
			...(metadata?.tool_choice !== undefined && { tool_choice: metadata.tool_choice }),
			...(metadata?.parallelToolCalls && { parallel_tool_calls: true }),
		}

		// Add tools if provided
		const tools = this.convertToolsForOpenAI(metadata?.tools)
		if (tools && tools.length > 0) {
			params.tools = tools
		}

		// Add thinking parameter if reasoning is enabled and model supports it
		if (this.options.enableReasoningEffort && info.supportsReasoningBinary) {
			;(params as any).thinking = { type: "enabled" }
		}

		try {
			return this.client.chat.completions.create(params, requestOptions)
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
	}

	override async *createMessage(
		systemPrompt: string,
		messages: Anthropic.Messages.MessageParam[],
		metadata?: ApiHandlerCreateMessageMetadata,
	): ApiStream {
		const stream = await this.createStream(systemPrompt, messages, metadata)

		const matcher = new TagMatcher(
			"think",
			(chunk) =>
				({
					type: chunk.matched ? "reasoning" : "text",
					text: chunk.data,
				}) as const,
		)

		let lastUsage: OpenAI.CompletionUsage | undefined
		const activeToolCallIds = new Set<string>()
		let accumulatedText = "" // Accumulate text to detect XML tool calls

		for await (const chunk of stream) {
			// Check for provider-specific error responses (e.g., MiniMax base_resp)
			const chunkAny = chunk as any
			if (chunkAny.base_resp?.status_code && chunkAny.base_resp.status_code !== 0) {
				throw new Error(
					`${this.providerName} API Error (${chunkAny.base_resp.status_code}): ${chunkAny.base_resp.status_msg || "Unknown error"}`,
				)
			}

			const delta = chunk.choices?.[0]?.delta
			const finishReason = chunk.choices?.[0]?.finish_reason

			if (delta?.content) {
				// Accumulate text for XML parsing
				accumulatedText += delta.content

				// Check if we have complete XML tool calls in the accumulated text
				if (hasXmlToolCalls(accumulatedText)) {
					const parsed = parseXmlToolCalls(accumulatedText)

					// Emit any extracted tool calls
					for (const toolCall of parsed.toolCalls) {
						yield {
							type: "tool_call",
							id: toolCall.id,
							name: toolCall.name,
							arguments: toolCall.arguments,
						}
					}

					// Process the cleaned text (without XML) through the matcher
					for (const processedChunk of matcher.update(parsed.textWithoutXml)) {
						yield processedChunk
					}

					// Reset accumulated text after processing
					accumulatedText = ""
				} else if (/<tool_call/.test(accumulatedText)) {
					// XML tool call is incomplete, buffer it without emitting
					// This prevents partial XML from appearing in chat
					continue
				} else {
					// No XML tags at all, safe to emit
					for (const processedChunk of matcher.update(delta.content)) {
						yield processedChunk
					}
					// Clear accumulated text since we've processed it
					accumulatedText = ""
				}
			}

			if (delta) {
				for (const key of ["reasoning_content", "reasoning"] as const) {
					if (key in delta) {
						const reasoning_content = ((delta as any)[key] as string | undefined) || ""
						if (reasoning_content?.trim()) {
							yield { type: "reasoning", text: reasoning_content }
						}
						break
					}
				}
			}

			// Emit raw tool call chunks - NativeToolCallParser handles state management
			if (delta?.tool_calls) {
				for (const toolCall of delta.tool_calls) {
					if (toolCall.id) {
						activeToolCallIds.add(toolCall.id)
					}
					yield {
						type: "tool_call_partial",
						index: toolCall.index,
						id: toolCall.id,
						name: toolCall.function?.name,
						arguments: toolCall.function?.arguments,
					}
				}
			}

			// Emit tool_call_end events when finish_reason is "tool_calls"
			// This ensures tool calls are finalized even if the stream doesn't properly close
			if (finishReason === "tool_calls" && activeToolCallIds.size > 0) {
				for (const id of activeToolCallIds) {
					yield { type: "tool_call_end", id }
				}
				activeToolCallIds.clear()
			}

			if (chunk.usage) {
				lastUsage = chunk.usage
			}
		}

		if (lastUsage) {
			yield this.processUsageMetrics(lastUsage, this.getModel().info)
		}

		// Final pass: check if there's any remaining accumulated text with XML
		if (accumulatedText && hasXmlToolCalls(accumulatedText)) {
			const parsed = parseXmlToolCalls(accumulatedText)
			for (const toolCall of parsed.toolCalls) {
				yield {
					type: "tool_call",
					id: toolCall.id,
					name: toolCall.name,
					arguments: toolCall.arguments,
				}
			}
			for (const processedChunk of matcher.update(parsed.textWithoutXml)) {
				yield processedChunk
			}
		} else if (accumulatedText) {
			// Emit any remaining text that wasn't XML
			for (const processedChunk of matcher.update(accumulatedText)) {
				yield processedChunk
			}
		}

		// Process any remaining content
		for (const processedChunk of matcher.final()) {
			yield processedChunk
		}
	}

	protected processUsageMetrics(usage: any, modelInfo?: any): ApiStreamUsageChunk {
		const inputTokens = usage?.prompt_tokens || 0
		const outputTokens = usage?.completion_tokens || 0
		const cacheWriteTokens = usage?.prompt_tokens_details?.cache_write_tokens || 0
		const cacheReadTokens = usage?.prompt_tokens_details?.cached_tokens || 0

		const { totalCost } = modelInfo
			? calculateApiCostOpenAI(modelInfo, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens)
			: { totalCost: 0 }

		return {
			type: "usage",
			inputTokens,
			outputTokens,
			cacheWriteTokens: cacheWriteTokens || undefined,
			cacheReadTokens: cacheReadTokens || undefined,
			totalCost,
		}
	}

	async completePrompt(prompt: string): Promise<string> {
		const { id: modelId, info: modelInfo } = this.getModel()

		const params: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
			model: modelId,
			messages: [{ role: "user", content: prompt }],
		}

		// Add thinking parameter if reasoning is enabled and model supports it
		if (this.options.enableReasoningEffort && modelInfo.supportsReasoningBinary) {
			;(params as any).thinking = { type: "enabled" }
		}

		try {
			const response = await this.client.chat.completions.create(params)

			// Check for provider-specific error responses (e.g., MiniMax base_resp)
			const responseAny = response as any
			if (responseAny.base_resp?.status_code && responseAny.base_resp.status_code !== 0) {
				throw new Error(
					`${this.providerName} API Error (${responseAny.base_resp.status_code}): ${responseAny.base_resp.status_msg || "Unknown error"}`,
				)
			}

			return response.choices?.[0]?.message.content || ""
		} catch (error) {
			throw handleOpenAIError(error, this.providerName)
		}
	}

	override getModel() {
		const id =
			this.options.apiModelId && this.options.apiModelId in this.providerModels
				? (this.options.apiModelId as ModelName)
				: this.defaultProviderModelId

		return { id, info: this.providerModels[id] }
	}
}
