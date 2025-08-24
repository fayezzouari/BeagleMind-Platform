# Use official Node.js image as the base
FROM node:20-alpine AS builder
# Provide defaults at build-time to satisfy NextAuth during build; override via runtime env
ARG NEXTAUTH_URL=http://localhost:3000
ARG NEXTAUTH_SECRET=dev_only_secret_do_not_use_in_prod
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET

WORKDIR /app

# Copy package manifests and install all deps (including dev) for build
COPY package.json package-lock.json ./
RUN npm ci

# Copy app sources and build
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
# Carry over required NextAuth envs with safe defaults (override via compose env)
ARG NEXTAUTH_URL=http://localhost:3000
ARG NEXTAUTH_SECRET=dev_only_secret_do_not_use_in_prod
ENV NEXTAUTH_URL=$NEXTAUTH_URL
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET

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
