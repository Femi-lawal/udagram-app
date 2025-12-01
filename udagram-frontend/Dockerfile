# Stage 1: Build the Angular application
FROM node:20-alpine AS build

# Install libc6-compat for rollup compatibility on Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies - remove lock and cache for clean install
RUN rm -rf node_modules package-lock.json && npm cache clean --force && npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:1.25-alpine

LABEL maintainer="Udagram Team"
LABEL description="Udagram Frontend - Instagram-like photo sharing app"

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from build stage
COPY --from=build /app/dist/udagram-frontend/browser /usr/share/nginx/html

# Copy nginx configuration for SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Add health check
RUN apk add --no-cache curl
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Expose port 80
EXPOSE 80

# Run nginx
CMD ["nginx", "-g", "daemon off;"]
