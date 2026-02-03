/**
 * User Interaction Logger Helper
 *
 * Provides helper functions for logging user interactions (prompts, system messages, task creation)
 * to the centralized logging service.
 */

import { LoggingService } from "../LoggingService"

export interface UserInteractionContext {
	sessionId?: string
	userId?: string
	actionLogId?: number
	metadata?: Record<string, any>
}

/**
 * Log a user prompt/message
 */
export async function logUserPrompt(prompt: string, context: UserInteractionContext = {}): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	try {
		await LoggingService.instance.logUserInteraction({
			session_id: context.sessionId,
			user_id: context.userId,
			action_log_id: context.actionLogId,
			interaction_type: "user_prompt",
			component: "chat_interface",
			action: "send_message",
			result: "success",
			context: {
				...context.metadata,
				prompt_length: prompt.length,
				prompt_preview: prompt.substring(0, 200), // Store preview in metadata
				full_prompt: prompt, // Store full prompt if needed, but be mindful of size
			},
		})
	} catch (error) {
		console.error("[UserInteractionLogger] Failed to log user prompt:", error)
	}
}

/**
 * Log a system message (assistant response or system notification)
 */
export async function logSystemMessage(
	message: string,
	type: "assistant_response" | "system_notification" | "error",
	context: UserInteractionContext = {},
): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	try {
		await LoggingService.instance.logUserInteraction({
			session_id: context.sessionId,
			user_id: context.userId,
			action_log_id: context.actionLogId,
			interaction_type: type,
			component: "chat_interface",
			action: "display_message",
			result: "success",
			context: {
				...context.metadata,
				message_length: message.length,
				message_preview: message.substring(0, 200),
			},
		})
	} catch (error) {
		console.error("[UserInteractionLogger] Failed to log system message:", error)
	}
}

/**
 * Log task creation
 */
export async function logTaskCreation(
	taskDescription: string,
	images: string[] = [],
	context: UserInteractionContext = {},
): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	try {
		await LoggingService.instance.logUserInteraction({
			session_id: context.sessionId,
			user_id: context.userId,
			action_log_id: context.actionLogId,
			interaction_type: "task_creation",
			component: "task_interface",
			action: "create_task",
			result: "success",
			context: {
				...context.metadata,
				has_images: images.length > 0,
				image_count: images.length,
				task_description_length: taskDescription.length,
				task_description: taskDescription,
			},
		})
	} catch (error) {
		console.error("[UserInteractionLogger] Failed to log task creation:", error)
	}
}

/**
 * Log a generic user interaction
 */
export async function logInteraction(
	interactionType: string,
	component: string,
	action: string,
	context: UserInteractionContext = {},
	details?: Record<string, any>,
): Promise<void> {
	if (!LoggingService.hasInstance() || !LoggingService.instance.isEnabled()) {
		return
	}

	try {
		await LoggingService.instance.logUserInteraction({
			session_id: context.sessionId,
			user_id: context.userId,
			action_log_id: context.actionLogId,
			interaction_type: interactionType,
			component: component,
			action: action,
			result: "success",
			context: {
				...context.metadata,
				...details,
			},
		})
	} catch (error) {
		console.error("[UserInteractionLogger] Failed to log interaction:", error)
	}
}
