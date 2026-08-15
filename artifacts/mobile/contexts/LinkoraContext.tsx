import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import InCallManager from "react-native-incall-manager";
import {
  MediaStream,
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
} from "react-native-webrtc";

import { resolveSignalUrl } from "@/lib/signal-url";

export type MessageType =
  | "text"
  | "image"
  | "call_started"
  | "call_ended"
  | "call_missed";

export type MessageStatus = "sending" | "sent" | "delivered" | "read";
export type CallMode = "audio" | "video";

export interface ReplyReference {
  id: string;
  content: string;
  type: MessageType;
  fromMe: boolean;
}

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  durationMs?: number;
  fromMe: boolean;
  timestamp: number;
  status: MessageStatus;
  replyTo?: ReplyReference;
  deletedAt?: number;
  attachmentUnavailable?: boolean;
}

export interface Conversation {
  peerId: string;
  peerName: string;
  messages: Message[];
  isOnline: boolean;
  lastSeenAt?: number;
  isTyping?: boolean;
  lastActivity: number;
  unreadCount: number;
}

export interface IncomingCall {
  peerId: string;
  peerName: string;
  callId: string;
  mode: CallMode;
}

export interface SendMessageInput {
  type: "text" | "image";
  content: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  durationMs?: number;
  replyTo?: ReplyReference;
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
  activeCallMode: CallMode | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  setupUser: (name: string) => Promise<void>;
  sendMessage: (peerId: string, peerName: string, msg: SendMessageInput) => void;
  sendTyping: (peerId: string, isTyping: boolean) => void;
  deleteMessage: (peerId: string, messageId: string) => void;
  startCall: (peerId: string, mode?: CallMode) => void;
  acceptCall: () => void;
  rejectCall: () => void;
  endCall: () => void;
  setCallMuted: (muted: boolean) => void;
  setSpeakerEnabled: (enabled: boolean) => void;
  markAsRead: (peerId: string) => void;
  deleteConversation: (peerId: string) => void;
  updatePeerName: (peerId: string, name: string) => void;
}

const USER_KEY = "linkora_user";
const CONVS_KEY = "linkora_conversations";
const TYPING_TIMEOUT_MS = 4000;
const PERSIST_DEBOUNCE_MS = 700;
const MAX_MESSAGES_IN_MEMORY = 180;
const MAX_PERSISTED_MESSAGES_PER_CONVERSATION = 80;
const MAX_PERSISTED_ATTACHMENT_CHARS = 1_000_000;
const MAX_PENDING_ICE_CANDIDATES = 100;
const WAKE_RETRY_DELAYS_MS = [2_000, 5_000];

// Public STUN makes direct connections possible. A TURN service must be supplied
// for reliable calls when either participant is behind a restrictive network.
// The credentials used in a mobile build are visible to its users, so production
// deployments should use short-lived credentials issued by an authenticated API.
const turnUrl = process.env.EXPO_PUBLIC_TURN_URL;
const turnUsername = process.env.EXPO_PUBLIC_TURN_USERNAME;
const turnCredential = process.env.EXPO_PUBLIC_TURN_CREDENTIAL;
const ICE_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ...(turnUrl && turnUsername && turnCredential
    ? [{ urls: turnUrl, username: turnUsername, credential: turnCredential }]
    : []),
];

function generateUserId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function isInlineAttachment(message: Message) {
  return message.type === "image" && message.content.startsWith("data:");
}

function compactMessageForStorage(message: Message): Message {
  if (isInlineAttachment(message) && message.content.length > MAX_PERSISTED_ATTACHMENT_CHARS) {
    return { ...message, content: "", attachmentUnavailable: true };
  }
  return message;
}

