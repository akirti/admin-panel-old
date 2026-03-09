#!/bin/sh
# PCF runs this script before starting the app

ENVIRONMENT="${ENVIRONMENT:-production}"
CONFIG_SRC="envConfig/env-${ENVIRONMENT}.js"
CONFIG_DEST="public/env-config.js"

if [ -f "$CONFIG_SRC" ]; then
  echo "Loading env-config for environment: ${ENVIRONMENT}"
  cp "$CONFIG_SRC" "$CONFIG_DEST"
else
  echo "WARNING: Config not found for '${ENVIRONMENT}', falling back to production"
  cp "envConfig/env-production.js" "$CONFIG_DEST"
fi
