/**
 * Action Logging Integration Examples
 *
 * This file demonstrates how to use action logging throughout the extension.
 */

import {
	ActionLogger,
	LogAction,
	withActionLogging,
	logCommandExecution,
	logUserInteraction,
	logApiRequest,
	logFileOperation,
	logExtensionEvent,
} from "../helpers/actionLogHelper"

// ========================================
// Example 1: Simple Command Logging
// ========================================

export async function exampleCommandHandler(commandId: string, ...args: any[]) {
	const logger = await logCommandExecution(commandId, args)

	try {
		// Execute command logic
		const result = await executeCommand(commandId, args)

		await logger.success({ result })
		return result
	} catch (error) {
		await logger.error(error as Error)
		throw error
	}
}

// ========================================
// Example 2: Using ActionLogger Class
// ========================================

export async function complexOperation(userId: string, data: any) {
	const logger = new ActionLogger({
		actionType: "complex_operation",
		actionName: "multi_step_process",
		userId,
		inputData: { data },
	})

	await logger.start()

	try {
		// Step 1
		const step1Result = await performStep1(data)

		// Step 2
		const step2Result = await performStep2(step1Result)

		// Step 3
		const finalResult = await performStep3(step2Result)

		await logger.success({ finalResult })
		return finalResult
	} catch (error) {
		await logger.error(error as Error, 500)
		throw error
	}
}

// ========================================
// Example 3: Using Decorator
// ========================================

export class MyService {
	@LogAction("service_operation", "process_data")
	async processData(input: string): Promise<string> {
		// This method is automatically logged
		await new Promise((resolve) => setTimeout(resolve, 100))
		return input.toUpperCase()
	}

	@LogAction("service_operation", "fetch_remote_data")
	async fetchRemoteData(url: string): Promise<any> {
		const response = await fetch(url)
		return await response.json()
	}
}

// ========================================
// Example 4: Using Higher-Order Function
// ========================================

export async function performWithLogging() {
	return await withActionLogging(
		{
			actionType: "background_task",
			actionName: "cleanup_old_files",
			metadata: { scheduled: true },
		},
		async () => {
			// Your logic here
			await cleanupOldFiles()
			return { filesDeleted: 10 }
		},
	)
}

// ========================================
// Example 5: User Interaction Logging
// ========================================

export async function handleUserAsk(query: string, userId: string) {
	const logger = await logUserInteraction("ask", "ChatPanel", "user_query", { query, queryLength: query.length })

	try {
		const response = await processUserQuery(query)
		await logger.success({ response })
		return response
	} catch (error) {
		await logger.error(error as Error)
		throw error
	}
}

// ========================================
// Example 6: API Request Logging with Linking
// ========================================

export async function callAnthropicAPI(prompt: string) {
	const logger = await logApiRequest("anthropic", "/v1/messages", "POST")
	const actionLogId = logger.getLogId() // Get ID for linking

	try {
		const startTime = Date.now()
		const response = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ prompt }),
		})

		const data = await response.json()
		const duration = Date.now() - startTime

		// Log the API call details (linked to action log)
		if (actionLogId) {
			const { LoggingService } = await import("../LoggingService")
			await LoggingService.instance.logApiCall({
				action_log_id: actionLogId,
				provider: "anthropic",
				model: "claude-3-opus",
				endpoint: "/v1/messages",
				method: "POST",
				status_code: response.status,
				duration_ms: duration,
				tokens_used: data.usage?.total_tokens,
			})
		}

		await logger.success({ tokens: data.usage?.total_tokens })
		return data
	} catch (error) {
		await logger.error(error as Error, 500)
		throw error
	}
}

// ========================================
// Example 7: File Operation Logging
// ========================================

export async function saveFile(filePath: string, content: string) {
	const logger = await logFileOperation("write", filePath, "overwrite")

	try {
		// Perform file write
		await writeFileAsync(filePath, content)

		await logger.success({
			filePath,
			size: content.length,
		})
	} catch (error) {
		await logger.error(error as Error)
		throw error
	}
}

// ========================================
// Example 8: Extension Lifecycle Logging
// ========================================

export async function onExtensionActivate() {
	await logExtensionEvent("activation", {
		version: "1.0.0",
		timestamp: new Date().toISOString(),
	})
}

export async function onExtensionDeactivate() {
	await logExtensionEvent("deactivation", {
		uptime: process.uptime(),
		timestamp: new Date().toISOString(),
	})
}

// ========================================
// Example 9: Batch Logging Multiple Actions
// ========================================

export async function performBatchOperations() {
	const { LoggingService } = await import("../LoggingService")

	// Queue multiple logs for batch processing
	LoggingService.instance.queueLog("action", {
		session_id: "session-123",
		action_type: "batch_import",
		action_name: "import_file_1",
		status: "success",
	})

	LoggingService.instance.queueLog("action", {
		session_id: "session-123",
		action_type: "batch_import",
		action_name: "import_file_2",
		status: "success",
	})

	// Logs will be flushed automatically after 5 seconds or 10 items
	// Or manually flush:
	await LoggingService.instance.flushBatch()
}

// ========================================
// Helper functions (mocks for examples)
// ========================================

async function executeCommand(commandId: string, args: any[]): Promise<any> {
	return { success: true }
}

async function performStep1(data: any): Promise<any> {
	return { step1: "complete" }
}

async function performStep2(data: any): Promise<any> {
	return { step2: "complete" }
}

async function performStep3(data: any): Promise<any> {
	return { step3: "complete" }
}

async function cleanupOldFiles(): Promise<void> {
	// Cleanup logic
}

async function processUserQuery(query: string): Promise<string> {
	return `Response to: ${query}`
}

async function writeFileAsync(filePath: string, content: string): Promise<void> {
	// File write logic
}
