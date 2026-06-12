# Linkora

A peer-to-peer messaging app that connects two devices directly using WebRTC signaling. Messages travel between devices in real time with no central storage — everything is saved locally on each device.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API + WebSocket signaling server (port 5000)
- `pnpm --filter @workspace/mobile run dev` — run the Expo mobile app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `DATABASE_URL` — Postgres connection string (optional, not used yet)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + WebSocket (`ws`) signaling server at `/api/signal`
- Mobile: Expo (React Native) with Expo Router
- DB: PostgreSQL + Drizzle ORM (available but not used — messages stored locally)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract
- `lib/db/src/schema/index.ts` — DB schema (source of truth)
- `artifacts/api-server/src/routes/signal.ts` — WebSocket P2P signaling server
- `artifacts/mobile/contexts/LinkoraContext.tsx` — WebSocket connection + all app state
- `artifacts/mobile/constants/colors.ts` — Dark blue color theme tokens
- `artifacts/mobile/app/(tabs)/index.tsx` — Chats list
- `artifacts/mobile/app/chat/[peerId].tsx` — Chat screen (text, images, files)
- `artifacts/mobile/app/call/[peerId].tsx` — Video call screen
- `artifacts/mobile/app/setup.tsx` — First-time user setup

## Architecture decisions

- **Signaling server only, no storage**: The WebSocket server at `/api/signal` relays SDP/ICE and messages between peers. It never stores any message. If a peer is offline, the message is dropped.
- **Local-first storage**: All conversations are persisted in AsyncStorage on each device. No cloud backup.
- **Random 8-char user IDs**: Generated at first launch (e.g. `ABCD1234`). Easy to share verbally. No phone number or email required.
- **WebSocket relay for MVP**: Messages are relayed via WebSocket instead of true WebRTC DataChannel. This works in Expo Go without a native build. True WebRTC DataChannel (fully offline P2P) would require react-native-webrtc and EAS Build.
- **Video calls require native build**: Video call UI is implemented; real camera streams require EAS Android build with react-native-webrtc.

## Product

- Users create a profile (just a name) on first launch and get a unique 8-character ID
- Share your ID with a contact, they enter it to start a conversation
- Messages, images, and files are sent directly between devices (via signaling relay)
- Nothing is stored on the server — messages are only delivered if both devices are online
- Incoming call notifications with accept/reject
- Dark navy color theme throughout

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Always restart the api-server workflow after changing `signal.ts`
- expo-clipboard and expo-document-picker must be pinned to their expo-compatible versions (8.x and 14.x)
- expo-file-system expected version is ~19.0.23 for expo 54; 18.x works but shows a warning

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
