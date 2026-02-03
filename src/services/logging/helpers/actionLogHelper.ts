/**
 * Action Log Helpers
 *
 * Provides convenient utilities for logging actions throughout the extension.
 * Actions represent high-level operations that users or the system perform.
 */

import { LoggingService } from "../LoggingService"

export interface ActionContext {
	actionType: string
	actionName: string
	userId?: string
	workspaceId?: string
	inputData?: Record<string, any>
	metadata?: Record<string, any>
}

export interface ActionResult {
	status: "success" | "error" | "pending"
	outputData?: Record<string, any>
	errorMessage?: string
	errorStack?: string
	responseCode?: number
}

/**
 * Log a simple action (fire-and-forget)
 */
export async function logAction(context: ActionContext, result?: ActionResult): Promise<number | null> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return null
	}

	return await LoggingService.instance.logAction({
		action_type: context.actionType,
		action_name: context.actionName,
		user_id: context.userId,
		workspace_id: context.workspaceId,
		input_data: context.inputData,
		action_metadata: context.metadata,
		status: result?.status || "pending",
		output_data: result?.outputData,
		error_message: result?.errorMessage,
		error_stack: result?.errorStack,
		response_code: result?.responseCode,
	})
}

/**
 * Class for managing multi-step actions with automatic timing
 */
export class ActionLogger {
	private logId: number | null = null
	private startTime: number
	private context: ActionContext

	constructor(context: ActionContext) {
		this.context = context
		this.startTime = Date.now()
	}

	/**
	 * Start the action (creates log entry)
	 */
	async start(): Promise<void> {
		if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
			return
		}

		this.logId = await LoggingService.instance.logAction({
			action_type: this.context.actionType,
			action_name: this.context.actionName,
			user_id: this.context.userId,
			workspace_id: this.context.workspaceId,
			input_data: this.context.inputData,
			action_metadata: this.context.metadata,
			status: "pending",
		})

		this.startTime = Date.now()
	}

	/**
	 * Complete the action successfully
	 */
	async success(outputData?: Record<string, any>): Promise<void> {
		if (!this.logId || !LoggingService.hasInstance()) {
			return
		}

		const duration = Date.now() - this.startTime

		await LoggingService.instance.updateActionLog(this.logId, {
			status: "success",
			output_data: outputData,
			duration,
		})
	}

	/**
	 * Mark the action as failed
	 */
	async error(error: Error | string, responseCode?: number): Promise<void> {
		if (!this.logId || !LoggingService.hasInstance()) {
			return
		}

		const duration = Date.now() - this.startTime
		const errorMessage = error instanceof Error ? error.message : error
		const errorStack = error instanceof Error ? error.stack : undefined

		await LoggingService.instance.updateActionLog(this.logId, {
			status: "error",
			error_message: errorMessage,
			error_stack: errorStack,
			response_code: responseCode,
			duration,
		})
	}

	/**
	 * Update action with partial data
	 */
	async update(updates: Partial<ActionResult>): Promise<void> {
		if (!this.logId || !LoggingService.hasInstance()) {
			return
		}

		await LoggingService.instance.updateActionLog(this.logId, {
			status: updates.status,
			output_data: updates.outputData,
			error_message: updates.errorMessage,
			error_stack: updates.errorStack,
			response_code: updates.responseCode,
		})
	}

	/**
	 * Get the action log ID for linking related logs
	 */
	getLogId(): number | null {
		return this.logId
	}
}

/**
 * Decorator for automatic action logging
 */
export function LogAction(actionType: string, actionName?: string) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value

		descriptor.value = async function (...args: any[]) {
			const logger = new ActionLogger({
				actionType,
				actionName: actionName || propertyKey,
				inputData: { args },
			})

			await logger.start()

			try {
				const result = await originalMethod.apply(this, args)
				await logger.success({ result })
				return result
			} catch (error) {
				await logger.error(error as Error)
				throw error
			}
		}

		return descriptor
	}
}

/**
 * Higher-order function for wrapping actions with logging
 */
export function withActionLogging<T>(context: ActionContext, fn: () => Promise<T>): Promise<T> {
	return (async function (): Promise<T> {
		const logger = new ActionLogger(context)
		await logger.start()

		try {
			const result = await fn()
			await logger.success({ result: result as any })
			return result
		} catch (error) {
			await logger.error(error as Error)
			throw error
		}
	})()
}

// ========================================
// Convenience functions for common actions
// ========================================

/**
 * Log a command execution
 */
export async function logCommandExecution(
	commandId: string,
	args?: any[],
	userId?: string,
	workspaceId?: string,
): Promise<ActionLogger> {
	const logger = new ActionLogger({
		actionType: "command_execution",
		actionName: commandId,
		userId,
		workspaceId,
		inputData: args ? { args } : undefined,
	})

	await logger.start()
	return logger
}

/**
 * Log a user interaction
 */
export async function logUserInteraction(
	interactionType: string,
	component: string,
	action?: string,
	context?: Record<string, any>,
): Promise<ActionLogger> {
	const logger = new ActionLogger({
		actionType: "user_interaction",
		actionName: interactionType,
		inputData: context,
		metadata: { component, action },
	})

	await logger.start()
	return logger
}

/**
 * Log an API request
 */
export async function logApiRequest(
	provider: string,
	endpoint: string,
	method: string = "POST",
): Promise<ActionLogger> {
	const logger = new ActionLogger({
		actionType: "api_request",
		actionName: `${provider}_${method}`,
		metadata: { provider, endpoint, method },
	})

	await logger.start()
	return logger
}

/**
 * Log a file operation
 */
export async function logFileOperation(
	operation: "read" | "write" | "delete" | "rename",
	filePath: string,
	mode?: string,
): Promise<ActionLogger> {
	const logger = new ActionLogger({
		actionType: "file_operation",
		actionName: operation,
		metadata: { filePath, mode },
	})

	await logger.start()
	return logger
}

/**
 * Log an extension lifecycle event
 */
export async function logExtensionEvent(
	eventName: "activation" | "deactivation" | "configuration_change",
	details?: Record<string, any>,
): Promise<number | null> {
	return await logAction(
		{
			actionType: "extension_lifecycle",
			actionName: eventName,
			metadata: details,
		},
		{ status: "success" },
	)
}
