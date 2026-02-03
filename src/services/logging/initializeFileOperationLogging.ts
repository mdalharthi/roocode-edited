/**
 * Initialize File Operation Logging
 *
 * This service initializes all file operation logging capabilities:
 * - Automatic capture of VSCode file events
 * - Text document change tracking
 * - File system watcher integration
 *
 * Call this during extension activation to enable file operation logging.
 *
 * @example
 * ```typescript
 * import { initializeFileOperationLogging } from './services/logging/initializeFileOperationLogging';
 *
 * // In extension.ts activate()
 * const disposable = await initializeFileOperationLogging(context, outputChannel);
 * context.subscriptions.push(disposable);
 * ```
 */

import * as vscode from "vscode"
import { initializeFileOperationCapture } from "./helpers/fileOperationCapture"
import { LoggingService } from "./LoggingService"

/**
 * Initialize file operation logging
 */
export async function initializeFileOperationLogging(
	context: vscode.ExtensionContext,
	outputChannel?: vscode.OutputChannel,
): Promise<vscode.Disposable> {
	const disposables: vscode.Disposable[] = []

	try {
		// Check if logging service is initialized
		if (!LoggingService.hasInstance()) {
			outputChannel?.appendLine(
				"[FileOperationLogging] LoggingService not initialized. File operation logging will be disabled.",
			)
			return new vscode.Disposable(() => {})
		}

		if (!LoggingService.instance.isEnabled()) {
			outputChannel?.appendLine(
				"[FileOperationLogging] LoggingService is disabled. File operation logging will not start.",
			)
			return new vscode.Disposable(() => {})
		}

		// Initialize file operation capture
		const captureDisposable = initializeFileOperationCapture(context)
		disposables.push(captureDisposable)

		outputChannel?.appendLine("[FileOperationLogging] File operation logging initialized successfully")
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		outputChannel?.appendLine(`[FileOperationLogging] Failed to initialize: ${errorMsg}`)
		console.error("[FileOperationLogging] Initialization error:", error)
	}

	return vscode.Disposable.from(...disposables)
}

/**
 * Shutdown file operation logging
 */
export async function shutdownFileOperationLogging(outputChannel?: vscode.OutputChannel): Promise<void> {
	try {
		outputChannel?.appendLine("[FileOperationLogging] Shutting down file operation logging")
		// Any cleanup needed
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error)
		outputChannel?.appendLine(`[FileOperationLogging] Shutdown error: ${errorMsg}`)
		console.error("[FileOperationLogging] Shutdown error:", error)
	}
}
