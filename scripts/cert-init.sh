#!/bin/bash
# First-time Let's Encrypt certificate issuance.
# Run once on the server before starting the full stack.
# Requires: DOMAIN and CERTBOT_EMAIL set in .env or exported.

set -euo pipefail

source .env 2>/dev/null || true

: "${DOMAIN:?DOMAIN env var required}"
: "${CERTBOT_EMAIL:?CERTBOT_EMAIL env var required}"

# Start nginx-proxy in HTTP-only mode to serve ACME challenge
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx-proxy

# Issue certificate
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile certbot run --rm certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    --email "${CERTBOT_EMAIL}" \
    --agree-tos \
    --no-eff-email \
    -d "${DOMAIN}"

# Reload nginx to pick up the new cert
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx-proxy nginx -s reload

echo "Certificate issued for ${DOMAIN}. Stack ready to start."
