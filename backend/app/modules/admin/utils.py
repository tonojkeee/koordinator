import os
from pathlib import Path

def get_env_path():
    """
    Get path to .env file in backend directory.
    Uses pathlib for more robust path resolution.
    """
    # Get the backend directory (4 levels up from this file)
    current_file = Path(__file__).resolve()
    backend_dir = current_file.parents[3]  # More readable than multiple dirname
    
    env_path = backend_dir / ".env"
    
    # Validate it's actually the backend directory
    if not (backend_dir / "app").exists():
        raise RuntimeError(f"Could not locate backend directory. Expected at: {backend_dir}")
    
    return str(env_path)

def read_env_file():
    """Read .env file into a dictionary"""
    env_path = get_env_path()
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    env_vars[key.strip()] = value.strip()
    return env_vars

def write_env_file(env_vars):
    """Write dictionary to .env file, preserving existing keys"""
    env_path = get_env_path()
    
    # Read existing lines to preserve comments and order if possible
    existing_lines = []
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            existing_lines = f.readlines()
            
    new_lines = []
    processed_keys = set()
    
    # Update existing keys
    for line in existing_lines:
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and "=" in stripped:
            key = stripped.split("=", 1)[0].strip()
            if key in env_vars:
                new_lines.append(f"{key}={env_vars[key]}\n")
                processed_keys.add(key)
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
            
    # Add new keys
    for key, value in env_vars.items():
        if key not in processed_keys:
            if new_lines and not new_lines[-1].endswith("\n"):
                new_lines.append("\n")
            new_lines.append(f"{key}={value}\n")
            
    with open(env_path, "w") as f:
        f.writelines(new_lines)

def parse_database_url(url: str):
    """Parse DATABASE_URL into components for UI"""
    # Example: mysql+aiomysql://user:pass@host:port/dbname
    # Example: sqlite+aiosqlite:///path/to/db
    
    config = {
        "type": "sqlite",
        "host": "",
        "port": 3306,
        "user": "",
        "password": "",
        "database": ""
    }
    
    if not url:
        return config
        
    if url.startswith("sqlite"):
        config["type"] = "sqlite"
        # Extract path if needed, but for sqlite usually we just default or it's hardcoded relative path
        return config
        
    # MySQL parsing
    if url.startswith("mysql"):
        config["type"] = "mysql"
        try:
            # simple parse
            # mysql+aiomysql://user:pass@host:port/dbname
            without_protocol = url.split("://", 1)[1]
            if "@" in without_protocol:
                creds, location = without_protocol.split("@", 1)
                if ":" in creds:
                    config["user"], config["password"] = creds.split(":", 1)
                else:
                    config["user"] = creds
                    
                if "/" in location:
                    host_port, dbname = location.split("/", 1)
                    config["database"] = dbname
                    
                    if ":" in host_port:
                        host, port = host_port.split(":", 1)
                        config["host"] = host
                        config["port"] = int(port)
                    else:
                        config["host"] = host_port
        except Exception:
            pass
            
    return config
