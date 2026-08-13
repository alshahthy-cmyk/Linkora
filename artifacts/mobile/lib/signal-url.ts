export interface SignalUrlResolution {
  url: string | null;
  error: string | null;
}

const SIGNAL_PATH = "/api/signal";

function ensureSignalPath(url: URL): URL {
  if (url.pathname === "/" || url.pathname === "") {
    url.pathname = SIGNAL_PATH;
  }
  return url;
}

function resolveDevelopmentUrl(): SignalUrlResolution {
  const legacyDomain = process.env.EXPO_PUBLIC_DOMAIN?.trim();

  if (!legacyDomain) {
    return { url: `ws://localhost:3000${SIGNAL_PATH}`, error: null };
  }

  try {
    const normalizedDomain = /^https?:\/\//i.test(legacyDomain)
      ? legacyDomain
      : `https://${legacyDomain}`;
    const parsed = new URL(normalizedDomain);
    parsed.protocol = parsed.hostname === "localhost" ? "ws:" : "wss:";
    return { url: ensureSignalPath(parsed).toString(), error: null };
  } catch {
    return {
      url: null,
      error: "The development messaging service address is invalid.",
    };
  }
}

/**
 * Resolves the WebSocket endpoint embedded in the Expo bundle.
 * A standalone build must use a public, secure WSS endpoint supplied through
 * EXPO_PUBLIC_SIGNAL_URL at build time. The legacy domain is used only in dev.
 */
export function resolveSignalUrl(): SignalUrlResolution {
  const configuredUrl = process.env.EXPO_PUBLIC_SIGNAL_URL?.trim();

  if (!configuredUrl) {
    if (__DEV__) return resolveDevelopmentUrl();
    return {
      url: null,
      error:
        "Messaging is not configured. This build needs EXPO_PUBLIC_SIGNAL_URL.",
    };
  }

  try {
    const parsed = ensureSignalPath(new URL(configuredUrl));
    const usesSecureWebSocket = parsed.protocol === "wss:";
    const usesDevelopmentWebSocket = __DEV__ && parsed.protocol === "ws:";

    if (!usesSecureWebSocket && !usesDevelopmentWebSocket) {
      return {
        url: null,
        error:
          "Messaging must use a secure wss:// address outside development.",
      };
    }

    return { url: parsed.toString(), error: null };
  } catch {
    return {
      url: null,
      error: "The configured messaging service address is invalid.",
    };
  }
}
