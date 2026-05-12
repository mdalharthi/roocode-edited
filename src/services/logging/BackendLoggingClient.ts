/**
 * Backend Logging Client - PostgreSQL-backed logging via FastAPI backend
 *
 * This client provides a TypeScript interface to interact with the backend logging API.
 * It supports 5 log types: Action, API, Performance, User Interaction, and File Operation logs.
 *
 * @example
 * ```typescript
 * import BackendLoggingClient from './BackendLoggingClient';
 *
 * const client = new BackendLoggingClient({
 *   apiUrl: process.env.BACKEND_API_URL!,
 *   apiKey: process.env.BACKEND_API_KEY!,
 * });
 *
 * // Log an action
 * await client.createActionLog({
 *   session_id: 'session-123',
 *   action_type: 'command_execution',
 *   action_name: 'git_commit',
 *   status: 'success',
 * });
 * ```
 */

export interface LoggingConfig {
	apiUrl: string
	apiKey: string
}

export interface ActionLogData {
	session_id: string
	user_id?: string
	workspace_id?: string
	action_type: string
	action_name: string
	status?: string
	error_message?: string
	error_stack?: string
	input_data?: Record<string, any>
	output_data?: Record<string, any>
	response_code?: number
	duration?: number
	action_metadata?: Record<string, any>
}

export interface ApiLogData {
	session_id: string
	action_log_id?: number
	provider: string
	model?: string
	url?: string
	endpoint?: string
	method: string
	status_code?: number
	request_headers?: Record<string, any>
	request_body?: any
	response_headers?: Record<string, any>
	response_body?: any
	error_message?: string
	duration_ms?: number
	tokens_used?: number
	cost?: number
	retry_count?: number
	metadata?: Record<string, any>
}

export interface PerformanceLogData {
	session_id: string
	operation_name: string
	operation_type: string
	duration_ms: number
	cpu_usage?: number
	memory_usage?: number
	memory_usage_mb?: number
	file_size_bytes?: number
	throughput?: number
	action_log_id?: number
	resource_metrics?: Record<string, any>
	additional_metrics?: Record<string, any>
}

export interface UserInteractionLogData {
	session_id: string
	user_id?: string
	action_log_id?: number
	interaction_type: string
	component: string
	action?: string
	result?: string
	context?: Record<string, any>
}

export interface FileOperationLogData {
	session_id: string
	operation: string
	mode: string
	file_path: string
	file_size_bytes?: number
	duration_ms?: number
	success?: boolean
	error_message?: string
	file_metadata?: Record<string, any>
	action_log_id?: number
	version_before?: string
	version_after?: string
	previous_total_lines?: number
	new_total_lines?: number
	new_lines_added?: number
	lines_removed?: number
	lines_modified?: number
	non_empty_lines_before?: number
	non_empty_lines_after?: number
	content_type?: string
}

export interface McpLogData {
	session_id: string
	action_log_id?: number
	server_name: string
	request_type: string
	endpoint?: string
	request_data?: any
	response_data?: any
	status_code?: number
	error_message?: string
	duration_ms?: number
}

export interface BatchLogData {
	action_logs?: ActionLogData[]
	api_logs?: ApiLogData[]
	performance_logs?: PerformanceLogData[]
	user_interaction_logs?: UserInteractionLogData[]
	file_operation_logs?: FileOperationLogData[]
	mcp_logs?: McpLogData[]
}

export interface LogListResponse<T> {
	logs: T[]
	total: number
	limit: number
	offset: number
}

export interface BatchLogResponse {
	action_logs_created: number
	api_logs_created: number
	performance_logs_created: number
	user_interaction_logs_created: number
	file_operation_logs_created: number
	mcp_logs_created: number
	total_created: number
	errors: string[]
	id_map?: Record<number, number>
}

export interface ApiProviderData {
	name: string
	display_name?: string
	provider_type: string
	base_url: string
	api_key_encrypted?: string
	auth_type: string
	rate_limit_requests_per_minute?: number
	rate_limit_requests_per_hour?: number
	rate_limit_requests_per_day?: number
	config_metadata?: Record<string, any>
	created_by?: string
	updated_by?: string
}

