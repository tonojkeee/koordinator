"""
Validation utilities for common input validation patterns.

This module provides reusable validation functions to reduce code duplication
and improve consistency across the application.
"""

import re
from typing import Tuple


def validate_password_strength(
    password: str,
    min_length: int = 8,
    require_uppercase: bool = False,
    require_lowercase: bool = False,
    require_digit: bool = False,
    require_special: bool = False
) -> Tuple[bool, str]:
    """
    Validate password strength against specified requirements.
    
    Args:
        password: Password to validate
        min_length: Minimum password length (default: 8)
        require_uppercase: Require at least one uppercase letter
        require_lowercase: Require at least one lowercase letter
        require_digit: Require at least one digit
        require_special: Require at least one special character
        
    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if password meets all requirements
        - error_message: Description of validation failure, empty if valid
        
    Example:
        is_valid, error = validate_password_strength(
            'MyPass123!',
            min_length=8,
            require_uppercase=True,
            require_digit=True
        )
        if not is_valid:
            raise ValueError(error)
    """
    if len(password) < min_length:
        return False, f"Password must be at least {min_length} characters"
    
    if require_uppercase and not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    
    if require_lowercase and not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    
    if require_digit and not re.search(r'\d', password):
        return False, "Password must contain at least one digit"
    
    if require_special and not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain at least one special character"
    
    return True, ""


def validate_email(email: str) -> Tuple[bool, str]:
    """
    Validate email address format.
    
    Args:
        email: Email address to validate
        
    Returns:
        Tuple of (is_valid, error_message)
        
    Example:
        is_valid, error = validate_email('user@example.com')
        if not is_valid:
            raise ValueError(error)
    """
    if not email:
        return False, "Email is required"
    
    # Basic email regex pattern
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    
    if not re.match(pattern, email):
        return False, "Invalid email format"
    
    return True, ""


def validate_emoji(emoji: str) -> bool:
    """
    Validate that string is a valid Unicode emoji character.
    
    Args:
        emoji: String to validate as emoji
        
    Returns:
        True if valid emoji, False otherwise
        
    Example:
        if not validate_emoji('👍'):
            raise ValueError("Invalid emoji")
    """
    if not emoji:
        return False
    
    # Basic emoji ranges (simplified)
    # This covers most common emojis but not all Unicode emoji sequences
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"  # emoticons
        "\U0001F300-\U0001F5FF"  # symbols & pictographs
        "\U0001F680-\U0001F6FF"  # transport & map symbols
        "\U0001F1E0-\U0001F1FF"  # flags
        "\U00002702-\U000027B0"  # dingbats
        "\U000024C2-\U0001F251"  # enclosed characters
        "]+",
        flags=re.UNICODE
    )
    
    return bool(emoji_pattern.match(emoji))


def validate_url(url: str, require_https: bool = False) -> Tuple[bool, str]:
    """
    Validate URL format.
    
    Args:
        url: URL to validate
        require_https: Require HTTPS protocol (default: False)
        
    Returns:
        Tuple of (is_valid, error_message)
        
    Example:
        is_valid, error = validate_url('https://example.com', require_https=True)
        if not is_valid:
            raise ValueError(error)
    """
    if not url:
        return False, "URL is required"
    
    # Basic URL pattern
    if require_https:
        pattern = r'^https://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$'
        if not re.match(pattern, url):
            return False, "Invalid HTTPS URL format"
    else:
        pattern = r'^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$'
        if not re.match(pattern, url):
            return False, "Invalid URL format"
    
    return True, ""


def validate_username(username: str, min_length: int = 3, max_length: int = 50) -> Tuple[bool, str]:
    """
    Validate username format.
    
    Args:
        username: Username to validate
        min_length: Minimum username length (default: 3)
        max_length: Maximum username length (default: 50)
        
    Returns:
        Tuple of (is_valid, error_message)
        
    Example:
        is_valid, error = validate_username('john_doe')
        if not is_valid:
            raise ValueError(error)
    """
    if not username:
        return False, "Username is required"
    
    if len(username) < min_length:
        return False, f"Username must be at least {min_length} characters"
    
    if len(username) > max_length:
        return False, f"Username must not exceed {max_length} characters"
    
    # Allow alphanumeric, underscore, and hyphen
    if not re.match(r'^[a-zA-Z0-9_-]+$', username):
        return False, "Username can only contain letters, numbers, underscores, and hyphens"
    
    return True, ""


def validate_phone_number(phone: str) -> Tuple[bool, str]:
    """
    Validate phone number format (basic validation).
    
    Args:
        phone: Phone number to validate
        
    Returns:
        Tuple of (is_valid, error_message)
        
    Example:
        is_valid, error = validate_phone_number('+79991234567')
        if not is_valid:
            raise ValueError(error)
    """
    if not phone:
        return False, "Phone number is required"
    
    # Remove common separators
    cleaned = re.sub(r'[\s\-\(\)]', '', phone)
    
    # Check if it's a valid phone number (10-15 digits, optionally starting with +)
    if not re.match(r'^\+?\d{10,15}$', cleaned):
        return False, "Invalid phone number format"
    
    return True, ""
