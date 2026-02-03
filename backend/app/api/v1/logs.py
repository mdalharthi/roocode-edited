"""
Logging endpoints - CRUD operations for all 5 logging types.
Includes batch operations for efficient bulk logging.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models.action_log import ActionLog
from app.models.api_log import ApiLog
from app.models.performance_log import PerformanceLog
from app.models.user_interaction_log import UserInteractionLog
from app.models.file_operation_log import FileOperationLog
from app.schemas.logging import (
    ActionLogCreate,
    ActionLogUpdate,
    ActionLogResponse,
    ActionLogListResponse,
    ApiLogCreate,
    ApiLogResponse,
    ApiLogListResponse,
    PerformanceLogCreate,
    PerformanceLogResponse,
    PerformanceLogListResponse,
    UserInteractionLogCreate,
    UserInteractionLogResponse,
    UserInteractionLogListResponse,
    FileOperationLogCreate,
    FileOperationLogResponse,
    FileOperationLogListResponse,
    BatchLogCreate,
    BatchLogResponse,
)
from app.core.security import verify_api_key
from app.api.deps import PaginationParams, get_pagination

router = APIRouter()


# =====================
# Action Log Endpoints
# =====================


@router.get("/logs/actions", response_model=ActionLogListResponse)
async def list_action_logs(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    action_type: Optional[str] = Query(None, description="Filter by action type"),
    pagination: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """List action logs with optional filtering and pagination."""
    query = select(ActionLog).order_by(ActionLog.created_at.desc())

    if session_id:
        query = query.where(ActionLog.session_id == session_id)
    if action_type:
        query = query.where(ActionLog.action_type == action_type)

    # Get total count
    count_query = select(func.count()).select_from(ActionLog)
    if session_id:
        count_query = count_query.where(ActionLog.session_id == session_id)
    if action_type:
        count_query = count_query.where(ActionLog.action_type == action_type)
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination
    query = query.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return ActionLogListResponse(
        logs=[ActionLogResponse.model_validate(log) for log in logs],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.post("/logs/actions", response_model=ActionLogResponse, status_code=201)
async def create_action_log(
    log_data: ActionLogCreate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Create a new action log entry."""
    log = ActionLog(
        session_id=log_data.session_id,
        user_id=log_data.user_id,
        workspace_id=log_data.workspace_id,
        action_type=log_data.action_type,
        action_name=log_data.action_name,
        status=log_data.status,
        error_message=log_data.error_message,
        error_stack=log_data.error_stack,
        input_data=log_data.input_data,
        output_data=log_data.output_data,
        response_code=log_data.response_code,
        duration=log_data.duration,
        action_metadata=log_data.action_metadata or {},
    )

    db.add(log)
    await db.flush()  # Flush to get the ID

    # Auto-create user_interaction log if action_type is "user_interaction"
    if log_data.action_type == "user_interaction":
        user_interaction_log = UserInteractionLog(
            action_log_id=log.id,
            session_id=log_data.session_id,
            user_id=log_data.user_id,
            interaction_type=log_data.action_name,  # e.g., "ask", "webview_response"
            component=log_data.action_metadata.get("component", "Task") if log_data.action_metadata else "Task",
            action=log_data.input_data.get("askType") if log_data.input_data else None,
            result=None,  # Will be updated later when action completes
            context=log_data.input_data or {},
        )
        db.add(user_interaction_log)

    await db.commit()
    await db.refresh(log)

    return ActionLogResponse.model_validate(log)


