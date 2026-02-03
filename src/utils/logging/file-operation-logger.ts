/**
 * File Operation Logger
 *
 * Provides logging utilities for file operations with automatic diff calculation
 * and metrics tracking.
 */

import * as fs from "fs/promises"
import * as path from "path"
import { LoggingService } from "../../services/logging/LoggingService"
import { hashContent, calculateDiff, getContentType, PerformanceTimer } from "../logging/helpers"

export interface FileOperationContext {
	sessionId?: string
	actionLogId?: number
}

/**
 * Log a file write operation
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
		})
	} catch (logError) {
		console.error("[FileOperationLogger] Failed to log file delete:", logError)
	}
}

/**
 * Wrap a file operation with automatic logging
 */
export async function withFileOperationLogging<T>(
	operation: "read" | "write" | "delete",
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
		// For write/delete, these should be logged explicitly with more context

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
