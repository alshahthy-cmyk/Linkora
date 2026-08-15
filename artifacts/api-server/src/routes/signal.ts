import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { logger } from "../lib/logger";

interface PeerInfo {
  ws: WebSocket;
  userName: string;
}

const peers = new Map<string, PeerInfo>();
const MAX_SIGNAL_MESSAGE_BYTES = 12 * 1024 * 1024;
const MAX_INLINE_IMAGE_CHARS = 1_000_000;
const ALLOWED_RELAY_TYPES = new Set([
  "message",
  "message-received",
  "message-read",
  "message-delete",
  "typing",
  "call-request",
  "call-accept",
  "call-reject",
  "call-end",
  "webrtc-offer",
  "webrtc-answer",
  "webrtc-ice",
]);

function isAllowedRelayPayload(payload: unknown): payload is Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const relay = payload as Record<string, unknown>;
  const relayType = relay["type"];
  if (typeof relayType !== "string" || !ALLOWED_RELAY_TYPES.has(relayType)) return false;
  if (relayType !== "message") return true;

  const message = relay["message"];
  if (!message || typeof message !== "object" || Array.isArray(message)) return false;
  const item = message as Record<string, unknown>;
  if (item["type"] !== "text" && item["type"] !== "image") return false;
  if (typeof item["content"] !== "string") return false;
  return item["type"] !== "image" || item["content"].length <= MAX_INLINE_IMAGE_CHARS;
}

function broadcast(message: Record<string, unknown>, exceptPeerId?: string) {
  const encoded = JSON.stringify(message);
  for (const [id, peer] of peers) {
    if (id !== exceptPeerId && peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(encoded);
    }
  }
}

export function attachSignaling(server: Server): void {
  const wss = new WebSocketServer({
    server,
    path: "/api/signal",
    maxPayload: MAX_SIGNAL_MESSAGE_BYTES,
  });

  wss.on("connection", (ws) => {
    let peerId: string | null = null;

    ws.on("message", (data) => {
      try {
        const rawData = Array.isArray(data)
          ? Buffer.concat(data)
          : Buffer.isBuffer(data)
            ? data
            : Buffer.from(data);
        if (rawData.byteLength > MAX_SIGNAL_MESSAGE_BYTES) {
          ws.send(JSON.stringify({ type: "payload-too-large" }));
          return;
        }
        const msg = JSON.parse(rawData.toString()) as Record<string, unknown>;

        if (msg["type"] === "register") {
          peerId = msg["userId"] as string;
          const name = (msg["userName"] as string) ?? peerId;
          peers.set(peerId, { ws, userName: name });
          ws.send(
            JSON.stringify({
              type: "registered",
              userId: peerId,
              peers: Array.from(peers.entries())
                .filter(([id]) => id !== peerId)
                .map(([id, peer]) => ({ peerId: id, peerName: peer.userName })),
            }),
          );
          broadcast(
            {
              type: "presence",
              peerId,
              peerName: name,
              online: true,
              at: Date.now(),
            },
            peerId,
          );
          logger.info({ peerId }, "Peer registered");
        } else if (msg["type"] === "send" && peerId) {
          const to = msg["to"] as string;
          const payload = msg["payload"];
          if (typeof to !== "string" || !isAllowedRelayPayload(payload)) {
            ws.send(JSON.stringify({ type: "unsupported-content" }));
            return;
          }
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
        broadcast({
          type: "presence",
          peerId,
          online: false,
          at: Date.now(),
        });
        logger.info({ peerId }, "Peer disconnected");
      }
    });

    ws.on("error", (err) => {
      logger.error({ err, peerId }, "WebSocket error");
    });
  });

  logger.info("Signaling server attached at /api/signal");
}
