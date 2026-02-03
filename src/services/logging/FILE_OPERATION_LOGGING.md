# File Operation Logging System

Comprehensive logging system for capturing all file operations (read, write, delete, rename) and storing them in the `ca_file_operation_logs` database table via the backend API.

## Overview

The file operation logging system consists of three main components:

1. **fileOperationLogger.ts** - Core logging functions for individual file operations
2. **fileOperationHelper.ts** - Helper utilities and wrappers for easy integration
3. **fileOperationCapture.ts** - Automatic capture of VSCode file events

## Features

- ✅ **Automatic capture** of all VSCode file events (create, save, delete, rename)
- ✅ **Manual logging** for custom file operations
- ✅ **Comprehensive metrics** including line counts, diff calculations, and content hashing
- ✅ **Error tracking** with success/failure status
- ✅ **Action log linking** to correlate file operations with user actions
- ✅ **Batch operations** for efficient logging of multiple files
- ✅ **Directory watching** for monitoring specific folders
- ✅ **Performance tracking** with operation duration measurement

## Quick Start

### 1. Initialize During Extension Activation

```typescript
import { initializeFileOperationLogging } from "./services/logging"

export async function activate(context: vscode.ExtensionContext) {
	// ... other initialization code ...

	// Initialize file operation logging
	const disposable = await initializeFileOperationLogging(context, outputChannel)
	context.subscriptions.push(disposable)
}
```

### 2. Automatic Logging (No Code Changes Needed)

Once initialized, the system automatically captures:

- File creation via VSCode UI or commands
- File saves (tracks before/after content with diff metrics)
- File deletions
- File renames/moves
- Text document edits

### 3. Manual Logging for Custom Operations

```typescript
import { logFileWrite, logFileRead } from "./services/logging"
import { LoggingService } from "./services/logging/LoggingService"

// Log a file write
await logFileWrite(filePath, beforeContent, afterContent, {
	sessionId: LoggingService.instance.getSessionId(),
	actionLogId: 123, // Optional: link to action log
})

// Log a file read
await logFileRead(filePath, true, durationMs)
```

### 4. Using Wrapper Functions

```typescript
import { withFileWriteLogging } from "./services/logging"

// Wrap any file operation with automatic logging
await withFileWriteLogging(filePath, beforeContent, afterContent, async () => {
	await fs.writeFile(filePath, afterContent)
})
```

## Architecture

### Database Schema

The `ca_file_operation_logs` table stores:

| Column                 | Type        | Description                                        |
| ---------------------- | ----------- | -------------------------------------------------- |
| id                     | SERIAL      | Primary key                                        |
| session_id             | UUID        | Current session identifier                         |
| action_log_id          | INTEGER     | Links to ca_action_logs (optional)                 |
| operation              | VARCHAR     | Operation type: read, write, delete, rename        |
| mode                   | VARCHAR     | Operation mode: create, edit, read, delete, rename |
| file_path              | TEXT        | Full file path                                     |
| file_size_bytes        | INTEGER     | File size in bytes                                 |
| duration_ms            | INTEGER     | Operation duration in milliseconds                 |
| success                | BOOLEAN     | Whether operation succeeded                        |
| error_message          | TEXT        | Error message if failed                            |
| version_before         | VARCHAR(40) | SHA256 hash of content before                      |
| version_after          | VARCHAR(40) | SHA256 hash of content after                       |
| previous_total_lines   | INTEGER     | Total lines before change                          |
| new_total_lines        | INTEGER     | Total lines after change                           |
| new_lines_added        | INTEGER     | Number of lines added                              |
| lines_removed          | INTEGER     | Number of lines removed                            |
| lines_modified         | INTEGER     | Number of lines modified                           |
| non_empty_lines_before | INTEGER     | Non-empty lines before                             |
| non_empty_lines_after  | INTEGER     | Non-empty lines after                              |
| content_type           | VARCHAR(50) | File type: typescript, javascript, etc.            |
| file_metadata          | JSONB       | Additional metadata                                |
| created_at             | TIMESTAMP   | Creation timestamp (auto)                          |

### System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     VSCode File Events                      │
│  (onDidCreate, onDidSave, onDidDelete, onDidRename)         │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              fileOperationCapture.ts                        │
│  Intercepts and normalizes all file operation events        │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              fileOperationLogger.ts                         │
│  Calculates metrics, hashes, and prepares log data          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              LoggingService.ts                              │
│  Manages session, batching, and API communication           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              BackendLoggingClient.ts                        │
│  HTTP client for backend API                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend API (/logs/file-operations)            │
│  FastAPI endpoint                                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL Database                            │
│  ca_file_operation_logs table                               │
└─────────────────────────────────────────────────────────────┘
```

## API Reference

### Core Functions

#### `logFileWrite(filePath, beforeContent, afterContent, context?)`

Logs a file write operation (create or edit).

**Parameters:**

- `filePath` (string): Full path to the file
- `beforeContent` (string | null): Content before change (null for new files)
- `afterContent` (string): Content after change
- `context` (FileOperationContext): Optional context with sessionId, actionLogId, metadata

#### `logFileRead(filePath, success, duration?, error?, context?)`

Logs a file read operation.

**Parameters:**

- `filePath` (string): Full path to the file
- `success` (boolean): Whether read succeeded
- `duration` (number): Optional duration in milliseconds
- `error` (Error): Optional error object if failed
- `context` (FileOperationContext): Optional context

#### `logFileDelete(filePath, success, error?, context?)`

Logs a file delete operation.

#### `logFileRename(oldPath, newPath, success, error?, context?)`

Logs a file rename/move operation.

### Helper Classes

#### `FileOperationLogger`

Class for managing file operation tracking with context.

```typescript
const logger = new FileOperationLogger({
	sessionId: LoggingService.instance.getSessionId(),
	actionLogId: 123,
})

