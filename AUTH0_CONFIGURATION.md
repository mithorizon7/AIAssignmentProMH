# Auth0 Configuration Guide for AIGrader

This document provides guidance on configuring Auth0 for proper integration with AIGrader, including SSO with MIT Horizon.

## Required Environment Variables

```
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
BASE_URL=https://your-app-domain.com
AUTH0_CALLBACK_URL=https://your-app-domain.com/api/auth-sso/callback
```

## Auth0 Application Configuration

When setting up your Auth0 application, you must configure the following:

1. **Application Type**: Regular Web Application
2. **Allowed Callback URLs**: This must include your callback URL (`${BASE_URL}/api/auth-sso/callback`)
3. **Allowed Logout URLs**: This must include your base domain URL WITHOUT any path (`${BASE_URL}`) 
   - IMPORTANT: Auth0 has strict requirements for logout URLs. Only use the root domain.
   - Example: Use `https://aigrader.replit.app` NOT `https://aigrader.replit.app/auth`
4. **Allowed Web Origins**: Include your base URL without path (`${BASE_URL}`)
5. **Token Endpoint Authentication Method**: Set to "Post"
6. **ID Token Expiration**: Recommended setting of 86400 seconds (24 hours)
7. **Enable Refresh Token Rotation**: Recommended for enhanced security

## Complete SSO Workflow

The SSO login and logout flow in AIGrader works as follows:

### Login Flow

1. User navigates to `/auth` and clicks "Login with MIT Horizon"
2. User is redirected to Auth0 login page (`https://${AUTH0_DOMAIN}/authorize?...`)
3. After successful authentication, Auth0 redirects to our callback URL
4. Our server validates the token and establishes a local session
5. User is redirected to the appropriate dashboard based on role

### Logout Flow

1. User clicks logout button which calls the `logout()` function
2. Frontend calls `/api/auth/logout` API endpoint
3. Server ends the local session and prepares Auth0 logout URL
4. Server returns the Auth0 logout URL in the response
5. Frontend redirects the browser to Auth0 logout URL
6. Auth0 ends the SSO session and redirects back to our application root URL
7. Our application detects the return from Auth0 and redirects to the login page

#### Auth0 Logout URL Format

The Auth0 logout URL must include two parameters:
- `client_id`: Your Auth0 client ID
- `returnTo`: Your application's root domain URL (must be whitelisted in Auth0 settings)

Example:
```
https://YOUR_AUTH0_DOMAIN/v2/logout?client_id=YOUR_CLIENT_ID&returnTo=https://aigrader.replit.app
```

IMPORTANT: The `returnTo` URL must be:
- Exactly as registered in Auth0's "Allowed Logout URLs"
- Use your application's root domain with NO path parameters
- Fully URL-encoded

## Common Issues and Troubleshooting

### "Oops, something went wrong" Error on Logout

If you see the Auth0 error page with "Oops, something went wrong" after logout:

1. The `returnTo` URL isn't properly whitelisted in Auth0's "Allowed Logout URLs"
2. Ensure you're using the root domain without any path segments 
   - Correct: `https://aigrader.replit.app`
   - Incorrect: `https://aigrader.replit.app/auth` or `https://aigrader.replit.app/login`
3. Check Auth0 logs for specific error messages about invalid logout URLs
4. Verify the URL is properly URL-encoded in your code

### Callback URL Mismatch

If you receive a "callback URL mismatch" error from Auth0, ensure:

1. Your Auth0 application's "Allowed Callback URLs" setting includes your callback URL
2. The `AUTH0_CALLBACK_URL` environment variable matches exactly what's configured in Auth0
3. If using `BASE_URL` to construct the callback URL, ensure it's correctly formatted without trailing slash

### Cross-Origin Issues

If you experience CORS issues:

1. Ensure "Allowed Web Origins" in Auth0 includes your base URL
2. Verify that your application's "trust token origin" setting is enabled

### SSO Session Management

For proper SSO integration:

1. Auth0 logout URL must include the `client_id` parameter
2. The `returnTo` parameter must be URL-encoded and match a URL in "Allowed Logout URLs"
3. For MIT Horizon integration, the tenant domain must be correctly configured

## Testing Auth0 Configuration

To test if your Auth0 configuration is working properly:

1. Log in via the Auth0 login button
2. Verify successful redirection after login
3. Log out and confirm you are properly redirected to Auth0's logout URL
4. Confirm you are redirected back to the AIGrader login page after Auth0 logout
5. Test access to protected routes to verify session persistence

## Production vs. Development Configuration

In development:
- Use `localhost` URLs with appropriate ports
- Consider using Auth0's "Allow Skipping User Confirmation" feature

In production:
- Always use HTTPS URLs
- Ensure proper SSL certificate configuration
- Set appropriate token lifetimes based on security requirements
- Use a custom domain for Auth0 if required for branding