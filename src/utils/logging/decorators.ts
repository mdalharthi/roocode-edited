/**
 * Logging Decorators
 *
 * Method decorators to automatically log function executions with minimal boilerplate.
 *
 * @example
 * ```typescript
 * class MyService {
 *   @LogExecution('my_operation')
 *   async doSomething(param: string) {
 *     // Method logic
 *   }
 *
 *   @LogPerformance('heavy_operation')
 *   async heavyOperation() {
 *     // This will automatically log performance metrics
 *   }
 * }
 * ```
 */

import { LoggingService } from "../../services/logging/LoggingService"
import { PerformanceTimer, getMemoryUsageMB } from "./helpers"

/**
 * Decorator to log method execution as an action log
 */
export function LogExecution(actionName: string, actionType: string = "function_execution") {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value

		descriptor.value = async function (...args: any[]) {
			const timer = new PerformanceTimer()
			let actionLogId: number | null = null

			try {
				// Create initial log
				if (LoggingService.hasInstance() && LoggingService.instance.isEnabled()) {
					actionLogId = await LoggingService.instance.logAction({
						action_type: actionType,
						action_name: actionName,
						status: "pending",
						input_data: { args: args.map(String) },
					})
				}

				// Execute method
				const result = await originalMethod.apply(this, args)

				// Update log with success
				if (actionLogId && LoggingService.hasInstance()) {
					await LoggingService.instance.updateActionLog(actionLogId, {
						status: "success",
						duration: timer.getDuration(),
						output_data: { result: String(result) },
					})
				}

				return result
			} catch (error) {
				// Update log with failure
				if (actionLogId && LoggingService.hasInstance()) {
					await LoggingService.instance.updateActionLog(actionLogId, {
						status: "failed",
						error_message: error instanceof Error ? error.message : String(error),
						error_stack: error instanceof Error ? error.stack : undefined,
						duration: timer.getDuration(),
					})
				}

				throw error
			}
		}

		return descriptor
	}
}

/**
 * Decorator to log method performance
 */
export function LogPerformance(operationName: string, operationType: string = "function") {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value

		descriptor.value = async function (...args: any[]) {
			const timer = new PerformanceTimer()
			const memoryBefore = getMemoryUsageMB()

			try {
				const result = await originalMethod.apply(this, args)

				// Log performance
				if (LoggingService.hasInstance() && LoggingService.instance.isEnabled()) {
					const memoryAfter = getMemoryUsageMB()

					await LoggingService.instance.logPerformance({
						operation_name: operationName,
						operation_type: operationType,
						duration_ms: timer.getDuration(),
						memory_usage_mb: memoryAfter,
						additional_metrics: {
							memory_delta_mb: memoryAfter - memoryBefore,
							function: propertyKey,
						},
					})
				}

				return result
			} catch (error) {
				// Still log performance even on error
				if (LoggingService.hasInstance() && LoggingService.instance.isEnabled()) {
					const memoryAfter = getMemoryUsageMB()

					await LoggingService.instance.logPerformance({
						operation_name: operationName,
						operation_type: operationType,
						duration_ms: timer.getDuration(),
						memory_usage_mb: memoryAfter,
						additional_metrics: {
							memory_delta_mb: memoryAfter - memoryBefore,
							function: propertyKey,
							error: error instanceof Error ? error.message : String(error),
						},
					})
				}

				throw error
			}
		}

		return descriptor
	}
}

/**
 * Decorator to log API calls
 */
export function LogApiCall(provider: string, getModel?: () => string) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value

		descriptor.value = async function (...args: any[]) {
			const timer = new PerformanceTimer()
			const model = getModel ? getModel.call(this) : "unknown"

			try {
				const result = await originalMethod.apply(this, args)

				// Log API call
				if (LoggingService.hasInstance() && LoggingService.instance.isEnabled()) {
					await LoggingService.instance.logApiCall({
						provider,
						model,
						method: "POST",
						duration_ms: timer.getDuration(),
						tokens_used: result?.usage?.total_tokens,
						status_code: 200,
					})
				}

				return result
			} catch (error) {
				// Log failed API call
				if (LoggingService.hasInstance() && LoggingService.instance.isEnabled()) {
					await LoggingService.instance.logApiCall({
						provider,
						model,
						method: "POST",
						duration_ms: timer.getDuration(),
						error_message: error instanceof Error ? error.message : String(error),
						status_code: 500,
					})
				}

				throw error
			}
		}

		return descriptor
	}
}

/**
 * Decorator to log user interactions (for UI event handlers)
 */
export function LogUserInteraction(interactionType: string, component: string) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value

		descriptor.value = async function (...args: any[]) {
			try {
				const result = await originalMethod.apply(this, args)

				// Log interaction
				if (LoggingService.hasInstance() && LoggingService.instance.isEnabled()) {
					void LoggingService.instance.logUserInteraction({
						interaction_type: interactionType,
						component,
						action: propertyKey,
						result: "success",
						context: { args: args.map(String) },
					})
				}

				return result
			} catch (error) {
				// Log failed interaction
				if (LoggingService.hasInstance() && LoggingService.instance.isEnabled()) {
					void LoggingService.instance.logUserInteraction({
						interaction_type: interactionType,
						component,
						action: propertyKey,
						result: "failed",
						context: {
							args: args.map(String),
							error: error instanceof Error ? error.message : String(error),
						},
					})
				}

				throw error
			}
		}

		return descriptor
	}
}
