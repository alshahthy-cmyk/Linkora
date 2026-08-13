# Linkora Android preview build

The mobile application embeds its messaging endpoint at build time. For a standalone APK, set `EXPO_PUBLIC_SIGNAL_URL` to the public secure address of the deployed signaling server, including `/api/signal`.

```bash
cd artifacts/mobile
cp .env.example .env.local
# Replace signal.example.com with the public service hostname.
```

The client accepts `wss://` outside development. A `ws://` address is accepted only while developing, where the legacy `EXPO_PUBLIC_DOMAIN` fallback is also supported. Do not put private tokens in `EXPO_PUBLIC_SIGNAL_URL`; Expo embeds `EXPO_PUBLIC_*` values into the client bundle.

For EAS Build, create the public environment value for each build environment before building:

```bash
eas env:create --name EXPO_PUBLIC_SIGNAL_URL --value wss://signal.example.com/api/signal --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_SIGNAL_URL --value wss://signal.example.com/api/signal --environment production --visibility plaintext
eas build --platform android --profile preview
```

The `preview` profile produces an installable APK. Before distributing it, verify that `https://signal.example.com/api/healthz` returns HTTP 200 and that two devices on separate networks can open a WSS connection to `/api/signal`.

The repository includes a signaling smoke test that registers two clients and verifies that one message is relayed. Run it against the deployed service after replacing the example address:

```bash
SIGNAL_URL=wss://signal.example.com/api/signal pnpm --filter @workspace/api-server run smoke:signal
```
