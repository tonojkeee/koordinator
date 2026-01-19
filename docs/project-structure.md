# Project Structure

## Backend Structure

```
backend/
├── app/
│   ├── core/           # Database, security, config, utilities
│   └── modules/        # Feature modules
│       ├── auth/       # Authentication & authorization
│       ├── chat/       # Real-time messaging
│       ├── email/      # Email management
│       ├── tasks/      # Task management
│       └── admin/      # Admin functionality
├── migrations/         # Alembic database migrations
└── scripts/           # Utility scripts and tests
```

**Module Pattern**: Each module contains:
- `models.py` - SQLAlchemy models
- `schemas.py` - Pydantic request/response models
- `service.py` - Business logic
- `router.py` - FastAPI route definitions

## Frontend Structure

```
frontend/src/
├── features/          # Feature-based modules
│   ├── auth/         # Login, registration
│   ├── chat/         # Chat interface
│   ├── email/        # Email client
│   ├── tasks/        # Task management
│   └── admin/        # Admin dashboard
├── design-system/    # Reusable UI components
├── api/             # API client and service functions
├── hooks/           # Custom React hooks
├── store/           # Zustand stores
├── utils/           # Utility functions
└── types/           # TypeScript type definitions
```

**Feature Pattern**: Each feature contains:
- Main page component
- `components/` - Feature-specific components
- API service functions
- Type definitions
- Store/state management (if needed)