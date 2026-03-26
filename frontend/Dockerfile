# Frontend Dockerfile - Multi-stage build
# Build context: ./frontend (standard)
# REQUIRES: jira-dashboard source copied into frontend/.jira-dashboard/ before build
# Run: cp -r ../jira-dashboard/src frontend/.jira-dashboard-src && cp ../jira-dashboard/package.json frontend/.jira-dashboard-pkg.json

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Set up jira-dashboard as local package
RUN mkdir -p /jira-dashboard/src
COPY .jira-dashboard-pkg.json /jira-dashboard/package.json
COPY .jira-dashboard-src/ /jira-dashboard/src/

# Copy package files and install
COPY package.json yarn.lock ./
RUN yarn install --production=false 2>/dev/null || npm install --legacy-peer-deps

# Copy frontend source
COPY . .

# Clean up build artifacts copied for jira-dashboard
RUN rm -rf .jira-dashboard-src .jira-dashboard-pkg.json

# Set production mode for build
ENV NODE_ENV=production

# Build the application
RUN yarn build

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