await logger.trackWrite(filePath, beforeContent, afterContent)
await logger.trackRead(filePath, true, 150)
await logger.trackDelete(filePath, true)
await logger.trackRename(oldPath, newPath, true)
```

### Wrapper Functions

Automatically log operations with error handling:

```typescript
// File read with logging
const content = await withFileReadLogging(filePath, async () => {
	return await fs.readFile(filePath, "utf-8")
})

// File write with logging
await withFileWriteLogging(filePath, before, after, async () => {
	await fs.writeFile(filePath, after)
})

// File delete with logging
await withFileDeleteLogging(filePath, async () => {
	await fs.unlink(filePath)
})

// File rename with logging
await withFileRenameLogging(oldPath, newPath, async () => {
	await fs.rename(oldPath, newPath)
})
```

## Integration Examples

### Tool Integration (write_to_file, edit_file)

```typescript
// In your tool execution handler
async function executeWriteToFileTool(args, actionLogId) {
	const beforeContent = await getExistingContent(args.path)
	const afterContent = args.content

	// Perform the write operation
	await fs.writeFile(args.path, afterContent)

	// Log the operation
	await logFileWrite(args.path, beforeContent, afterContent, {
		sessionId: LoggingService.instance.getSessionId(),
		actionLogId: actionLogId,
		metadata: {
			tool: "write_to_file",
			trigger: "tool_execution",
		},
	})
}
```

### Command Integration

```typescript
vscode.commands.registerCommand("extension.saveFile", async (uri) => {
	const doc = await vscode.workspace.openTextDocument(uri)
	const content = doc.getText()

	await withFileWriteLogging(
		uri.fsPath,
		null,
		content,
		async () => {
			await doc.save()
		},
		{
			metadata: { trigger: "user_command" },
		},
	)
})
```

### Directory Watching

```typescript
const logger = new FileOperationLogger({
	sessionId: LoggingService.instance.getSessionId(),
})

// Watch a directory
const watcher = logger.watchDirectory("/path/to/watch", {
	pattern: "**/*.ts",
})

// Cleanup
context.subscriptions.push(watcher)
```

## Performance Considerations

### Batching

The logging service automatically batches logs to reduce API calls:

- Batch size: 10 logs
- Flush interval: 5 seconds
- Or flush immediately when batch size is reached

### Async Operations

All logging operations are fire-and-forget and non-blocking:

```typescript
// This won't block your code
await logFileWrite(path, before, after)
```

### Error Handling

Logging errors are caught and logged to console, never throwing to prevent disruption of normal operations.

## Configuration

### Environment Variables

```env
USE_BACKEND_API=true
BACKEND_API_URL=https://your-backend-api.com
BACKEND_API_KEY=your-api-key
```

### Disable Logging

```typescript
// Disable all logging
LoggingService.instance.setEnabled(false)

// Re-enable logging
LoggingService.instance.setEnabled(true)
```

## Troubleshooting

### Logs Not Appearing in Database

1. Check if LoggingService is initialized:

```typescript
if (!LoggingService.hasInstance()) {
	console.error("LoggingService not initialized")
}
```

2. Check if logging is enabled:

```typescript
if (!LoggingService.instance.isEnabled()) {
	console.error("Logging is disabled")
}
```

3. Check environment variables:

```typescript
console.log("Backend API URL:", process.env.BACKEND_API_URL)
console.log("Use Backend API:", process.env.USE_BACKEND_API)
```

### Missing File Operation Logs

If file operations aren't being logged:

1. Verify file operation logging was initialized in extension activation
2. Check output channel for initialization errors
3. Ensure files are in workspace folders (watching only covers workspace files)

### High Memory Usage

If experiencing high memory usage:

1. Reduce batch size (edit BATCH_SIZE in LoggingService)
2. Increase flush interval (edit FLUSH_INTERVAL_MS)
3. Consider excluding large binary files from logging

## Best Practices

1. **Always link to action logs** when possible for better traceability:

    ```typescript
    await logFileWrite(path, before, after, { actionLogId: actionId })
    ```

2. **Use wrapper functions** for automatic error handling:

    ```typescript
    await withFileWriteLogging(path, before, after, async () => {
    	// Your write logic
    })
    ```

3. **Add metadata** for better context:

    ```typescript
    await logFileWrite(path, before, after, {
    	metadata: {
    		tool: "edit_file",
    		user_initiated: true,
    		reason: "refactoring",
    	},
    })
    ```

4. **Monitor performance** by checking log duration:
    ```typescript
    // High duration might indicate slow file I/O
    await logFileRead(path, true, duration)
    ```

## See Also

- [examples/fileOperationLoggingExamples.ts](./examples/fileOperationLoggingExamples.ts) - Comprehensive usage examples
- [BackendLoggingClient.ts](./BackendLoggingClient.ts) - API client documentation
- [LoggingService.ts](./LoggingService.ts) - Core logging service
