# Build TS
FROM node:22-alpine AS builder-ts

WORKDIR /app
COPY . .
RUN npm i && npm run build:ts && npm cache clean --force

# Build TS
FROM node:22-alpine AS builder-deps
WORKDIR /app
COPY . .
RUN npm ci --only=production && npm cache clean --force

# Release
FROM node:22-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=builder-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs ./migrations ./migrations
COPY --chown=nodejs:nodejs \
    package*.json \
    tsconfig.json \
    entrypoint.sh \
    .
COPY --from=builder-ts --chown=nodejs:nodejs /app/dist ./

USER nodejs
EXPOSE 3000

ENTRYPOINT ["/bin/sh"]
CMD ["entrypoint.sh"]
