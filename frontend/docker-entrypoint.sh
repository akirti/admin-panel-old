#!/bin/sh
set -e

ENVIRONMENT="${ENVIRONMENT:-production}"
CONFIG_SRC="/etc/nginx/env-config/env-config.${ENVIRONMENT}.js"
CONFIG_DEST="/usr/share/nginx/html/env-config.js"

if [ -f "$CONFIG_SRC" ]; then
  echo "Loading env-config for environment: ${ENVIRONMENT}"
  cp "$CONFIG_SRC" "$CONFIG_DEST"
else
  echo "WARNING: Config not found for environment '${ENVIRONMENT}', falling back to production"
  cp "/etc/nginx/env-config/env-config.production.js" "$CONFIG_DEST"
fi

exec nginx -g "daemon off;"
