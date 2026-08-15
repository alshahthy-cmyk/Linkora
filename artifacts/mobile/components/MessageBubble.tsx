import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Message } from "@/contexts/LinkoraContext";
import { useColors } from "@/hooks/useColors";

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function replyLabel(message: Message["replyTo"]) {
  if (!message) return "";
  if (message.type === "image") return "Photo";
  return message.content || "Message";
}

interface MessageBubbleProps {
  message: Message;
  onLongPress?: (message: Message) => void;
}

export const MessageBubble = memo(function MessageBubble({ message, onLongPress }: MessageBubbleProps) {
  const colors = useColors();

  if (message.type === "call_started" || message.type === "call_ended" || message.type === "call_missed") {
    const missed = message.type === "call_missed";
    const label = message.type === "call_started" ? "Call started" : message.type === "call_ended" ? "Call ended" : "Missed call";
    return (
      <View style={styles.systemRow}>
        <Feather name={missed ? "phone-missed" : "phone-call"} size={12} color={missed ? colors.destructive : colors.mutedForeground} />
        <Text style={[styles.systemText, { color: colors.mutedForeground }]}>{label} · {formatTime(message.timestamp)}</Text>
      </View>
    );
  }

  const isMe = message.fromMe;
  const textColor = isMe ? "#fff" : colors.foreground;
  const metaColor = isMe ? "rgba(255,255,255,0.58)" : colors.mutedForeground;

  return (
    <View style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}>
      <Pressable
        onLongPress={() => onLongPress?.(message)}
        delayLongPress={350}
        android_ripple={{ color: isMe ? "rgba(255,255,255,0.16)" : colors.primary + "12" }}
        style={({ pressed }) => [
          styles.bubble,
          isMe ? [styles.bubbleRight, { backgroundColor: colors.sentBubble }] : [styles.bubbleLeft, { backgroundColor: colors.receivedBubble }],
          pressed && styles.pressed,
        ]}
      >
        {message.replyTo && !message.deletedAt && (
          <View style={[styles.replyPreview, { borderLeftColor: isMe ? "rgba(255,255,255,0.78)" : colors.primary, backgroundColor: isMe ? "rgba(0,0,0,0.12)" : colors.primary + "10" }]}>
            <Text style={[styles.replyAuthor, { color: isMe ? "rgba(255,255,255,0.82)" : colors.primary }]}>{message.replyTo.fromMe ? "You" : "Reply"}</Text>
            <Text numberOfLines={1} style={[styles.replyText, { color: isMe ? "rgba(255,255,255,0.72)" : colors.mutedForeground }]}>{replyLabel(message.replyTo)}</Text>
          </View>
        )}

        {message.deletedAt ? (
          <View style={styles.deletedRow}>
            <Feather name="slash" size={14} color={metaColor} />
            <Text style={[styles.deletedText, { color: metaColor }]}>This message was deleted</Text>
          </View>
        ) : (
          <>
            {message.attachmentUnavailable && (
              <View style={styles.unavailableAttachment}>
                <Feather name="archive" size={16} color={metaColor} />
                <Text style={[styles.unavailableAttachmentText, { color: metaColor }]}>Attachment removed from local history to keep Linkora stable</Text>
              </View>
            )}
            {!message.attachmentUnavailable && message.type === "text" && <Text style={[styles.messageText, { color: textColor }]}>{message.content}</Text>}
            {!message.attachmentUnavailable && message.type === "image" && <Image source={{ uri: message.content }} style={styles.imageContent} contentFit="cover" cachePolicy="memory-disk" />}
          </>
        )}

        <View style={styles.meta}>
          <Text style={[styles.time, { color: metaColor }]}>{formatTime(message.timestamp)}</Text>
          {isMe && <Feather name={message.status === "read" ? "check-circle" : message.status === "delivered" ? "check-circle" : "check"} size={11} color={message.status === "read" ? "#A9E6FF" : message.status === "delivered" ? "rgba(255,255,255,0.76)" : "rgba(255,255,255,0.42)"} />}
        </View>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { paddingHorizontal: 12, paddingVertical: 2 },
  rowLeft: { alignItems: "flex-start" },
  rowRight: { alignItems: "flex-end" },
  bubble: { maxWidth: "80%", borderRadius: 20, padding: 10, paddingHorizontal: 13, minWidth: 64, overflow: "hidden", shadowColor: "#172033", shadowOpacity: 0.08, shadowRadius: 7, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  bubbleLeft: { borderBottomLeftRadius: 4 },
  bubbleRight: { borderBottomRightRadius: 4 },
  pressed: { opacity: 0.82 },
  messageText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 21 },
  imageContent: { width: 230, height: 188, borderRadius: 13 },
  replyPreview: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 7, gap: 2 },
  replyAuthor: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  replyText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  deletedRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  deletedText: { fontSize: 14, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  unavailableAttachment: { flexDirection: "row", alignItems: "center", gap: 7, minWidth: 180, paddingVertical: 4 },
  unavailableAttachmentText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 4 },
  time: { fontSize: 11, fontFamily: "Inter_400Regular" },
  systemRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8 },
  systemText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
