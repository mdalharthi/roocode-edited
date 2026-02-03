/**
 * Logging Helper Utilities
 *
 * Provides utility functions for logging operations:
 * - File hashing for version tracking
 * - Diff calculation for line-level metrics
 * - Content type detection
 * - Performance measurement helpers
 */

import * as crypto from "crypto"
import * as path from "path"

/**
 * Calculate SHA256 hash of content
 */
export function hashContent(content: string): string {
	return crypto.createHash("sha256").update(content).digest("hex").substring(0, 40)
}

/**
 * Calculate diff metrics between two file contents
 */
export interface DiffMetrics {
	added: number
	removed: number
	modified: number
	totalLinesBefore: number
	totalLinesAfter: number
	nonEmptyLinesBefore: number
	nonEmptyLinesAfter: number
}

export function calculateDiff(beforeContent: string | null, afterContent: string): DiffMetrics {
	const beforeLines = beforeContent ? beforeContent.split("\n") : []
	const afterLines = afterContent.split("\n")

	// Count non-empty lines
	const countNonEmpty = (lines: string[]) => lines.filter((line) => line.trim().length > 0).length

	// Simple line-based diff (for more accuracy, use a proper diff library)
	const beforeSet = new Set(beforeLines)
	const afterSet = new Set(afterLines)

	let added = 0
	let removed = 0

	// Count added lines
	for (const line of afterLines) {
		if (!beforeSet.has(line)) {
			added++
		}
	}

	// Count removed lines
	for (const line of beforeLines) {
		if (!afterSet.has(line)) {
			removed++
		}
	}

	// Estimate modified lines (lines that changed)
	const totalChanges = added + removed
	const modified = Math.max(0, Math.min(added, removed))

	return {
		added: added - modified,
		removed: removed - modified,
		modified,
		totalLinesBefore: beforeLines.length,
		totalLinesAfter: afterLines.length,
		nonEmptyLinesBefore: countNonEmpty(beforeLines),
		nonEmptyLinesAfter: countNonEmpty(afterLines),
	}
}

/**
 * Detect content type from file path
 */
export function getContentType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase()

	const typeMap: Record<string, string> = {
		".ts": "typescript",
		".tsx": "typescript",
		".js": "javascript",
		".jsx": "javascript",
		".py": "python",
		".java": "java",
		".c": "c",
		".cpp": "cpp",
		".cs": "csharp",
		".go": "go",
		".rs": "rust",
		".rb": "ruby",
		".php": "php",
		".html": "html",
		".css": "css",
		".json": "json",
		".xml": "xml",
		".md": "markdown",
		".yml": "yaml",
		".yaml": "yaml",
		".txt": "text",
	}

	return typeMap[ext] || "unknown"
}

/**
 * Performance measurement helper
 */
export class PerformanceTimer {
	private startTime: number
	private marks: Map<string, number>

	constructor() {
		this.startTime = Date.now()
		this.marks = new Map()
	}

	/**
	 * Mark a checkpoint
	 */
	mark(name: string): void {
		this.marks.set(name, Date.now())
	}

	/**
	 * Get duration since start in milliseconds
	 */
	getDuration(): number {
		return Date.now() - this.startTime
	}

	/**
	 * Get duration between two marks
	 */
	getDurationBetween(start: string, end: string): number {
		const startTime = this.marks.get(start)
		const endTime = this.marks.get(end)

		if (!startTime || !endTime) {
			throw new Error(`Mark not found: ${!startTime ? start : end}`)
		}

		return endTime - startTime
	}

	/**
	 * Get duration since a mark
	 */
	getDurationSinceMark(mark: string): number {
		const markTime = this.marks.get(mark)
		if (!markTime) {
			throw new Error(`Mark not found: ${mark}`)
		}
		return Date.now() - markTime
	}

	/**
	 * Get all marks as an object
	 */
	getMarks(): Record<string, number> {
		return Object.fromEntries(this.marks)
	}
}

/**
 * Get current memory usage in MB
 */
export function getMemoryUsageMB(): number {
	if (typeof process !== "undefined" && process.memoryUsage) {
		return process.memoryUsage().heapUsed / 1024 / 1024
	}
	return 0
}

/**
 * Sanitize log data to remove sensitive information
 */
export function sanitizeLogData(data: any): any {
	if (!data || typeof data !== "object") {
		return data
	}

	const sensitiveKeys = ["api_key", "apiKey", "password", "token", "secret", "authorization", "auth"]

	const sanitized = Array.isArray(data) ? [...data] : { ...data }

	for (const key in sanitized) {
		const lowerKey = key.toLowerCase()

		// Redact sensitive keys
		if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
			sanitized[key] = "***REDACTED***"
		}
		// Recursively sanitize nested objects
		else if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
			sanitized[key] = sanitizeLogData(sanitized[key])
		}
	}

	return sanitized
}

/**
 * Truncate long strings for logging
 */
export function truncateString(str: string, maxLength: number = 1000): string {
	if (str.length <= maxLength) {
		return str
	}
	return str.substring(0, maxLength) + `... (truncated ${str.length - maxLength} chars)`
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B"

	const k = 1024
	const sizes = ["B", "KB", "MB", "GB"]
	const i = Math.floor(Math.log(bytes) / Math.log(k))

	return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

/**
 * Create a correlation ID for linking related logs
 */
export function createCorrelationId(): string {
	return crypto.randomBytes(8).toString("hex")
}
