# Team Chat Application

Modular monolith with FastAPI backend and React frontend, supporting real-time chat, email, task management, and document sharing.

## Quick Start

**Backend**: `cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 5100`  
**Frontend**: `cd frontend && npm run dev`  
**Migrations**: `cd backend && alembic upgrade head`

## Architecture Decisions

- **Backend**: FastAPI with async/await throughout, SQLAlchemy 2.0
- **Frontend**: React 19 with TypeScript, Zustand for state, TanStack Query for server state
- **Styling**: Tailwind CSS v4 with design system components
- **Database**: PostgreSQL with Alembic migrations
- **Real-time**: WebSocket connections for chat and notifications

## Detailed Guidelines

- [Python/FastAPI Conventions](docs/python-conventions.md)
- [TypeScript/React Conventions](docs/typescript-conventions.md)
- [Testing Guidelines](docs/testing.md)
- [Security Requirements](docs/security.md)
- [Project Structure](docs/project-structure.md)
- [Common Patterns](docs/common-patterns.md)