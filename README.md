# FinControl

Gestão financeira pessoal (React + Express + Prisma + Postgres) com agente de IA e integração WhatsApp (Meta Embedded Signup).

## Stack

- Frontend: Vite + React + Tailwind
- Backend: Express + Prisma + PostgreSQL
- CI: GitHub Actions → imagens no GHCR
- Deploy: **manual** na VPS Hostinger com Docker Compose

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

## CI (GitHub Actions)

Push em `main` (ou `workflow_dispatch`) apenas **builda e publica** as imagens:

- `ghcr.io/rfo-dev/fincontrol-api:latest`
- `ghcr.io/rfo-dev/fincontrol-web:latest`

Não há deploy automático na VPS.

## Deploy manual na VPS

Veja o passo a passo em [`docs/DEPLOY-VPS.md`](docs/DEPLOY-VPS.md).

Resumo:

```bash
cd /opt/fincontrol
# .env preenchido + docker-compose.prod.yml
docker login ghcr.io -u rfo-dev
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

## Meta / WhatsApp

URLs de callback (app em `https://financial.cubotechbr.com.br`):

- OAuth redirect / domínio SDK: `https://financial.cubotechbr.com.br/`
- Webhook: `https://financial.cubotechbr.com.br/api/whatsapp/webhook`
- Deauthorize: `https://financial.cubotechbr.com.br/api/whatsapp/deauthorize`
- Data deletion: `https://financial.cubotechbr.com.br/api/whatsapp/data-deletion`
