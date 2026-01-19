# Python/FastAPI Conventions

## Build Commands

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt

# Development
uvicorn app.main:app --reload --host 0.0.0.0 --port 5100

# Testing
python -m pytest tests/test_module.py -v
python -m pytest --cov=app tests/

# Database
alembic upgrade head
alembic revision --autogenerate -m "description"

# Formatting
black app/ tests/
```

## Code Style

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