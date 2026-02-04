# Deployment

[← Back to Index](index.md)

---

## Docker Compose (Recommended)

```yaml
services:
  app:
    container_name: metamcp
    image: ghcr.io/metatool-ai/metamcp:latest
    pull_policy: always
    env_file:
      - .env
    ports:
      - "12008:12008"
    environment:
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_USER: metamcp_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: metamcp_db
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/metamcp_db
      APP_URL: ${APP_URL:-http://localhost:12008}
      BETTER_AUTH_SECRET: ${BETTER_AUTH_SECRET}
      TRANSFORM_LOCALHOST_TO_DOCKER_INTERNAL: true
    extra_hosts:
      - "host.docker.internal:host-gateway"
    depends_on:
      postgres:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    container_name: metamcp-pg
    environment:
      POSTGRES_DB: metamcp_db
      POSTGRES_USER: metamcp_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "9433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U metamcp_user -d metamcp_db"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

---

## Quick Start

```bash
git clone https://github.com/metatool-ai/metamcp.git
cd metamcp
cp example.env .env
docker compose up -d
```

Access at `http://localhost:12008`

---

## Nginx Reverse Proxy (SSE Support)

```nginx
server {
    listen 443 ssl http2;
    server_name metamcp.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:12008;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE-critical settings
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;

        # HTTP/1.1 for SSE
        proxy_set_header Connection '';
        proxy_http_version 1.1;

        # Disable buffering
        proxy_set_header Cache-Control 'no-cache';
        proxy_set_header X-Accel-Buffering 'no';
    }
}
```

---

## System Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 2GB | 4GB+ |
| CPU | 1 vCPU | 2+ vCPU |
| Storage | 20GB SSD | 80GB SSD |

---

## Production Checklist

- [ ] Change `POSTGRES_PASSWORD` from default
- [ ] Generate secure `BETTER_AUTH_SECRET` (`openssl rand -hex 32 | base64`)
- [ ] Set `APP_URL` to actual domain with HTTPS
- [ ] Configure SSL/TLS certificates
- [ ] Set up Nginx reverse proxy
- [ ] Configure firewall (only expose 443)
- [ ] Set up backups for PostgreSQL volume
- [ ] Consider volume name conflicts (rename `postgres_data` if needed)

---

## Local Development

```bash
pnpm install
pnpm dev
```

**Hot Reload with Docker:**
```bash
pnpm run dev:docker
pnpm run dev:docker:down
pnpm run dev:docker:clean
```
