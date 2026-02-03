import * as vscode from "vscode"
import { logExtensionDeactivation } from "./initializeActionLogging"
import { LoggingService } from "./LoggingService"

/**
 * Handles all logging cleanup operations during extension deactivation.
 * This includes logging the deactivation event and shutting down the logging service.
 * @param outputChannel The output channel for logging messages
 */
export async function cleanupLoggingOnDeactivation(outputChannel: vscode.OutputChannel): Promise<void> {
	// Log extension deactivation
	await logExtensionDeactivation(outputChannel)

	// Cleanup logging service
	try {
		if (LoggingService.hasInstance()) {
			await LoggingService.instance.shutdown()
			outputChannel.appendLine("[LoggingService] Backend logging shutdown complete")
		}
	} catch (error) {
		outputChannel.appendLine(
			`[LoggingService] Shutdown error: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}
