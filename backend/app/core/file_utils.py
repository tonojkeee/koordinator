"""
Shared file upload utilities to eliminate code duplication.
Used by auth, board, archive modules for consistent file handling.
"""
import os
import hashlib
from typing import BinaryIO, Tuple
from fastapi import UploadFile
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.file_security import validate_file_size, validate_file_type


async def save_uploaded_file(
    file: UploadFile,
    upload_dir: str,
    max_size_mb: int = 50,
    allowed_types: str = None,
    custom_filename: str = None
) -> Tuple[str, int]:
    """
    Save uploaded file to disk with validation.
    
    Args:
        file: UploadFile from FastAPI
        upload_dir: Directory to save file to
        max_size_mb: Maximum file size in MB (default: 50)
        allowed_types: Comma-separated allowed file types (default: all types)
        custom_filename: Custom filename to use (default: generate from original)
    
    Returns:
        Tuple of (file_path, file_size)
    
    Raises:
        HTTPException: If validation fails
    """
    validate_file_size(file, max_size_mb)
    validate_file_type(file, allowed_types)
    
    file_size = 0
    content = file.file
    
    os.makedirs(upload_dir, exist_ok=True)
    
    if custom_filename:
        filename = custom_filename
    else:
        filename = file.filename
    
    unique_filename = _generate_unique_filename(upload_dir, filename)
    file_path = os.path.join(upload_dir, unique_filename)
    
    with open(file_path, "wb") as f:
        while chunk := content.read(8192):
            f.write(chunk)
            file_size += len(chunk)
    
    return file_path, file_size


def _generate_unique_filename(directory: str, filename: str) -> str:
    """Generate unique filename to prevent overwrites."""
    name, ext = os.path.splitext(filename)
    counter = 1
    unique_name = filename
    
    while os.path.exists(os.path.join(directory, unique_name)):
        unique_name = f"{name}_{counter}{ext}"
        counter += 1
    
    return unique_name


async def calculate_file_size_bytes(max_mb_str: str) -> int:
    """Convert MB string to bytes."""
    try:
        max_mb = int(max_mb_str)
        return max_mb * 1024 * 1024
    except (ValueError, TypeError):
        return 50 * 1024 * 1024  # Default 50MB


def parse_allowed_types(allowed_types_str: str) -> set:
    """Parse comma-separated allowed types string into set."""
    if not allowed_types_str:
        return None
    return {t.strip().lower() for t in allowed_types_str.split(",")}


async def delete_file_safe(file_path: str) -> bool:
    """
    Safely delete file if it exists.
    
    Returns:
        True if file was deleted, False otherwise
    """
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
    except OSError as e:
        from app.core.config import get_settings
        logger = get_settings().get_logger(__name__)
        logger.error(f"Error deleting file {file_path}: {e}")
    return False
