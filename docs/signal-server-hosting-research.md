# Signal Server Hosting Research

## Render

- Render Web Services accept inbound WebSocket connections from the public Internet.
- Public clients should use `wss://`; Render documents that `ws://` can fail after TLS redirect.
- Render does not impose a fixed WebSocket duration, but connections can end on deploys, maintenance, or instance replacement. Clients should reconnect with backoff and services should use heartbeats.
- Source: https://render.com/docs/websocket

## Railway

- Railway lists a Free plan with $1 of monthly usage credits, one replica, and up to 1 vCPU / 0.5 GB per service.
- Its trial lists $5 credits for 30 days without a credit card.
- Source: https://railway.com/pricing

## Koyeb

- Koyeb documents GitHub-driven deployment for Express and says an account is free to get started.
- Its WebSocket tutorial describes native WebSocket support and long-running WebSocket applications. The Node service must listen on the `PORT` supplied by the platform.
- Sources: https://www.koyeb.com/docs/deploy/express and https://www.koyeb.com/tutorials/using-websockets-with-socketio-and-nodejs-on-koyeb

## Railway deployment diagnosis

- Railway documents shared monorepos as root-based deployments and recommends custom per-service build and start commands that reference the desired workspace package.
- Nixpacks detects package managers from `packageManager` or the lockfile and supports Corepack for a declared pnpm version.
- The upstream Nixpacks project has an open 2026 issue reporting pnpm 11 incompatibility and says Nixpacks is deprecated; a deployment should pin a compatible pnpm release or use Railpack/Docker instead of relying on automatic setup.
- Sources: https://docs.railway.com/deployments/monorepo, https://nixpacks.com/docs/providers/node, https://github.com/railwayapp/nixpacks/issues/1419
