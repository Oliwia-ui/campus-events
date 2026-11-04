FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
# Install the SQLite driver for the Render demo.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json
RUN npm ci --omit=dev --workspace=api

# Build the Vue app. Its build tools (Vite) are devDependencies, so they stay in this stage
# and never reach the final image; only the static files in web/dist are copied over.
FROM node:22-bookworm-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json ./api/package.json
COPY web/package.json ./web/package.json
RUN npm ci --workspace=web
COPY web ./web
RUN npm run build -w web

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
# Express serves these files (see api/src/middleware/frontend.mjs): one URL for site and API.
COPY --from=web --chown=node:node /app/web/dist ./web/dist
RUN mkdir -p /app/api/data && chown node:node /app/api/data
USER node
EXPOSE 3000
CMD ["npm", "start"]
