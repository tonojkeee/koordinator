# Security Guidelines

## Secrets Management

### Critical: Never Use Default or Weak Secrets

This application requires strong, randomly generated secrets for security. **Never use default, example, or weak values in any environment.**

### Required Secrets

#### 1. SECRET_KEY (JWT Token Signing)

**Purpose:** Used to sign and verify JWT authentication tokens.

**Requirements:**
- Minimum 32 characters (64 recommended)
- Cryptographically random
- Unique per environment
- Never shared or committed to version control

**Generate:**
```bash
# Option 1: Using OpenSSL (recommended)
openssl rand -hex 32

# Option 2: Using Python
python -c "import secrets; print(secrets.token_hex(32))"
```

**Example (DO NOT USE THIS VALUE):**
```
SECRET_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

#### 2. Database Passwords

**Purpose:** Secure database access.

**Requirements:**
- Minimum 20 characters (32 recommended)
- Mix of uppercase, lowercase, numbers, and symbols
- Unique per environment
- Different passwords for root and application users

**Generate:**
```bash
# Generate strong password
openssl rand -base64 32
```

**Update DATABASE_URL:**
```bash
# Example format (use your generated password)
DATABASE_URL=mysql+aiomysql://koordinator:YOUR_STRONG_PASSWORD@localhost:3306/koordinator
```

#### 3. Redis Password (if using Redis)

**Purpose:** Secure Redis access for caching and WebSocket scaling.

**Requirements:**
- Minimum 20 characters
- Cryptographically random

**Generate:**
```bash
openssl rand -base64 32
```

**Update REDIS_URL:**
```bash
# Example format (use your generated password)
REDIS_URL=redis://:YOUR_STRONG_PASSWORD@localhost:6379/0
```

### Environment Setup Checklist

Before deploying to any environment (development, staging, production):

- [ ] Generate unique SECRET_KEY using `openssl rand -hex 32`
- [ ] Generate unique database passwords using `openssl rand -base64 32`
- [ ] Generate unique Redis password (if applicable)
- [ ] Update `.env` file with generated secrets
- [ ] Verify secrets are NOT committed to git
- [ ] Test application starts successfully with new secrets
- [ ] Document secret rotation procedures

### Secret Rotation

Secrets should be rotated periodically:

- **SECRET_KEY:** Rotate every 90 days or immediately if compromised
- **Database Passwords:** Rotate every 90 days or immediately if compromised
- **Redis Password:** Rotate every 90 days or immediately if compromised

**Rotation Procedure:**
1. Generate new secret using appropriate command
2. Update `.env` file with new secret
3. For SECRET_KEY: All users will need to re-authenticate
4. For database passwords: Update database user password first, then update `.env`
5. Restart application
6. Verify functionality
7. Securely delete old secrets

### What NOT to Do

❌ **Never use these weak patterns:**
- `password`
- `secret`
- `change-me`
- `koordinator_db_password`
- `your-secret-key-change-in-production`
- Any value from `.env.example` files
- Any value found in documentation or tutorials
- Short passwords (< 20 characters)
- Dictionary words
- Predictable patterns

✅ **Always:**
- Generate cryptographically random secrets
- Use different secrets for each environment
- Keep secrets out of version control
- Use environment variables for secrets
- Rotate secrets periodically
- Document secret management procedures

### Validation

The application includes built-in validation that will **refuse to start** if:
- SECRET_KEY is missing or less than 32 characters
- SECRET_KEY contains known weak patterns
- DATABASE_URL contains known weak passwords (for MySQL/PostgreSQL)

This validation helps prevent accidental deployment with weak secrets.

### Emergency Response

If you suspect a secret has been compromised:

1. **Immediately** generate a new secret
2. Update the compromised secret in all environments
3. Restart affected services
4. For SECRET_KEY compromise: Force all users to re-authenticate
5. For database compromise: Review database access logs
6. Document the incident
7. Review how the compromise occurred
8. Implement additional controls to prevent recurrence

### Additional Resources

- [OWASP: Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP: Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [NIST: Digital Identity Guidelines](https://pages.nist.gov/800-63-3/)

### Questions?

If you have questions about secrets management or security:
1. Review this document
2. Check the security audit findings in `.kiro/specs/security-audit-and-refactoring/`
3. Consult with the security team
4. Never compromise on security for convenience
