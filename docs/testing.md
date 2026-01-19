# Testing Guidelines

## Backend Testing

**Framework**: pytest with pytest-asyncio

**Patterns**:
- Mock external dependencies (database, external APIs)
- Test both success and error paths
- Write integration tests for endpoints

**Example**:
```python
@pytest.mark.asyncio
async def test_get_user_success(db_session, test_user):
    user = await UserService.get_user(test_user.id, db_session)
    assert user.email == test_user.email

@pytest.mark.asyncio
async def test_get_user_not_found(db_session):
    with pytest.raises(HTTPException) as exc:
        await UserService.get_user(999, db_session)
    assert exc.value.status_code == 404
```

## Frontend Testing

**Framework**: React Testing Library

**Patterns**:
- Test user interactions, not implementation
- Mock API calls using msw or similar
- Snapshot test UI components when appropriate
- Test async operations and loading states

**Example**:
```typescript
test('displays user profile when loaded', async () => {
  render(<UserProfile userId="123" />);
  
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  
  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
```