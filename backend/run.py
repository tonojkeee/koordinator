
import uvicorn
from app.core.config import get_settings

import os

if __name__ == "__main__":
    settings = get_settings()
    
    # Resolve absolute paths for certificates
    base_dir = os.path.dirname(os.path.abspath(__file__))
    cert_dir = os.path.join(base_dir, "certs")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=5100,
        reload=settings.debug,
        log_level="info",
        ssl_keyfile=os.path.join(cert_dir, "key.pem"),
        ssl_certfile=os.path.join(cert_dir, "cert.pem")
    )
