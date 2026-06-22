FROM node:20-bookworm-slim

# better-sqlite3 necesita herramientas de compilación nativas
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar dependencias primero (mejor cache)
COPY package*.json ./
RUN npm ci --omit=dev

# Copiar el código
COPY src ./src

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/index.js"]