/**
 * Client for interacting with the backend logging API
 */
export class BackendLoggingClient {
	private config: LoggingConfig

	constructor(config: LoggingConfig) {
		this.config = config
	}

	/**
	 * Make an HTTP request to the backend API
	 */
	private async request<T>(endpoint: string, method: string = "GET", data?: any): Promise<T> {
		// Ensure no double slashes
		const baseUrl = this.config.apiUrl.endsWith("/") ? this.config.apiUrl.slice(0, -1) : this.config.apiUrl
		const urlEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
		const url = `${baseUrl}${urlEndpoint}`

		const headers: Record<string, string> = {
			"X-API-Key": this.config.apiKey,
			"Content-Type": "application/json",
		}

		const options: RequestInit = {
			method,
			headers,
		}

		if (data && (method === "POST" || method === "PATCH")) {
			options.body = JSON.stringify(data)
		}

		try {
			const response = await fetch(url, options)

			if (!response.ok) {
				const errorText = await response.text()
				throw new Error(`API request failed: ${response.status} ${response.statusText}. ${errorText}`)
			}

			return await response.json()
		} catch (error) {
			console.error(`Logging API Error [${endpoint}]:`, error)
			throw error
		}
	}

	// ========================================
	// ACTION LOGS
	// ========================================

	/**
	 * Create a new action log entry
	 */
	async createActionLog(data: ActionLogData): Promise<any> {
		return this.request("/logs/actions", "POST", data)
	}

	/**
	 * Update an existing action log entry
	 */
	async updateActionLog(logId: number, data: Partial<ActionLogData>): Promise<any> {
		return this.request(`/logs/actions/${logId}`, "PATCH", data)
	}

	/**
	 * List action logs with optional filtering
	 */
	async listActionLogs(
		sessionId?: string,
		actionType?: string,
		limit = 50,
		offset = 0,
	): Promise<LogListResponse<any>> {
		const params = new URLSearchParams()
		if (sessionId) params.append("session_id", sessionId)
		if (actionType) params.append("action_type", actionType)
		params.append("limit", limit.toString())
		params.append("offset", offset.toString())

		return this.request(`/logs/actions?${params.toString()}`, "GET")
	}

	// ========================================
	// API LOGS
	// ========================================

	/**
	 * Create a new API log entry
	 */
	async createApiLog(data: ApiLogData): Promise<any> {
		return this.request("/logs/api", "POST", data)
	}

	/**
	 * List API logs with optional filtering
	 */
	async listApiLogs(sessionId?: string, provider?: string, limit = 50, offset = 0): Promise<LogListResponse<any>> {
		const params = new URLSearchParams()
		if (sessionId) params.append("session_id", sessionId)
		if (provider) params.append("provider", provider)
		params.append("limit", limit.toString())
		params.append("offset", offset.toString())

		return this.request(`/logs/api?${params.toString()}`, "GET")
	}

	// ========================================
	// PERFORMANCE LOGS
	// ========================================

	/**
	 * Create a new performance log entry
	 */
	async createPerformanceLog(data: PerformanceLogData): Promise<any> {
		return this.request("/logs/performance", "POST", data)
	}

	/**
	 * List performance logs with optional filtering
	 */
	async listPerformanceLogs(
		sessionId?: string,
		operationType?: string,
		limit = 50,
		offset = 0,
	): Promise<LogListResponse<any>> {
		const params = new URLSearchParams()
		if (sessionId) params.append("session_id", sessionId)
		if (operationType) params.append("operation_type", operationType)
		params.append("limit", limit.toString())
		params.append("offset", offset.toString())

		return this.request(`/logs/performance?${params.toString()}`, "GET")
	}

	// ========================================
	// USER INTERACTION LOGS
	// ========================================

