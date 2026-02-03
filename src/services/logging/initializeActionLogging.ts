import * as vscode from "vscode"
import * as os from "os"
import { Package } from "../../shared/package"
import { collectSystemMetrics, logOperationPerformance } from "./helpers/systemMetricsCollector"

/**
 * Logs extension activation event
 * @param context The extension context
 * @param outputChannel The output channel for logging messages
 */
export async function logExtensionActivation(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<void> {
	try {
		const { logExtensionEvent } = await import("../../utils/logging")
		await logExtensionEvent("activation", {
			version: Package.version,
			name: Package.name,
			extensionPath: context.extensionPath,
			timestamp: new Date().toISOString(),
			os: {
				platform: os.platform(),
				release: os.release(),
				arch: os.arch(),
				totalMemory: os.totalmem(),
				freeMemory: os.freemem(),
			},
			nodeVersion: process.version,
			vscodeVersion: vscode.version,
		})

		// Log performance metrics for extension activation
		const metrics = collectSystemMetrics("extension_activation", "Extension")
		await logOperationPerformance({
			operation_name: "extension_activation",
			operation_type: "extension_lifecycle",
			duration_ms: 0, // Snapshot at activation
			resource_source: "activation",
			resource_component: "Extension",
			resource_metrics: metrics,
			additional_metrics: {
				version: Package.version,
				name: Package.name,
				os_platform: os.platform(),
				os_arch: os.arch(),
				os_total_memory_mb: Math.round(os.totalmem() / 1024 / 1024),
				os_free_memory_mb: Math.round(os.freemem() / 1024 / 1024),
				node_version: process.version,
				vscode_version: vscode.version,
			},
		})

		outputChannel.appendLine("[ActionLogging] Extension activation logged")
	} catch (error) {
		outputChannel.appendLine(
			`[ActionLogging] Failed to log activation: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}

/**
 * Logs extension deactivation event
 * @param outputChannel The output channel for logging messages
 */
export async function logExtensionDeactivation(outputChannel: vscode.OutputChannel): Promise<void> {
	try {
		const { logExtensionEvent } = await import("../../utils/logging")
		const memUsage = process.memoryUsage()
		const cpuUsage = process.cpuUsage()

		await logExtensionEvent("deactivation", {
			uptime: process.uptime(),
			timestamp: new Date().toISOString(),
			memoryUsage: memUsage,
			cpuUsage: cpuUsage,
		})

		// Log performance metrics for extension deactivation
		const metrics = collectSystemMetrics("extension_deactivation", "Extension")
		await logOperationPerformance({
			operation_name: "extension_deactivation",
			operation_type: "extension_lifecycle",
			duration_ms: Math.round(process.uptime() * 1000), // Total extension uptime
			resource_source: "deactivation",
			resource_component: "Extension",
			resource_metrics: metrics,
			additional_metrics: {
				uptime_seconds: process.uptime(),
				heap_used_mb: Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100,
				heap_total_mb: Math.round((memUsage.heapTotal / 1024 / 1024) * 100) / 100,
				rss_mb: Math.round((memUsage.rss / 1024 / 1024) * 100) / 100,
				cpu_user_ms: Math.round(cpuUsage.user / 1000),
				cpu_system_ms: Math.round(cpuUsage.system / 1000),
			},
		})

		outputChannel.appendLine("[ActionLogging] Extension deactivation logged")
	} catch (error) {
		outputChannel.appendLine(
			`[ActionLogging] Failed to log deactivation: ${error instanceof Error ? error.message : String(error)}`,
		)
	}
}
