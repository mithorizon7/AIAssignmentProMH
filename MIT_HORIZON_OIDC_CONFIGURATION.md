# MIT Horizon OIDC Configuration Guide

This document explains how to configure direct OpenID Connect (OIDC) integration with MIT Horizon's Auth0 tenant for AIGrader.

## Overview

AIGrader provides two methods for authenticating with MIT Horizon:

1. **Auth0 Integration** (Original method) - Uses Auth0 as an identity broker between AIGrader and MIT Horizon
2. **Direct OIDC Integration** (New method) - Connects directly to MIT Horizon's Auth0 tenant

The direct OIDC integration provides a more streamlined authentication flow with better control over user data mapping and session management.

## Configuration Steps

### 1. Register AIGrader as an OIDC Client in MIT Horizon Auth0 Tenant

Contact MIT Horizon administrators to register AIGrader as an OIDC client application. You'll need to provide:

- Your application name ("AIGrader")
- Callback URL: `https://your-domain.com/api/auth/horizon/callback`
- Logout URL: `https://your-domain.com` (root domain only, no path)
- Required scopes: `openid email profile`

### 2. Set Environment Variables

Once approved, you'll receive credentials. Add these to your `.env` file:

```
MIT_HORIZON_OIDC_ISSUER_URL=https://mit-horizon.auth0.com/
MIT_HORIZON_OIDC_CLIENT_ID=your_client_id
MIT_HORIZON_OIDC_CLIENT_SECRET=your_client_secret
MIT_HORIZON_OIDC_CALLBACK_URL=https://your-domain.com/api/auth/horizon/callback
```

### 3. Test the Integration

1. Restart your application
2. Navigate to the login page
3. Click "Log in with MIT Horizon"
4. You should be redirected to the MIT Horizon login page
5. After successful authentication, you should be redirected back to AIGrader

## How It Works

The Direct OIDC integration works as follows:

1. User clicks "Log in with MIT Horizon" on the login page
2. User is redirected to MIT Horizon's Auth0 login page
3. After authentication, MIT Horizon returns the user to AIGrader with an ID token
4. AIGrader verifies the token and either:
   - Creates a new user account if this is the first login
   - Updates the existing user account if the user has logged in before
5. User is logged into AIGrader with appropriate permissions

## User Account Linking

If a user with the same email already exists in AIGrader:
- Their account will be linked to their MIT Horizon identity
- Their existing role and permissions will be preserved
- They'll maintain access to all their previous assignments and submissions

## Security Considerations

- All communication happens over HTTPS
- OAuth flows use state parameters to prevent CSRF attacks
- User tokens are validated according to OIDC specifications
- User passwords are never stored for OIDC users (null password field)

## Troubleshooting

Common issues:

1. **"Invalid redirect URI"** - The callback URL must exactly match what's registered with MIT Horizon
2. **"Client authentication failed"** - Check your client ID and secret
3. **"Missing required scope"** - Ensure MIT Horizon has approved the openid, email, and profile scopes

## Additional Resources

- [OpenID Connect Core Specification](https://openid.net/specs/openid-connect-core-1_0.html)
- [Auth0 Documentation on OIDC](https://auth0.com/docs/authenticate/protocols/openid-connect-protocol)
- [Passport.js OIDC Strategy](https://github.com/jaredhanson/passport-openidconnect)