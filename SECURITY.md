# Security Policy and Practices

This document outlines security measures, considerations, and best practices for the AIGrader platform.

## Critical Security Requirements

### Environment Variables and Secrets

- **SESSION_SECRET**: Required for secure session management. Must be a strong, unique, random value (at least 32 characters).
- **CSRF_SECRET**: Required for CSRF protection. Must be a strong, unique, random value (at least 32 characters).

Both of these values are **required** and the application will fail to start if they are not properly set. To generate suitable values:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Anonymous Submissions Security

Anonymous submissions (via shareable link) require proper validation:

1. Each assignment has a unique `shareableCode` generated when the assignment is created
2. The client-side submission form must include this `shareableCode` in the request
3. The server validates that the provided `shareableCode` matches the assignment's stored code
4. Submissions are rejected with a 403 Forbidden status if the codes don't match

This prevents unauthorized submissions to assignments by simply guessing assignment IDs.

## Authentication and Authorization

- Password hashing is implemented using bcrypt with appropriate salt rounds
- Role-based access control restricts endpoints to appropriate user roles
- Session cookies are configured with secure settings:
  - HttpOnly: Prevents client-side JavaScript from accessing cookies
  - Secure: (In production) Requires HTTPS
  - SameSite: Strict or Lax to prevent CSRF attacks
  - Path restricted to root

## Additional Security Measures

- CSRF protection with double-submit technique
- Security headers set to prevent common web vulnerabilities:
  - X-Frame-Options: Prevents clickjacking
  - X-XSS-Protection: Enables browser XSS filters
  - X-Content-Type-Options: Prevents MIME-sniffing
  - Strict-Transport-Security: (In production) Enforces HTTPS
  
## Rate Limiting

The application implements rate limiting to protect against abuse, brute force attacks, and potential DoS attempts:

| Endpoint | Limit | Window | Purpose |
|----------|-------|--------|---------|
| `/api/auth/login` | 10 requests | 1 minute | Prevent brute force login attempts |
| `/api/auth/register` | 10 requests | 1 minute | Prevent mass account creation |
| `/api/anonymous-submissions` | 5 requests | 1 minute | Protect AI service from abuse |
| `/api/assignments/code/:code` | 100 requests | 15 minutes | Prevent excessive assignment lookups |
| `/api/csrf-token` | 20 requests | 1 minute | Allow reasonable token refresh rate |

Rate limits are enforced on a per-IP basis, with proper consideration for proxies through use of X-Forwarded-For headers when configured. Rate limits are disabled in development mode for easier testing.

## Development vs. Production

The application has stricter security settings in production:

- Session cookies are marked as secure in production (requires HTTPS)
- SameSite cookie setting is 'strict' in production vs. 'lax' in development
- HTTP Strict Transport Security headers are enabled in production
- Error messages are less verbose in production to avoid information disclosure

## Security Bug Reporting

If you discover a security vulnerability, please report it responsibly by contacting the maintainers directly rather than opening a public issue.