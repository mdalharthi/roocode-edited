/**
 * LoggingService - Singleton service for managing application-wide logging
 *
 * This service provides a centralized interface for logging to the PostgreSQL backend.
 * It manages session IDs, handles errors gracefully, and provides convenience methods
 * for all log types.
 *
 * @example
 * ```typescript
 * // Initialize once in extension.ts
 * LoggingService.initialize({
 *   apiUrl: process.env.BACKEND_API_URL!,
 *   apiKey: process.env.BACKEND_API_KEY!,
 *   sessionId: uuidv7(),
 * });
 *
 * // Use anywhere in the application
 * await LoggingService.instance.logApiCall({
 *   provider: 'anthropic',
 *   model: 'claude-3-opus',
 *   tokens_used: 1500,
 * });
 * ```
 */

import { v7 as uuidv7 } from "uuid"
import BackendLoggingClient, {
	ActionLogData,
	ApiLogData,
	PerformanceLogData,
	UserInteractionLogData,
	FileOperationLogData,
	ApiProviderData,
	McpLogData,
} from "./BackendLoggingClient"

import { actionLogContext } from "./actionContext"

interface LoggingServiceConfig {
	apiUrl: string
	apiKey: string
	sessionId?: string
	userId?: string
	workspaceId?: string
	enabled?: boolean
}

/**
 * Singleton service for application-wide logging
 */
export class LoggingService {
	private static _instance: LoggingService | null = null
	private client: BackendLoggingClient
	private config: Required<LoggingServiceConfig>
	private batchBuffer: any[] = []
	private flushTimer: NodeJS.Timeout | null = null

	private readonly BATCH_SIZE = 10
	private readonly FLUSH_INTERVAL_MS = 5000

	/**
	 * Get the currently active action log ID from context
	 */
	public getActiveActionLogId(): number | null {
		return actionLogContext.getStore() || null
	}

	private constructor(config: LoggingServiceConfig) {
		this.config = {
			apiUrl: config.apiUrl,
			apiKey: config.apiKey,
			sessionId: config.sessionId || uuidv7(),
			userId: config.userId || "unknown",
			workspaceId: config.workspaceId || "default",
			enabled: config.enabled ?? true,
		}

		this.client = new BackendLoggingClient({
			apiUrl: this.config.apiUrl,
			apiKey: this.config.apiKey,
		})

		// Start batch flush timer
		if (this.config.enabled) {
			this.startFlushTimer()
		}
	}

	/**
	 * Initialize the logging service (call once in extension.ts)
	 */
	public static initialize(config: LoggingServiceConfig): LoggingService {
		if (LoggingService._instance) {
			console.warn("LoggingService already initialized. Replacing existing instance.")
		}

		LoggingService._instance = new LoggingService(config)
		return LoggingService._instance
	}

	/**
	 * Get the singleton instance
	 */
	public static get instance(): LoggingService {
		if (!LoggingService._instance) {
			throw new Error("LoggingService not initialized. Call LoggingService.initialize() first.")
		}
		return LoggingService._instance
	}

	/**
	 * Check if an instance exists (for testing)
	 */
	public static hasInstance(): boolean {
		return LoggingService._instance !== null
	}

	/**
	 * Get current session ID
	 */
	public getSessionId(): string {
		return this.config.sessionId
	}

	/**
	 * Update user ID
	 */
	public setUserId(userId: string): void {
		this.config.userId = userId
	}

	/**
	 * Update workspace ID
	 */
	public setWorkspaceId(workspaceId: string): void {
		this.config.workspaceId = workspaceId
	}

	/**
	 * Enable or disable logging
	 */
	public setEnabled(enabled: boolean): void {
		this.config.enabled = enabled
		if (enabled && !this.flushTimer) {
			this.startFlushTimer()
		} else if (!enabled && this.flushTimer) {
			this.stopFlushTimer()
		}
	}

	/**
	 * Check if logging is enabled
	 */
	public isEnabled(): boolean {
		return this.config.enabled
	}

	// ========================================
	// Fire-and-forget logging methods
	// ========================================

	/**
	 * Safely execute a logging function without blocking
	 */
	private async safeLog<T>(logFn: () => Promise<T>, context: string): Promise<T | null> {
		if (!this.config.enabled) {
			return null
		}

		try {
			return await logFn()
		} catch (error) {
			console.error(`[LoggingService] ${context} failed:`, error)
			return null
		}
	}

	/**
	 * Log an action (returns action log ID for linking)
	 */
	public async logAction(
		data: Omit<ActionLogData, "session_id" | "user_id" | "workspace_id"> &
			Partial<Pick<ActionLogData, "session_id" | "user_id" | "workspace_id">>,
	): Promise<number | null> {
		const result = await this.safeLog(async () => {
			const log = await this.client.createActionLog({
				session_id: data.session_id || this.config.sessionId,
				user_id: data.user_id || this.config.userId,
				workspace_id: data.workspace_id || this.config.workspaceId,
				...data,
			} as ActionLogData)
			return log.id
		}, "logAction")
		return result
	}

	/**
	 * Update an existing action log
	 */
	public async updateActionLog(logId: number, updates: Partial<ActionLogData>): Promise<void> {
		await this.safeLog(() => this.client.updateActionLog(logId, updates), "updateActionLog")
	}

