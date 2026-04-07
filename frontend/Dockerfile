# Frontend Dockerfile - Multi-stage build
# Build context: ./frontend (standard)
# REQUIRES: jira-dashboard and easyweaver-ui source copied before build
# Run: cp -r ../jira-dashboard/src frontend/.jira-dashboard-src && cp ../jira-dashboard/package.json frontend/.jira-dashboard-pkg.json
# Run: cp -r ../easyweaver-ui/src frontend/.easyweaver-ui-src && cp ../easyweaver-ui/package.json frontend/.easyweaver-ui-pkg.json

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Set up jira-dashboard as local package
RUN mkdir -p /jira-dashboard/src
COPY .jira-dashboard-pkg.json /jira-dashboard/package.json
COPY .jira-dashboard-src/ /jira-dashboard/src/

# Set up easyweaver-ui as local package
RUN mkdir -p /easyweaver-ui/src
COPY .easyweaver-ui-pkg.json /easyweaver-ui/package.json
COPY .easyweaver-ui-src/ /easyweaver-ui/src/

# Install dependencies for local packages (transitive deps)
# --ignore-scripts prevents running arbitrary postinstall scripts from packages
RUN cd /jira-dashboard && npm install --omit=dev --legacy-peer-deps --ignore-scripts
RUN cd /easyweaver-ui && npm install --omit=dev --legacy-peer-deps --ignore-scripts

# Copy package files and install
COPY package.json package-lock.json* yarn.lock* ./
RUN npm ci --legacy-peer-deps --ignore-scripts

# Copy frontend source
COPY . .

# Clean up build artifacts copied for local packages
RUN rm -rf .jira-dashboard-src .jira-dashboard-pkg.json .easyweaver-ui-src .easyweaver-ui-pkg.json

# Set production mode for build
ENV NODE_ENV=production

# Build the application
RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:mainline-alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/build/public /usr/share/nginx/html

# Copy environment-specific config files
COPY envConfig/ /etc/nginx/env-config/

# Copy and set up entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx via entrypoint (selects env config at runtime)
CMD ["/docker-entrypoint.sh"]
