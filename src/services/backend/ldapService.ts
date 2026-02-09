/**
 * LDAP Service - Verifies users against Active Directory
 */

export interface LDAPUserInfo {
	username: string
	verified: boolean
	displayName?: string
	email?: string
	department?: string
}

export interface LDAPStatusInfo {
	configured: boolean
	connected: boolean
	host: string
	port: number
}

/**
 * Verifies a username against Active Directory via the backend API.
 *
 * @param username - The username to verify (from os.userInfo())
 * @param backendApiUrl - The backend API URL
 * @param backendApiKey - The backend API key
 * @returns LDAPUserInfo with verified username or "unknown"
 */
export async function verifyUserWithLDAP(
	username: string,
	backendApiUrl: string,
	backendApiKey: string,
): Promise<LDAPUserInfo> {
	try {
		const response = await fetch(`${backendApiUrl}/users/verify`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-Key": backendApiKey,
			},
			body: JSON.stringify({ username }),
		})

		if (!response.ok) {
			console.error(`[LDAP] Verification failed with status: ${response.status}`)
			return {
				username: "unknown",
				verified: false,
			}
		}

		const data = await response.json()
		return {
			username: data.username,
			verified: data.verified,
			displayName: data.display_name,
			email: data.email,
			department: data.department,
		}
	} catch (error) {
		console.error(`[LDAP] Error verifying user: ${error instanceof Error ? error.message : String(error)}`)
		return {
			username: "unknown",
			verified: false,
		}
	}
}

/**
 * Gets the LDAP service status from the backend.
 *
 * @param backendApiUrl - The backend API URL
 * @param backendApiKey - The backend API key
 * @returns LDAPStatusInfo with connection status
 */
export async function getLDAPStatus(backendApiUrl: string, backendApiKey: string): Promise<LDAPStatusInfo | null> {
	try {
		const response = await fetch(`${backendApiUrl}/users/ldap-status`, {
			method: "GET",
			headers: {
				"X-API-Key": backendApiKey,
			},
		})

		if (!response.ok) {
			return null
		}

		const data = await response.json()
		return {
			configured: data.configured,
			connected: data.connected,
			host: data.host,
			port: data.port,
		}
	} catch {
		return null
	}
}

export interface LDAPAuthResponse {
	authenticated: boolean
	username: string
	displayName?: string
	email?: string
	department?: string
	error?: string
}

/**
 * Authenticates a user against Active Directory via the backend API.
 *
 * @param username - The username to authenticate
 * @param password - The user's password
 * @param backendApiUrl - The backend API URL
 * @param backendApiKey - The backend API key
 * @returns LDAPAuthResponse with authentication result
 */
export async function authenticateWithLDAP(
	username: string,
	password: string,
	backendApiUrl: string,
	backendApiKey: string,
): Promise<LDAPAuthResponse> {
	try {
		const response = await fetch(`${backendApiUrl}/users/authenticate`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-Key": backendApiKey,
			},
			body: JSON.stringify({ username, password }),
		})

		if (!response.ok) {
			console.error(`[LDAP] Authentication failed with status: ${response.status}`)
			return {
				authenticated: false,
				username,
				error: `Server error: ${response.status}`,
			}
		}

		const data = await response.json()
		return {
			authenticated: data.authenticated,
			username: data.username,
			displayName: data.display_name,
			email: data.email,
			department: data.department,
			error: data.error,
		}
	} catch (error) {
		console.error(`[LDAP] Error during authentication: ${error instanceof Error ? error.message : String(error)}`)
		return {
			authenticated: false,
			username,
			error: "Failed to connect to authentication server",
		}
	}
}