function compactConversationsForStorage(items: Conversation[]): Conversation[] {
  return items.map((conversation) => ({
    ...conversation,
    isOnline: false,
    isTyping: false,
    messages: conversation.messages
      .filter((message) => message.type === "text" || message.type === "image" || message.type.startsWith("call_"))
      .slice(-MAX_PERSISTED_MESSAGES_PER_CONVERSATION)
      .map(compactMessageForStorage),
  }));
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
  const [activeCallMode, setActiveCallMode] = useState<CallMode | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const typingTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const userIdRef = useRef<string | null>(null);
  const userNameRef = useRef<string | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const activeCallRef = useRef<string | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const conversationsRef = useRef<Conversation[]>([]);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistenceRef = useRef<Conversation[] | null>(null);
  const shouldReconnectRef = useRef(false);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const saveConversations = useCallback((next: Conversation[]) => {
    pendingPersistenceRef.current = compactConversationsForStorage(next);
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      const snapshot = pendingPersistenceRef.current;
      pendingPersistenceRef.current = null;
      persistTimeoutRef.current = null;
      if (!snapshot) return;
      void AsyncStorage.setItem(CONVS_KEY, JSON.stringify(snapshot)).catch(() => {
        // Local persistence must never block chat interactions.
      });
    }, PERSIST_DEBOUNCE_MS);
  }, []);

  const flushConversationPersistence = useCallback(() => {
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = null;
    const snapshot = pendingPersistenceRef.current;
    pendingPersistenceRef.current = null;
    if (snapshot) void AsyncStorage.setItem(CONVS_KEY, JSON.stringify(snapshot)).catch(() => {});
  }, []);

  const updateConversations = useCallback(
    (updater: (previous: Conversation[]) => Conversation[]) => {
      setConversations((previous) => {
        const next = updater(previous);
        conversationsRef.current = next;
        saveConversations(next);
        return next;
      });
    },
    [saveConversations],
  );

  useEffect(() => {
    async function load() {
      try {
        const [userRaw, conversationsRaw] = await Promise.all([
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(CONVS_KEY),
        ]);

        if (userRaw) {
          const savedUser = JSON.parse(userRaw) as { id: string; name: string };
          setUserId(savedUser.id);
          setUserName(savedUser.name);
          userIdRef.current = savedUser.id;
          userNameRef.current = savedUser.name;
        }

        if (conversationsRaw) {
          const savedConversations = JSON.parse(conversationsRaw) as Conversation[];
          const restoredConversations = compactConversationsForStorage(savedConversations);
          conversationsRef.current = restoredConversations;
          setConversations(restoredConversations);
          const compactedRaw = JSON.stringify(restoredConversations);
          if (compactedRaw !== conversationsRaw) void AsyncStorage.setItem(CONVS_KEY, compactedRaw).catch(() => {});
        }
      } catch {
        // Start with an empty local history if a stale cache cannot be decoded.
      } finally {
        setIsReady(true);
      }
    }
    void load();
  }, []);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  const sendRelay = useCallback((peerId: string, payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify({ type: "send", to: peerId, payload }));
    return true;
  }, []);

  const addSystemMessage = useCallback(
    (peerId: string, peerName: string, type: "call_started" | "call_ended" | "call_missed") => {
      const message: Message = { id: generateId(), type, content: "", fromMe: false, timestamp: Date.now(), status: "delivered" };
      updateConversations((previous) => {
        const index = previous.findIndex((conversation) => conversation.peerId === peerId);
        if (index < 0) {
          return [...previous, { peerId, peerName, messages: [message], isOnline: true, lastActivity: message.timestamp, unreadCount: 0 }];
        }
        return previous.map((conversation, itemIndex) => itemIndex === index
          ? { ...conversation, peerName, messages: [...conversation.messages, message].slice(-MAX_MESSAGES_IN_MEMORY), lastActivity: message.timestamp }
          : conversation);
      });
    },
    [updateConversations],
  );

  const closePeerConnection = useCallback(() => {
    const connection = peerConnectionRef.current;
    if (connection) {
      connection.onicecandidate = null;
      connection.ontrack = null;
      connection.onconnectionstatechange = null;
      connection.close();
    }
    peerConnectionRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    pendingCandidatesRef.current = [];
    activeCallIdRef.current = null;
    InCallManager.stop();
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setActiveCallMode(null);
    setIsMuted(false);
    setIsSpeakerOn(false);
  }, []);

  const flushPendingCandidates = useCallback(async () => {
    const connection = peerConnectionRef.current;
    if (!connection || !connection.remoteDescription) return;
    const pending = pendingCandidatesRef.current.splice(0);
    await Promise.all(pending.map((candidate) => connection.addIceCandidate(new RTCIceCandidate(candidate))));
  }, []);

  const preparePeerConnection = useCallback(async (
    peerId: string,
    mode: CallMode,
    callId: string,
  ) => {
    const stream = await mediaDevices.getUserMedia({ audio: true, video: mode === "video" });
    localStreamRef.current = stream;
    setLocalStream(stream);
    setActiveCall(peerId);
    setActiveCallMode(mode);
    activeCallIdRef.current = callId;
    setIsMuted(false);
    setIsSpeakerOn(false);
    InCallManager.start({ media: mode });
    InCallManager.setForceSpeakerphoneOn(false);

    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peerConnectionRef.current = connection;
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));
    connection.onicecandidate = (event: { candidate: RTCIceCandidate | null }) => {
      if (!event.candidate) return;
      const candidate = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
      sendRelay(peerId, { type: "webrtc-ice", callId, candidate: candidate as unknown as Record<string, unknown> });
    };
    connection.ontrack = (event: { streams: MediaStream[] }) => {
      const nextRemote = event.streams[0];
      if (nextRemote) {
        remoteStreamRef.current = nextRemote;
        setRemoteStream(nextRemote);
      }
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed") {
        setConnectionError("The call connection failed. Check the network and try again.");
        closePeerConnection();
      }
    };
    return connection;
  }, [closePeerConnection, sendRelay]);

  const handleMessage = useRef<((message: Record<string, unknown>) => void) | null>(null);

  useEffect(() => {
    const setTypingState = (peerId: string, isTyping: boolean) => {
      const existingTimer = typingTimeoutsRef.current.get(peerId);
      if (existingTimer) clearTimeout(existingTimer);
      updateConversations((previous) => previous.map((conversation) => conversation.peerId === peerId ? { ...conversation, isTyping } : conversation));
      if (isTyping) {
        const timeout = setTimeout(() => {
          updateConversations((previous) => previous.map((conversation) => conversation.peerId === peerId ? { ...conversation, isTyping: false } : conversation));
          typingTimeoutsRef.current.delete(peerId);
        }, TYPING_TIMEOUT_MS);
        typingTimeoutsRef.current.set(peerId, timeout);
      }
    };

    const handleWebRtcOffer = async (from: string, payload: Record<string, unknown>) => {
      const connection = peerConnectionRef.current;
      const description = payload["description"] as { sdp: string; type: string | null } | undefined;
      if (!connection || !description) return;
      await connection.setRemoteDescription(new RTCSessionDescription(description));
      await flushPendingCandidates();
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      sendRelay(from, { type: "webrtc-answer", callId: payload["callId"], description: connection.localDescription as unknown as Record<string, unknown> });
    };

    const handleWebRtcAnswer = async (payload: Record<string, unknown>) => {
      const connection = peerConnectionRef.current;
      const description = payload["description"] as { sdp: string; type: string | null } | undefined;
      if (!connection || !description) return;
      await connection.setRemoteDescription(new RTCSessionDescription(description));
      await flushPendingCandidates();
    };

    const handleWebRtcCandidate = async (payload: Record<string, unknown>) => {
      const candidate = payload["candidate"] as RTCIceCandidateInit | undefined;
      const connection = peerConnectionRef.current;
      if (!candidate || !connection) return;
      if (connection.remoteDescription) {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        if (pendingCandidatesRef.current.length >= MAX_PENDING_ICE_CANDIDATES) {
          setConnectionError("The call received too many network candidates. Please try again.");
          return;
        }
        pendingCandidatesRef.current.push(candidate);
      }
    };

    handleMessage.current = (message) => {
      if (message["type"] === "registered") {
        const peers = Array.isArray(message["peers"]) ? message["peers"] : [];
        const onlineIds = new Set(peers.map((peer) => (peer as Record<string, unknown>)["peerId"]).filter(Boolean));
        updateConversations((previous) => previous.map((conversation) => ({ ...conversation, isOnline: onlineIds.has(conversation.peerId) })));
        return;
      }

      if (message["type"] === "presence") {
        const peerId = message["peerId"] as string;
        const online = Boolean(message["online"]);
        const at = typeof message["at"] === "number" ? message["at"] : Date.now();
        if (!peerId) return;
        updateConversations((previous) => previous.map((conversation) => conversation.peerId === peerId
          ? { ...conversation, isOnline: online, lastSeenAt: online ? conversation.lastSeenAt : at, isTyping: online ? conversation.isTyping : false }
          : conversation));
        return;
      }

      if (message["type"] === "payload-too-large") {
        setConnectionError("The selected attachment is too large to send.");
        return;
      }

      if (message["type"] === "unsupported-content") {
        setConnectionError("يسمح Linkora بالرسائل النصية والصور فقط.");
        return;
      }

      if (message["type"] === "peer-offline") {
        const peerId = message["peerId"] as string;
        updateConversations((previous) => previous.map((conversation) => conversation.peerId === peerId ? { ...conversation, isOnline: false, lastSeenAt: Date.now() } : conversation));
        return;
      }

      if (message["type"] !== "relay") return;
      const from = message["from"] as string;
      const fromName = (message["fromName"] as string) || from;
      const payload = message["payload"] as Record<string, unknown>;
      if (!from || !payload) return;

      if (payload["type"] === "message") {
        const rawMessage = payload["message"] as Message;
        if (!rawMessage?.id) return;
        if (rawMessage.type !== "text" && rawMessage.type !== "image") return;
        const incoming: Message = { ...rawMessage, fromMe: false, status: "delivered" };
        updateConversations((previous) => {
          const index = previous.findIndex((conversation) => conversation.peerId === from);
          if (index < 0) return [...previous, { peerId: from, peerName: fromName, messages: [incoming], isOnline: true, lastActivity: incoming.timestamp, unreadCount: 1 }];
          return previous.map((conversation, itemIndex) => itemIndex === index
            ? { ...conversation, peerName: fromName, isOnline: true, messages: [...conversation.messages, incoming].slice(-MAX_MESSAGES_IN_MEMORY), lastActivity: incoming.timestamp, unreadCount: conversation.unreadCount + 1 }
            : conversation);
        });
        sendRelay(from, { type: "message-received", messageId: incoming.id });
        return;
      }

      if (payload["type"] === "message-received" || payload["type"] === "message-read") {
        const messageId = payload["messageId"] as string;
        const status: MessageStatus = payload["type"] === "message-read" ? "read" : "delivered";
        if (!messageId) return;
        updateConversations((previous) => previous.map((conversation) => conversation.peerId === from
          ? { ...conversation, messages: conversation.messages.map((item) => item.id === messageId && item.fromMe ? { ...item, status } : item) }
          : conversation));
        return;
      }

      if (payload["type"] === "message-delete") {
        const messageId = payload["messageId"] as string;
        if (!messageId) return;
        updateConversations((previous) => previous.map((conversation) => conversation.peerId === from
          ? { ...conversation, messages: conversation.messages.map((item) => item.id === messageId ? { ...item, content: "", fileName: undefined, deletedAt: Date.now() } : item) }
          : conversation));
        return;
      }

      if (payload["type"] === "typing") {
        setTypingState(from, Boolean(payload["isTyping"]));
        return;
      }

      if (payload["type"] === "call-request") {
        const mode: CallMode = payload["mode"] === "video" ? "video" : "audio";
        setIncomingCall({ peerId: from, peerName: fromName, callId: (payload["callId"] as string) || generateId(), mode });
        return;
      }

      if (payload["type"] === "call-accept") {
        void (async () => {
          const connection = peerConnectionRef.current;
          if (!connection || activeCallIdRef.current !== payload["callId"]) return;
          try {
            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);
            sendRelay(from, { type: "webrtc-offer", callId: payload["callId"], description: connection.localDescription as unknown as Record<string, unknown> });
          } catch {
            setConnectionError("Unable to start the call. Please try again.");
            closePeerConnection();
          }
        })();
        return;
      }

      if (payload["type"] === "webrtc-offer") {
        void handleWebRtcOffer(from, payload).catch(() => {
          setConnectionError("Unable to answer the call.");
          closePeerConnection();
        });
        return;
      }

      if (payload["type"] === "webrtc-answer") {
        void handleWebRtcAnswer(payload).catch(() => {
          setConnectionError("Unable to complete the call connection.");
          closePeerConnection();
        });
        return;
      }

      if (payload["type"] === "webrtc-ice") {
        void handleWebRtcCandidate(payload).catch(() => {
          setConnectionError("Network details for the call could not be applied.");
        });
        return;
      }

      if (payload["type"] === "call-reject") {
        addSystemMessage(from, fromName, "call_missed");
        closePeerConnection();
        return;
      }

      if (payload["type"] === "call-end") {
        addSystemMessage(from, fromName, "call_ended");
        setIncomingCall(null);
        closePeerConnection();
      }
    };
  }, [addSystemMessage, closePeerConnection, flushPendingCandidates, sendRelay, updateConversations]);

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

    const existingSocket = wsRef.current;
    if (existingSocket && (existingSocket.readyState === WebSocket.OPEN || existingSocket.readyState === WebSocket.CONNECTING)) return;
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    try {
      const ws = new WebSocket(signal.url);
      wsRef.current = ws;
      ws.onopen = () => {
        if (wsRef.current !== ws) {
          ws.close();
          return;
        }
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;
        ws.send(JSON.stringify({ type: "register", userId: currentUserId, userName: currentUserName }));
      };
      ws.onmessage = (event) => {
        try {
          handleMessage.current?.(JSON.parse(event.data as string) as Record<string, unknown>);
        } catch {
          // Ignore malformed signal packets.
        }
      };
      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        setIsConnected(false);
        wsRef.current = null;
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        if (!shouldReconnectRef.current) return;
        const retryIndex = reconnectAttemptsRef.current;
        const delay = WAKE_RETRY_DELAYS_MS[retryIndex] ?? Math.min(10_000 * 2 ** Math.max(0, retryIndex - WAKE_RETRY_DELAYS_MS.length), 30_000);
        reconnectAttemptsRef.current += 1;
        setConnectionError("جارٍ الاتصال…");
        reconnectTimeoutRef.current = setTimeout(() => {
          if (userIdRef.current) connectWebSocket();
        }, delay);
      };
      ws.onerror = () => {
        if (wsRef.current !== ws) return;
        setConnectionError("جارٍ الاتصال…");
        ws.close();
      };
    } catch {
      setIsConnected(false);
      setConnectionError("جارٍ الاتصال…");
    }
  }, []);

  useEffect(() => {
    shouldReconnectRef.current = true;
    if (userId && userName) connectWebSocket();
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutsRef.current.clear();
      const socket = wsRef.current;
      if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.onmessage = null;
        socket.close();
        if (wsRef.current === socket) wsRef.current = null;
      }
      flushConversationPersistence();
      closePeerConnection();
    };
  }, [closePeerConnection, connectWebSocket, flushConversationPersistence, userId, userName]);

  const setupUser = useCallback(async (name: string) => {
    const id = generateUserId();
    await AsyncStorage.setItem(USER_KEY, JSON.stringify({ id, name }));
    setUserId(id);
    setUserName(name);
    userIdRef.current = id;
    userNameRef.current = name;
  }, []);

  const sendMessage = useCallback((peerId: string, peerName: string, msgInput: SendMessageInput) => {
    if (msgInput.type !== "text" && msgInput.type !== "image") {
      setConnectionError("يسمح Linkora بالرسائل النصية والصور فقط.");
      return;
    }
    const message: Message = { id: generateId(), ...msgInput, fromMe: true, timestamp: Date.now(), status: "sending" };
    if (isInlineAttachment(message) && message.content.length > MAX_PERSISTED_ATTACHMENT_CHARS) {
      setConnectionError("This attachment is too large for the direct test connection. Choose a smaller file.");
      return;
    }
    updateConversations((previous) => {
      const index = previous.findIndex((conversation) => conversation.peerId === peerId);
      if (index < 0) return [...previous, { peerId, peerName, messages: [message], isOnline: true, lastActivity: message.timestamp, unreadCount: 0 }];
      return previous.map((conversation, itemIndex) => itemIndex === index ? { ...conversation, messages: [...conversation.messages, message].slice(-MAX_MESSAGES_IN_MEMORY), lastActivity: message.timestamp } : conversation);
    });
    if (sendRelay(peerId, { type: "message", message })) {
      updateConversations((previous) => previous.map((conversation) => conversation.peerId === peerId
        ? { ...conversation, messages: conversation.messages.map((item) => item.id === message.id ? { ...item, status: "sent" } : item) }
        : conversation));
    } else {
      setConnectionError("جارٍ الاتصال… ستُعاد المحاولة تلقائياً.");
    }
  }, [sendRelay, updateConversations]);

  const sendTyping = useCallback((peerId: string, isTyping: boolean) => {
    sendRelay(peerId, { type: "typing", isTyping });
  }, [sendRelay]);

  const deleteMessage = useCallback((peerId: string, messageId: string) => {
    updateConversations((previous) => previous.map((conversation) => conversation.peerId === peerId
      ? { ...conversation, messages: conversation.messages.map((message) => message.id === messageId ? { ...message, content: "", fileName: undefined, deletedAt: Date.now() } : message) }
      : conversation));
    sendRelay(peerId, { type: "message-delete", messageId });
  }, [sendRelay, updateConversations]);

  const startCall = useCallback((peerId: string, mode: CallMode = "audio") => {
    const callId = generateId();
    void (async () => {
      try {
        await preparePeerConnection(peerId, mode, callId);
        if (!sendRelay(peerId, { type: "call-request", callId, mode })) {
          closePeerConnection();
          setConnectionError("The contact must be online before a call can start.");
        }
      } catch {
        closePeerConnection();
        setConnectionError("Allow microphone and camera access before starting this call.");
      }
    })();
  }, [closePeerConnection, preparePeerConnection, sendRelay]);

  const acceptCall = useCallback(() => {
    const call = incomingCallRef.current;
    if (!call) return;
    void (async () => {
      try {
        await preparePeerConnection(call.peerId, call.mode, call.callId);
        sendRelay(call.peerId, { type: "call-accept", callId: call.callId });
        setIncomingCall(null);
      } catch {
        closePeerConnection();
        setConnectionError("Allow microphone and camera access before answering this call.");
      }
    })();
  }, [closePeerConnection, preparePeerConnection, sendRelay]);

  const rejectCall = useCallback(() => {
    const call = incomingCallRef.current;
    if (!call) return;
    sendRelay(call.peerId, { type: "call-reject", callId: call.callId });
    setIncomingCall(null);
  }, [sendRelay]);

  const endCall = useCallback(() => {
    const peerId = activeCallRef.current;
    const callId = activeCallIdRef.current;
    if (peerId) sendRelay(peerId, { type: "call-end", callId });
    setIncomingCall(null);
    closePeerConnection();
  }, [closePeerConnection, sendRelay]);

  const setCallMuted = useCallback((muted: boolean) => {
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !muted; });
    InCallManager.setMicrophoneMute(muted);
    setIsMuted(muted);
  }, []);

  const setSpeakerEnabled = useCallback((enabled: boolean) => {
    InCallManager.setForceSpeakerphoneOn(enabled);
    setIsSpeakerOn(enabled);
  }, []);

  const markAsRead = useCallback((peerId: string) => {
    const conversation = conversationsRef.current.find((item) => item.peerId === peerId);
    const unreadMessageIds = (conversation?.messages ?? []).filter((message) => !message.fromMe && !message.deletedAt).map((message) => message.id);
    updateConversations((previous) => previous.map((item) => item.peerId === peerId ? { ...item, unreadCount: 0 } : item));
    unreadMessageIds.forEach((messageId) => sendRelay(peerId, { type: "message-read", messageId }));
  }, [sendRelay, updateConversations]);

  const deleteConversation = useCallback((peerId: string) => updateConversations((previous) => previous.filter((item) => item.peerId !== peerId)), [updateConversations]);

  const updatePeerName = useCallback((peerId: string, name: string) => {
    updateConversations((previous) => previous.map((item) => item.peerId === peerId ? { ...item, peerName: name } : item));
  }, [updateConversations]);

  return (
    <LinkoraContext.Provider value={{
      userId,
      userName,
      isReady,
      isConnected,
      connectionError,
      conversations,
      incomingCall,
      activeCall,
      activeCallMode,
      localStream,
      remoteStream,
      isMuted,
      isSpeakerOn,
      setupUser,
      sendMessage,
      sendTyping,
      deleteMessage,
      startCall,
      acceptCall,
      rejectCall,
      endCall,
      setCallMuted,
      setSpeakerEnabled,
      markAsRead,
      deleteConversation,
      updatePeerName,
    }}>
      {children}
    </LinkoraContext.Provider>
  );
}

export function useLinkoraContext() {
  const context = useContext(LinkoraContext);
  if (!context) throw new Error("useLinkoraContext must be used within LinkoraProvider");
  return context;
}
