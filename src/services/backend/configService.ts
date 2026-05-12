import axios from "axios"
import { ProviderSettingsWithId } from "@roo-code/types"

// Minimal interface for the raw API response for ApiProvider
export interface BackendApiProvider {
	id: number
	name: string
	display_name?: string
	provider_type: string
	base_url: string
	api_key_encrypted?: string
	auth_type: string
	rate_limit_requests_per_minute: number
	rate_limit_requests_per_hour: number
	rate_limit_requests_per_day: number
	config_metadata: Record<string, any>
	version: number
}

// Minimal interface for McpServerConfig response
export interface BackendMcpServer {
	id: number
	name: string
	config: Record<string, any>
	version: number
}

export class ConfigService {
	private _apiUrl?: string
	private _apiKey?: string

	constructor(apiUrl?: string, apiKey?: string) {
		this._apiUrl = apiUrl
		this._apiKey = apiKey
	}

	private get apiUrl(): string {
		return this._apiUrl || process.env.BACKEND_API_URL || ""
	}

	private get apiKey(): string {
		return this._apiKey || process.env.BACKEND_API_KEY || ""
	}

	get isConfigured(): boolean {
		return !!this.apiUrl && !!this.apiKey
	}

	private get normalizedApiUrl(): string {
		let url = this.apiUrl
		if (url.endsWith("/")) {
			url = url.slice(0, -1)
		}
		// If the user already included /api/v1 in their URL, don't add it again
		if (url.endsWith("/api/v1")) {
			return url
		}
		return `${url}/api/v1`
	}

	private getHeaders() {
		return {
			"X-API-Key": this.apiKey,
			"Content-Type": "application/json",
		}
	}

	// --- API Providers ---

	async fetchApiProviders(): Promise<ProviderSettingsWithId[]> {
		if (!this.isConfigured) return []
		try {
			const response = await axios.get(`${this.normalizedApiUrl}/providers`, { headers: this.getHeaders() })
			// The response might be { providers: [...] } or just an array depending on the backend endpoint.
			// Checking backend/app/api/v1/providers.py, response is ApiProviderListResponse -> { providers: [...], total: n }
			const data = response.data.providers as BackendApiProvider[]
			return data.map((provider) => ({
				id: provider.name,
				// Merge specific fields and metadata back into a shape the frontend uses
				...provider.config_metadata,
				// Add backend managed flag
				isBackendManaged: true,
			}))
		} catch (error) {
			console.error("Failed to fetch API providers from backend", error)
			return []
		}
	}

	async createApiProvider(provider: ProviderSettingsWithId): Promise<void> {
		if (!this.isConfigured) return
		try {
			const { id, isBackendManaged, ...configMetadata } = provider as any
			// Map to Backend API Provider creation schema
			const payload = {
				name: id,
				provider_type: configMetadata.type || "unknown",
				base_url: configMetadata.baseURL || "",
				auth_type: "api_key",
				config_metadata: configMetadata,
			}
			await axios.post(`${this.normalizedApiUrl}/providers`, payload, { headers: this.getHeaders() })
		} catch (error) {
			console.error("Failed to create API provider on backend", error)
			throw error
		}
	}

	async updateApiProvider(id: string, provider: Partial<ProviderSettingsWithId>): Promise<void> {
		if (!this.isConfigured) return
		try {
			const { isBackendManaged, ...configMetadata } = provider as any
			const payload: Record<string, any> = {
				config_metadata: configMetadata,
			}
			if (configMetadata.type) payload["provider_type"] = configMetadata.type
			if (configMetadata.baseURL) payload["base_url"] = configMetadata.baseURL

			await axios.patch(`${this.normalizedApiUrl}/providers/by-name/${id}`, payload, {
				headers: this.getHeaders(),
			})
		} catch (error) {
			console.error("Failed to update API provider on backend", error)
			throw error
		}
	}

	async deleteApiProvider(id: string): Promise<void> {
		if (!this.isConfigured) return
		try {
			await axios.delete(`${this.normalizedApiUrl}/providers/by-name/${id}`, { headers: this.getHeaders() })
		} catch (error) {
			console.error("Failed to delete API provider from backend", error)
			throw error
		}
	}

	// --- MCP Servers ---

	async fetchMcpServers(): Promise<Record<string, any>> {
		if (!this.isConfigured) {
			console.log("[ConfigService] Skip fetchMcpServers: not configured")
			return {}
		}
		try {
			console.log("[ConfigService] Fetching MCP servers from backend...")
			const response = await axios.get(`${this.normalizedApiUrl}/mcp_servers`, { headers: this.getHeaders() })

			if (!response.data || !Array.isArray(response.data.servers)) {
				console.error("[ConfigService] Invalid response from backend for mcp_servers:", response.data)
				return {}
			}

			const data = response.data.servers as BackendMcpServer[]
			console.log(`[ConfigService] Successfully fetched ${data.length} MCP servers from backend`)

			const servers: Record<string, any> = {}
			for (const s of data) {
				servers[s.name] = {
					...s.config,
					isBackendManaged: true,
				}
			}
			return servers
		} catch (error) {
			if (axios.isAxiosError(error)) {
				console.error(
					`[ConfigService] Failed to fetch MCP servers: ${error.status} - ${error.message}`,
					error.response?.data,
				)
			} else {
				console.error("[ConfigService] Unexpected error fetching MCP servers:", error)
			}
			return {}
		}
	}

	async createMcpServer(name: string, config: any): Promise<void> {
		if (!this.isConfigured) return
		try {
			const { isBackendManaged, ...cleanConfig } = config
			const payload = {
				name,
				config: cleanConfig,
			}
			await axios.post(`${this.normalizedApiUrl}/mcp_servers`, payload, { headers: this.getHeaders() })
		} catch (error) {
			console.error("Failed to create MCP server on backend", error)
			throw error
		}
	}

	async updateMcpServer(name: string, config: any): Promise<void> {
		if (!this.isConfigured) return
		try {
			const { isBackendManaged, ...cleanConfig } = config
			const payload = {
				config: cleanConfig,
			}
			await axios.patch(`${this.normalizedApiUrl}/mcp_servers/${name}`, payload, { headers: this.getHeaders() })
		} catch (error) {
			console.error("Failed to update MCP server on backend", error)
			throw error
		}
	}

	async deleteMcpServer(name: string): Promise<void> {
		if (!this.isConfigured) return
		try {
			await axios.delete(`${this.normalizedApiUrl}/mcp_servers/${name}`, { headers: this.getHeaders() })
		} catch (error) {
			console.error("Failed to delete MCP server from backend", error)
			throw error
		}
	}
}

export const configService = new ConfigService()
