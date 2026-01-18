# AGENTS.md - Guidelines for Coding Agents

## Build & Test Commands

### Backend (Python/FastAPI)
```bash
# Navigate to backend directory
cd backend

# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 5100

# Run a single test file
python -m pytest tests/test_module.py -v

# Run specific test
python -m pytest tests/test_module.py::test_function_name -v

# Run tests with coverage
python -m pytest --cov=app tests/

# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"

# Format code (if black is added)
black app/ tests/
```

### Frontend (TypeScript/React)
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Type checking
npx tsc --noEmit

# Run preview of production build
npm run preview

# Electron desktop (optional)
npm run electron:dev
npm run electron:build
```

## Code Style Guidelines

### Python (Backend)

**Imports**: 
- Order: stdlib → third-party → local
- Use absolute imports: `from app.modules.auth.models import User`
- Group with blank lines between sections

**Naming**:
- Classes: PascalCase (`UserService`, `UserBase`)
- Functions/variables: snake_case (`get_current_user`, `user_id`)
- Constants: UPPER_SNAKE_CASE (`SECRET_KEY`, `DEBUG`)
- Private: `_internal_method`, `__private_field`

**Type Hints**:
- Always use type hints for functions
- Use `Optional[T]` for nullable values
- Use `Mapped[T]` for SQLAlchemy models (modern style)
- Use `dict[str, Any]` for generic dict types (Python 3.9+)

**Error Handling**:
- Use FastAPI's `HTTPException` for API errors
- Log errors before raising: `logger.error(f"Error: {e}", exc_info=True)`
- Use specific status codes with `status.HTTP_*` constants
- Never expose sensitive data in error messages

**Async Patterns**:
- Always use `async/await` for DB operations
- Use `AsyncSession` from `sqlalchemy.ext.asyncio`
- Use `Depends()` for dependency injection
- Implement proper lifespan management

**Database**:
- Use SQLAlchemy 2.0 async models with `Mapped` syntax
- Define relationships using `relationship()`
- Add indexes on frequently queried fields
- Use `datetime.utcnow` for timestamps

### TypeScript/React (Frontend)

**Imports**:
- React imports first: `import React from 'react'`
- Third-party packages next: `import { useQuery } from '@tanstack/react-query'`
- Relative imports last: `import { Avatar } from '../components'`
- Sort imports alphabetically within groups

**Naming**:
- Components: PascalCase (`UserAvatar`, `ChatList`)
- Functions/variables: camelCase (`fetchUsers`, `userName`)
- Types/Interfaces: PascalCase (`UserProps`, `ApiResponse`)
- Constants: UPPER_SNAKE_CASE only for truly global constants

**Type Definitions**:
- Define explicit interfaces for props
- Use `React.FC<Props>` for functional components
- Prefer `interface` over `type` for object shapes
- Use `type` for unions, primitives, and utility types

**React Patterns**:
- Use functional components with hooks
- Prefer `useState` over `useReducer` for simple state
- Use custom hooks for reusable logic
- Use `useMemo`/`useCallback` for expensive computations
- Key lists properly with stable identifiers

**State Management**:
- Use Zustand for global state
- Use TanStack Query for server state (caching, refetching)
- Keep component state local when possible
- Avoid prop drilling (use Context or Zustand)

**Styling**:
- Use Tailwind CSS v4 utility classes
- Prefer `className` over `style` prop
- Use design-system components when available
- Responsive-first approach: `md:w-1/2`, `lg:flex-row`
- Use `cn()` utility for conditional classes

**Error Handling**:
- Handle async errors in try/catch blocks
- Display user-friendly error messages
- Log errors to console in development
- Show toast notifications for user feedback

## Project Structure

### Backend
- `app/core/` - Database, security, config, utilities
- `app/modules/` - Feature modules (auth, chat, admin, etc.)
  - Each module: `models.py`, `schemas.py`, `service.py`, `router.py`
- `migrations/` - Alembic database migrations
- `scripts/` - Utility scripts and tests

### Frontend
- `src/features/` - Feature-based modules (auth, chat, admin, etc.)
- `src/components/` - Reusable UI components
- `src/components/ui/` - Design system components
- `src/api/` - API client and service functions
- `src/hooks/` - Custom React hooks
- `src/store/` - Zustand stores
- `src/utils/` - Utility functions
- `src/types/` - TypeScript type definitions

## Testing

### Backend
- Use pytest for testing
- Mock external dependencies (database, external APIs)
- Test both success and error paths
- Use `pytest-asyncio` for async tests
- Write integration tests for endpoints

### Frontend
- Use React Testing Library
- Test user interactions, not implementation
- Mock API calls using msw or similar
- Snapshot test UI components when appropriate
- Test async operations and loading states

## Security

### Backend
- Never commit secrets to git
- Use environment variables for configuration
- Validate all user inputs with Pydantic
- Sanitize user-generated content (HTML, uploads)
- Use HTTPS in production
- Implement rate limiting on sensitive endpoints
- Use CSRF protection for state-changing operations

### Frontend
- Sanitize HTML content (DOMPurify)
- Validate file uploads (type, size, content)
- Never store tokens in localStorage (use httpOnly cookies)
- Use Content Security Policy headers
- Implement proper authentication checks

## Development Workflow

1. Create feature branch from main
2. Run tests before pushing: `npm run lint` + `npm run build`
3. Write tests for new features
4. Keep PRs focused and small
5. Ensure all tests pass before merge
6. Update README.md for user-facing changes

## Common Patterns

### API Calls (Frontend)
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['users', userId],
  queryFn: () => api.get(`/users/${userId}`)
});
```

### Service Layer (Backend)
```python
class UserService:
    @staticmethod
    async def get_user(user_id: int, db: AsyncSession) -> UserResponse:
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserResponse.model_validate(user)
```

### Error Boundary (Frontend)
```typescript
try {
  await fetchData();
} catch (error) {
  showToast({ message: "Failed to load data", type: "error" });
}
```

## Notes

- This is a modular monolith architecture
- Backend uses FastAPI with async/await throughout
- Frontend uses React 19 with modern TypeScript
- Both parts support Docker deployment
- Russian language UI is supported (i18n)
- Desktop app available via Electron wrapper
