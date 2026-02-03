import { LoggingService } from "./LoggingService"

/**
 * Helper class for logging performance metrics to the logging service
 */
export class PerformanceLogger {
	/**
	 * Measure the execution time of an asynchronous operation and log it
	 *
	 * @param operationName Name of the operation to measure
	 * @param operationType Type of operation (e.g., 'task_execution', 'database_query')
	 * @param fn The async function to measure
	 * @param metadata Optional metadata to include in the log
	 */
	public static async measure<T>(
		operationName: string,
		operationType: string,
		fn: () => Promise<T>,
		metadata?: Record<string, any>,
	): Promise<T> {
		const startTime = performance.now()
		const startCpu = process.cpuUsage()
		let result: T
		let error: any

		try {
			result = await fn()
			return result
		} catch (e) {
			error = e
			throw e
		} finally {
			const endTime = performance.now()
			const durationMs = endTime - startTime
			const cpuDiff = process.cpuUsage(startCpu)
			const cpuTimeMs = (cpuDiff.user + cpuDiff.system) / 1000
			const memUsage = process.memoryUsage().heapUsed

			console.log(`[PerformanceLogger] Measured ${operationName} (${operationType}): ${durationMs}ms`)

			await this.log(operationName, operationType, durationMs, {
				...metadata,
				success: !error,
				error_message: error instanceof Error ? error.message : String(error),
				cpu_usage_raw: cpuTimeMs,
				memory_usage_raw: memUsage,
			})
		}
	}

	/**
	 * Start a timer manually
	 * Returns a function to call when the operation is complete
	 */
	public static start(operationName: string, operationType: string, metadata?: Record<string, any>): () => void {
		const startTime = performance.now()
		const startCpu = process.cpuUsage()

		return async () => {
			const endTime = performance.now()
			const durationMs = endTime - startTime
			const cpuDiff = process.cpuUsage(startCpu)
			const cpuTimeMs = (cpuDiff.user + cpuDiff.system) / 1000
			const memUsage = process.memoryUsage().heapUsed

			await this.log(operationName, operationType, durationMs, {
				...metadata,
				cpu_usage_raw: cpuTimeMs,
				memory_usage_raw: memUsage,
			})
		}
	}

	/**
	 * Log a performance metric
	 */
	private static async log(
		operationName: string,
		operationType: string,
		durationMs: number,
		metadata?: Record<string, any>,
	): Promise<void> {
		try {
			if (!LoggingService.hasInstance()) {
				console.warn("[PerformanceLogger] LoggingService not initialized, skipping log")
				return
			}

			console.log(`[PerformanceLogger] Logging metric: ${operationName}`)

			// Extract generic resource metrics if available in metadata
			const resourceMetrics: Record<string, any> = {}

			// Prioritize raw metrics passed from measure/start
			if (metadata?.memory_usage_raw) {
				resourceMetrics.memory_usage = metadata.memory_usage_raw
				resourceMetrics.memory_usage_mb = Math.round((metadata.memory_usage_raw / 1024 / 1024) * 100) / 100
			} else if (metadata?.memoryUsage) {
				resourceMetrics.memory_usage = metadata.memoryUsage
			}

			if (metadata?.cpu_usage_raw) {
				resourceMetrics.cpu_usage = metadata.cpu_usage_raw
			} else if (metadata?.cpuUsage) {
				resourceMetrics.cpu_usage = metadata.cpuUsage
			}

			// File size
			const fileSizeBytes = metadata?.file_size_bytes ?? metadata?.fileSize ?? undefined

			await LoggingService.instance.logPerformance({
				operation_name: operationName,
				operation_type: operationType,
				duration_ms: durationMs,
				cpu_usage: resourceMetrics.cpu_usage,
				memory_usage: resourceMetrics.memory_usage,
				memory_usage_mb: resourceMetrics.memory_usage_mb,
				file_size_bytes: fileSizeBytes,
				resource_metrics: Object.keys(resourceMetrics).length > 0 ? resourceMetrics : undefined,
				additional_metrics: metadata,
			})
		} catch (error) {
			console.error("[PerformanceLogger] Failed to log metric:", error)
		}
	}
}
