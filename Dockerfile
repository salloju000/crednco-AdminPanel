# Build Stage
FROM node:20-slim AS build

WORKDIR /app

# Copy package files and install dependencies
COPY frontend/package*.json ./
RUN npm ci

# Copy source code and build
COPY frontend/ .
# Set build-time env if needed (or override via docker-compose)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Serve Stage
FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build output to nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
