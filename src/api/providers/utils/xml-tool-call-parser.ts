/**
 * XML Tool Call Parser
 *
 * Parses XML-formatted tool calls from LLM responses and converts them
 * to the native OpenAI tool call format. This is needed for OpenAI-compatible
 * endpoints (like Qwen, SGLang) that output XML tool calls instead of native JSON.
 *
 * Example XML format:
 * <tool_call>
 * <function=ask_followup_question>
 * <parameter=question>What do you want?</parameter>
 * <parameter=follow_up>[...]</parameter>
 * </function>
 * </tool_call>
 */

export interface ExtractedToolCall {
	id: string
	name: string
	arguments: string
	fullMatch: string
}

export interface ParseResult {
	textWithoutXml: string
	toolCalls: ExtractedToolCall[]
}

/**
 * Extracts XML tool calls from text and returns both the tool calls and cleaned text.
 * Handles multiple tool calls in a single response.
 */
export function parseXmlToolCalls(text: string): ParseResult {
	const toolCalls: ExtractedToolCall[] = []
	let cleanText = text
	let callId = 0

	// Match XML tool call blocks: <tool_call>...*</tool_call>
	// This regex is greedy and will capture everything between opening and closing tags
	const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g

	let match
	while ((match = toolCallRegex.exec(text)) !== null) {
		const fullMatch = match[0]
		const content = match[1]

		// Parse the function name from <function=name>
		const functionMatch = content.match(/<function=([^>]+)>/)
		if (!functionMatch) continue

		const functionName = functionMatch[1].trim()

		// Extract parameters from <parameter=key>value</parameter>
		const parameters: Record<string, any> = {}
		const paramRegex = /<parameter=([^>]+)>([\s\S]*?)<\/parameter>/g
		let paramMatch

		while ((paramMatch = paramRegex.exec(content)) !== null) {
			const paramKey = paramMatch[1].trim()
			let paramValue = paramMatch[2].trim()

			// Try to parse as JSON if it looks like JSON
			if ((paramValue.startsWith("[") || paramValue.startsWith("{")) && paramValue.includes("}")) {
				try {
					paramValue = JSON.parse(paramValue)
				} catch {
					// Keep as string if JSON parsing fails
				}
			}

			parameters[paramKey] = paramValue
		}

		// Create tool call in OpenAI format
		const toolCall: ExtractedToolCall = {
			id: `call_${callId++}`,
			name: functionName,
			arguments: JSON.stringify(parameters),
			fullMatch: fullMatch,
		}

		toolCalls.push(toolCall)
	}

	// Remove all XML tool call blocks from the text
	cleanText = cleanText.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim()

	return {
		textWithoutXml: cleanText,
		toolCalls,
	}
}

/**
 * Checks if text contains XML tool calls
 */
export function hasXmlToolCalls(text: string): boolean {
	return /<tool_call>[\s\S]*?<\/tool_call>/.test(text)
}

/**
 * Removes XML tool calls from text without extracting them
 */
export function stripXmlToolCalls(text: string): string {
	return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim()
}
