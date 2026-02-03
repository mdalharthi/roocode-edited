/**
 * File Operation Logger Service
 *
 * Provides logging utilities for file operations with automatic database integration.
 * This service captures all file operations (read, write, delete, rename) and logs them
 * to the ca_file_operation_logs table via the backend API.
 *
 * @example
 * ```typescript
 * import { logFileWrite, logFileRead } from './helpers/fileOperationLogger';
 *
 * // Log a file write
 * await logFileWrite('/path/to/file.ts', beforeContent, afterContent, {
 *   sessionId: LoggingService.instance.getSessionId(),
 *   actionLogId: 123,
 * });
 *
 * // Log a file read
 * await logFileRead('/path/to/file.ts', true, 150);
 * ```
 */

import * as fs from "fs/promises"
import * as path from "path"
import { LoggingService } from "../LoggingService"
import { hashContent, calculateDiff, getContentType, PerformanceTimer } from "../../../utils/logging/helpers"

export interface FileOperationContext {
	sessionId?: string
	actionLogId?: number
	userId?: string
	workspaceId?: string
	metadata?: Record<string, any>
}

export interface FileOperationResult {
	success: boolean
	duration?: number
	error?: Error
	fileSizeBytes?: number
}

/**
 * Log a file write operation (create or edit)
 */
export async function logFileWrite(
	filePath: string,
	beforeContent: string | null,
	afterContent: string,
	context: FileOperationContext = {},
): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	try {
		const diff = calculateDiff(beforeContent, afterContent)
		const mode = beforeContent === null ? "create" : "edit"

		// Get file size
		let fileSizeBytes: number | undefined
		try {
			const stats = await fs.stat(filePath)
			fileSizeBytes = stats.size
		} catch {
			fileSizeBytes = Buffer.byteLength(afterContent, "utf-8")
		}

		await LoggingService.instance.logFileOperation({
			session_id: context.sessionId,
			action_log_id: context.actionLogId,
			operation: "write",
			mode,
			file_path: filePath,
			file_size_bytes: fileSizeBytes,
			version_before: beforeContent ? hashContent(beforeContent) : undefined,
			version_after: hashContent(afterContent),
			previous_total_lines: diff.totalLinesBefore,
			new_total_lines: diff.totalLinesAfter,
			new_lines_added: diff.added,
			lines_removed: diff.removed,
			lines_modified: diff.modified,
			non_empty_lines_before: diff.nonEmptyLinesBefore,
			non_empty_lines_after: diff.nonEmptyLinesAfter,
			content_type: getContentType(filePath),
			success: true,
			file_metadata: context.metadata,
		})
	} catch (error) {
		console.error("[FileOperationLogger] Failed to log file write:", error)
	}
}

/**
 * Log a file read operation
 */
export async function logFileRead(
	filePath: string,
	success: boolean,
	duration?: number,
	error?: Error,
	context: FileOperationContext = {},
): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	try {
		let fileSizeBytes: number | undefined
		try {
			const stats = await fs.stat(filePath)
			fileSizeBytes = stats.size
		} catch {
			// File might not exist
		}

		await LoggingService.instance.logFileOperation({
			session_id: context.sessionId,
			action_log_id: context.actionLogId,
			operation: "read",
			mode: "read",
			file_path: filePath,
			file_size_bytes: fileSizeBytes,
			duration_ms: duration,
			success,
			error_message: error?.message,
			content_type: getContentType(filePath),
			file_metadata: context.metadata,
		})
	} catch (logError) {
		console.error("[FileOperationLogger] Failed to log file read:", logError)
	}
}

/**
 * Log a file delete operation
 */
export async function logFileDelete(
	filePath: string,
	success: boolean,
	error?: Error,
	context: FileOperationContext = {},
): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	try {
		await LoggingService.instance.logFileOperation({
			session_id: context.sessionId,
			action_log_id: context.actionLogId,
			operation: "delete",
			mode: "delete",
			file_path: filePath,
			success,
			error_message: error?.message,
			content_type: getContentType(filePath),
			file_metadata: context.metadata,
		})
	} catch (logError) {
		console.error("[FileOperationLogger] Failed to log file delete:", logError)
	}
}

/**
 * Log a file rename/move operation
 */
export async function logFileRename(
	oldPath: string,
	newPath: string,
	success: boolean,
	error?: Error,
	context: FileOperationContext = {},
): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	try {
		let fileSizeBytes: number | undefined
		try {
			const stats = await fs.stat(newPath)
			fileSizeBytes = stats.size
		} catch {
			// New file might not exist if operation failed
		}

		await LoggingService.instance.logFileOperation({
			session_id: context.sessionId,
			action_log_id: context.actionLogId,
			operation: "rename",
			mode: "rename",
			file_path: newPath,
			file_size_bytes: fileSizeBytes,
			success,
			error_message: error?.message,
			content_type: getContentType(newPath),
			file_metadata: {
				...context.metadata,
				old_path: oldPath,
				new_path: newPath,
			},
		})
	} catch (logError) {
		console.error("[FileOperationLogger] Failed to log file rename:", logError)
	}
}

/**
 * Wrap a file operation with automatic logging
 */
export async function withFileOperationLogging<T>(
	operation: "read" | "write" | "delete" | "rename",
	filePath: string,
	fileOp: () => Promise<T>,
	context: FileOperationContext = {},
): Promise<T> {
	const timer = new PerformanceTimer()

	try {
		const result = await fileOp()
		const duration = timer.getDuration()

		// Log based on operation type
		if (operation === "read") {
			await logFileRead(filePath, true, duration, undefined, context)
		}
		// For write/delete/rename, these should be logged explicitly with more context

		return result
	} catch (error) {
		const duration = timer.getDuration()
		const err = error instanceof Error ? error : new Error(String(error))

		// Log failure
		if (operation === "read") {
			await logFileRead(filePath, false, duration, err, context)
		} else if (operation === "delete") {
			await logFileDelete(filePath, false, err, context)
		}

		throw error
	}
}

/**
 * Log a batch of file operations
 */
export async function logFileOperationBatch(
	operations: Array<{
		operation: "read" | "write" | "delete" | "rename"
		filePath: string
		success: boolean
		error?: Error
		duration?: number
		beforeContent?: string | null
		afterContent?: string
		oldPath?: string
		newPath?: string
	}>,
	context: FileOperationContext = {},
): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	// Log each operation
	for (const op of operations) {
		try {
			if (op.operation === "write" && op.afterContent !== undefined) {
				await logFileWrite(op.filePath, op.beforeContent || null, op.afterContent, context)
			} else if (op.operation === "read") {
				await logFileRead(op.filePath, op.success, op.duration, op.error, context)
			} else if (op.operation === "delete") {
				await logFileDelete(op.filePath, op.success, op.error, context)
			} else if (op.operation === "rename" && op.oldPath && op.newPath) {
				await logFileRename(op.oldPath, op.newPath, op.success, op.error, context)
			}
		} catch (error) {
			console.error("[FileOperationLogger] Failed to log operation:", error)
		}
	}
}