	/**
	 * Create a new user interaction log entry
	 */
	async createUserInteractionLog(data: UserInteractionLogData): Promise<any> {
		return this.request("/logs/user-interactions", "POST", data)
	}

	/**
	 * List user interaction logs with optional filtering
	 */
	async listUserInteractionLogs(
		sessionId?: string,
		interactionType?: string,
		limit = 50,
		offset = 0,
	): Promise<LogListResponse<any>> {
		const params = new URLSearchParams()
		if (sessionId) params.append("session_id", sessionId)
		if (interactionType) params.append("interaction_type", interactionType)
		params.append("limit", limit.toString())
		params.append("offset", offset.toString())

		return this.request(`/logs/user-interactions?${params.toString()}`, "GET")
	}

	// ========================================
	// FILE OPERATION LOGS
	// ========================================

	/**
	 * Create a new file operation log entry
	 */
	async createFileOperationLog(data: FileOperationLogData): Promise<any> {
		return this.request("/logs/file-operations", "POST", data)
	}

	/**
	 * List file operation logs with optional filtering
	 */
	async listFileOperationLogs(
		sessionId?: string,
		operation?: string,
		limit = 50,
		offset = 0,
	): Promise<LogListResponse<any>> {
		const params = new URLSearchParams()
		if (sessionId) params.append("session_id", sessionId)
		if (operation) params.append("operation", operation)
		params.append("limit", limit.toString())
		params.append("offset", offset.toString())

		return this.request(`/logs/file-operations?${params.toString()}`, "GET")
	}

	// ========================================
	// MCP LOGS
	// ========================================

	/**
	 * Create a new MCP log entry
	 */
	async createMcpLog(data: McpLogData): Promise<any> {
		return this.request("/logs/mcp", "POST", data)
	}

	/**
	 * List MCP logs with optional filtering
	 */
	async listMcpLogs(
		sessionId?: string,
		serverName?: string,
		requestType?: string,
		limit = 50,
		offset = 0,
	): Promise<LogListResponse<any>> {
		const params = new URLSearchParams()
		if (sessionId) params.append("session_id", sessionId)
		if (serverName) params.append("server_name", serverName)
		if (requestType) params.append("request_type", requestType)
		params.append("limit", limit.toString())
		params.append("offset", offset.toString())

		return this.request(`/logs/mcp?${params.toString()}`, "GET")
	}

	// ========================================
	// API PROVIDERS
	// ========================================

	/**
	 * Create a new API provider configuration
	 */
	async createApiProvider(data: ApiProviderData): Promise<any> {
		return this.request("/providers", "POST", data)
	}

	/**
	 * Get an API provider by name
	 */
	async getApiProviderByName(name: string): Promise<any> {
		// Encoding the name to handle special characters is important
		return this.request(`/providers/by-name/${encodeURIComponent(name)}`, "GET")
	}

	/**
	 * Update an API provider
	 */
	async updateApiProvider(id: number, data: Partial<ApiProviderData>): Promise<any> {
		return this.request(`/providers/${id}`, "PATCH", data)
	}

	// ========================================
	// BATCH OPERATIONS
	// ========================================

	/**
	 * Batch create multiple logs in a single request for efficiency
	 */
	async batchCreateLogs(data: BatchLogData): Promise<BatchLogResponse> {
		return this.request("/logs/batch", "POST", data)
	}
}

/**
 * Singleton instance with environment configuration
 */
let clientInstance: BackendLoggingClient | null = null

/**
 * Get or create the singleton logging client instance
 */
export function getLoggingClient(): BackendLoggingClient {
	if (!clientInstance) {
		const apiUrl = process.env.BACKEND_API_URL
		const apiKey = process.env.BACKEND_API_KEY

		if (!apiUrl || !apiKey) {
			throw new Error("Backend logging client requires BACKEND_API_URL and BACKEND_API_KEY environment variables")
		}

		clientInstance = new BackendLoggingClient({
			apiUrl,
			apiKey,
		})
	}

	return clientInstance
}

export default BackendLoggingClient
