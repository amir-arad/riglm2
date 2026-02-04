# Authentication & Authorization

[← Back to Index](index.md)

---

## Authentication Methods

### 1. API Key Authentication

**Header Format:**
```
Authorization: Bearer sk_mt_xxx
```

**Alternative Methods:**
- Header: `X-API-Key: sk_mt_xxx`
- Query param: `?api_key=sk_mt_xxx` (if enabled on endpoint)
- Query param: `?apikey=sk_mt_xxx`

**Key Format:** `sk_mt_` prefix followed by random string.

---

### 2. OAuth 2.0 (MCP Spec 2025-06-18)

MetaMCP supports standard OAuth per MCP specification.

**Endpoints:**
| Endpoint | Purpose |
|----------|---------|
| `/.well-known/oauth-authorization-server` | Server metadata |
| `/oauth/authorize` | Authorization endpoint |
| `/oauth/token` | Token endpoint |
| `/oauth/register` | Dynamic client registration |

**Flow:** Authorization Code with PKCE

---

### 3. Session Cookies (Internal)

Used for frontend ↔ backend communication via Better Auth.

---

### 4. OIDC/SSO (Enterprise)

**Supported Providers:**
- Auth0
- Keycloak
- Azure AD
- Google
- Okta

**Configuration:**
```bash
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_DISCOVERY_URL=https://provider.com/.well-known/openid-configuration
OIDC_AUTHORIZATION_URL=https://provider.com/auth/authorize
OIDC_SCOPES=openid email profile
OIDC_PKCE=true
```

**Discovery URLs by Provider:**
| Provider | Discovery URL |
|----------|---------------|
| Auth0 | `https://{domain}.auth0.com/.well-known/openid-configuration` |
| Keycloak | `https://{host}/realms/{realm}/.well-known/openid-configuration` |
| Azure AD | `https://login.microsoftonline.com/{tenant}/v2.0/.well-known/openid-configuration` |
| Google | `https://accounts.google.com/.well-known/openid-configuration` |
| Okta | `https://{domain}.okta.com/.well-known/openid-configuration` |

---

## Authorization Model

### Scopes
- **Private** - Owned by specific user (`user_id` set)
- **Public** - Owned by system (`user_id` NULL)

### Rules
- Users see their own resources + public resources
- Public API keys cannot access private resources
- Private API keys can access owner's resources + public resources

---

## Authentication Scenarios

| API Key Auth | OAuth | Behavior |
|--------------|-------|----------|
| Disabled | Disabled | No auth required |
| Enabled | Disabled | Require valid API key |
| Disabled | Enabled | Require OAuth token |
| Enabled | Enabled | Require either API key OR OAuth token |

---

## Registration Controls

Administrators can control registration via settings:

| Setting | Description |
|---------|-------------|
| `disable_ui_registration` | Block form-based signups |
| `disable_sso_registration` | Block SSO/OAuth signups |

**Enterprise Scenarios:**
- Block UI, allow SSO → Corporate SSO only
- Block SSO, allow UI → Manual signups only
- Block both → No new registrations
