#!/bin/bash
cat > /home/vcap/app/env-config.js << 'ENVEOF'
(function (window) {
  window.__env = window.__env || {};
ENVEOF
cat >> /home/vcap/app/env-config.js << EOF
  window.__env.ENV = "${EASYLIFE_ENVIRONMENT:-local}";
  window.__env.API_BASE_URL = "${VITE_API_BASE_URL:-/api/v1}";
  window.__env.PREVAIL_API_BASE_URL = "${VITE_PREVAIL_API_BASE_URL:-/api/v1}";
EOF
cat >> /home/vcap/app/env-config.js << 'ENVEOF'
})(this);
ENVEOF
