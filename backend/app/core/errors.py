"""
Centralized error handling and sanitization for the application.

This module provides utilities to:
1. Log detailed error information for debugging
2. Return sanitized error messages to clients
3. Prevent sensitive information disclosure
"""

import logging
from typing import Optional, Dict, Any
from app.core.config import get_settings

logger = logging.getLogger(__name__)


def sanitize_error_for_client(
    error: Exception,
    user_message: str,
    log_context: Optional[Dict[str, Any]] = None,
    include_details_in_debug: bool = True
) -> str:
    """
    Log detailed error internally, return generic message to client.
    
    This function ensures that:
    - Detailed error information is logged for debugging
    - Only safe, generic messages are returned to clients
    - Sensitive information (paths, database details, etc.) is not exposed
    
    Args:
        error: The exception that occurred
        user_message: Safe message to return to the user
        log_context: Additional context to include in logs (optional)
        include_details_in_debug: If True and DEBUG=true, include error details in response
        
    Returns:
        str: Sanitized error message safe to return to client
        
    Example:
        try:
            # Some database operation
            result = await db.execute(query)
        except Exception as e:
            error_msg = sanitize_error_for_client(
                e,
                "Database operation failed. Please try again.",
                {"operation": "user_query", "user_id": user.id}
            )
            raise HTTPException(status_code=500, detail=error_msg)
    """
    settings = get_settings()
    
    # Log full error details for debugging
    logger.error(
        f"Error: {user_message}",
        exc_info=error,
        extra=log_context or {},
        stack_info=True
    )
    
    # In debug mode, optionally include error details for development
    if settings.debug and include_details_in_debug:
        # Still sanitize somewhat - don't expose full stack traces
        error_type = type(error).__name__
        error_str = str(error)
        # Truncate very long error messages
        if len(error_str) > 200:
            error_str = error_str[:200] + "..."
        return f"{user_message} [DEBUG: {error_type}: {error_str}]"
    
    # In production, return only the generic message
    return user_message


def sanitize_database_error(error: Exception, operation: str = "database operation") -> str:
    """
    Sanitize database-specific errors.
    
    Database errors often contain sensitive information like:
    - Database type and version
    - Host and port information
    - Table and column names
    - SQL query details
    
    Args:
        error: The database exception
        operation: Description of the operation that failed
        
    Returns:
        str: Sanitized error message
    """
    return sanitize_error_for_client(
        error,
        f"The {operation} failed. Please verify your configuration and try again.",
        {"error_type": "database", "operation": operation}
    )


def sanitize_file_error(error: Exception, operation: str = "file operation") -> str:
    """
    Sanitize file system errors.
    
    File errors can expose:
    - Internal directory structure
    - File paths
    - Permission details
    
    Args:
        error: The file system exception
        operation: Description of the operation that failed
        
    Returns:
        str: Sanitized error message
    """
    return sanitize_error_for_client(
        error,
        f"The {operation} failed. Please check your configuration.",
        {"error_type": "filesystem", "operation": operation}
    )


def sanitize_validation_error(error: Exception, field: Optional[str] = None) -> str:
    """
    Sanitize validation errors.
    
    Validation errors are generally safe to expose, but we still
    want to ensure they don't leak internal details.
    
    Args:
        error: The validation exception
        field: The field that failed validation (optional)
        
    Returns:
        str: Sanitized error message
    """
    error_str = str(error)
    # Validation errors are usually safe, but truncate if too long
    if len(error_str) > 500:
        error_str = error_str[:500] + "..."
    
    if field:
        return f"Validation failed for field '{field}': {error_str}"
    return f"Validation failed: {error_str}"


class SanitizedHTTPException(Exception):
    """
    Custom exception that automatically sanitizes error messages.
    
    Use this instead of directly raising HTTPException when you want
    to ensure error details are logged but not exposed to clients.
    """
    
    def __init__(
        self,
        status_code: int,
        detail: str,
        error: Optional[Exception] = None,
        log_context: Optional[Dict[str, Any]] = None
    ) -> None:
        self.status_code = status_code
        self.detail = detail
        self.error = error
        self.log_context = log_context
        
        # Log the error if provided
        if error:
            sanitize_error_for_client(error, detail, log_context)
        
        super().__init__(detail)
