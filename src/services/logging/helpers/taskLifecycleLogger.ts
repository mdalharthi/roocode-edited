/**
 * Task Lifecycle Action Logging Helpers
 *
 * Provides centralized logging functions for task lifecycle events
 * (createTask, cancelTask, taskFinished) to ensure consistent logging behavior.
 */

import { ActionLogger } from "./actionLogHelper"
import { LoggingService } from "../LoggingService"
import { collectSystemMetrics, logOperationPerformance, startMetricsTimer } from "./systemMetricsCollector"

// Track task start times and metrics for duration calculation
const taskStartMetrics = new Map<string, { startTime: number; metrics: ReturnType<typeof collectSystemMetrics> }>()

/**
 * Logs the creation of a new task
 * @param inputData The input data for the task (e.g., text prompt, hasImages)
 * @returns ActionLogger instance to track success/failure
 */
export async function logCreateTask(inputData: { text?: string; hasImages?: boolean }): Promise<ActionLogger> {
	const logger = new ActionLogger({
		actionType: "task_lifecycle",
		actionName: "createTask",
		inputData,
	})
	await logger.start()

	// Log performance metrics for task creation within the action context
	await logger.run(async () => {
		const metrics = collectSystemMetrics("task_create", "Task")
		await logOperationPerformance({
			operation_name: "task_create",
			operation_type: "task_lifecycle",
			duration_ms: 0, // Snapshot at creation time
			resource_source: "task_create",
			resource_component: "Task",
			resource_metrics: metrics,
			additional_metrics: {
				has_images: inputData.hasImages || false,
				prompt_length: inputData.text?.length || 0,
			},
		})
	})

	return logger
}

/**
 * Logs task cancellation
 * @returns ActionLogger instance to track success/failure
 */
export async function logCancelTask(): Promise<ActionLogger> {
	const logger = new ActionLogger({
		actionType: "task_lifecycle",
		actionName: "cancelTask",
	})
	await logger.start()

	// Log performance metrics for task cancellation within the action context
	await logger.run(async () => {
		const metrics = collectSystemMetrics("task_cancel", "Task")
		await logOperationPerformance({
			operation_name: "task_cancel",
			operation_type: "task_lifecycle",
			duration_ms: 0,
			resource_source: "task_cancel",
			resource_component: "Task",
			resource_metrics: metrics,
		})
	})

	return logger
}

/**
 * Logs task completion (finished via attempt_completion)
 * @param taskId The task ID
 * @param result The completion result (will be truncated)
 * @param tokenUsage Token usage metrics
 * @param toolUsage Tool usage metrics
 * @param parentTaskId Optional parent task ID for subtasks
 */
export async function logTaskFinished(
	taskId: string,
	result: string,
	tokenUsage: Record<string, any>,
	toolUsage: Record<string, any>,
	parentTaskId?: string,
): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	const logger = new ActionLogger({
		actionType: "task_lifecycle",
		actionName: "taskFinished",
		inputData: {
			taskId,
			result: result.substring(0, 500), // Truncate result for log size
		},
		metadata: {
			tokenUsage,
			toolUsage,
			parentTaskId,
		},
	})
	await logger.start()

	// Log performance metrics for task completion within the action context
	await logger.run(async () => {
		await logger.success()

		const metrics = collectSystemMetrics("task_finished", "Task")
		await logOperationPerformance({
			operation_name: "task_finished",
			operation_type: "task_lifecycle",
			duration_ms: 0, // Duration tracked elsewhere via PerformanceLogger.measure
			resource_source: "task_finished",
			resource_component: "Task",
			resource_metrics: metrics,
			additional_metrics: {
				task_id: taskId,
				result_length: result.length,
				token_usage: tokenUsage,
				tool_usage: toolUsage,
				parent_task_id: parentTaskId,
			},
		})
	})
}

/**
 * Logs activation completed command
 */
export async function logActivationCompleted(): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	const logger = new ActionLogger({
		actionType: "extension_lifecycle",
		actionName: "activationCompleted",
	})
	await logger.start()

	// Log performance metrics for activation completion within the action context
	await logger.run(async () => {
		await logger.success()

		const metrics = collectSystemMetrics("activation_completed", "Extension")
		await logOperationPerformance({
			operation_name: "activation_completed",
			operation_type: "extension_lifecycle",
			duration_ms: 0,
			resource_source: "activation_completed",
			resource_component: "Extension",
			resource_metrics: metrics,
		})
	})
}
