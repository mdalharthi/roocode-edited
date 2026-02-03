import { LoggingService } from "./LoggingService"

/**
 * Helper class for logging backend API calls to the logging service
 */
export class BackendApiLogger {
	/**
	 * Log a backend API request
	 *
	 * @param method HTTP method (GET, POST, etc.)
	 * @param url Full URL string
	 * @param status HTTP status code
	 * @param durationMs Request duration in milliseconds
	 * @param details Optional additional details (request/response body, headers, error)
	 */
	public static async logRequest(
		method: string,
		url: string,
		status: number,
		durationMs: number,
		details?: {
			requestBody?: any
			responseBody?: any
			error?: any
			headers?: any
		},
	): Promise<void> {
		try {
			// Check if logging service is initialized
			if (!LoggingService.hasInstance()) {
				return
			}

			// Parse URL to get endpoint
			let endpoint = url
			try {
				const urlObj = new URL(url)
				endpoint = urlObj.pathname
			} catch (e) {
				// If invalid URL, keep original string
			}

			// Prepare log data
			await LoggingService.instance.logApiCall({
				provider: "backend", // Distinguish from model providers
				model: "backend-api", // Generic model name for backend API
				url: url,
				endpoint: endpoint,
				method: method,
				status_code: status,
				duration_ms: durationMs,
				request_body: details?.requestBody,
				response_body: details?.responseBody,
				error_message: details?.error
					? details.error instanceof Error
						? details.error.message
						: String(details.error)
					: undefined,
				metadata: {
					headers: details?.headers,
					timestamp: new Date().toISOString(),
				},
			})
		} catch (error) {
			// Fail silently to avoid affecting the actual request
			console.error("[BackendApiLogger] Failed to log request:", error)
		}
	}
}
