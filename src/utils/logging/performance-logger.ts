/**
 * Performance Logging Utilities
 *
 * Utilities for logging performance metrics of heavy operations.
 */

import { LoggingService } from "../../services/logging/LoggingService"
import { PerformanceTimer, getMemoryUsageMB } from "./helpers"

export interface PerformanceContext {
	sessionId?: string
	actionLogId?: number
}

/**
 * Wrap a heavy operation with performance logging
 */
export async function withPerformanceLogging<T>(
	operationName: string,
	operationType: string,
	operation: () => Promise<T>,
	context: PerformanceContext = {},
): Promise<T> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return operation()
	}

	const timer = new PerformanceTimer()
	const memoryBefore = getMemoryUsageMB()

	try {
		const result = await operation()
		const duration = timer.getDuration()
		const memoryAfter = getMemoryUsageMB()

		// Log performance
		await LoggingService.instance.logPerformance({
			session_id: context.sessionId,
			action_log_id: context.actionLogId,
			operation_name: operationName,
			operation_type: operationType,
			duration_ms: duration,
			memory_usage_mb: memoryAfter,
			additional_metrics: {
				memory_delta_mb: memoryAfter - memoryBefore,
			},
		})

		return result
	} catch (error) {
		const duration = timer.getDuration()
		const memoryAfter = getMemoryUsageMB()

		// Log performance even on error
		await LoggingService.instance.logPerformance({
			session_id: context.sessionId,
			action_log_id: context.actionLogId,
			operation_name: operationName,
			operation_type: operationType,
			duration_ms: duration,
			memory_usage_mb: memoryAfter,
			additional_metrics: {
				memory_delta_mb: memoryAfter - memoryBefore,
				error: error instanceof Error ? error.message : String(error),
			},
		})

		throw error
	}
}

/**
 * Log performance metrics for a completed operation
 */
export async function logPerformanceMetrics(
	operationName: string,
	operationType: string,
	duration: number,
	additionalMetrics?: Record<string, any>,
	context: PerformanceContext = {},
): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	try {
		await LoggingService.instance.logPerformance({
			session_id: context.sessionId,
			action_log_id: context.actionLogId,
			operation_name: operationName,
			operation_type: operationType,
			duration_ms: duration,
			memory_usage_mb: getMemoryUsageMB(),
			additional_metrics: additionalMetrics,
		})
	} catch (error) {
		console.error("[PerformanceLogger] Failed to log performance:", error)
	}
}
