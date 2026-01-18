"""
File security utilities for safe file operations and serving.
"""
import os
import magic
from PIL import Image
import io
from typing import Tuple, Optional, Set
from fastapi import UploadFile, HTTPException
from fastapi.responses import FileResponse
import logging

logger = logging.getLogger(__name__)


def safe_file_path(file_path: str, base_dir: str) -> str:
    """
    Safely resolve file path within base directory.
    Prevents path traversal attacks.
    
    Args:
        file_path: The file path from database or user input
        base_dir: The base directory that files must be within
        
    Returns:
        Absolute path to the file
        
    Raises:
        HTTPException: If path traversal is detected or file is outside base directory
    """
    # Get absolute path of base directory
    base_abs = os.path.abspath(base_dir)
    
    # Extract filename only (ignore any path components)
    # This is the most secure approach - only use the basename
    filename = os.path.basename(file_path.lstrip("/"))
    
    # Construct safe path
    safe_path = os.path.join(base_abs, filename)
    
    # Resolve to absolute path
    resolved_path = os.path.abspath(safe_path)
    
    # Verify it's still within base directory
    if not resolved_path.startswith(base_abs + os.sep):
        logger.warning(f"Path traversal attempt detected: {file_path}")
        raise HTTPException(status_code=403, detail="Access denied")
    
    return resolved_path


def safe_file_operation(file_path: str, base_dir: str) -> str:
    """
    Safely resolve file path for operations like delete/copy.
    More permissive than safe_file_path as it allows subdirectories.
    
    Args:
        file_path: The file path from database
        base_dir: The base directory that files must be within
        
    Returns:
        Absolute path to the file
        
    Raises:
        ValueError: If path traversal is detected
    """
    # Get absolute paths
    base_abs = os.path.abspath(base_dir)
    
    # Remove leading slash and resolve
    clean_path = file_path.lstrip("/")
    full_path = os.path.abspath(os.path.join(base_abs, clean_path))
    
    # Verify path is within base directory
    if not full_path.startswith(base_abs + os.sep):
        logger.error(f"Path traversal detected in file operation: {file_path}")
        raise ValueError(f"Path traversal detected: {file_path}")
    
    return full_path


def secure_file_response(
    path: str,
    filename: Optional[str] = None,
    media_type: Optional[str] = None,
    content_disposition: str = "attachment"
) -> FileResponse:
    """
    Create a FileResponse with security headers.
    
    Args:
        path: Path to the file
        filename: Optional filename for download
        media_type: Optional MIME type
        content_disposition: "attachment" or "inline"
        
    Returns:
        FileResponse with security headers
    """
    response = FileResponse(
        path,
        filename=filename,
        media_type=media_type,
        content_disposition_type=content_disposition
    )
    
    # Prevent content sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    
    # Prevent embedding in iframes (clickjacking)
    response.headers["X-Frame-Options"] = "DENY"
    
    # Content Security Policy for inline viewing
    if content_disposition == "inline":
        response.headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    
    # Prevent caching of sensitive files
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"
    
    return response


# Extension to MIME type mapping for validation
EXTENSION_MIME_MAP = {
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.png': ['image/png'],
    '.gif': ['image/gif'],
    '.webp': ['image/webp'],
    '.pdf': ['application/pdf'],
    '.doc': ['application/msword'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    '.xls': ['application/vnd.ms-excel'],
    '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    '.txt': ['text/plain'],
    '.csv': ['text/csv', 'text/plain'],
    '.zip': ['application/zip'],
    '.rar': ['application/x-rar-compressed', 'application/vnd.rar'],
}

# Safe image types (no SVG due to XSS risk)
SAFE_IMAGE_TYPES = {'image/jpeg', 'image/png', 'image/gif', 'image/webp'}


def validate_file_upload(
    file: UploadFile, 
    allowed_extensions: Set[str],
    max_size: Optional[int] = None,
    check_magic_bytes: bool = True
) -> Tuple[bool, str]:
    """
    Comprehensive file validation.
    
    Args:
        file: The uploaded file
        allowed_extensions: Set of allowed file extensions (e.g., {'.pdf', '.jpg'})
        max_size: Maximum file size in bytes (optional)
        check_magic_bytes: Whether to verify file content matches extension
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    # 1. Check extension
    extension = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if extension not in allowed_extensions:
        return False, f"File extension {extension} not allowed"
    
    # 2. Read file content for validation
    try:
        file_content = file.file.read(8192)  # Read first 8KB
        file.file.seek(0)  # Reset for later reading
    except Exception as e:
        logger.error(f"Error reading file for validation: {e}")
        return False, "Error reading file"
    
    # 3. Check file size if specified
    if max_size:
        file.file.seek(0, 2)  # Seek to end
        size = file.file.tell()
        file.file.seek(0)  # Reset
        if size > max_size:
            return False, f"File too large (max {max_size} bytes)"
    
    # 4. Verify magic bytes if requested
    if check_magic_bytes and extension in EXTENSION_MIME_MAP:
        try:
            mime = magic.from_buffer(file_content, mime=True)
            expected_mimes = EXTENSION_MIME_MAP[extension]
            if mime not in expected_mimes:
                logger.warning(f"File content ({mime}) doesn't match extension ({extension})")
                return False, f"File content doesn't match extension"
        except Exception as e:
            logger.error(f"Error checking magic bytes: {e}")
            # Don't fail validation if magic check fails, just log it
            pass
    
    # 5. For images, verify they can be opened
    if extension in {'.jpg', '.jpeg', '.png', '.gif', '.webp'}:
        try:
            img = Image.open(io.BytesIO(file_content))
            img.verify()
            file.file.seek(0)  # Reset after verify
        except Exception as e:
            logger.warning(f"Invalid or corrupted image file: {e}")
            return False, "Invalid or corrupted image file"
    
    # 6. Check for dangerous content patterns
    dangerous_patterns = [
        b'<?php',
        b'<script',
        b'<%',
        b'#!/',
    ]
    for pattern in dangerous_patterns:
        if pattern in file_content:
            logger.warning(f"File contains potentially dangerous content: {pattern}")
            return False, "File contains potentially dangerous content"
    
    return True, ""


def validate_avatar_upload(file: UploadFile, max_size: int = 2 * 1024 * 1024) -> Tuple[bool, str]:
    """
    Validate avatar image upload.
    Only allows safe image formats (no SVG).
    
    Args:
        file: The uploaded file
        max_size: Maximum file size in bytes (default 2MB)
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    # Check content type
    if file.content_type not in SAFE_IMAGE_TYPES:
        return False, "Only JPEG, PNG, GIF, and WebP images allowed"
    
    # Validate with comprehensive checks
    return validate_file_upload(
        file,
        allowed_extensions={'.jpg', '.jpeg', '.png', '.gif', '.webp'},
        max_size=max_size,
        check_magic_bytes=True
    )
