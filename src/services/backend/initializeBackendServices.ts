import * as vscode from "vscode"
import * as os from "os"
import { Package } from "../../shared/package"

/**
 * Gets the system username safely
 * @returns The system username or "unknown" if unable to retrieve
 */
function getSystemUserId(): string {
	try {
		return os.userInfo().username || "unknown"
	} catch {
		// os.userInfo() can throw on some systems
		return process.env.USER || process.env.USERNAME || "unknown"
	}
}

/**
 * Initializes backend services including logging and version tracking
 * @param outputChannel The output channel for logging messages
 * @returns Promise that resolves when initialization is complete (throws on critical errors)
 */
export async function initializeBackendServices(outputChannel: vscode.OutputChannel): Promise<void> {
	const backendApiUrl = process.env.BACKEND_API_URL
	const backendApiKey = process.env.BACKEND_API_KEY
	const useBackendApi = process.env.USE_BACKEND_API === "true"

	if (!useBackendApi) {
		outputChannel.appendLine(`[Backend] Services disabled (USE_BACKEND_API=${process.env.USE_BACKEND_API})`)
	} else if (!backendApiUrl || !backendApiKey) {
		outputChannel.appendLine(
			`[Backend] Services disabled due to missing credentials (URL=${!!backendApiUrl}, Key=${!!backendApiKey})`,
		)
	}

	if (useBackendApi && backendApiUrl && backendApiKey) {
		// Get the system user ID and verify against Active Directory
		let systemUserId = getSystemUserId()

		// Verify user against Active Directory
		try {
			const { verifyUserWithLDAP } = await import("./ldapService")
			outputChannel.appendLine(`[Backend] Verifying user '${systemUserId}' against Active Directory...`)

			const ldapResult = await verifyUserWithLDAP(systemUserId, backendApiUrl, backendApiKey)

			if (ldapResult.verified) {
				outputChannel.appendLine(`[Backend] User '${systemUserId}' verified in AD`)
				if (ldapResult.displayName) {
					outputChannel.appendLine(`[Backend] Display name: ${ldapResult.displayName}`)
				}
			} else {
				outputChannel.appendLine(`[Backend] User '${systemUserId}' not found in AD, using 'unknown'`)
				systemUserId = "unknown"
			}
		} catch (error) {
			outputChannel.appendLine(
				`[Backend] LDAP verification failed: ${error instanceof Error ? error.message : String(error)}`,
			)
			// Keep the original username if verification fails
			outputChannel.appendLine(`[Backend] Continuing with unverified user: ${systemUserId}`)
		}

		// Initialize logging service
		try {
			const { LoggingService } = await import("../logging/LoggingService")
			const { v7: uuidv7 } = await import("uuid")

			LoggingService.initialize({
				apiUrl: backendApiUrl,
				apiKey: backendApiKey,
				sessionId: uuidv7(),
				userId: systemUserId,
				enabled: true,
			})
			outputChannel.appendLine(`[Backend] Logging service initialized with user: ${systemUserId}`)

			// Send boot-up test log
			try {
				await LoggingService.instance.logPerformance({
					operation_name: "backend_service_init",
					operation_type: "system_lifecycle",
					duration_ms: 0,
					additional_metrics: {
						timestamp: new Date().toISOString(),
						init_test: true,
					},
				})
				outputChannel.appendLine("[Backend] Boot-up performance log sent")
			} catch (err) {
				outputChannel.appendLine(
					`[Backend] Failed to send boot-up log: ${err instanceof Error ? err.message : String(err)}`,
				)
			}
		} catch (error) {
			outputChannel.appendLine(
				`[Backend] Logging initialization failed: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		// Initialize file operation logging
		try {
			const { initializeFileOperationLogging } = await import("../logging/initializeFileOperationLogging")

			// Note: We need the extension context to properly initialize file operation logging
			// This will be called from extension.ts after context is available
			outputChannel.appendLine("[Backend] File operation logging will be initialized after extension activation")
		} catch (error) {
			outputChannel.appendLine(
				`[Backend] File operation logging setup failed: ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		// Initialize version tracking
		try {
			const { initializeExtensionVersion } = await import("../version")
			await initializeExtensionVersion(Package.version, backendApiUrl, backendApiKey, {
				name: Package.name,
				publisher: Package.publisher,
				sha: Package.sha,
				node_env: process.env.NODE_ENV,
				platform: process.platform,
			})
			outputChannel.appendLine(`[Backend] Version ${Package.version} tracked`)
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error)

			// Check if this is a version lock error
			if (errorMsg.includes("LOCKED") || errorMsg.includes("mismatch")) {
				outputChannel.appendLine(`[Backend] CRITICAL: ${errorMsg}`)

				// Show error dialog to user
				await vscode.window.showErrorMessage(
					`Extension Locked: This version (${Package.version}) is not authorized. ${errorMsg}`,
					{ modal: true },
				)

				// Throw error to prevent extension from activating
				throw new Error(`Extension activation blocked: ${errorMsg}`)
			}

			// Non-critical error
			outputChannel.appendLine(`[Backend] Version tracking failed: ${errorMsg}`)
		}
	} else {
		outputChannel.appendLine("[Backend] Services disabled (USE_BACKEND_API not enabled or missing credentials)")
	}
}
