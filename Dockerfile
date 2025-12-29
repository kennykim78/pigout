# Build stage
FROM node:20-alpine AS builder

# Install build dependencies for native modules (sharp, etc.)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    vips-dev \
    pkgconfig \
    libc6-compat

# Set sharp to use pre-built binaries for musl (Alpine)
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1
ENV npm_config_platform=linuxmusl
ENV npm_config_arch=x64

WORKDIR /app

# Copy package files first for better caching
COPY backend/package.json backend/package-lock.json* ./

# Install ALL dependencies (including devDependencies for build)
# Force sharp to download pre-built binary
RUN npm install --legacy-peer-deps --ignore-scripts && \
    npm rebuild sharp

# Copy source code
COPY backend/tsconfig.json ./
COPY backend/src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

# Install runtime dependencies for sharp
RUN apk add --no-cache vips libc6-compat

WORKDIR /app

# Set sharp environment
ENV SHARP_IGNORE_GLOBAL_LIBVIPS=1

# Copy package files
COPY backend/package.json backend/package-lock.json* ./

# Install production dependencies only
RUN npm install --legacy-peer-deps --omit=dev --ignore-scripts && \
    npm rebuild sharp

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Set environment
ENV NODE_ENV=production
ENV PORT=3001

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "dist/main.js"]
