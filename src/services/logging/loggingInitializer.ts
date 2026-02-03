import * as vscode from "vscode"

/**
 * Initialize all logging systems for the extension.
 * This aggregates file operation logging and user interaction logging initialization.
 *
 * @param context - The extension context
 * @param outputChannel - The output channel to log status messages to
 */
export async function initializeLoggingSystems(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<void> {
	// Initialize file operation logging
	try {
		const { initializeFileOperationLogging } = await import("./initializeFileOperationLogging")
		const fileOpDisposable = await initializeFileOperationLogging(context, outputChannel)
		context.subscriptions.push(fileOpDisposable)
		outputChannel.appendLine("[Extension] File operation logging initialized successfully")
	} catch (error) {
		outputChannel.appendLine(
			`[Extension] File operation logging initialization failed: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	// Initialize user interaction logging
	try {
		const { initializeUserInteractionLogging } = await import("./initializeUserInteractionLogging")
		await initializeUserInteractionLogging(context)
		outputChannel.appendLine("[Extension] User interaction logging initialized successfully")
	} catch (error) {
		outputChannel.appendLine(
			`[Extension] User interaction logging initialization failed: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}