	/**
	 * Log an API call
	 */
	public async logApiCall(
		data: Omit<ApiLogData, "session_id"> & Partial<Pick<ApiLogData, "session_id">>,
	): Promise<void> {
		await this.safeLog(
			() =>
				this.client.createApiLog({
					session_id: data.session_id || this.config.sessionId,
					action_log_id: data.action_log_id || this.getActiveActionLogId(),
					...data,
				} as ApiLogData),
			"logApiCall",
		)
	}

	/**
	 * Log performance metrics
	 */
	public async logPerformance(
		data: Omit<PerformanceLogData, "session_id"> & Partial<Pick<PerformanceLogData, "session_id">>,
	): Promise<void> {
		await this.safeLog(
			() =>
				this.client.createPerformanceLog({
					session_id: data.session_id || this.config.sessionId,
					action_log_id: data.action_log_id || this.getActiveActionLogId(),
					...data,
				} as PerformanceLogData),
			"logPerformance",
		)
	}

	/**
	 * Log user interaction
	 */
	public async logUserInteraction(
		data: Omit<UserInteractionLogData, "session_id" | "user_id"> &
			Partial<Pick<UserInteractionLogData, "session_id" | "user_id">>,
	): Promise<void> {
		await this.safeLog(
			() =>
				this.client.createUserInteractionLog({
					session_id: data.session_id || this.config.sessionId,
					user_id: data.user_id || this.config.userId,
					action_log_id: data.action_log_id || this.getActiveActionLogId(),
					...data,
				} as UserInteractionLogData),
			"logUserInteraction",
		)
	}

	/**
	 * Log file operation
	 */
	public async logFileOperation(
		data: Omit<FileOperationLogData, "session_id"> & Partial<Pick<FileOperationLogData, "session_id">>,
	): Promise<void> {
		await this.safeLog(
			() =>
				this.client.createFileOperationLog({
					session_id: data.session_id || this.config.sessionId,
					action_log_id: data.action_log_id || this.getActiveActionLogId(),
					...data,
				} as FileOperationLogData),
			"logFileOperation",
		)
	}

	/**
	 * Log MCP interaction
	 */
	public async logMcpCall(
		data: Omit<McpLogData, "session_id"> & Partial<Pick<McpLogData, "session_id">>,
	): Promise<void> {
		await this.safeLog(
			() =>
				this.client.createMcpLog({
					session_id: data.session_id || this.config.sessionId,
					action_log_id: data.action_log_id || this.getActiveActionLogId(),
					...data,
				} as McpLogData),
			"logMcpCall",
		)
	}

	/**
	 * Store API provider configuration (create or update)
	 */
	public async storeApiProvider(data: ApiProviderData): Promise<void> {
		await this.safeLog(async () => {
			try {
				await this.client.createApiProvider(data)
			} catch (error: any) {
				// Check if it's a conflict (already exists)
				const isConflict =
					error.message &&
					(error.message.includes("409") ||
						error.message.includes("Conflict") ||
						error.message.includes("already exists"))

				if (isConflict) {
					try {
						// Fetch existing to get ID
						const existing = await this.client.getApiProviderByName(data.name)
						if (existing && existing.id) {
							// Update existing
							await this.client.updateApiProvider(existing.id, data)
						}
					} catch (updateError) {
						console.error("[LoggingService] Failed to update existing provider during upsert:", updateError)
					}
				} else {
					// Re-throw other errors
					throw error
				}
			}
		}, "storeApiProvider")
	}

	// ========================================
	// Batch logging
	// ========================================

	/**
	 * Add log to batch buffer (will flush automatically)
	 */
	public queueLog(type: string, data: any): void {
		if (!this.config.enabled) {
			return
		}

		this.batchBuffer.push({ type, data })

		// Flush if batch size reached
		if (this.batchBuffer.length >= this.BATCH_SIZE) {
			void this.flushBatch()
		}
	}

	/**
	 * Flush the batch buffer
	 */
	public async flushBatch(): Promise<void> {
		if (this.batchBuffer.length === 0) {
			return
		}

		const batchToSend = [...this.batchBuffer]
		this.batchBuffer = []

		await this.safeLog(async () => {
			const batchData: any = {
				action_logs: [],
				api_logs: [],
				performance_logs: [],
				user_interaction_logs: [],
				file_operation_logs: [],
				mcp_logs: [],
			}

			for (const item of batchToSend) {
				switch (item.type) {
					case "action":
						batchData.action_logs.push(item.data)
						break
					case "api":
						batchData.api_logs.push(item.data)
						break
					case "performance":
						batchData.performance_logs.push(item.data)
						break
					case "user_interaction":
						batchData.user_interaction_logs.push(item.data)
						break
					case "file_operation":
						batchData.file_operation_logs.push(item.data)
						break
					case "mcp":
						batchData.mcp_logs.push(item.data)
						break
				}
			}

			await this.client.batchCreateLogs(batchData)
		}, "flushBatch")
	}

	/**
	 * Start periodic batch flushing
	 */
	private startFlushTimer(): void {
		this.flushTimer = setInterval(() => {
			void this.flushBatch()
		}, this.FLUSH_INTERVAL_MS)
	}

	/**
	 * Stop periodic batch flushing
	 */
	private stopFlushTimer(): void {
		if (this.flushTimer) {
			clearInterval(this.flushTimer)
			this.flushTimer = null
		}
	}

	/**
	 * Cleanup and flush remaining logs
	 */
	public async shutdown(): Promise<void> {
		this.stopFlushTimer()
		await this.flushBatch()
	}

	/**
	 * Get the underlying client (for advanced use cases)
	 */
	public getClient(): BackendLoggingClient {
		return this.client
	}
}

export default LoggingService
