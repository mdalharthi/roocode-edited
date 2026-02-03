/**
 * User Interaction Logger
 *
 * Provides logging utilities for user interactions in webview and UI components.
 */

import { LoggingService } from "../../services/logging/LoggingService"

export interface UserInteractionContext {
	sessionId?: string
	userId?: string
	actionLogId?: number
}

/**
 * Log a user interaction
 */
export async function logUserInteraction(
	interactionType: string,
	component: string,
	action?: string,
	result?: string,
	context?: Record<string, any>,
	userContext: UserInteractionContext = {},
): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	try {
		// Fire and forget - don't await to avoid blocking UI
		void LoggingService.instance.logUserInteraction({
			session_id: userContext.sessionId,
			user_id: userContext.userId,
			action_log_id: userContext.actionLogId,
			interaction_type: interactionType,
			component,
			action,
			result,
			context: context || {},
		})
	} catch (error) {
		console.error("[UserInteractionLogger] Failed to log interaction:", error)
	}
}

/**
 * Log a task start interaction
 */
export async function logTaskStart(
	taskType: string,
	taskData?: Record<string, any>,
	userContext: UserInteractionContext = {},
): Promise<void> {
	await logUserInteraction("task_start", "Task", taskType, "started", taskData, userContext)
}

/**
 * Log a task completion interaction
 */
export async function logTaskComplete(
	taskType: string,
	result: "success" | "failed" | "cancelled",
	taskData?: Record<string, any>,
	userContext: UserInteractionContext = {},
): Promise<void> {
	await logUserInteraction("task_complete", "Task", taskType, result, taskData, userContext)
}

/**
 * Log a user message/question
 */
export async function logUserMessage(
	messageType: string,
	message: string,
	metadata?: Record<string, any>,
	userContext: UserInteractionContext = {},
): Promise<void> {
	await logUserInteraction(
		"user_message",
		"Chat",
		messageType,
		"sent",
		{
			message: message.substring(0, 500), // Truncate long messages
			...metadata,
		},
		userContext,
	)
}

/**
 * Log a button click
 */
export async function logButtonClick(
	buttonName: string,
	component: string,
	metadata?: Record<string, any>,
	userContext: UserInteractionContext = {},
): Promise<void> {
	await logUserInteraction("button_click", component, buttonName, "clicked", metadata, userContext)
}

/**
 * Log a settings change
 */
export async function logSettingsChange(
	settingKey: string,
	oldValue: any,
	newValue: any,
	userContext: UserInteractionContext = {},
): Promise<void> {
	await logUserInteraction(
		"settings_change",
		"Settings",
		settingKey,
		"changed",
		{
			oldValue: String(oldValue),
			newValue: String(newValue),
		},
		userContext,
	)
}
