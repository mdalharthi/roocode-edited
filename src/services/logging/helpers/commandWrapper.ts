/**
 * Command Wrapper with Action Logging
 *
 * This module provides a wrapper function to automatically log all command executions.
 * Use this when registering VSCode commands to ensure they're tracked in action logs.
 */

import * as vscode from "vscode"
import { ActionLogger } from "../helpers/actionLogHelper"

export interface CommandOptions {
	/** User ID for logging (optional) */
	userId?: string
	/** Workspace ID for logging (optional) */
	workspaceId?: string
	/** Additional metadata (optional) */
	metadata?: Record<string, any>
}

/**
 * Wraps a command handler with automatic action logging
 *
 * @example
 * ```typescript
 * context.subscriptions.push(
 *   vscode.commands.registerCommand(
 *     'myExt.doSomething',
 *     wrapCommandWithLogging('myExt.doSomething', async (...args) => {
 *       // Your command logic here
 *       return { success: true };
 *     })
 *   )
 * );
 * ```
 */
export function wrapCommandWithLogging<T extends (...args: any[]) => any>(
	commandId: string,
	handler: T,
	options?: CommandOptions,
): T {
	return (async (...args: any[]) => {
		const logger = new ActionLogger({
			actionType: "command_execution",
			actionName: commandId,
			userId: options?.userId,
			workspaceId: options?.workspaceId,
			inputData: { args },
			metadata: options?.metadata,
		})

		await logger.start()

		try {
			const result = await handler(...args)
			await logger.success({ result })
			return result
		} catch (error) {
			await logger.error(error as Error)
			throw error
		}
	}) as T
}

/**
 * Register a command with automatic action logging
 *
 * @example
 * ```typescript
 * registerCommandWithLogging(
 *   context,
 *   'myExt.doSomething',
 *   async (...args) => {
 *     // Your command logic
 *   }
 * );
 * ```
 */
export function registerCommandWithLogging(
	context: vscode.ExtensionContext,
	commandId: string,
	handler: (...args: any[]) => any,
	options?: CommandOptions,
): vscode.Disposable {
	const wrappedHandler = wrapCommandWithLogging(commandId, handler, options)
	const disposable = vscode.commands.registerCommand(commandId, wrappedHandler)
	context.subscriptions.push(disposable)
	return disposable
}

/**
 * Register multiple commands with action logging
 *
 * @example
 * ```typescript
 * registerCommandsWithLogging(context, {
 *   'myExt.command1': async () => { / * ... * / },
 *   'myExt.command2': async (arg) => { / * ... * / },
 * });
 * ```
 */
export function registerCommandsWithLogging(
	context: vscode.ExtensionContext,
	commands: Record<string, (...args: any[]) => any>,
	options?: CommandOptions,
): vscode.Disposable[] {
	const disposables: vscode.Disposable[] = []

	for (const [commandId, handler] of Object.entries(commands)) {
		const disposable = registerCommandWithLogging(context, commandId, handler, options)
		disposables.push(disposable)
	}

	return disposables
}
