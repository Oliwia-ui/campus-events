FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
# SQLite remains available for local development and tests.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json
RUN npm ci --omit=dev --workspace=api

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./package.json
COPY --chown=node:node api/package.json ./api/package.json
COPY --chown=node:node api/src ./api/src
USER node
EXPOSE 3000
CMD ["npm", "start"]
