import WebSocket from "ws";

const endpoint = process.env.SIGNAL_URL ?? "ws://127.0.0.1:5103/api/signal";
const timeoutMs = 5000;

function waitForMessage(socket, predicate) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out while waiting for a message from ${endpoint}`));
    }, timeoutMs);

    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      if (predicate(message)) {
        clearTimeout(timeout);
        resolve(message);
      }
    });
  });
}

function openClient() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(endpoint);
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error(`Timed out while connecting to ${endpoint}`));
    }, timeoutMs);

    socket.once("open", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

const alice = await openClient();
const bob = await openClient();

try {
  const aliceRegistered = waitForMessage(
    alice,
    (message) => message.type === "registered" && message.userId === "ALICE001",
  );
  alice.send(JSON.stringify({ type: "register", userId: "ALICE001", userName: "Alice" }));
  await aliceRegistered;

  const bobRegistered = waitForMessage(
    bob,
    (message) => message.type === "registered" && message.userId === "BOB00001",
  );
  bob.send(JSON.stringify({ type: "register", userId: "BOB00001", userName: "Bob" }));
  await bobRegistered;

  const relayed = waitForMessage(
    bob,
    (message) =>
      message.type === "relay" &&
      message.from === "ALICE001" &&
      message.payload?.type === "message" &&
      message.payload?.message?.content === "signal-smoke-test",
  );

  alice.send(
    JSON.stringify({
      type: "send",
      to: "BOB00001",
      payload: { type: "message", message: { content: "signal-smoke-test" } },
    }),
  );

  await relayed;

  const webRtcOfferRelayed = waitForMessage(
    bob,
    (message) =>
      message.type === "relay" &&
      message.from === "ALICE001" &&
      message.payload?.type === "webrtc-offer" &&
      message.payload?.callId === "call-smoke-test" &&
      message.payload?.description?.type === "offer",
  );

  alice.send(
    JSON.stringify({
      type: "send",
      to: "BOB00001",
      payload: {
        type: "webrtc-offer",
        callId: "call-smoke-test",
        description: { type: "offer", sdp: "signal-only-smoke-test" },
      },
    }),
  );

  await webRtcOfferRelayed;
  console.log(`Signal smoke test passed: ${endpoint}`);
} finally {
  alice.close();
  bob.close();
}
