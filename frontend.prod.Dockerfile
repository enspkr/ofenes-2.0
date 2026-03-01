# --- Build Stage ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ .
RUN npm run build

# --- Serve Stage ---
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
# Nginx config is mounted via docker-compose volume
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
