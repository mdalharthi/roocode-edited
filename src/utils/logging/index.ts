/**
 * Logging utilities - Public exports
 *
 * Exports both the original CompactLogger for backward compatibility
 * and new backend logging utilities for PostgreSQL integration.
 */

import { CompactLogger } from "./CompactLogger"

// ========================================
// Original logger (backward compatibility)
// ========================================

const noopLogger = {
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
	fatal: () => {},
	child: () => noopLogger,
	close: () => {},
}

export const logger = process.env.NODE_ENV === "test" ? new CompactLogger() : noopLogger

// ========================================
// Backend logging utilities
// ========================================

export { LoggingService } from "../../services/logging/LoggingService"
export { BackendLoggingClient } from "../../services/logging/BackendLoggingClient"

export {
	hashContent,
	calculateDiff,
	getContentType,
	PerformanceTimer,
	getMemoryUsageMB,
	sanitizeLogData,
	truncateString,
	formatBytes,
	createCorrelationId,
	type DiffMetrics,
} from "./helpers"

export { LogExecution, LogPerformance, LogApiCall, LogUserInteraction } from "./decorators"

export {
	logFileWrite,
	logFileRead,
	logFileDelete,
	withFileOperationLogging,
	type FileOperationContext,
} from "./file-operation-logger"

export { logCommandExecution, withCommandLogging, type CommandExecutionContext } from "./command-logger"

export {
	logUserInteraction,
	logTaskStart,
	logTaskComplete,
	logUserMessage,
	logButtonClick,
	logSettingsChange,
	type UserInteractionContext,
} from "./interaction-logger"

export { withPerformanceLogging, logPerformanceMetrics, type PerformanceContext } from "./performance-logger"

export {
	checkLoggingHealth,
	checkAndLogHealth,
	startHealthCheckMonitoring,
	type HealthCheckResult,
} from "./health-check"

// Action logging helpers (renamed to avoid conflicts)
export {
	logAction,
	ActionLogger,
	LogAction,
	withActionLogging,
	logCommandExecution as logActionCommand,
	logUserInteraction as logActionInteraction,
	logApiRequest,
	logFileOperation as logActionFileOp,
	logExtensionEvent,
	type ActionContext,
	type ActionResult,
} from "../../services/logging/helpers/actionLogHelper"
