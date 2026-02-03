/**
 * System Metrics Collector
 *
 * Centralized utility for collecting system metrics (CPU, memory, process)
 * with resource source identification for performance logging.
 *
 * @example
 * ```typescript
 * import { collectSystemMetrics, logOperationPerformance } from './systemMetricsCollector';
 *
 * // Collect metrics at start of operation
 * const startMetrics = collectSystemMetrics('api_call', 'anthropic');
 *
 * // ... perform operation ...
 *
 * // Log performance with collected metrics
 * await logOperationPerformance({
 *     operation_name: 'llm_create_message',
 *     operation_type: 'api_call',
 *     duration_ms: 1500,
 *     resource_metrics: startMetrics,
 * });
 * ```
 */

import * as os from "os"
import { LoggingService } from "../LoggingService"

/**
 * Structure for collected system metrics
 */
export interface SystemMetrics {
	// CPU metrics (in milliseconds) - process CPU time
	cpu_user_ms: number
	cpu_system_ms: number
	cpu_total_ms: number

	// CPU utilization (0-100 percentage) - system-wide CPU usage
	cpu_utilization_percent: number

	// Memory metrics (in MB for readability)
	memory_heap_used_mb: number
	memory_heap_total_mb: number
	memory_rss_mb: number
	memory_external_mb: number
	memory_array_buffers_mb: number

	// Process metrics
	uptime_seconds: number

	// Resource identification
	resource_source: string // What triggered the collection (e.g., "api_call", "file_write")
	resource_component: string // Which component (e.g., "anthropic", "WriteToFileTool")

	// Timestamp for correlation
	collected_at: string
}

/**
 * Structure for metrics delta (difference between two snapshots)
 */
export interface MetricsDelta {
	cpu_delta_ms: number
	memory_heap_delta_mb: number
	memory_rss_delta_mb: number
	duration_ms: number
}

/**
 * Options for performance logging
 */
export interface PerformanceLogOptions {
	operation_name: string
	operation_type: string
	duration_ms: number
	resource_source?: string
	resource_component?: string
	file_size_bytes?: number
	throughput?: number
	action_log_id?: number
	resource_metrics?: SystemMetrics | Record<string, any>
	additional_metrics?: Record<string, any>
}

/**
 * Convert bytes to megabytes with 2 decimal precision
 */
function bytesToMB(bytes: number): number {
	return Math.round((bytes / 1024 / 1024) * 100) / 100
}

/**
 * Convert microseconds to milliseconds with 2 decimal precision
 */
function microToMs(micro: number): number {
	return Math.round((micro / 1000) * 100) / 100
}

/**
 * Calculate current CPU utilization percentage (0-100) across all cores
 * This is the percentage of CPU time that is NOT idle
 */
function getCpuUtilization(): number {
	const cpus = os.cpus()
	let totalIdle = 0
	let totalTick = 0

	for (const cpu of cpus) {
		const times = cpu.times
		totalIdle += times.idle
		totalTick += times.user + times.nice + times.sys + times.idle + times.irq
	}

	// Calculate utilization: (total non-idle time / total time) * 100
	const utilization = totalTick > 0 ? Math.round(((totalTick - totalIdle) / totalTick) * 100 * 100) / 100 : 0

	return Math.min(100, Math.max(0, utilization))
}

/**
 * Collect current system metrics snapshot
 *
 * @param resourceSource - What triggered this metric collection (e.g., "api_call", "file_write", "task_start")
 * @param resourceComponent - Which component is being measured (e.g., "anthropic", "WriteToFileTool", "Task")
 * @returns SystemMetrics snapshot
 */
export function collectSystemMetrics(resourceSource: string, resourceComponent: string): SystemMetrics {
	const cpuUsage = process.cpuUsage()
	const memUsage = process.memoryUsage()

	return {
		// CPU metrics (process CPU time in ms)
		cpu_user_ms: microToMs(cpuUsage.user),
		cpu_system_ms: microToMs(cpuUsage.system),
		cpu_total_ms: microToMs(cpuUsage.user + cpuUsage.system),

		// CPU utilization (system-wide, 0-100%)
		cpu_utilization_percent: getCpuUtilization(),

		// Memory metrics
		memory_heap_used_mb: bytesToMB(memUsage.heapUsed),
		memory_heap_total_mb: bytesToMB(memUsage.heapTotal),
		memory_rss_mb: bytesToMB(memUsage.rss),
		memory_external_mb: bytesToMB(memUsage.external),
		memory_array_buffers_mb: bytesToMB(memUsage.arrayBuffers),

		// Process metrics
		uptime_seconds: Math.round(process.uptime() * 100) / 100,

		// Resource identification
		resource_source: resourceSource,
		resource_component: resourceComponent,

		// Timestamp
		collected_at: new Date().toISOString(),
	}
}

/**
 * Calculate delta between two metric snapshots
 *
 * @param start - Metrics collected at start of operation
 * @param end - Metrics collected at end of operation
 * @returns MetricsDelta with differences
 */
