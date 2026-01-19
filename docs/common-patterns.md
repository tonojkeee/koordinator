# Common Patterns

## API Calls (Frontend)

**TanStack Query Pattern**:
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['users', userId],
  queryFn: () => api.get(`/users/${userId}`)
});

// With mutations
const mutation = useMutation({
  mutationFn: (userData) => api.post('/users', userData),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    showToast({ message: "User created", type: "success" });
  },
  onError: (error) => {
    showToast({ message: "Failed to create user", type: "error" });
  }
});
```

## Service Layer (Backend)

**Service Class Pattern**:
```python
class UserService:
    @staticmethod
    async def get_user(user_id: int, db: AsyncSession) -> UserResponse:
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return UserResponse.model_validate(user)
    
    @staticmethod
    async def create_user(user_data: UserCreate, db: AsyncSession) -> UserResponse:
        # Validate unique email
        existing = await db.execute(
            select(User).where(User.email == user_data.email)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already exists")
        
        user = User(**user_data.model_dump())
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return UserResponse.model_validate(user)
```

## Error Handling

**Frontend Error Boundary**:
```typescript
try {
  await fetchData();
} catch (error) {
  console.error('API Error:', error);
  showToast({ 
    message: error.response?.data?.detail || "Something went wrong", 
    type: "error" 
  });
}
```

**Backend Error Response**:
```python
try:
    result = await some_operation()
    return result
except ValueError as e:
    logger.error(f"Validation error: {e}", exc_info=True)
    raise HTTPException(status_code=400, detail=str(e))
except Exception as e:
    logger.error(f"Unexpected error: {e}", exc_info=True)
    raise HTTPException(status_code=500, detail="Internal server error")
```

## WebSocket Patterns

**Frontend WebSocket Hook**:
```typescript
const useWebSocket = (url: string) => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket(url);
    
    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // Handle message
    };
    
    setSocket(ws);
    return () => ws.close();
  }, [url]);

  return { socket, isConnected };
};
```