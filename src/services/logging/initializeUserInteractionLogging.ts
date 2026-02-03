/**
 * Initialize User Interaction Logging
 *
 * Sets up any global listeners or configuration required for user interaction logging.
 * This should be called from extension.ts during activation.
 */

import * as vscode from "vscode"
import { LoggingService } from "./LoggingService"
import { logInteraction } from "./helpers/userInteractionLogger"

export async function initializeUserInteractionLogging(context: vscode.ExtensionContext): Promise<void> {
	console.log("[Logging] Initializing User Interaction Listening...")

	// Log the initialization event
	if (LoggingService.hasInstance()) {
		await logInteraction(
			"system_event",
			"extension",
			"initialize_logging",
			{ sessionId: LoggingService.instance.getSessionId() },
			{ version: context.extension.packageJSON.version },
		)
	}

	// You could potentially add VS Code event listeners here if needed,
	// e.g., for window focus changes or command executions that aren't captured elsewhere.
	// For now, key interactions are captured within the Task class.

	context.subscriptions.push(
		vscode.window.onDidChangeWindowState((e) => {
			if (e.focused && LoggingService.hasInstance()) {
				// Optional: Log when user focuses the window
				// void logInteraction('window_event', 'vscode_window', 'focus');
			}
		}),
	)
}
