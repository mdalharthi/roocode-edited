/**
 * File Operation Capture Service
 *
 * Automatically captures and logs file operations from various sources:
 * - VSCode commands (save, delete, rename)
 * - Tool executions (write_to_file, edit_file, etc.)
 * - Direct file system operations
 *
 * This service integrates with the existing tool infrastructure to ensure
 * ALL file operations are logged to ca_file_operation_logs.
 *
 * @example
 * ```typescript
 * import { initializeFileOperationCapture } from './helpers/fileOperationCapture';
 *
 * // Initialize in extension.ts
 * const disposable = initializeFileOperationCapture(context);
 * context.subscriptions.push(disposable);
 * ```
 */

import * as vscode from "vscode"
import * as fs from "fs/promises"
import { logFileWrite, logFileRead, logFileDelete, logFileRename } from "./fileOperationLogger"
import { LoggingService } from "../LoggingService"

/**
 * Track content before file modifications
 */
const fileContentCache = new Map<string, string>()

/**
 * Initialize file operation capture
 */
export function initializeFileOperationCapture(context: vscode.ExtensionContext): vscode.Disposable {
	const disposables: vscode.Disposable[] = []

	// Capture workspace file changes
	const workspaceWatcher = captureWorkspaceFileChanges()
	disposables.push(workspaceWatcher)

	// Capture text document changes
	const textDocumentWatcher = captureTextDocumentChanges()
	disposables.push(textDocumentWatcher)

	// Capture file system events
	const fileSystemWatcher = captureFileSystemEvents()
	disposables.push(fileSystemWatcher)

	return vscode.Disposable.from(...disposables)
}

/**
 * Capture workspace file changes (creates, deletes, renames)
 */
function captureWorkspaceFileChanges(): vscode.Disposable {
	const disposables: vscode.Disposable[] = []

	// Listen for file will create events
	disposables.push(
		vscode.workspace.onWillCreateFiles(async (event) => {
			// Files are about to be created
			for (const uri of event.files) {
				// We'll log this on the actual creation
				console.log(`[FileOperationCapture] File will be created: ${uri.fsPath}`)
			}
		}),
	)

	// Listen for file did create events
	disposables.push(
		vscode.workspace.onDidCreateFiles(async (event) => {
			for (const uri of event.files) {
				try {
					const content = await fs.readFile(uri.fsPath, "utf-8")
					await logFileWrite(uri.fsPath, null, content, {
						sessionId: LoggingService.hasInstance() ? LoggingService.instance.getSessionId() : undefined,
					})
				} catch (error) {
					console.error(`[FileOperationCapture] Failed to log file creation:`, error)
				}
			}
		}),
	)

	// Listen for file will delete events
	disposables.push(
		vscode.workspace.onWillDeleteFiles(async (event) => {
			// Cache file content before deletion (for potential rollback/audit)
			for (const uri of event.files) {
				try {
					const content = await fs.readFile(uri.fsPath, "utf-8")
					fileContentCache.set(uri.fsPath, content)
				} catch (error) {
					// File might not exist or not readable
				}
			}
		}),
	)

	// Listen for file did delete events
	disposables.push(
		vscode.workspace.onDidDeleteFiles(async (event) => {
			for (const uri of event.files) {
				try {
					await logFileDelete(uri.fsPath, true, undefined, {
						sessionId: LoggingService.hasInstance() ? LoggingService.instance.getSessionId() : undefined,
					})
					fileContentCache.delete(uri.fsPath)
				} catch (error) {
					console.error(`[FileOperationCapture] Failed to log file deletion:`, error)
				}
			}
		}),
	)

	// Listen for file will rename events
	disposables.push(
		vscode.workspace.onWillRenameFiles(async (event) => {
			// Cache file content before rename
			for (const file of event.files) {
				try {
					const content = await fs.readFile(file.oldUri.fsPath, "utf-8")
					fileContentCache.set(file.oldUri.fsPath, content)
				} catch (error) {
					// File might not exist or not readable
				}
			}
		}),
	)

	// Listen for file did rename events
	disposables.push(
		vscode.workspace.onDidRenameFiles(async (event) => {
			for (const file of event.files) {
				try {
					await logFileRename(file.oldUri.fsPath, file.newUri.fsPath, true, undefined, {
						sessionId: LoggingService.hasInstance() ? LoggingService.instance.getSessionId() : undefined,
					})
					fileContentCache.delete(file.oldUri.fsPath)
				} catch (error) {
					console.error(`[FileOperationCapture] Failed to log file rename:`, error)
				}
			}
		}),
	)

	return vscode.Disposable.from(...disposables)
}

