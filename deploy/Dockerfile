# syntax=docker/dockerfile:1
# One image runs nginx, api, auth, dashboard, and the OTel collector under s6.
# Build with the repository root as the context.

FROM golang:1.27.3 AS api-build
WORKDIR /src/api
COPY api/go.mod api/go.sum ./
RUN go mod download
COPY api ./
RUN CGO_ENABLED=0 go build -trimpath -o /out/api .

FROM golang:1.27.3 AS auth-build
WORKDIR /src/auth
COPY auth/go.mod auth/go.sum ./
RUN go mod download
COPY auth ./
RUN CGO_ENABLED=0 go build -trimpath -o /out/auth .

# Next.js builds on Node, as in CI. Bun only installs packages.
FROM node:24-slim AS dashboard-build
COPY --from=oven/bun:1.4.3 /usr/local/bin/bun /usr/local/bin/bun
ARG NEXT_PUBLIC_AUTH_URL
ARG NEXT_PUBLIC_API_URL
WORKDIR /src/dashboard
COPY dashboard/package.json dashboard/bun.lock ./
RUN bun install --frozen-lockfile
COPY dashboard ./
COPY design /src/design
RUN bun run build

FROM node:24-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates nginx s6 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=otel/opentelemetry-collector:0.162.0 /otelcol /usr/local/bin/otelcol
COPY otel/config.yaml /etc/otelcol/config.yaml
COPY --from=api-build /out/api /usr/local/bin/keysy-api
COPY --from=auth-build /out/auth /usr/local/bin/keysy-auth
WORKDIR /app/dashboard
# Standalone output holds server.js, its traced node_modules, and the server build. It omits static files.
COPY --from=dashboard-build --chown=node:node /src/dashboard/.next/standalone/dashboard ./
COPY --from=dashboard-build --chown=node:node /src/dashboard/.next/static ./.next/static
COPY --from=dashboard-build --chown=node:node /src/dashboard/public ./public
COPY deploy/nginx.conf /etc/nginx/nginx.conf
# s6-supervise writes its state into each service directory.
COPY --chown=node:node deploy/s6 /etc/s6
USER node
EXPOSE 8000
# Fly's init stays pid 1, so this uses plain s6-svscan; s6-overlay refuses to run unless it is pid 1.
CMD ["s6-svscan", "/etc/s6"]
