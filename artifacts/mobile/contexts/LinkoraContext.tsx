import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { resolveSignalUrl } from "@/lib/signal-url";

export interface Message {
  id: string;
  type:
    | "text"
    | "image"
    | "file"
    | "call_started"
    | "call_ended"
    | "call_missed";
  content: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  fromMe: boolean;
  timestamp: number;
  status: "sending" | "sent" | "delivered";
}

export interface Conversation {
  peerId: string;
  peerName: string;
  messages: Message[];
  isOnline: boolean;
  lastActivity: number;
  unreadCount: number;
}

export interface IncomingCall {
  peerId: string;
  peerName: string;
}

interface SendMessageInput {
  type: "text" | "image" | "file";
  content: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

interface LinkoraContextValue {
  userId: string | null;
  userName: string | null;
  isReady: boolean;
  isConnected: boolean;
  connectionError: string | null;
  conversations: Conversation[];
  incomingCall: IncomingCall | null;
  activeCall: string | null;
  setupUser: (name: string) => Promise<void>;
  sendMessage: (
    peerId: string,
    peerName: string,
    msg: SendMessageInput,
  ) => void;
  startCall: (peerId: string) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  markAsRead: (peerId: string) => void;
  deleteConversation: (peerId: string) => void;
  updatePeerName: (peerId: string, name: string) => void;
}

const USER_KEY = "linkora_user";
const CONVS_KEY = "linkora_conversations";

function generateUserId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 8 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
}

function generateMsgId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

const LinkoraContext = createContext<LinkoraContextValue | null>(null);

