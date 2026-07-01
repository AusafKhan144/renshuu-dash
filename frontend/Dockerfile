# Build the SPA, then hand the static output to the backend via a shared volume.
FROM node:20-slim AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* /app/
RUN npm install
COPY frontend /app
RUN npm run build

# Minimal runtime image whose only job is to publish dist/ into the shared volume.
FROM busybox:1.36
WORKDIR /dist
COPY --from=build /app/dist /dist
# On start, refresh the mounted volume the backend serves from. Clear it first
# so stale hashed bundles from a previous build don't linger in the volume.
CMD ["sh", "-c", "rm -rf /shared/* && cp -r /dist/* /shared/ && echo 'frontend build published' && tail -f /dev/null"]
