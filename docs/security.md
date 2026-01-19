# Security Requirements

## Backend Security

**Input Validation**:
- Validate all user inputs with Pydantic
- Sanitize user-generated content (HTML, uploads)
- Implement rate limiting on sensitive endpoints
- Use CSRF protection for state-changing operations

**Authentication**:
- Use environment variables for configuration
- Never expose sensitive data in error messages

## Frontend Security

**Data Handling**:
- Sanitize HTML content (DOMPurify)
- Validate file uploads (type, size, content)
- Never store tokens in localStorage (use httpOnly cookies)

**Headers & Policies**:
- Use Content Security Policy headers
- Implement proper authentication checks

## File Upload Security

**Validation**:
- Check file type and extension
- Limit file size
- Scan file content for malicious patterns
- Store uploads outside web root
- Generate unique filenames to prevent conflicts