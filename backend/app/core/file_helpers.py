"""
File operation helper utilities.

This module provides reusable functions for secure file operations
to reduce code duplication and improve security consistency.
"""

import os
from typing import Tuple
from pathlib import Path


def sanitize_file_path(
    base_dir: str,
    user_id: int,
    file_path: str
) -> Tuple[bool, str, str]:
    """
    Sanitize and validate file path to prevent path traversal attacks.
    
    Args:
        base_dir: Base directory for file storage
        user_id: User ID for user-specific directory
        file_path: Relative file path to validate
        
    Returns:
        Tuple of (is_valid, full_path, error_message)
        - is_valid: True if path is valid and safe
        - full_path: Absolute path if valid, empty string otherwise
        - error_message: Error description if invalid, empty string otherwise
        
    Example:
        is_valid, full_path, error = sanitize_file_path(
            UPLOAD_DIR, user_id, "documents/file.pdf"
        )
        if not is_valid:
            raise ValueError(error)
    """
    # Check for empty or suspicious path
    if not file_path or '..' in file_path:
        return False, '', "Invalid file path"
    
    # Build full path
    user_dir = os.path.join(base_dir, str(user_id))
    full_path = os.path.join(user_dir, file_path)
    
    # Normalize path to resolve any . or .. components
    full_path = os.path.normpath(full_path)
    user_dir = os.path.normpath(user_dir)
    
    # Check if file exists
    if not os.path.exists(full_path):
        return False, '', "File not found"
    
    # Verify path is within user directory (prevent path traversal)
    if not full_path.startswith(user_dir + os.sep):
        return False, '', "Path traversal detected"
    
    return True, full_path, ''


def ensure_user_directory(base_dir: str, user_id: int) -> str:
    """
    Ensure user-specific directory exists and return its path.
    
    Args:
        base_dir: Base directory for file storage
        user_id: User ID for user-specific directory
        
    Returns:
        Path to user directory
        
    Example:
        user_dir = ensure_user_directory(UPLOAD_DIR, current_user.id)
    """
    user_dir = os.path.join(base_dir, str(user_id))
    os.makedirs(user_dir, exist_ok=True)
    return user_dir


def get_safe_filename(filename: str) -> str:
    """
    Sanitize filename to prevent security issues.
    
    Removes or replaces potentially dangerous characters while
    preserving the file extension.
    
    Args:
        filename: Original filename
        
    Returns:
        Sanitized filename
        
    Example:
        safe_name = get_safe_filename("../../etc/passwd")
        # Returns: "etcpasswd"
    """
    # Remove path components
    filename = os.path.basename(filename)
    
    # Replace dangerous characters
    dangerous_chars = ['..', '/', '\\', '\0', '\n', '\r']
    for char in dangerous_chars:
        filename = filename.replace(char, '')
    
    # Ensure filename is not empty
    if not filename:
        filename = 'unnamed'
    
    return filename


def validate_file_path_exists(
    base_dir: str,
    user_id: int,
    file_path: str
) -> Tuple[bool, str]:
    """
    Validate that a file path exists and is safe (without returning full path).
    
    Args:
        base_dir: Base directory for file storage
        user_id: User ID for user-specific directory
        file_path: Relative file path to validate
        
    Returns:
        Tuple of (is_valid, error_message)
        
    Example:
        is_valid, error = validate_file_path_exists(UPLOAD_DIR, user_id, file_path)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error)
    """
    is_valid, _, error = sanitize_file_path(base_dir, user_id, file_path)
    return is_valid, error


def get_file_size(file_path: str) -> int:
    """
    Get file size in bytes.
    
    Args:
        file_path: Path to file
        
    Returns:
        File size in bytes, or 0 if file doesn't exist
        
    Example:
        size = get_file_size(full_path)
    """
    try:
        return os.path.getsize(file_path)
    except (OSError, FileNotFoundError):
        return 0


def delete_file_safe(file_path: str) -> bool:
    """
    Safely delete a file, handling errors gracefully.
    
    Args:
        file_path: Path to file to delete
        
    Returns:
        True if file was deleted, False otherwise
        
    Example:
        if delete_file_safe(full_path):
            print("File deleted successfully")
    """
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    except (OSError, PermissionError):
        return False
