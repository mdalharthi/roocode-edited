/**
 * API Provider Logging Wrapper
 *
 * Wraps API provider createMessage calls to automatically log:
 * - Request/response data
 * - Token usage and costs
 * - Response times
 * - Errors and retries
 *
 * This provides a reusable pattern for all API providers.
 */

import { Anthropic } from "@anthropic-ai/sdk"
import { LoggingService } from "../../services/logging/LoggingService"
import { PerformanceTimer, sanitizeLogData, truncateString } from "../../utils/logging/helpers"
import {
	collectSystemMetrics,
	logOperationPerformance,
	calculateMetricsDelta,
	SystemMetrics,
} from "../../services/logging/helpers/systemMetricsCollector"

interface ApiCallContext {
	provider: string
	model: string
	sessionId?: string
	userPrompt?: string
}

/**
 * Wrap an API call with automatic logging
 */
export async function withApiLogging<T>(
	context: ApiCallContext,
	apiCall: () => Promise<T>,
	options: {
		extractTokens?: (result: T) => number | undefined
		extractCost?: (result: T) => number | undefined
		logRequest?: boolean
		logResponse?: boolean
	} = {},
): Promise<T> {
	const { extractTokens, extractCost, logRequest = false, logResponse = false } = options

	// Check if logging is enabled
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return apiCall()
	}

	const timer = new PerformanceTimer()
	const startMetrics = collectSystemMetrics("api_call", context.provider)
	let actionLogId: number | null = null

	try {
		// Create initial action log
		actionLogId = await LoggingService.instance.logAction({
			session_id: context.sessionId,
			action_type: "api_request",
			action_name: "llm_create_message",
			status: "pending",
			action_metadata: {
				provider: context.provider,
				model: context.model,
			},
		})

		// Execute API call
		const result = await apiCall()

		const duration = timer.getDuration()

		// Extract metrics from result
		const tokensUsed = extractTokens ? extractTokens(result) : undefined
		const cost = extractCost ? extractCost(result) : undefined

		// Update action log
		if (actionLogId) {
			await LoggingService.instance.updateActionLog(actionLogId, {
				status: "success",
				duration,
				response_code: 200,
			})
		}

		// Create API log
		await LoggingService.instance.logApiCall({
			action_log_id: actionLogId || undefined,
			provider: context.provider,
			model: context.model,
			method: "POST",
			url: getProviderUrl(context.provider),
			endpoint: "/messages",
			status_code: 200,
			duration_ms: duration,
			tokens_used: tokensUsed,
			cost,
			metadata: context.userPrompt ? { user_prompt: context.userPrompt } : undefined,
		})

		// Log performance metrics for API call
		const endMetrics = collectSystemMetrics("api_call_complete", context.provider)
		await logOperationPerformance({
			operation_name: `api_call_${context.provider}`,
			operation_type: "api_call",
			duration_ms: duration,
			resource_source: "llm_request",
			resource_component: context.provider,
			resource_metrics: {
				start: startMetrics,
				end: endMetrics,
				delta: calculateMetricsDelta(startMetrics, endMetrics),
			},
			additional_metrics: {
				model: context.model,
				tokens_used: tokensUsed,
				cost,
				success: true,
			},
		})

		return result
	} catch (error) {
		const duration = timer.getDuration()
		const errorMessage = error instanceof Error ? error.message : String(error)

		// Update action log with error
		if (actionLogId) {
			await LoggingService.instance.updateActionLog(actionLogId, {
				status: "failed",
				error_message: errorMessage,
				error_stack: error instanceof Error ? error.stack : undefined,
				duration,
				response_code: 500,
			})
		}

		// Log failed API call
		await LoggingService.instance.logApiCall({
			action_log_id: actionLogId || undefined,
			provider: context.provider,
			model: context.model,
			method: "POST",
			url: getProviderUrl(context.provider),
			endpoint: "/messages",
			status_code: 500,
			duration_ms: duration,
			error_message: errorMessage,
		})

		// Log performance metrics for failed API call
		const endMetrics = collectSystemMetrics("api_call_error", context.provider)
		await logOperationPerformance({
			operation_name: `api_call_${context.provider}`,
			operation_type: "api_call",
			duration_ms: duration,
			resource_source: "llm_request",
			resource_component: context.provider,
			resource_metrics: {
				start: startMetrics,
				end: endMetrics,
				delta: calculateMetricsDelta(startMetrics, endMetrics),
			},
			additional_metrics: {
				model: context.model,
				success: false,
				error_message: errorMessage,
			},
		})

		throw error
	}
}

/**
 * Get provider URL for logging
 */
function getProviderUrl(provider: string): string {
	const providerUrls: Record<string, string> = {
		anthropic: "https://api.anthropic.com",
		openai: "https://api.openai.com",
		bedrock: "https://bedrock-runtime.amazonaws.com",
		vertex: "https://us-central1-aiplatform.googleapis.com",
		gemini: "https://generativelanguage.googleapis.com",
		openrouter: "https://openrouter.ai",
		roo: "https://api.roocode.com",
	}

	return providerUrls[provider.toLowerCase()] || "unknown"
}

/**
 * Maximum size for request/response body logging (in characters)
 * Larger bodies will be truncated to prevent DB bloat
 */
const MAX_BODY_SIZE = 100000 // ~100KB

/**
 * Truncate body if it exceeds max size
 */
function truncateBody(body: any): any {
	if (body === undefined || body === null) {
		return body
	}

	const stringified = typeof body === "string" ? body : JSON.stringify(body)
	if (stringified.length <= MAX_BODY_SIZE) {
		return body
	}

	// Return truncated version with indicator
	return {
		_truncated: true,
		_originalSize: stringified.length,
		data: stringified.substring(0, MAX_BODY_SIZE),
	}
}

/**
 * Log streaming API response (for streaming endpoints)
 */
export async function logStreamingApiCall(
	context: ApiCallContext,
	duration: number,
	tokensUsed?: number,
	error?: Error,
	requestBody?: {
		systemPrompt?: string
		messages?: any[]
		metadata?: any
	},
	responseBody?: {
		textContent?: string
		reasoning?: string
		toolCalls?: any[]
		usage?: any
	},
): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	await LoggingService.instance.logApiCall({
		provider: context.provider,
		model: context.model,
		method: "POST",
		url: getProviderUrl(context.provider),
		endpoint: "/messages/stream",
		status_code: error ? 500 : 200,
		duration_ms: duration,
		tokens_used: tokensUsed,
		error_message: error?.message,
		request_body: truncateBody(requestBody),
		response_body: truncateBody(responseBody),
		metadata: context.userPrompt ? { user_prompt: context.userPrompt } : undefined,
	})

	// Log performance metrics for streaming API call
	const metrics = collectSystemMetrics(error ? "streaming_api_error" : "streaming_api_complete", context.provider)
	await logOperationPerformance({
		operation_name: `streaming_api_${context.provider}`,
		operation_type: "api_call",
		duration_ms: duration,
		resource_source: "llm_streaming",
		resource_component: context.provider,
		resource_metrics: metrics,
		additional_metrics: {
			model: context.model,
			tokens_used: tokensUsed,
			success: !error,
			error_message: error?.message,
		},
	})
}
