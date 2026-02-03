/**
 * Extension Version Tracking Client
 *
 * Provides integration with the backend extension version tracking API.
 * This allows tracking extension versions in PostgreSQL for version control
 * and compatibility verification.
 */
import { BackendApiLogger } from "../logging/BackendApiLogger"

export interface ExtensionVersionData {
	extension_version: string
	schema_version?: number
	migration_hash?: string
	metadata?: Record<string, any>
}

export interface VersionVerifyData {
	extension_version: string
}

export interface VersionResponse {
	id: number
	extension_version: string
	schema_version: number
	migration_hash?: string
	is_locked: boolean
	locked_at?: string
	locked_reason?: string
	last_synced_at: string
	created_at: string
	updated_at: string
}

export interface VersionVerifyResponse {
	matches: boolean
	is_locked: boolean
	locked_at?: string
	locked_reason?: string
	current_version: string
	current_schema_version: number
	requested_version: string
	requested_schema_version?: number
	message: string
}

export interface VersionStatsResponse {
	is_locked: boolean
	locked_at?: string
	locked_reason?: string
	extension_version: string
	schema_version: number
}

/**
 * Client for extension version tracking API
 */
export class ExtensionVersionClient {
	private apiUrl: string
	private apiKey: string

	constructor(apiUrl: string, apiKey: string) {
		this.apiUrl = apiUrl
		this.apiKey = apiKey
	}

	/**
	 * Make an HTTP request to the version API
	 */
	private async request<T>(endpoint: string, method: string = "GET", data?: any): Promise<T> {
		const url = `${this.apiUrl}${endpoint}`

		const headers: Record<string, string> = {
			"X-API-Key": this.apiKey,
			"Content-Type": "application/json",
		}

		const options: RequestInit = {
			method,
			headers,
		}

		if (data && (method === "POST" || method === "PUT")) {
			options.body = JSON.stringify(data)
		}

		const startTime = Date.now()
		let response: Response | undefined
		let responseBody: any
		let errorToThrow: any

		try {
			response = await fetch(url, options)

			if (!response.ok) {
				const errorText = await response.text()
				errorToThrow = new Error(
					`Version API request failed: ${response.status} ${response.statusText}. ${errorText}`,
				)
				// Try to parse error text as JSON for logging if possible, otherwise string
				try {
					responseBody = JSON.parse(errorText)
				} catch {
					responseBody = errorText
				}
			} else {
				responseBody = await response.json()
			}
		} catch (error) {
			errorToThrow = error
		}

		const duration = Date.now() - startTime
		const status = response ? response.status : 0

		await BackendApiLogger.logRequest(method, url, status, duration, {
			requestBody: options.body ? JSON.parse(options.body as string) : undefined,
			responseBody: responseBody,
			error: errorToThrow,
			headers: options.headers,
		})

		if (errorToThrow) {
			if (!response || !response.ok) {
				// If it was a fetch error or non-OK response, re-throw
				console.error(`Version API Error [${endpoint}]:`, errorToThrow)
				throw errorToThrow
			}
		}

		return responseBody
	}

	/**
	 * Initialize extension version in the database
	 */
	async initializeVersion(versionData: ExtensionVersionData): Promise<VersionResponse> {
		return this.request<VersionResponse>("/version/initialize", "POST", versionData)
	}

	/**
	 * Get the current active version
	 */
	async getCurrentVersion(): Promise<VersionResponse> {
		return this.request<VersionResponse>("/version", "GET")
	}

	/**
	 * Verify if a version is valid/matches
	 */
	async verifyVersion(versionData: VersionVerifyData): Promise<VersionVerifyResponse> {
		return this.request<VersionVerifyResponse>("/version/verify", "POST", versionData)
	}

	/**
	 * Get version statistics
	 */
	async getVersionStats(): Promise<VersionStatsResponse> {
		return this.request<VersionStatsResponse>("/version/status", "GET")
	}

	/**
	 * List all versions (Note: This endpoint may not exist in backend)
	 */
	async listVersions(limit = 50, offset = 0): Promise<{ versions: VersionResponse[]; total: number }> {
		const params = new URLSearchParams()
		params.append("limit", limit.toString())
		params.append("offset", offset.toString())

		return this.request(`/version?${params.toString()}`, "GET")
	}

	/**
	 * Lock the database
	 */
	async lockDatabase(reason?: string): Promise<VersionResponse> {
		return this.request<VersionResponse>("/version/lock", "POST", { reason })
	}

	/**
	 * Unlock the database
	 */
	async unlockDatabase(force = false): Promise<VersionResponse> {
		return this.request<VersionResponse>("/version/unlock", "POST", { force })
	}
}

/**
 * Initialize extension version tracking
 * Call this once during extension activation
 *
 * @throws Error if extension is locked due to version mismatch
 */
export async function initializeExtensionVersion(
	version: string,
	apiUrl: string,
	apiKey: string,
	metadata?: Record<string, any>,
): Promise<void> {
	const client = new ExtensionVersionClient(apiUrl, apiKey)

	try {
		// Try to get current version first
		const currentVersion = await client.getCurrentVersion()
		console.log(`[VersionTracking] Database version: ${currentVersion.extension_version}`)

		// Verify version and handle lock status
		const verification = await client.verifyVersion({ extension_version: version })

		// Check if database is locked
		if (verification.is_locked) {
			const errorMsg =
				`Extension is LOCKED: ${verification.locked_reason || "Unknown reason"}. ` +
				`Database version: ${verification.current_version}, Running version: ${version}`
			console.error(`[VersionTracking] ${errorMsg}`)
			throw new Error(errorMsg)
		}

		// Check if version matches
		if (!verification.matches) {
			const errorMsg =
				`Version mismatch detected and database has been LOCKED. ` +
				`Expected: ${verification.current_version}, Got: ${version}`
			console.error(`[VersionTracking] ${errorMsg}`)
			throw new Error(errorMsg)
		}

		// Version matches - synced successfully
		console.log(`[VersionTracking] ✓ Version ${version} verified and synced`)
	} catch (error) {
		// If error is version/lock related, re-throw it
		if (error instanceof Error && (error.message.includes("LOCKED") || error.message.includes("mismatch"))) {
			throw error
		}

		// No version in database yet, initialize it
		console.log(`[VersionTracking] Initializing new version ${version}`)

		try {
			await client.initializeVersion({
				extension_version: version,
				schema_version: 1,
				migration_hash: metadata?.sha,
			})
			console.log(`[VersionTracking] ✓ Version ${version} initialized successfully`)
		} catch (initError) {
			console.error("[VersionTracking] Failed to initialize version:", initError)
			throw new Error(
				`Failed to initialize version: ${initError instanceof Error ? initError.message : String(initError)}`,
			)
		}
	}
}

export default ExtensionVersionClient
