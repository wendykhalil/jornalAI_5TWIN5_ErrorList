# Stage 1: Build React/Vite SPA
FROM node:22-alpine AS build

WORKDIR /app

# Copy package manifests and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy frontend source code
COPY . ./

# Build with relative /api base URL so it works seamlessly behind Nginx reverse proxy
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# Stage 2: Serve via Nginx Alpine with TLS support
FROM nginx:1.27-alpine

# Install OpenSSL for TLS certificate bootstrap
RUN apk add --no-cache openssl

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts to Nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Copy and prepare entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/entrypoint.sh"]
