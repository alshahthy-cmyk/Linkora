import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Conversation } from "@/contexts/LinkoraContext";
import { useColors } from "@/hooks/useColors";

function formatTime(ts: number) {
  const now = Date.now();
  const diff = now - ts;
  const d = new Date(ts);
  if (diff < 60 * 1000) return "now";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 24 * 60 * 60 * 1000)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getLastMessagePreview(conv: Conversation): string {
  if (conv.messages.length === 0) return "No messages yet";
  const last = conv.messages[conv.messages.length - 1];
  const prefix = last.fromMe ? "You: " : "";
  if (last.type === "text") return `${prefix}${last.content}`;
  if (last.type === "image") return `${prefix}📷 Image`;
  if (last.type === "file") return `${prefix}📎 ${last.fileName ?? "File"}`;
  if (last.type === "call_started") return "Call started";
  if (last.type === "call_ended") return "Call ended";
  if (last.type === "call_missed")
    return last.fromMe ? "You missed a call" : "Missed call";
  return "";
}

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
}

export function ConversationItem({
  conversation,
  onPress,
}: ConversationItemProps) {
  const colors = useColors();
  const letter = conversation.peerName.charAt(0).toUpperCase();

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? colors.secondary : "transparent",
        },
      ]}
    >
      <View style={styles.avatarWrap}>
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.primary + "25", borderColor: colors.border },
          ]}
        >
          <Text style={[styles.avatarLetter, { color: colors.primary }]}>
            {letter}
          </Text>
        </View>
        {conversation.isOnline && (
          <View
            style={[
              styles.onlineDot,
              { backgroundColor: colors.online, borderColor: colors.background },
            ]}
          />
        )}
      </View>

      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text
            style={[styles.name, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {conversation.peerName}
          </Text>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>
            {formatTime(conversation.lastActivity)}
          </Text>
        </View>
        <View style={styles.bottomRow}>
          <Text
            style={[styles.preview, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {getLastMessagePreview(conversation)}
          </Text>
          {conversation.unreadCount > 0 && (
            <View
              style={[styles.badge, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.badgeText}>
                {conversation.unreadCount > 99
                  ? "99+"
                  : conversation.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    alignItems: "center",
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  info: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  time: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginLeft: 8,
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 4,
  },
  preview: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
});
