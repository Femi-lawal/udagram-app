FROM nginx:1.25-alpine

LABEL maintainer="Udagram Team"
LABEL description="Nginx reverse proxy for Udagram microservices"

# Install curl for health checks
RUN apk add --no-cache curl

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create custom error pages directory
RUN mkdir -p /usr/share/nginx/html

# Create custom 50x error page
RUN echo '<!DOCTYPE html><html><head><title>Udagram - Error</title><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#fafafa}div{text-align:center}h1{color:#262626;font-size:24px}p{color:#8e8e8e}</style></head><body><div><h1>Something went wrong</h1><p>Please try again later</p></div></body></html>' > /usr/share/nginx/html/50x.html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
