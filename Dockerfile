# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY server.ts ./
COPY tsconfig.json ./

# Create uploads dir (will be mounted or used at runtime)
RUN mkdir -p uploads

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "--no-warnings=ExperimentalWarning", "--experimental-strip-types", "server.ts"]
