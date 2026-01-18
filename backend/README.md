# TeamChat Backend

## Running the application

```bash
# Activate virtual environment
source venv/bin/activate

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 5100
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:5100/docs
- ReDoc: http://localhost:5100/redoc

## Environment Variables

Create a `.env` file in the backend directory:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
DATABASE_URL=sqlite+aiosqlite:///./teamchat.db
```
