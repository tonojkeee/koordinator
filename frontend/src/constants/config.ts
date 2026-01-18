// Constants for timeout and configuration values

export const CONNECTION_HEALTH_CHECK_TIMEOUT = 3000;
export const WEBSOCKET_CONNECTION_TIMEOUT = 45.0;
export const WEBSOCKET_HEARTBEAT_INTERVAL = 30;
export const WEBSOCKET_RECONNECT_DELAY = 2.0;

export const MAX_UPLOAD_SIZE_MB = 50;
export const AVATAR_MAX_SIZE_MB = 2;
export const EMAIL_MAX_ATTACHMENT_SIZE_MB = 25;
export const EMAIL_MAX_TOTAL_ATTACHMENT_SIZE_MB = 50;

export const FILE_READ_CHUNK_SIZE = 8192;

export const ACCESS_TOKEN_EXPIRE_MINUTES = 480;
export const REFRESH_TOKEN_EXPIRE_DAYS = 30;

export const DB_POOL_SIZE = 10;
export const DB_MAX_OVERFLOW = 20;
export const DB_POOL_TIMEOUT = 30;
export const DB_POOL_RECYCLE = 1800;

export const CHAT_RATE_LIMIT = 100;
export const CHAT_MAX_MESSAGE_LENGTH = 4000;
export const CHAT_PAGE_SIZE = 50;

export const WS_CLOSE_CODE_ACCOUNT_DISABLED = 4003;
export const WS_CLOSE_CODE_SERVER_SHUTDOWN = 1001;

export const HTTP_STATUS_OK = 200;
export const HTTP_STATUS_BAD_REQUEST = 400;
export const HTTP_STATUS_UNAUTHORIZED = 401;
export const HTTP_STATUS_FORBIDDEN = 403;
export const HTTP_STATUS_NOT_FOUND = 404;
export const HTTP_STATUS_INTERNAL_SERVER_ERROR = 500;

export const PAGINATION_DEFAULT_LIMIT = 100;
export const PAGINATION_DEFAULT_PAGE_SIZE = 50;
