/**
 * File Operation Helper Functions
 *
 * Provides convenient utilities for wrapping file operations with automatic logging.
 * These helpers integrate seamlessly with VSCode's file system APIs.
 *
 * @example
 * ```typescript
 * import { FileOperationLogger } from './helpers/fileOperationHelper';
 *
 * const logger = new FileOperationLogger({
 *   sessionId: LoggingService.instance.getSessionId(),
 *   actionLogId: 123,
 * });
 *
 * // Track a file write operation
 * await logger.trackWrite(filePath, beforeContent, afterContent);
 *
 * // Or use the wrapper
 * const content = await withFileReadLogging('/path/to/file', async () => {
 *   return await fs.readFile('/path/to/file', 'utf-8');
 * });
 * ```
 */

import * as vscode from "vscode"
import * as fs from "fs/promises"
import { logFileWrite, logFileRead, logFileDelete, logFileRename, FileOperationContext } from "./fileOperationLogger"
import { PerformanceTimer } from "../../../utils/logging/helpers"
import { LoggingService } from "../LoggingService"
import { collectSystemMetrics, logOperationPerformance } from "./systemMetricsCollector"

/**
 * Class for managing file operation tracking
 */
export class FileOperationLogger {
	private context: FileOperationContext
	private fileWatchers: Map<string, vscode.FileSystemWatcher>

	constructor(context: FileOperationContext = {}) {
		this.context = {
			sessionId:
				context.sessionId ||
				(LoggingService.hasInstance() ? LoggingService.instance.getSessionId() : undefined),
			actionLogId: context.actionLogId,
			userId: context.userId,
			workspaceId: context.workspaceId,
			metadata: context.metadata,
		}
		this.fileWatchers = new Map()
	}

	/**
	 * Track a file write operation
	 */
	async trackWrite(filePath: string, beforeContent: string | null, afterContent: string): Promise<void> {
		await logFileWrite(filePath, beforeContent, afterContent, this.context)
	}

	/**
	 * Track a file read operation
	 */
	async trackRead(filePath: string, success: boolean, duration?: number, error?: Error): Promise<void> {
		await logFileRead(filePath, success, duration, error, this.context)
	}

	/**
	 * Track a file delete operation
	 */
	async trackDelete(filePath: string, success: boolean, error?: Error): Promise<void> {
		await logFileDelete(filePath, success, error, this.context)
	}

	/**
	 * Track a file rename operation
	 */
	async trackRename(oldPath: string, newPath: string, success: boolean, error?: Error): Promise<void> {
		await logFileRename(oldPath, newPath, success, error, this.context)
	}

	/**
	 * Update the context (e.g., action log ID)
	 */
	updateContext(updates: Partial<FileOperationContext>): void {
		this.context = { ...this.context, ...updates }
	}

	/**
	 * Watch a directory for file changes and automatically log them
	 */
	watchDirectory(
		directoryPath: string,
		options: {
			pattern?: vscode.GlobPattern
			ignoreCreateEvents?: boolean
			ignoreChangeEvents?: boolean
			ignoreDeleteEvents?: boolean
		} = {},
	): vscode.FileSystemWatcher {
		const pattern = options.pattern || new vscode.RelativePattern(directoryPath, "**/*")
		const watcher = vscode.workspace.createFileSystemWatcher(
			pattern,
			options.ignoreCreateEvents,
			options.ignoreChangeEvents,
			options.ignoreDeleteEvents,
		)

		// Track file creation
		if (!options.ignoreCreateEvents) {
			watcher.onDidCreate(async (uri) => {
				try {
					const content = await fs.readFile(uri.fsPath, "utf-8")
					await this.trackWrite(uri.fsPath, null, content)
				} catch (error) {
					console.error("[FileOperationHelper] Failed to track file creation:", error)
				}
			})
		}

		// Track file changes
		if (!options.ignoreChangeEvents) {
			watcher.onDidChange(async (uri) => {
				try {
					const content = await fs.readFile(uri.fsPath, "utf-8")
					// We don't have before content here, so we'll log it as a read operation
					await this.trackRead(uri.fsPath, true)
				} catch (error) {
					console.error("[FileOperationHelper] Failed to track file change:", error)
				}
			})
		}

		// Track file deletion
		if (!options.ignoreDeleteEvents) {
			watcher.onDidDelete(async (uri) => {
				await this.trackDelete(uri.fsPath, true)
			})
		}

		this.fileWatchers.set(directoryPath, watcher)
		return watcher
	}

	/**
	 * Stop watching a directory
	 */
	unwatchDirectory(directoryPath: string): void {
		const watcher = this.fileWatchers.get(directoryPath)
		if (watcher) {
			watcher.dispose()
			this.fileWatchers.delete(directoryPath)
		}
	}

	/**
	 * Stop all watchers
	 */
	disposeAllWatchers(): void {
		for (const watcher of this.fileWatchers.values()) {
			watcher.dispose()
		}
		this.fileWatchers.clear()
	}
}

/**
 * Wrap a file read operation with automatic logging
 */