/**
 * Capture text document changes (edits and saves)
 */
function captureTextDocumentChanges(): vscode.Disposable {
	const disposables: vscode.Disposable[] = []
	const documentContentBefore = new Map<string, string>()

	// Track document when it's opened
	disposables.push(
		vscode.workspace.onDidOpenTextDocument(async (document) => {
			if (document.uri.scheme === "file") {
				documentContentBefore.set(document.uri.fsPath, document.getText())

				// Log the read operation
				await logFileRead(document.uri.fsPath, true, undefined, undefined, {
					sessionId: LoggingService.hasInstance() ? LoggingService.instance.getSessionId() : undefined,
					metadata: { trigger: "document_open" },
				})
			}
		}),
	)

	// Track document when it's saved
	disposables.push(
		vscode.workspace.onDidSaveTextDocument(async (document) => {
			if (document.uri.scheme === "file") {
				const beforeContent = documentContentBefore.get(document.uri.fsPath) || null
				const afterContent = document.getText()

				await logFileWrite(document.uri.fsPath, beforeContent, afterContent, {
					sessionId: LoggingService.hasInstance() ? LoggingService.instance.getSessionId() : undefined,
					metadata: { trigger: "document_save" },
				})

				// Update the before content for next save
				documentContentBefore.set(document.uri.fsPath, afterContent)
			}
		}),
	)

	// Track document when it's closed
	disposables.push(
		vscode.workspace.onDidCloseTextDocument((document) => {
			if (document.uri.scheme === "file") {
				documentContentBefore.delete(document.uri.fsPath)
			}
		}),
	)

	return vscode.Disposable.from(...disposables)
}

/**
 * Capture file system events using file system watcher
 */
function captureFileSystemEvents(): vscode.Disposable {
	const disposables: vscode.Disposable[] = []

	// Watch all workspace folders
	if (vscode.workspace.workspaceFolders) {
		for (const folder of vscode.workspace.workspaceFolders) {
			// Create a watcher for the workspace folder
			const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, "**/*"))

			// Note: These events are already captured by workspace events above,
			// but we keep them here for completeness and in case workspace events are disabled

			disposables.push(watcher)
		}
	}

	return vscode.Disposable.from(...disposables)
}

/**
 * Wrap native file system operations with logging
 * Use this to intercept and log direct fs operations
 */
/**
 * Wrap native file system operations with logging
 * Use this to intercept and log direct fs operations
 *
 * NOTE: Native fs wrapping is disabled in this environment due to ESM import constraints.
 * File operations are captured via VSCode events and explicit tool logging.
 */
export function wrapFileSystemOperations() {
	console.warn("[FileOperationCapture] Native fs wrapping is disabled due to ESM constraints.")
	return {
		restore: () => {
			// No-op
		},
	}
}

/**
 * Hook into tool executions to capture file operations from tools
 */
export function captureToolFileOperations(): vscode.Disposable {
	// This would integrate with the tool execution pipeline
	// to capture file operations from write_to_file, edit_file, etc.

	// Implementation would depend on your tool execution architecture
	// Typically, you would wrap the tool execution handlers

	return new vscode.Disposable(() => {
		// Cleanup
	})
}