@router.patch("/logs/actions/{log_id}", response_model=ActionLogResponse)
async def update_action_log(
    log_id: int,
    log_data: ActionLogUpdate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Update an existing action log entry."""
    result = await db.execute(select(ActionLog).where(ActionLog.id == log_id))
    log = result.scalar_one_or_none()

    if not log:
        # If log not found, we might want to create it or return 404.
        # For now, let's return 404 behavior via HTTPException (implied if not found handling)
        # But typically we'd raise HTTPException(status_code=404, detail="Log not found")
        # However, to avoid importing HTTPException just for this, I will assume it exists or handle it.
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Action log not found")

    # Update fields if provided
    if log_data.status is not None:
        log.status = log_data.status
    if log_data.error_message is not None:
        log.error_message = log_data.error_message
    if log_data.error_stack is not None:
        log.error_stack = log_data.error_stack
    if log_data.input_data is not None:
        # Merge input_data to preserve existing fields and add new ones
        if log.input_data:
            log.input_data = {**log.input_data, **log_data.input_data}
        else:
            log.input_data = log_data.input_data

        # Also update the context in the associated user_interaction_log if it exists
        if log.action_type == "user_interaction":
            result = await db.execute(
                select(UserInteractionLog).where(
                    UserInteractionLog.action_log_id == log.id,
                    UserInteractionLog.interaction_type == log.action_name
                )
            )
            user_interaction_log = result.scalar_one_or_none()
            if user_interaction_log:
                # Merge the context with new input_data
                if user_interaction_log.context:
                    user_interaction_log.context = {**user_interaction_log.context, **log_data.input_data}
                else:
                    user_interaction_log.context = log_data.input_data
    if log_data.output_data is not None:
        log.output_data = log_data.output_data
    if log_data.response_code is not None:
        log.response_code = log_data.response_code
    if log_data.duration is not None:
        log.duration = log_data.duration
    if log_data.action_metadata is not None:
        # Merge metadata or replace? Usually merge is better for metadata, but replace is simpler.
        # Let's assume replace for consistency with other updates, or merge if needed.
        # For now, let's do a shallow merge if it exists
        if log.action_metadata:
            log.action_metadata = {**log.action_metadata, **log_data.action_metadata}
        else:
            log.action_metadata = log_data.action_metadata

    # Auto-create completion action_log and user_interaction_log if completion_interaction is provided
    if log_data.completion_interaction and log.action_type == "user_interaction":
        completion_data = log_data.completion_interaction

        # Create a new action_log entry for the completion event
        completion_action_log = ActionLog(
            session_id=log.session_id,
            user_id=log.user_id,
            workspace_id=log.workspace_id,
            action_type="user_interaction",
            action_name=completion_data.get("interaction_type", f"{log.action_name}_completed"),
            status="completed",
            input_data=completion_data.get("context", {}),
            output_data=completion_data.get("context", {}),
            duration=log.duration,  # Inherit duration from parent
            action_metadata=log.action_metadata,
        )
        db.add(completion_action_log)
        await db.flush()  # Flush to get the new action_log ID

        # Create user_interaction_log referencing the new action_log
        user_interaction_log = UserInteractionLog(
            action_log_id=completion_action_log.id,
            session_id=log.session_id,
            user_id=log.user_id,
            interaction_type=completion_data.get("interaction_type", f"{log.action_name}_completed"),
            component=completion_data.get("component", log.action_metadata.get("component", "Task") if log.action_metadata else "Task"),
            action=completion_data.get("action"),
            result=completion_data.get("result", "success"),
            context=completion_data.get("context", {}),
        )
        db.add(user_interaction_log)

    await db.commit()
    await db.refresh(log)

    return ActionLogResponse.model_validate(log)


# =====================
# API Log Endpoints
# =====================


@router.get("/logs/api", response_model=ApiLogListResponse)
async def list_api_logs(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    provider: Optional[str] = Query(None, description="Filter by provider"),
    pagination: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """List API logs with optional filtering and pagination."""
    query = select(ApiLog).order_by(ApiLog.created_at.desc())

    if session_id:
        query = query.where(ApiLog.session_id == session_id)
    if provider:
        query = query.where(ApiLog.provider == provider)

    # Get total count
    count_query = select(func.count()).select_from(ApiLog)
    if session_id:
        count_query = count_query.where(ApiLog.session_id == session_id)
    if provider:
        count_query = count_query.where(ApiLog.provider == provider)
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination
    query = query.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return ApiLogListResponse(
        logs=[ApiLogResponse.model_validate(log) for log in logs],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.post("/logs/api", response_model=ApiLogResponse, status_code=201)
async def create_api_log(
    log_data: ApiLogCreate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Create a new API log entry."""
    log = ApiLog(
        action_log_id=log_data.action_log_id,
        session_id=log_data.session_id,
        provider=log_data.provider,
        model=log_data.model,
        url=log_data.url,
        endpoint=log_data.endpoint,
        method=log_data.method,
        status_code=log_data.status_code,
        request_headers=log_data.request_headers or {},
        request_body=log_data.request_body or {},
        response_headers=log_data.response_headers or {},
        response_body=log_data.response_body or {},
        error_message=log_data.error_message,
        duration_ms=log_data.duration_ms,
        tokens_used=log_data.tokens_used,
        cost=log_data.cost,
        retry_count=log_data.retry_count or 0,
    )

    db.add(log)
    await db.commit()
    await db.refresh(log)

    return ApiLogResponse.model_validate(log)


# =====================
# Performance Log Endpoints
# =====================


@router.get("/logs/performance", response_model=PerformanceLogListResponse)
async def list_performance_logs(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    operation_type: Optional[str] = Query(None, description="Filter by operation type"),
    pagination: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """List performance logs with optional filtering and pagination."""
    query = select(PerformanceLog).order_by(PerformanceLog.created_at.desc())

    if session_id:
        query = query.where(PerformanceLog.session_id == session_id)
    if operation_type:
        query = query.where(PerformanceLog.operation_type == operation_type)

    # Get total count
    count_query = select(func.count()).select_from(PerformanceLog)
    if session_id:
        count_query = count_query.where(PerformanceLog.session_id == session_id)
    if operation_type:
        count_query = count_query.where(PerformanceLog.operation_type == operation_type)
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination
    query = query.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return PerformanceLogListResponse(
        logs=[PerformanceLogResponse.model_validate(log) for log in logs],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.post("/logs/performance", response_model=PerformanceLogResponse, status_code=201)
async def create_performance_log(
    log_data: PerformanceLogCreate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Create a new performance log entry."""
    log = PerformanceLog(
        session_id=log_data.session_id,
        operation_name=log_data.operation_name,
        operation_type=log_data.operation_type,
        duration_ms=log_data.duration_ms,
        execution_time=int(round(log_data.duration_ms)) if log_data.duration_ms is not None else None,
        cpu_usage=log_data.cpu_usage,
        memory_usage=log_data.memory_usage,
        memory_usage_mb=log_data.memory_usage_mb,
        file_size_bytes=log_data.file_size_bytes,
        throughput=log_data.throughput,
        action_log_id=log_data.action_log_id,
        resource_metrics=log_data.resource_metrics or {},
        additional_metrics=log_data.additional_metrics or {},
    )

    db.add(log)
    await db.commit()
    await db.refresh(log)

    return PerformanceLogResponse.model_validate(log)


# =====================
# User Interaction Log Endpoints
# =====================


@router.get("/logs/user-interactions", response_model=UserInteractionLogListResponse)
async def list_user_interaction_logs(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    interaction_type: Optional[str] = Query(None, description="Filter by interaction type"),
    pagination: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """List user interaction logs with optional filtering and pagination."""
    query = select(UserInteractionLog).order_by(UserInteractionLog.created_at.desc())

    if session_id:
        query = query.where(UserInteractionLog.session_id == session_id)
    if interaction_type:
        query = query.where(UserInteractionLog.interaction_type == interaction_type)

    # Get total count
    count_query = select(func.count()).select_from(UserInteractionLog)
    if session_id:
        count_query = count_query.where(UserInteractionLog.session_id == session_id)
    if interaction_type:
        count_query = count_query.where(UserInteractionLog.interaction_type == interaction_type)
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination
    query = query.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return UserInteractionLogListResponse(
        logs=[UserInteractionLogResponse.model_validate(log) for log in logs],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.post("/logs/user-interactions", response_model=UserInteractionLogResponse, status_code=201)
async def create_user_interaction_log(
    log_data: UserInteractionLogCreate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Create a new user interaction log entry."""
    log = UserInteractionLog(
        action_log_id=log_data.action_log_id,
        session_id=log_data.session_id,
        user_id=log_data.user_id,
        interaction_type=log_data.interaction_type,
        component=log_data.component,
        action=log_data.action,
        result=log_data.result,
        context=log_data.context or {},
    )

    db.add(log)
    await db.commit()
    await db.refresh(log)

    return UserInteractionLogResponse.model_validate(log)


# =====================
# File Operation Log Endpoints
# =====================


@router.get("/logs/file-operations", response_model=FileOperationLogListResponse)
async def list_file_operation_logs(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    operation: Optional[str] = Query(None, description="Filter by operation type"),
    pagination: PaginationParams = Depends(get_pagination),
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """List file operation logs with optional filtering and pagination."""
    query = select(FileOperationLog).order_by(FileOperationLog.created_at.desc())

    if session_id:
        query = query.where(FileOperationLog.session_id == session_id)
    if operation:
        query = query.where(FileOperationLog.operation == operation)

    # Get total count
    count_query = select(func.count()).select_from(FileOperationLog)
    if session_id:
        count_query = count_query.where(FileOperationLog.session_id == session_id)
    if operation:
        count_query = count_query.where(FileOperationLog.operation == operation)
    result = await db.execute(count_query)
    total = result.scalar_one()

    # Apply pagination
    query = query.offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    logs = result.scalars().all()

    return FileOperationLogListResponse(
        logs=[FileOperationLogResponse.model_validate(log) for log in logs],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
    )


@router.post("/logs/file-operations", response_model=FileOperationLogResponse, status_code=201)
async def create_file_operation_log(
    log_data: FileOperationLogCreate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """Create a new file operation log entry."""
    log = FileOperationLog(
        session_id=log_data.session_id,
        operation=log_data.operation,
        mode=log_data.mode,
        file_path=log_data.file_path,
        file_size_bytes=log_data.file_size_bytes,
        duration_ms=log_data.duration_ms,
        success=log_data.success,
        error_message=log_data.error_message,
        file_metadata=log_data.file_metadata or {},
        action_log_id=log_data.action_log_id,
        version_before=log_data.version_before,
        version_after=log_data.version_after,
        previous_total_lines=log_data.previous_total_lines,
        new_total_lines=log_data.new_total_lines,
        new_lines_added=log_data.new_lines_added,
        lines_removed=log_data.lines_removed,
        lines_modified=log_data.lines_modified,
        non_empty_lines_before=log_data.non_empty_lines_before,
        non_empty_lines_after=log_data.non_empty_lines_after,
        content_type=log_data.content_type,
    )

    db.add(log)
    await db.commit()
    await db.refresh(log)

    return FileOperationLogResponse.model_validate(log)


# =====================
# Batch Operations
# =====================


@router.post("/logs/batch", response_model=BatchLogResponse, status_code=201)
async def batch_create_logs(
    batch_data: BatchLogCreate,
    db: AsyncSession = Depends(get_db),
    _api_key: str = Depends(verify_api_key),
):
    """
    Batch create multiple log entries at once for efficient bulk logging.
    Accepts logs for all 5 log types and creates them in a single transaction.
    """
    counts = {
        "action_logs_created": 0,
        "api_logs_created": 0,
        "performance_logs_created": 0,
        "user_interaction_logs_created": 0,
        "file_operation_logs_created": 0,
    }
    errors = []
    
    # Map client_id to real_id for batch correlation
    client_id_map = {}

    try:
        # Create action logs
        if batch_data.action_logs:
            action_log_instances = []
            for log_data in batch_data.action_logs:
                log = ActionLog(
                    session_id=log_data.session_id,
                    user_id=log_data.user_id,
                    workspace_id=log_data.workspace_id,
                    action_type=log_data.action_type,
                    action_name=log_data.action_name,
                    status=log_data.status or "pending",
                    response_code=log_data.response_code,
                    duration=log_data.duration,
                    input_data=log_data.input_data or {},
                    output_data=log_data.output_data or {},
                    error_message=log_data.error_message,
                    error_stack=log_data.error_stack,
                    action_metadata=log_data.action_metadata or {},
                )
                db.add(log)
                action_log_instances.append((log, log_data.client_id, log_data))

            # Flush to generate IDs for correlation
            await db.flush()

            # Populate map and auto-create user_interaction logs for user_interaction action_type
            for log, client_id, log_data in action_log_instances:
                if client_id is not None:
                    client_id_map[client_id] = log.id

                # Auto-create user_interaction log if action_type is "user_interaction"
                if log_data.action_type == "user_interaction":
                    user_interaction_log = UserInteractionLog(
                        action_log_id=log.id,
                        session_id=log_data.session_id,
                        user_id=log_data.user_id,
                        interaction_type=log_data.action_name,  # e.g., "ask", "webview_response"
                        component=log_data.action_metadata.get("component", "Task") if log_data.action_metadata else "Task",
                        action=log_data.input_data.get("askType") if log_data.input_data else None,
                        result=None,  # Will be updated later when action completes
                        context=log_data.input_data or {},
                    )
                    db.add(user_interaction_log)
                    counts["user_interaction_logs_created"] = counts.get("user_interaction_logs_created", 0) + 1

            counts["action_logs_created"] = len(batch_data.action_logs)

        # Create API logs
        if batch_data.api_logs:
            for log_data in batch_data.api_logs:
                # Resolve action_log_id from client_action_log_id if present
                action_log_id = log_data.action_log_id
                if log_data.client_action_log_id is not None and log_data.client_action_log_id in client_id_map:
                    action_log_id = client_id_map[log_data.client_action_log_id]

                log = ApiLog(
                    action_log_id=action_log_id,
                    session_id=log_data.session_id,
                    provider=log_data.provider,
                    model=log_data.model,
                    url=log_data.url,
                    endpoint=log_data.endpoint,
                    method=log_data.method,
                    status_code=log_data.status_code,
                    request_headers=log_data.request_headers or {},
                    request_body=log_data.request_body or {},
                    response_headers=log_data.response_headers or {},
                    response_body=log_data.response_body or {},
                    error_message=log_data.error_message,
                    duration_ms=log_data.duration_ms,
                    tokens_used=log_data.tokens_used,
                    cost=log_data.cost,
                    retry_count=log_data.retry_count or 0,
                )
                db.add(log)
            counts["api_logs_created"] = len(batch_data.api_logs)

        # Create performance logs
        if batch_data.performance_logs:
            for log_data in batch_data.performance_logs:
                # Resolve action_log_id from client_action_log_id if present
                action_log_id = log_data.action_log_id
                if log_data.client_action_log_id is not None and log_data.client_action_log_id in client_id_map:
                    action_log_id = client_id_map[log_data.client_action_log_id]

                log = PerformanceLog(
                    session_id=log_data.session_id,
                    operation_name=log_data.operation_name,
                    operation_type=log_data.operation_type,
                    duration_ms=log_data.duration_ms,
                    execution_time=int(round(log_data.duration_ms)) if log_data.duration_ms is not None else None,
                    cpu_usage=log_data.cpu_usage,
                    memory_usage=log_data.memory_usage,
                    memory_usage_mb=log_data.memory_usage_mb,
                    file_size_bytes=log_data.file_size_bytes,
                    throughput=log_data.throughput,
                    action_log_id=action_log_id,
                    resource_metrics=log_data.resource_metrics or {},
                    additional_metrics=log_data.additional_metrics or {},
                )
                db.add(log)
            counts["performance_logs_created"] = len(batch_data.performance_logs)

        # Create user interaction logs
        if batch_data.user_interaction_logs:
            for log_data in batch_data.user_interaction_logs:
                # Resolve action_log_id from client_action_log_id if present
                action_log_id = log_data.action_log_id
                if log_data.client_action_log_id is not None and log_data.client_action_log_id in client_id_map:
                    action_log_id = client_id_map[log_data.client_action_log_id]

                log = UserInteractionLog(
                    action_log_id=action_log_id,
                    session_id=log_data.session_id,
                    user_id=log_data.user_id,
                    interaction_type=log_data.interaction_type,
                    component=log_data.component,
                    action=log_data.action,
                    result=log_data.result,
                    context=log_data.context or {},
                )
                db.add(log)
            counts["user_interaction_logs_created"] = len(batch_data.user_interaction_logs)

        # Create file operation logs
        if batch_data.file_operation_logs:
            for log_data in batch_data.file_operation_logs:
                # Resolve action_log_id from client_action_log_id if present
                action_log_id = log_data.action_log_id
                if log_data.client_action_log_id is not None and log_data.client_action_log_id in client_id_map:
                    action_log_id = client_id_map[log_data.client_action_log_id]

                log = FileOperationLog(
                    session_id=log_data.session_id,
                    operation=log_data.operation,
                    mode=log_data.mode,
                    file_path=log_data.file_path,
                    file_size_bytes=log_data.file_size_bytes,
                    duration_ms=log_data.duration_ms,
                    success=log_data.success,
                    error_message=log_data.error_message,
                    file_metadata=log_data.file_metadata or {},
                    action_log_id=action_log_id,
                    version_before=log_data.version_before,
                    version_after=log_data.version_after,
                    previous_total_lines=log_data.previous_total_lines,
                    new_total_lines=log_data.new_total_lines,
                    new_lines_added=log_data.new_lines_added,
                    lines_removed=log_data.lines_removed,
                    lines_modified=log_data.lines_modified,
                    non_empty_lines_before=log_data.non_empty_lines_before,
                    non_empty_lines_after=log_data.non_empty_lines_after,
                    content_type=log_data.content_type,
                )
                db.add(log)
            counts["file_operation_logs_created"] = len(batch_data.file_operation_logs)

        await db.commit()

    except Exception as e:
        await db.rollback()
        errors.append(f"Batch operation failed: {str(e)}")

    total_created = sum(counts.values())

    return BatchLogResponse(
        action_logs_created=counts["action_logs_created"],
        api_logs_created=counts["api_logs_created"],
        performance_logs_created=counts["performance_logs_created"],
        user_interaction_logs_created=counts["user_interaction_logs_created"],
        file_operation_logs_created=counts["file_operation_logs_created"],
        total_created=total_created,
        errors=errors,
        id_map=client_id_map,
    )