export async function withFileReadLogging<T>(
	filePath: string,
	readFn: () => Promise<T>,
	context: FileOperationContext = {},
): Promise<T> {
	const timer = new PerformanceTimer()
	const startMetrics = collectSystemMetrics("file_read", "withFileReadLogging")

	try {
		const result = await readFn()
		const duration = timer.getDuration()
		await logFileRead(filePath, true, duration, undefined, context)

		// Log performance metrics
		const endMetrics = collectSystemMetrics("file_read_complete", "withFileReadLogging")
		await logOperationPerformance({
			operation_name: "file_read",
			operation_type: "file_operation",
			duration_ms: duration,
			resource_source: "file_read",
			resource_component: "withFileReadLogging",
			resource_metrics: { start: startMetrics, end: endMetrics },
			additional_metrics: { file_path: filePath, success: true },
		})

		return result
	} catch (error) {
		const duration = timer.getDuration()
		const err = error instanceof Error ? error : new Error(String(error))
		await logFileRead(filePath, false, duration, err, context)

		// Log performance metrics for error
		const endMetrics = collectSystemMetrics("file_read_error", "withFileReadLogging")
		await logOperationPerformance({
			operation_name: "file_read",
			operation_type: "file_operation",
			duration_ms: duration,
			resource_source: "file_read",
			resource_component: "withFileReadLogging",
			resource_metrics: { start: startMetrics, end: endMetrics },
			additional_metrics: { file_path: filePath, success: false, error: err.message },
		})

		throw error
	}
}

/**
 * Wrap a file write operation with automatic logging
 */
export async function withFileWriteLogging<T>(
	filePath: string,
	beforeContent: string | null,
	afterContent: string,
	writeFn: () => Promise<T>,
	context: FileOperationContext = {},
): Promise<T> {
	const timer = new PerformanceTimer()
	const startMetrics = collectSystemMetrics("file_write", "withFileWriteLogging")

	try {
		const result = await writeFn()
		const duration = timer.getDuration()
		await logFileWrite(filePath, beforeContent, afterContent, context)

		// Log performance metrics
		const endMetrics = collectSystemMetrics("file_write_complete", "withFileWriteLogging")
		await logOperationPerformance({
			operation_name: "file_write",
			operation_type: "file_operation",
			duration_ms: duration,
			file_size_bytes: afterContent.length,
			resource_source: "file_write",
			resource_component: "withFileWriteLogging",
			resource_metrics: { start: startMetrics, end: endMetrics },
			additional_metrics: { file_path: filePath, is_new_file: beforeContent === null },
		})

		return result
	} catch (error) {
		// Don't log failed writes
		throw error
	}
}

/**
 * Wrap a file delete operation with automatic logging
 */
export async function withFileDeleteLogging<T>(
	filePath: string,
	deleteFn: () => Promise<T>,
	context: FileOperationContext = {},
): Promise<T> {
	try {
		const result = await deleteFn()
		await logFileDelete(filePath, true, undefined, context)
		return result
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error))
		await logFileDelete(filePath, false, err, context)
		throw error
	}
}

/**
 * Wrap a file rename operation with automatic logging
 */
export async function withFileRenameLogging<T>(
	oldPath: string,
	newPath: string,
	renameFn: () => Promise<T>,
	context: FileOperationContext = {},
): Promise<T> {
	try {
		const result = await renameFn()
		await logFileRename(oldPath, newPath, true, undefined, context)
		return result
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error))
		await logFileRename(oldPath, newPath, false, err, context)
		throw error
	}
}

/**
 * Monitor VSCode workspace file events and log them
 */
export function monitorWorkspaceFileOperations(context: FileOperationContext = {}): vscode.Disposable {
	const logger = new FileOperationLogger(context)

	// Watch all workspace folders
	const watchers: vscode.FileSystemWatcher[] = []

	if (vscode.workspace.workspaceFolders) {
		for (const folder of vscode.workspace.workspaceFolders) {
			const watcher = logger.watchDirectory(folder.uri.fsPath)
			watchers.push(watcher)
		}
	}

	return new vscode.Disposable(() => {
		logger.disposeAllWatchers()
	})
}

/**
 * Helper to log file writes performed by AI tools
 */
export async function logToolFileWrite(
	toolName: string,
	filePath: string,
	beforeContent: string | null,
	afterContent: string,
	metadata: Record<string, any> = {},
): Promise<void> {
	const sessionId = LoggingService.hasInstance() ? LoggingService.instance.getSessionId() : undefined
	const startTime = Date.now()

	await logFileWrite(filePath, beforeContent, afterContent, {
		sessionId,
		metadata: {
			tool: toolName,
			trigger: "ai_tool_execution",
			...metadata,
		},
	})

	// Log performance metrics for file operation
	const duration = metadata.duration_ms || Date.now() - startTime
	const metrics = collectSystemMetrics("file_write", toolName)
	await logOperationPerformance({
		operation_name: `file_write_${toolName}`,
		operation_type: "file_operation",
		duration_ms: duration,
		file_size_bytes: afterContent.length,
		resource_source: "file_write",
		resource_component: toolName,
		resource_metrics: metrics,
		additional_metrics: {
			file_path: filePath,
			content_size_before: beforeContent?.length || 0,
			content_size_after: afterContent.length,
			is_new_file: beforeContent === null,
			...metadata,
		},
	})
}
