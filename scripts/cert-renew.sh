#!/bin/bash
# Certificate renewal. Run via cron: 0 3 * * * /opt/heat-map-soil/scripts/cert-renew.sh
# Certbot auto-skips renewal if cert is not due (< 30 days to expiry).

set -euo pipefail

cd "$(dirname "$0")/.."

docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile certbot run --rm certbot renew --quiet
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx-proxy nginx -s reload
