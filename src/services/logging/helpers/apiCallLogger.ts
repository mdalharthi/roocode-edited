/**
 * API Call Logger Helper
 *
 * Provides helper functions for logging streaming API calls from Task.ts.
 * This centralizes the logging logic and keeps Task.ts cleaner.
 */

import { logStreamingApiCall as baseLogStreamingApiCall } from "../../../api/providers/logging-wrapper"
import { PerformanceTimer } from "../../../utils/logging/helpers"
import { ProviderSettings, getModelId } from "@roo-code/types"

export interface StreamingApiCallContext {
	apiConfiguration: ProviderSettings
	taskId: string
	userPrompt?: string
}

export interface StreamingApiCallResponse {
	textContent?: string
	reasoning?: string
	toolCalls?: any[]
	usage?: any
}

export interface StreamingApiRequestBody {
	systemPrompt?: string
	messages?: any[]
	metadata?: any
}

/**
 * Log a streaming API call result
 */
export async function logTaskStreamingApiCall(
	context: StreamingApiCallContext,
	duration: number,
	tokensUsed: number,
	error: Error | undefined,
	requestBody: StreamingApiRequestBody | undefined,
	responseBody: StreamingApiCallResponse | undefined,
): Promise<void> {
	await baseLogStreamingApiCall(
		{
			provider: context.apiConfiguration.apiProvider || "unknown",
			model: getModelId(context.apiConfiguration) || "unknown",
			sessionId: context.taskId,
			userPrompt: context.userPrompt || "",
		},
		duration,
		tokensUsed,
		error,
		requestBody,
		responseBody,
	)
}

/**
 * Create a streaming API call logger context from task properties
 */
export function createStreamingApiContext(
	apiConfiguration: ProviderSettings,
	taskId: string,
	userPrompt?: string,
): StreamingApiCallContext {
	return {
		apiConfiguration,
		taskId,
		userPrompt,
	}
}

// Re-export PerformanceTimer for convenience
export { PerformanceTimer }
