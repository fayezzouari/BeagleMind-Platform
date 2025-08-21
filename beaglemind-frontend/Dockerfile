# Use official Node.js image as the base
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests and install all deps (including dev) for build
COPY package.json package-lock.json ./
RUN npm ci

# Copy app sources and build
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built assets from builder
COPY --from=builder /app/.next .next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
