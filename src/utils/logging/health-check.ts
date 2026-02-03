/**
 * Health Check Utilities
 *
 * Utilities for checking backend logging service health and connectivity.
 */

import { LoggingService } from "../../services/logging/LoggingService"

export interface HealthCheckResult {
	healthy: boolean
	backend: "connected" | "disconnected" | "error"
	sessionId?: string
	error?: string
	timestamp: string
}

/**
 * Check if logging service is healthy
 */
export async function checkLoggingHealth(): Promise<HealthCheckResult> {
	const timestamp = new Date().toISOString()

	try {
		// Check if logging service exists
		if (!LoggingService.hasInstance()) {
			return {
				healthy: false,
				backend: "disconnected",
				error: "LoggingService not initialized",
				timestamp,
			}
		}

		const service = LoggingService.instance

		// Check if service is enabled
		if (!service.isEnabled()) {
			return {
				healthy: false,
				backend: "disconnected",
				error: "Logging is disabled",
				timestamp,
			}
		}

		// Try to ping backend with a test log
		try {
			const testActionId = await service.logAction({
				action_type: "health_check",
				action_name: "ping",
				status: "success",
				action_metadata: { test: true },
			})

			return {
				healthy: true,
				backend: "connected",
				sessionId: service.getSessionId(),
				timestamp,
			}
		} catch (error) {
			return {
				healthy: false,
				backend: "error",
				sessionId: service.getSessionId(),
				error: error instanceof Error ? error.message : String(error),
				timestamp,
			}
		}
	} catch (error) {
		return {
			healthy: false,
			backend: "error",
			error: error instanceof Error ? error.message : String(error),
			timestamp,
		}
	}
}

/**
 * Check logging health and log the result
 */
export async function checkAndLogHealth(): Promise<HealthCheckResult> {
	const result = await checkLoggingHealth()

	const statusEmoji = result.healthy ? "✅" : "❌"
	const message = `${statusEmoji} Logging Health: ${result.backend}`

	if (result.healthy) {
		console.log(message, { sessionId: result.sessionId })
	} else {
		console.error(message, { error: result.error })
	}

	return result
}

/**
 * Start periodic health checks
 */
export function startHealthCheckMonitoring(intervalMs: number = 60000): NodeJS.Timeout {
	console.log(`Starting logging health check monitoring (every ${intervalMs}ms)`)

	return setInterval(async () => {
		await checkAndLogHealth()
	}, intervalMs)
}
