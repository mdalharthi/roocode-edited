/**
 * File Operation Logging - Usage Examples
 *
 * This file demonstrates how to integrate file operation logging throughout your codebase.
 */

import * as vscode from "vscode"
import * as fs from "fs/promises"
import {
	logFileWrite,
	logFileRead,
	logFileDelete,
	logFileRename,
	FileOperationLogger,
	withFileReadLogging,
	withFileWriteLogging,
	withFileDeleteLogging,
	withFileRenameLogging,
	initializeFileOperationLogging,
} from "../index"
import { LoggingService } from "../LoggingService"

// ========================================
// Example 1: Extension Activation
// ========================================

export async function activateFileOperationLogging(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel,
): Promise<void> {
	// Initialize file operation logging (this captures all VSCode file events)
	const disposable = await initializeFileOperationLogging(context, outputChannel)
	context.subscriptions.push(disposable)
}

// ========================================
// Example 2: Manual File Operation Logging
// ========================================

export async function exampleManualLogging(): Promise<void> {
	const filePath = "/path/to/file.ts"

	// Log a file read
	const startTime = Date.now()
	try {
		const content = await fs.readFile(filePath, "utf-8")
		const duration = Date.now() - startTime

		await logFileRead(filePath, true, duration)
	} catch (error) {
		const duration = Date.now() - startTime
		await logFileRead(filePath, false, duration, error instanceof Error ? error : new Error(String(error)))
	}

	// Log a file write
	const beforeContent = await fs.readFile(filePath, "utf-8").catch(() => null)
	const afterContent = '// Updated content\nconsole.log("Hello, world!");'

	await fs.writeFile(filePath, afterContent)
	await logFileWrite(filePath, beforeContent, afterContent)

	// Log a file delete
	try {
		await fs.unlink(filePath)
		await logFileDelete(filePath, true)
	} catch (error) {
		await logFileDelete(filePath, false, error instanceof Error ? error : new Error(String(error)))
	}

	// Log a file rename
	const oldPath = "/path/to/old.ts"
	const newPath = "/path/to/new.ts"
	try {
		await fs.rename(oldPath, newPath)
		await logFileRename(oldPath, newPath, true)
	} catch (error) {
		await logFileRename(oldPath, newPath, false, error instanceof Error ? error : new Error(String(error)))
	}
}

// ========================================
// Example 3: Using Wrapper Functions
// ========================================

export async function exampleWrapperFunctions(): Promise<void> {
	const filePath = "/path/to/file.ts"

	// Wrap a file read operation
	const content = await withFileReadLogging(
		filePath,
		async () => {
			return await fs.readFile(filePath, "utf-8")
		},
		{
			sessionId: LoggingService.instance.getSessionId(),
			metadata: { source: "example_function" },
		},
	)

	// Wrap a file write operation
	const beforeContent = content
	const afterContent = content + "\n// New line added"

	await withFileWriteLogging(
		filePath,
		beforeContent,
		afterContent,
		async () => {
			await fs.writeFile(filePath, afterContent)
		},
		{
			sessionId: LoggingService.instance.getSessionId(),
		},
	)

	// Wrap a file delete operation
	await withFileDeleteLogging(filePath, async () => {
		await fs.unlink(filePath)
	})

	// Wrap a file rename operation
	const oldPath = "/path/to/old.ts"
	const newPath = "/path/to/new.ts"

	await withFileRenameLogging(oldPath, newPath, async () => {
		await fs.rename(oldPath, newPath)
	})
}

// ========================================
// Example 4: Using FileOperationLogger Class
// ========================================

export async function exampleFileOperationLogger(): Promise<void> {
	// Create a logger instance with context
	const logger = new FileOperationLogger({
		sessionId: LoggingService.instance.getSessionId(),
		actionLogId: 123, // Link to an action log
		metadata: { component: "file_editor" },
	})

	// Track operations
	await logger.trackWrite("/path/to/file.ts", null, 'console.log("new file");')
	await logger.trackRead("/path/to/file.ts", true, 150)
	await logger.trackDelete("/path/to/file.ts", true)
	await logger.trackRename("/path/old.ts", "/path/new.ts", true)

	// Update context mid-operation
	logger.updateContext({ actionLogId: 456 })
	await logger.trackWrite("/path/to/another.ts", null, "const x = 1;")
}

