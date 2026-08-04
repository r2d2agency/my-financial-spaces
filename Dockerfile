# ---------- build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Nitro must target a plain Node server (not Cloudflare) for self-hosting.
ENV NITRO_PRESET=node-server

COPY package*.json ./
RUN npm install

COPY . .

# O sistema usa PostgreSQL puro e OpenAI. Não há dependências de build-time VITE_SUPABASE.

RUN npm run build

# ---------- runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=build /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
