FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# VITE_API_URL is a build-time var. Leave empty to use nginx proxy (recommended).
# Pass --build-arg VITE_API_URL=https://your-api.com only if API is on a separate domain.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# nginx.conf is treated as a template; entrypoint.sh runs envsubst at startup
COPY nginx.conf /etc/nginx/conf.d/default.conf.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Defaults for local docker-compose (Railway overrides PORT automatically)
ENV PORT=80
ENV API_INTERNAL_URL=http://api:3001

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
