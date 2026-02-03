/**
 * Command Execution Logger
 *
 * Provides logging utilities for command executions with output capture
 * and performance tracking.
 */

import { LoggingService } from "../../services/logging/LoggingService"
import { PerformanceTimer, truncateString } from "../logging/helpers"

export interface CommandExecutionContext {
	sessionId?: string
	cwd?: string
}

/**
 * Log a command execution
 */
export async function logCommandExecution(
	command: string,
	exitCode: number,
	stdout: string,
	stderr: string,
	duration: number,
	context: CommandExecutionContext = {},
): Promise<number | null> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return null
	}

	try {
		const status = exitCode === 0 ? "success" : "failed"

		return await LoggingService.instance.logAction({
			session_id: context.sessionId,
			action_type: "command_execution",
			action_name: "terminal_command",
			status,
			input_data: {
				command: truncateString(command, 500),
				cwd: context.cwd,
			},
			output_data: {
				stdout: truncateString(stdout, 1000),
				stderr: truncateString(stderr, 1000),
			},
			response_code: exitCode,
			duration,
		})
	} catch (error) {
		console.error("[CommandExecutionLogger] Failed to log command:", error)
		return null
	}
}

/**
 * Wrap a command execution with automatic logging
 */
export async function withCommandLogging<T extends { exitCode?: number; stdout?: string; stderr?: string }>(
	command: string,
	commandFn: () => Promise<T>,
	context: CommandExecutionContext = {},
): Promise<T> {
	const timer = new PerformanceTimer()

	try {
		const result = await commandFn()
		const duration = timer.getDuration()

		// Log the command execution
		await logCommandExecution(
			command,
			result.exitCode ?? 0,
			result.stdout ?? "",
			result.stderr ?? "",
			duration,
			context,
		)

		return result
	} catch (error) {
		const duration = timer.getDuration()
		const errorMessage = error instanceof Error ? error.message : String(error)

		// Log failed command
		await logCommandExecution(command, 1, "", errorMessage, duration, context)

		throw error
	}
}
