# Configuration Reference

[← Back to Index](index.md)

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@host:5432/db` |
| `BETTER_AUTH_SECRET` | Auth secret key | `openssl rand -hex 32 \| base64` |
| `APP_URL` | Public application URL | `https://metamcp.example.com` |

---

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_HOST` | `postgres` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `POSTGRES_USER` | `metamcp_user` | Database user |
| `POSTGRES_PASSWORD` | `m3t4mcp` | Database password |
| `POSTGRES_DB` | `metamcp_db` | Database name |
| `POSTGRES_EXTERNAL_PORT` | `9433` | External port mapping |

---

### OIDC (Optional)

| Variable | Description |
|----------|-------------|
| `OIDC_CLIENT_ID` | OAuth client ID |
| `OIDC_CLIENT_SECRET` | OAuth client secret |
| `OIDC_DISCOVERY_URL` | OpenID Connect discovery URL |
| `OIDC_AUTHORIZATION_URL` | Authorization endpoint |
| `OIDC_PROVIDER_ID` | Provider ID (default: `oidc`) |
| `OIDC_SCOPES` | Scopes (default: `openid email profile`) |
| `OIDC_PKCE` | Enable PKCE (default: `true`) |

---

### Docker

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSFORM_LOCALHOST_TO_DOCKER_INTERNAL` | `true` | Rewrite localhost URLs |
| `NODE_ENV` | `production` | Node environment |

---

## Application Settings (Config Table)

Settings stored in `config` table, accessible via tRPC `config` router.

| Setting | Type | Description |
|---------|------|-------------|
| `session_lifetime` | number/null | Session timeout in ms (null = infinite) |
| `disable_ui_registration` | boolean | Block form-based signups |
| `disable_sso_registration` | boolean | Block SSO/OAuth signups |

---

## Example .env File

```bash
NODE_ENV=production

# Database
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=metamcp_user
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=metamcp_db
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}

# Application
APP_URL=https://metamcp.example.com
NEXT_PUBLIC_APP_URL=https://metamcp.example.com

# Auth
BETTER_AUTH_SECRET=your-super-secret-key

# OIDC (Optional)
# OIDC_CLIENT_ID=your-client-id
# OIDC_CLIENT_SECRET=your-client-secret
# OIDC_DISCOVERY_URL=https://provider.com/.well-known/openid-configuration
# OIDC_AUTHORIZATION_URL=https://provider.com/auth

# Docker
TRANSFORM_LOCALHOST_TO_DOCKER_INTERNAL=true
```

---

## Generating Secrets

```bash
# Better Auth Secret
openssl rand -hex 32 | base64

# PostgreSQL Password
openssl rand -hex 16
```
