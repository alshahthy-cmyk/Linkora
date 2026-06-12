import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { logger } from "../lib/logger";

interface PeerInfo {
  ws: WebSocket;
  userName: string;
}

const peers = new Map<string, PeerInfo>();

export function attachSignaling(server: Server): void {
  const wss = new WebSocketServer({ server, path: "/api/signal" });

  wss.on("connection", (ws) => {
    let peerId: string | null = null;

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;

        if (msg["type"] === "register") {
          peerId = msg["userId"] as string;
          const name = (msg["userName"] as string) ?? peerId;
          peers.set(peerId, { ws, userName: name });
          ws.send(JSON.stringify({ type: "registered", userId: peerId }));
          logger.info({ peerId }, "Peer registered");
        } else if (msg["type"] === "send" && peerId) {
          const to = msg["to"] as string;
          const payload = msg["payload"];
          const target = peers.get(to);

          if (target && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(
              JSON.stringify({
                type: "relay",
                from: peerId,
                fromName: peers.get(peerId)?.userName ?? peerId,
                payload,
              }),
            );
          } else {
            ws.send(JSON.stringify({ type: "peer-offline", peerId: to }));
          }
        } else if (msg["type"] === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // ignore parse errors
      }
    });

    ws.on("close", () => {
      if (peerId) {
        peers.delete(peerId);
        logger.info({ peerId }, "Peer disconnected");
      }
    });

    ws.on("error", (err) => {
      logger.error({ err, peerId }, "WebSocket error");
    });
  });

  logger.info("Signaling server attached at /api/signal");
}
