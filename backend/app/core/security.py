from datetime import datetime, timedelta
from typing import Optional
import hashlib
import bcrypt
from jose import JWTError, jwt
from app.core.config import get_settings

settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password using SHA-256 raw digest pre-hashing"""
    try:
        # We use raw digest (32 bytes) for maximum efficiency and to stay well under bcrypt's 72-byte limit
        pre_hashed = hashlib.sha256(plain_password.encode('utf-8')).digest()
        # Ensure we are comparing bytes to bytes
        return bcrypt.checkpw(pre_hashed, hashed_password.encode('utf-8'))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hash a password using SHA-256 raw digest pre-hashing with bcrypt (12 rounds)"""
    pre_hashed = hashlib.sha256(password.encode('utf-8')).digest()
    salt = bcrypt.gensalt(rounds=12)  # Explicitly set to 12 rounds (minimum recommended)
    hashed = bcrypt.hashpw(pre_hashed, salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    # Standard: sub should be a string
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
        
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a long-lived JWT refresh token"""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days)
    
    # Standard: sub should be a string
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
        
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT token"""
    import logging
    logger = logging.getLogger("app.security")
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error decoding token: {e}")
        return None
