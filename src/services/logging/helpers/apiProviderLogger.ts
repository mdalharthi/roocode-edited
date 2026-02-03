import { ProviderSettings } from "@roo-code/types"
import LoggingService from "../LoggingService"
import { ApiProviderData } from "../BackendLoggingClient"

/**
 * Log API provider configuration to the backend
 *
 * This function maps the frontend ProviderSettings to the backend ApiProviderData structure
 * and sends it to the logging service.
 *
 * @param config The provider settings from the task
 */
export async function logApiProviderConfig(config: ProviderSettings): Promise<void> {
	try {
		if (!LoggingService.hasInstance()) {
			return
		}

		const loggingService = LoggingService.instance

		// Skip if logging is disabled
		if (!loggingService.isEnabled()) {
			return
		}

		const providerData: ApiProviderData = {
			name: `${config.apiProvider}-${config.apiModelId || "default"}`, // Unique name combination
			display_name: `${config.apiProvider} ${config.apiModelId || ""}`.trim(),
			provider_type: config.apiProvider || "unknown",
			base_url: config.openAiBaseUrl || config.ollamaBaseUrl || config.lmStudioBaseUrl || "default",
			api_key_encrypted:
				config.apiKey ||
				(config as any).openAiApiKey ||
				(config as any).anthropicApiKey ||
				(config as any).geminiApiKey ||
				(config as any).openRouterApiKey, // Backend handles encryption
			auth_type: "api_key", // Default to api_key for now
			created_by: loggingService.getSessionId(), // Using session ID as creator reference for now

			// Default rate limits (can be updated later based on specific provider)
			rate_limit_requests_per_minute: 60,
			rate_limit_requests_per_hour: 1000,
			rate_limit_requests_per_day: 10000,

			config_metadata: {
				model: config.apiModelId,
				temperature: 0, // Default for coding tasks
				max_tokens: config.modelMaxTokens,
				...config,
			},
		}

		await loggingService.storeApiProvider(providerData)
	} catch (error) {
		console.error("[ApiProviderLogger] Failed to log provider config:", error)
	}
}
