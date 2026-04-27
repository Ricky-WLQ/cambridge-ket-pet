FROM node:22-slim
LABEL "language"="nodejs"
LABEL "framework"="next.js"

WORKDIR /src

RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.14.0

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter web exec prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder" \
    DIRECT_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder" \
    AUTH_SECRET="placeholder-build-time-only" \
    pnpm --filter web build

EXPOSE 8080

CMD ["pnpm", "--filter", "web", "start"]