export function calculateMetricsDelta(start: SystemMetrics, end: SystemMetrics): MetricsDelta {
	return {
		cpu_delta_ms: Math.round((end.cpu_total_ms - start.cpu_total_ms) * 100) / 100,
		memory_heap_delta_mb: Math.round((end.memory_heap_used_mb - start.memory_heap_used_mb) * 100) / 100,
		memory_rss_delta_mb: Math.round((end.memory_rss_mb - start.memory_rss_mb) * 100) / 100,
		duration_ms: Math.round((end.uptime_seconds - start.uptime_seconds) * 1000),
	}
}

/**
 * Log performance metrics for an operation
 *
 * @param options - Performance log options including operation details and metrics
 */
export async function logOperationPerformance(options: PerformanceLogOptions): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	try {
		// Get CPU utilization percentage from metrics
		// Uses system-wide CPU utilization (0-100%) captured via os.cpus()
		let cpuUsagePercent: number = 0

		if (options.resource_metrics && typeof options.resource_metrics === "object") {
			const metrics = options.resource_metrics as Record<string, any>

			// Use cpu_utilization_percent if available (from collectSystemMetrics)
			if ("cpu_utilization_percent" in metrics && typeof metrics.cpu_utilization_percent === "number") {
				cpuUsagePercent = metrics.cpu_utilization_percent
			}
			// Check end metrics if we have start/end structure
			else if (metrics.end && typeof metrics.end === "object" && "cpu_utilization_percent" in metrics.end) {
				cpuUsagePercent = metrics.end.cpu_utilization_percent
			}
		}

		await LoggingService.instance.logPerformance({
			operation_name: options.operation_name,
			operation_type: options.operation_type,
			duration_ms: options.duration_ms,
			file_size_bytes: options.file_size_bytes,
			throughput: options.throughput,
			action_log_id: options.action_log_id,
			cpu_usage: cpuUsagePercent,
			memory_usage:
				options.resource_metrics && "memory_heap_used_mb" in options.resource_metrics
					? Math.round((options.resource_metrics as any).memory_heap_used_mb * 1024 * 1024)
					: undefined,
			memory_usage_mb:
				options.resource_metrics && "memory_heap_used_mb" in options.resource_metrics
					? (options.resource_metrics as any).memory_heap_used_mb
					: undefined,
			resource_metrics: {
				resource_source: options.resource_source,
				resource_component: options.resource_component,
				...options.resource_metrics,
			},
			additional_metrics: options.additional_metrics,
		})
	} catch (error) {
		console.error("[SystemMetricsCollector] Failed to log performance:", error)
	}
}

/**
 * Measure an async operation and log its performance with system metrics
 *
 * @param operationName - Name of the operation
 * @param operationType - Type category (e.g., "api_call", "file_operation", "task_lifecycle")
 * @param resourceSource - What triggered this (e.g., "llm_request", "file_write")
 * @param resourceComponent - Component name (e.g., "anthropic", "WriteToFileTool")
 * @param operation - Async function to measure
 * @param additionalMetrics - Optional additional metadata
 * @returns Result of the operation
 */
export async function measureWithSystemMetrics<T>(
	operationName: string,
	operationType: string,
	resourceSource: string,
	resourceComponent: string,
	operation: () => Promise<T>,
	additionalMetrics?: Record<string, any>,
): Promise<T> {
	const startTime = Date.now()
	const startMetrics = collectSystemMetrics(resourceSource, resourceComponent)
	let result: T
	let error: any

	try {
		result = await operation()
		return result
	} catch (e) {
		error = e
		throw e
	} finally {
		const endTime = Date.now()
		const duration = endTime - startTime
		const endMetrics = collectSystemMetrics(`${resourceSource}_complete`, resourceComponent)
		const delta = calculateMetricsDelta(startMetrics, endMetrics)

		await logOperationPerformance({
			operation_name: operationName,
			operation_type: operationType,
			duration_ms: duration,
			resource_source: resourceSource,
			resource_component: resourceComponent,
			resource_metrics: {
				start: startMetrics,
				end: endMetrics,
				delta,
			},
			additional_metrics: {
				...additionalMetrics,
				success: !error,
				error_message: error instanceof Error ? error.message : undefined,
			},
		})
	}
}

/**
 * Create a timer that captures system metrics at start, allowing stop to be called later
 *
 * @param resourceSource - What triggered this
 * @param resourceComponent - Component name
 * @returns Object with stop() method to complete measurement
 */
export function startMetricsTimer(
	resourceSource: string,
	resourceComponent: string,
): {
	startMetrics: SystemMetrics
	startTime: number
	stop: (operationName: string, operationType: string, additionalMetrics?: Record<string, any>) => Promise<void>
} {
	const startTime = Date.now()
	const startMetrics = collectSystemMetrics(resourceSource, resourceComponent)

	return {
		startMetrics,
		startTime,
		stop: async (
			operationName: string,
			operationType: string,
			additionalMetrics?: Record<string, any>,
		): Promise<void> => {
			const endTime = Date.now()
			const duration = endTime - startTime
			const endMetrics = collectSystemMetrics(`${resourceSource}_complete`, resourceComponent)
			const delta = calculateMetricsDelta(startMetrics, endMetrics)

			await logOperationPerformance({
				operation_name: operationName,
				operation_type: operationType,
				duration_ms: duration,
				resource_source: resourceSource,
				resource_component: resourceComponent,
				resource_metrics: {
					start: startMetrics,
					end: endMetrics,
					delta,
				},
				additional_metrics: additionalMetrics,
			})
		},
	}
}
