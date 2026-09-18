# Deploy manual na VPS (Hostinger)
#
# Pré-requisitos na VPS:
# - Docker + Docker Compose plugin
# - Acesso ao GHCR (docker login ghcr.io)
#
# 1) Na VPS:
#    sudo mkdir -p /opt/fincontrol && cd /opt/fincontrol
#
# 2) Copie estes arquivos para /opt/fincontrol:
#    - docker-compose.prod.yml
#    - .env  (a partir de .env.production.example)
#
# 3) Login no registry (PAT com read:packages):
#    echo SEU_PAT | docker login ghcr.io -u rfo-dev --password-stdin
#
# 4) Subir / atualizar:
#    docker compose -f docker-compose.prod.yml pull
#    docker compose -f docker-compose.prod.yml up -d
#
# 5) Logs:
#    docker compose -f docker-compose.prod.yml logs -f --tail=100
#
# Imagens:
#    ghcr.io/rfo-dev/fincontrol-api:latest
#    ghcr.io/rfo-dev/fincontrol-web:latest
