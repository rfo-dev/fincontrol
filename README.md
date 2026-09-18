# FinControl

Gestão financeira pessoal (React + Express + Prisma + Postgres) com agente de IA e integração WhatsApp (Meta Embedded Signup).

## Stack

- Frontend: Vite + React + Tailwind
- Backend: Express + Prisma + PostgreSQL
- Deploy: Docker Compose + GitHub Actions → GHCR → VPS Hostinger

## Desenvolvimento local

```bash
# DB + API
docker compose up -d db
cd backend && cp .env.example .env && npm install && npx prisma migrate deploy && npm run dev

# Frontend
cp .env.example .env
npm install
npm run dev
```

## Produção (VPS Hostinger)

1. No servidor, crie `/opt/fincontrol` (ou outro path).
2. Copie `docker-compose.prod.yml` e `.env.production.example` → `.env` e preencha segredos.
3. No GitHub do repositório, configure:

### Secrets

| Secret | Descrição |
|--------|-----------|
| `VPS_HOST` | IP/hostname da VPS |
| `VPS_USER` | Usuário SSH |
| `VPS_SSH_KEY` | Chave privada SSH |
| `VPS_PORT` | Porta SSH (ex.: `22`) |
| `VPS_APP_DIR` | Diretório na VPS (ex.: `/opt/fincontrol`) |
| `GHCR_TOKEN` | PAT com `read:packages` (para pull das imagens) |

### Variable

| Variable | Valor |
|----------|-------|
| `ENABLE_VPS_DEPLOY` | `true` |

4. Push em `main` gera imagens em GHCR. Com `ENABLE_VPS_DEPLOY=true`, também faz deploy via SSH.

## Meta / WhatsApp

URLs de callback (app em `https://financial.cubotechbr.com.br`):

- OAuth redirect / domínio SDK: `https://financial.cubotechbr.com.br/`
- Webhook: `https://financial.cubotechbr.com.br/api/whatsapp/webhook`
- Deauthorize: `https://financial.cubotechbr.com.br/api/whatsapp/deauthorize`
- Data deletion: `https://financial.cubotechbr.com.br/api/whatsapp/data-deletion`
