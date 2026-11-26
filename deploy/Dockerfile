# syntax=docker/dockerfile:1
# One image runs nginx, api, auth, and the OTel collector under s6.
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

FROM node:24-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates nginx s6 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=otel/opentelemetry-collector:0.162.0 /otelcol /usr/local/bin/otelcol
COPY otel/config.yaml /etc/otelcol/config.yaml
# The public Aiven project CA; KAFKA_CA_FILE in fly.toml points here.
COPY deploy/aiven-ca.pem /etc/keysy/aiven-ca.pem
COPY --from=api-build /out/api /usr/local/bin/keysy-api
COPY --from=auth-build /out/auth /usr/local/bin/keysy-auth
COPY deploy/nginx.conf /etc/nginx/nginx.conf
# s6-supervise writes its state into each service directory.
COPY --chown=node:node deploy/s6 /etc/s6
USER node
EXPOSE 8000
# Fly's init stays pid 1, so this uses plain s6-svscan; s6-overlay refuses to run unless it is pid 1.
CMD ["s6-svscan", "/etc/s6"]
