"""Validators and sanitizers for chat module"""
import re
import bleach
from typing import Optional


def sanitize_message_content(content: str) -> str:
    """
    Sanitize message content to prevent XSS attacks.
    For chat messages, we remove all HTML tags to ensure plain text only.
    """
    if not content:
        return content
    
    # Remove all HTML tags - chat messages should be plain text
    return bleach.clean(
        content,
        tags=[],  # No HTML tags allowed
        strip=True  # Strip tags instead of escaping
    )


def validate_emoji(emoji: str) -> bool:
    """
    Validate that emoji is a valid Unicode emoji character.
    Returns True if valid, False otherwise.
    """
    if not emoji or len(emoji) > 10:
        return False
    
    # Allow Unicode emoji range (basic emoji support)
    # This is a simplified check - a full implementation would use a proper emoji library
    emoji_pattern = r'^[\U0001F300-\U0001F9FF\u2600-\u26FF\u2700-\u27BF\U0001F600-\U0001F64F\U0001F680-\U0001F6FF\U0001F1E0-\U0001F1FF]+$'
    return bool(re.match(emoji_pattern, emoji))


def validate_channel_name(name: str) -> tuple[bool, Optional[str]]:
    """
    Validate channel name.
    Returns (is_valid, error_message)
    """
    if not name or not name.strip():
        return False, "Channel name is required"
    
    if len(name) > 100:
        return False, "Channel name must be less than 100 characters"
    
    # Check for invalid characters
    if not re.match(r'^[\w\s\-а-яА-ЯёЁ]+$', name):
        return False, "Channel name contains invalid characters"
    
    return True, None


def validate_message_content(content: str, max_length: int = 10000) -> tuple[bool, Optional[str]]:
    """
    Validate message content.
    Returns (is_valid, error_message)
    """
    if not content or not content.strip():
        return False, "Message content is required"
    
    if len(content) > max_length:
        return False, f"Message must be less than {max_length} characters"
    
    return True, None


def parse_mentions(content: str) -> set[str]:
    """
    Parse @mentions from message content.
    Returns set of mentioned usernames.
    """
    mention_pattern = r'@(\w+)'
    return set(re.findall(mention_pattern, content))
