import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Message } from "@/contexts/LinkoraContext";
import { useColors } from "@/hooks/useColors";

function formatTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const colors = useColors();

  if (
    message.type === "call_started" ||
    message.type === "call_ended" ||
    message.type === "call_missed"
  ) {
    const icon =
      message.type === "call_missed" ? "phone-missed" : "phone-call";
    const label =
      message.type === "call_started"
        ? "Call started"
        : message.type === "call_ended"
          ? "Call ended"
          : "Missed call";
    return (
      <View style={styles.systemRow}>
        <Feather
          name={icon as "phone-call" | "phone-missed"}
          size={12}
          color={
            message.type === "call_missed"
              ? colors.destructive
              : colors.mutedForeground
          }
        />
        <Text style={[styles.systemText, { color: colors.mutedForeground }]}>
          {label} · {formatTime(message.timestamp)}
        </Text>
      </View>
    );
  }

  const isMe = message.fromMe;

  return (
    <View
      style={[styles.row, isMe ? styles.rowRight : styles.rowLeft]}
    >
      <View
        style={[
          styles.bubble,
          isMe
            ? [styles.bubbleRight, { backgroundColor: colors.sentBubble }]
            : [styles.bubbleLeft, { backgroundColor: colors.receivedBubble }],
        ]}
      >
        {message.type === "text" && (
          <Text
            style={[
              styles.messageText,
              { color: isMe ? "#fff" : colors.foreground },
            ]}
          >
            {message.content}
          </Text>
        )}

        {message.type === "image" && (
          <View>
            <Image
              source={{ uri: message.content }}
              style={styles.imageContent}
              contentFit="cover"
            />
          </View>
        )}

        {message.type === "file" && (
          <Pressable style={[styles.fileRow, { opacity: 1 }]}>
            <View
              style={[
                styles.fileIcon,
                {
                  backgroundColor: isMe
                    ? "rgba(255,255,255,0.2)"
                    : colors.primary + "25",
                },
              ]}
            >
              <Feather
                name="file"
                size={18}
                color={isMe ? "#fff" : colors.primary}
              />
            </View>
            <View style={styles.fileInfo}>
              <Text
                style={[
                  styles.fileName,
                  { color: isMe ? "#fff" : colors.foreground },
                ]}
                numberOfLines={1}
              >
                {message.fileName ?? "File"}
              </Text>
              {!!message.fileSize && (
                <Text
                  style={[
                    styles.fileSize,
                    {
                      color: isMe
                        ? "rgba(255,255,255,0.65)"
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  {formatSize(message.fileSize)}
                </Text>
              )}
            </View>
          </Pressable>
        )}

        <View style={styles.meta}>
          <Text
            style={[
              styles.time,
              {
                color: isMe ? "rgba(255,255,255,0.5)" : colors.mutedForeground,
              },
            ]}
          >
            {formatTime(message.timestamp)}
          </Text>
          {isMe && (
            <Feather
              name={message.status === "delivered" ? "check-circle" : "check"}
              size={11}
              color={
                message.status === "delivered"
                  ? "rgba(255,255,255,0.7)"
                  : "rgba(255,255,255,0.4)"
              }
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  rowLeft: {
    alignItems: "flex-start",
  },
  rowRight: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    padding: 10,
    paddingHorizontal: 13,
    minWidth: 64,
  },
  bubbleLeft: {
    borderBottomLeftRadius: 4,
  },
  bubbleRight: {
    borderBottomRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  imageContent: {
    width: 220,
    height: 180,
    borderRadius: 10,
  },
  fileRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    minWidth: 180,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  fileSize: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 4,
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  systemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
  },
  systemText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