// ========================================
// Example 5: Watching Directories
// ========================================

export function exampleDirectoryWatching(context: vscode.ExtensionContext): void {
	const logger = new FileOperationLogger({
		sessionId: LoggingService.instance.getSessionId(),
	})

	// Watch a specific directory
	const watcher = logger.watchDirectory("/path/to/watch", {
		pattern: "**/*.ts", // Only watch TypeScript files
		ignoreCreateEvents: false,
		ignoreChangeEvents: false,
		ignoreDeleteEvents: false,
	})

	// The watcher will automatically log all file operations in this directory
	context.subscriptions.push(watcher)

	// To stop watching later
	// logger.unwatchDirectory('/path/to/watch');
}

// ========================================
// Example 6: Integration with Tool Execution
// ========================================

export async function exampleToolIntegration(
	toolName: string,
	filePath: string,
	beforeContent: string | null,
	afterContent: string,
	actionLogId: number,
): Promise<void> {
	// When a tool like write_to_file or edit_file is executed,
	// log the file operation with the action log ID for linking

	await logFileWrite(filePath, beforeContent, afterContent, {
		sessionId: LoggingService.instance.getSessionId(),
		actionLogId: actionLogId,
		metadata: {
			tool: toolName,
			trigger: "tool_execution",
		},
	})
}

// ========================================
// Example 7: Batch File Operations
// ========================================

export async function exampleBatchOperations(): Promise<void> {
	const { logFileOperationBatch } = await import("../helpers/fileOperationLogger")

	// Log multiple file operations in one go
	await logFileOperationBatch(
		[
			{
				operation: "write",
				filePath: "/path/to/file1.ts",
				success: true,
				beforeContent: null,
				afterContent: "const a = 1;",
			},
			{
				operation: "write",
				filePath: "/path/to/file2.ts",
				success: true,
				beforeContent: "const b = 1;",
				afterContent: "const b = 2;",
			},
			{
				operation: "delete",
				filePath: "/path/to/file3.ts",
				success: true,
			},
		],
		{
			sessionId: LoggingService.instance.getSessionId(),
			actionLogId: 789,
		},
	)
}

// ========================================
// Example 8: Error Handling
// ========================================

export async function exampleErrorHandling(): Promise<void> {
	const filePath = "/path/to/protected-file.ts"

	// File read with error handling
	try {
		const content = await withFileReadLogging(filePath, async () => {
			return await fs.readFile(filePath, "utf-8")
		})
		// Success - logging happens automatically
	} catch (error) {
		// Error logging happens automatically
		console.error("Failed to read file:", error)
		// You can handle the error further here
	}

	// Manual error logging
	try {
		await fs.unlink(filePath)
		await logFileDelete(filePath, true)
	} catch (error) {
		// Log the failed operation
		await logFileDelete(filePath, false, error instanceof Error ? error : new Error(String(error)), {
			metadata: { reason: "permission_denied" },
		})
	}
}

// ========================================
// Example 9: Integration with VSCode Commands
// ========================================

export function registerFileOperationCommands(context: vscode.ExtensionContext): void {
	// Command: Create new file with logging
	context.subscriptions.push(
		vscode.commands.registerCommand("extension.createFileWithLogging", async (uri: vscode.Uri) => {
			const content = "// New file\n"

			await withFileWriteLogging(
				uri.fsPath,
				null,
				content,
				async () => {
					await vscode.workspace.fs.writeFile(uri, Buffer.from(content))
				},
				{
					metadata: { trigger: "user_command" },
				},
			)

			vscode.window.showInformationMessage(`File created and logged: ${uri.fsPath}`)
		}),
	)

	// Command: Delete file with logging
	context.subscriptions.push(
		vscode.commands.registerCommand("extension.deleteFileWithLogging", async (uri: vscode.Uri) => {
			await withFileDeleteLogging(
				uri.fsPath,
				async () => {
					await vscode.workspace.fs.delete(uri)
				},
				{
					metadata: { trigger: "user_command" },
				},
			)

			vscode.window.showInformationMessage(`File deleted and logged: ${uri.fsPath}`)
		}),
	)
}
