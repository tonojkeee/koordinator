from pydantic_settings import BaseSettings
from functools import lru_cache
import json
import os


def get_app_version() -> str:
    """Read version from frontend/package.json"""
    try:
        # Try different paths to find package.json depending on where the app is started from
        paths_to_try = [
            "frontend/package.json",
            "../frontend/package.json",
            "../../frontend/package.json",
        ]
        for path in paths_to_try:
            if os.path.exists(path):
                with open(path, "r") as f:
                    return json.load(f).get("version", "1.0.0")
    except Exception:
        pass
    return "1.0.0"


class Settings(BaseSettings):
    """Application settings"""
    
    # App
    app_name: str = "«КООРДИНАТОР»"
    app_version: str = get_app_version()
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    use_https: bool = os.getenv("USE_HTTPS", "false").lower() == "true"
    server_domain: str = os.getenv("SERVER_DOMAIN", "") # e.g., backend_coord.40919.com
    
    # Error handling - expose details only in debug mode
    expose_error_details: bool = False  # Will be set based on debug mode
    
    # Database
    # backend/app/core/config.py -> backend/app/core -> backend/app -> backend
    _backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    _default_db_url = f"sqlite+aiosqlite:///{os.path.join(_backend_dir, 'teamchat.db')}"
    database_url: str = os.getenv("DATABASE_URL", _default_db_url)
    
    # Database Pool Settings (for MySQL/PostgreSQL)
    db_pool_size: int = int(os.getenv("DB_POOL_SIZE", "10"))
    db_max_overflow: int = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    db_pool_timeout: int = int(os.getenv("DB_POOL_TIMEOUT", "30"))
    db_pool_recycle: int = int(os.getenv("DB_POOL_RECYCLE", "1800"))
    
    # Redis (optional, for scaling)
    redis_url: str = os.getenv("REDIS_URL", "")
    
    # Security
    secret_key: str = os.getenv("SECRET_KEY", "")
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8 hours for better UX
    refresh_token_expire_days: int = 30
    
    # CORS - requires explicit configuration, no wildcards by default
    cors_origins: list[str] = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()] if os.getenv("CORS_ORIGINS") else []
    
    # Email
    internal_email_domain: str = "40919.com"
    
    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        
        # Set expose_error_details based on debug mode
        self.expose_error_details = self.debug
        
        # Validate SECRET_KEY is strong enough
        if not self.secret_key:
            raise ValueError("SECRET_KEY environment variable is required")
        if len(self.secret_key) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        # Warn about weak/default keys
        weak_keys = [
            "your-super-secret-key-change-me-32-chars",
            "your-secret-key-change-in-production",
            "change-me",
            "secret",
            "password",
            "generate_using_openssl",
            "generate_strong_password"
        ]
        if any(weak in self.secret_key.lower() for weak in weak_keys):
            raise ValueError(
                "SECRET_KEY appears to be a default/weak value. "
                "Generate a strong key using: openssl rand -hex 32"
            )
        
        # Validate CORS configuration in production
        if not self.debug:
            if not self.cors_origins:
                raise ValueError(
                    "CORS_ORIGINS must be configured in production. "
                    "Set CORS_ORIGINS environment variable with comma-separated allowed domains."
                )
            if "*" in self.cors_origins:
                raise ValueError(
                    "Wildcard CORS origin (*) is not allowed in production. "
                    "Specify exact allowed origins in CORS_ORIGINS."
                )
            # Validate each origin is a valid URL
            for origin in self.cors_origins:
                if not origin.startswith(("http://", "https://")):
                    raise ValueError(
                        f"Invalid CORS origin '{origin}'. "
                        f"Origins must start with http:// or https://"
                    )
        
        # Validate database password strength (if using MySQL/PostgreSQL)
        if not self.is_sqlite:
            weak_db_passwords = [
                "password",
                "koordinator_db_password",
                "koordinator_root_secret",
                "change-me",
                "secret",
                "admin",
                "root",
                "test",
                "generate_strong_password"
            ]
            db_url_lower = self.database_url.lower()
            for weak_pass in weak_db_passwords:
                if weak_pass in db_url_lower:
                    raise ValueError(
                        f"DATABASE_URL contains a weak/default password. "
                        f"Generate a strong password using: openssl rand -base64 32"
                    )
    
    @property
    def is_sqlite(self) -> bool:
        """Check if using SQLite database"""
        return "sqlite" in self.database_url.lower()
    
    @property
    def is_mysql(self) -> bool:
        """Check if using MySQL database"""
        return "mysql" in self.database_url.lower()
    
    class Config:
        env_file = ".env"



@lru_cache()
def get_settings() -> Settings:
    return Settings()
