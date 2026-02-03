/**
 * Backend Logging Exports
 *
 * Central export file for all backend logging utilities.
 * This provides access to the logging client, service, and helper functions.
 */

export { BackendLoggingClient, getLoggingClient } from "./BackendLoggingClient"
export { LoggingService } from "./LoggingService"
export * from "./helpers"
export * from "./initializeFileOperationLogging"

export type {
	LoggingConfig,
	ActionLogData,
	ApiLogData,
	PerformanceLogData,
	UserInteractionLogData,
	FileOperationLogData,
	BatchLogData,
	LogListResponse,
	BatchLogResponse,
} from "./BackendLoggingClient"