export function LinkoraProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reconnectAttemptsRef = useRef(0);
  const userIdRef = useRef<string | null>(null);
  const userNameRef = useRef<string | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const activeCallRef = useRef<string | null>(null);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const saveConversations = useCallback(async (convs: Conversation[]) => {
    try {
      await AsyncStorage.setItem(CONVS_KEY, JSON.stringify(convs));
    } catch {}
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [userRaw, convsRaw] = await Promise.all([
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(CONVS_KEY),
        ]);

        if (userRaw) {
          const { id, name } = JSON.parse(userRaw) as {
            id: string;
            name: string;
          };
          setUserId(id);
          setUserName(name);
          userIdRef.current = id;
          userNameRef.current = name;
        }

        if (convsRaw) {
          const parsed = JSON.parse(convsRaw) as Conversation[];
          setConversations(parsed.map((c) => ({ ...c, isOnline: false })));
        }
      } finally {
        setIsReady(true);
      }
    }
    void load();
  }, []);

  const handleMessage = useRef<
    ((msg: Record<string, unknown>) => void) | null
  >(null);

  const addSystemMessage = useCallback(
    (
      peerId: string,
      peerName: string,
      type: "call_started" | "call_ended" | "call_missed",
    ) => {
      const sysMsg: Message = {
        id: generateMsgId(),
        type,
        content: "",
        fromMe: false,
        timestamp: Date.now(),
        status: "delivered",
      };

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.peerId === peerId);
        let updated: Conversation[];
        if (idx >= 0) {
          updated = prev.map((c, i) =>
            i === idx
              ? {
                  ...c,
                  messages: [...c.messages, sysMsg],
                  lastActivity: sysMsg.timestamp,
                }
              : c,
          );
        } else {
          updated = [
            ...prev,
            {
              peerId,
              peerName,
              messages: [sysMsg],
              isOnline: false,
              lastActivity: sysMsg.timestamp,
              unreadCount: 0,
            },
          ];
        }
        void saveConversations(updated);
        return updated;
      });
    },
    [saveConversations],
  );

  useEffect(() => {
    handleMessage.current = (msg: Record<string, unknown>) => {
      if (msg["type"] === "relay") {
        const from = msg["from"] as string;
        const fromName = msg["fromName"] as string;
        const payload = msg["payload"] as Record<string, unknown>;

        if (payload["type"] === "message") {
          const incomingMsg = { ...(payload["message"] as Message) };
          incomingMsg.fromMe = false;
          incomingMsg.status = "delivered";

          setConversations((prev) => {
            const idx = prev.findIndex((c) => c.peerId === from);
            let updated: Conversation[];

            if (idx >= 0) {
              updated = prev.map((c, i) =>
                i === idx
                  ? {
                      ...c,
                      peerName: fromName,
                      messages: [...c.messages, incomingMsg],
                      lastActivity: incomingMsg.timestamp,
                      unreadCount: c.unreadCount + 1,
                    }
                  : c,
              );
            } else {
              updated = [
                ...prev,
                {
                  peerId: from,
                  peerName: fromName,
                  messages: [incomingMsg],
                  isOnline: true,
                  lastActivity: incomingMsg.timestamp,
                  unreadCount: 1,
                },
              ];
            }

            void saveConversations(updated);
            return updated;
          });
        } else if (payload["type"] === "call-request") {
          setIncomingCall({ peerId: from, peerName: fromName });
        } else if (payload["type"] === "call-accept") {
          // Call accepted by remote
        } else if (payload["type"] === "call-reject") {
          setActiveCall(null);
          addSystemMessage(from, fromName, "call_missed");
        } else if (payload["type"] === "call-end") {
          setActiveCall(null);
          setIncomingCall(null);
          addSystemMessage(from, fromName, "call_ended");
        }
      } else if (msg["type"] === "peer-offline") {
        const offlinePeerId = msg["peerId"] as string;
        setConversations((prev) =>
          prev.map((c) =>
            c.peerId === offlinePeerId ? { ...c, isOnline: false } : c,
          ),
        );
      }
    };
  }, [saveConversations, addSystemMessage]);

  const connectWebSocket = useCallback(() => {
    const currentUserId = userIdRef.current;
    const currentUserName = userNameRef.current;
    if (!currentUserId || !currentUserName) return;

    const signal = resolveSignalUrl();
    if (!signal.url) {
      setIsConnected(false);
      setConnectionError(signal.error);
      return;
    }

    try {
      const ws = new WebSocket(signal.url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        ws.send(
          JSON.stringify({
            type: "register",
            userId: currentUserId,
            userName: currentUserName,
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as Record<
            string,
            unknown
          >;
          handleMessage.current?.(msg);
        } catch {}
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        if (reconnectTimeoutRef.current)
          clearTimeout(reconnectTimeoutRef.current);
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current),
          30000,
        );
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          if (userIdRef.current) connectWebSocket();
        }, delay);
      };

      ws.onerror = () => {
        setConnectionError("Unable to reach the messaging service. Retrying...");
        ws.close();
      };
    } catch {
      setIsConnected(false);
      setConnectionError("Unable to start the messaging connection. Retrying...");
    }
  }, []);

  useEffect(() => {
    if (userId && userName) {
      connectWebSocket();
    }
    return () => {
      if (reconnectTimeoutRef.current)
        clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [userId, userName, connectWebSocket]);

  const setupUser = useCallback(async (name: string) => {
    const id = generateUserId();
    await AsyncStorage.setItem(USER_KEY, JSON.stringify({ id, name }));
    setUserId(id);
    setUserName(name);
    userIdRef.current = id;
    userNameRef.current = name;
  }, []);

  const sendMessage = useCallback(
    (peerId: string, peerName: string, msgInput: SendMessageInput) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const msg: Message = {
        id: generateMsgId(),
        ...msgInput,
        fromMe: true,
        timestamp: Date.now(),
        status: "sent",
      };

      ws.send(
        JSON.stringify({
          type: "send",
          to: peerId,
          payload: { type: "message", message: msg },
        }),
      );

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.peerId === peerId);
        let updated: Conversation[];

        if (idx >= 0) {
          updated = prev.map((c, i) =>
            i === idx
              ? {
                  ...c,
                  messages: [...c.messages, msg],
                  lastActivity: msg.timestamp,
                }
              : c,
          );
        } else {
          updated = [
            ...prev,
            {
              peerId,
              peerName,
              messages: [msg],
              isOnline: true,
              lastActivity: msg.timestamp,
              unreadCount: 0,
            },
          ];
        }

        void saveConversations(updated);
        return updated;
      });
    },
    [saveConversations],
  );

  const startCall = useCallback((peerId: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    setActiveCall(peerId);
    ws.send(
      JSON.stringify({
        type: "send",
        to: peerId,
        payload: { type: "call-request", fromName: userNameRef.current },
      }),
    );
  }, []);

  const acceptCall = useCallback(() => {
    const ws = wsRef.current;
    const call = incomingCallRef.current;
    if (!ws || !call) return;

    ws.send(
      JSON.stringify({
        type: "send",
        to: call.peerId,
        payload: { type: "call-accept" },
      }),
    );
    setActiveCall(call.peerId);
    setIncomingCall(null);
  }, []);

  const rejectCall = useCallback(() => {
    const ws = wsRef.current;
    const call = incomingCallRef.current;
    if (!ws || !call) return;

    ws.send(
      JSON.stringify({
        type: "send",
        to: call.peerId,
        payload: { type: "call-reject" },
      }),
    );
    setIncomingCall(null);
  }, []);

  const endCall = useCallback(() => {
    const ws = wsRef.current;
    const callPeerId = activeCallRef.current;
    if (!ws || !callPeerId) return;

    ws.send(
      JSON.stringify({
        type: "send",
        to: callPeerId,
        payload: { type: "call-end" },
      }),
    );

    setActiveCall(null);
    setIncomingCall(null);
  }, []);

  const markAsRead = useCallback(
    (peerId: string) => {
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.peerId === peerId ? { ...c, unreadCount: 0 } : c,
        );
        void saveConversations(updated);
        return updated;
      });
    },
    [saveConversations],
  );

  const deleteConversation = useCallback(
    (peerId: string) => {
      setConversations((prev) => {
        const updated = prev.filter((c) => c.peerId !== peerId);
        void saveConversations(updated);
        return updated;
      });
    },
    [saveConversations],
  );

  const updatePeerName = useCallback(
    (peerId: string, name: string) => {
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.peerId === peerId ? { ...c, peerName: name } : c,
        );
        void saveConversations(updated);
        return updated;
      });
    },
    [saveConversations],
  );

  return (
    <LinkoraContext.Provider
      value={{
        userId,
        userName,
        isReady,
        isConnected,
        connectionError,
        conversations,
        incomingCall,
        activeCall,
        setupUser,
        sendMessage,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        markAsRead,
        deleteConversation,
        updatePeerName,
      }}
    >
      {children}
    </LinkoraContext.Provider>
  );
}

export function useLinkoraContext() {
  const ctx = useContext(LinkoraContext);
  if (!ctx)
    throw new Error("useLinkoraContext must be used within LinkoraProvider");
  return ctx;
}
