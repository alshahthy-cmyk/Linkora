import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLinkoraContext } from "@/contexts/LinkoraContext";
import { useColors } from "@/hooks/useColors";

function AvatarCircle({
  name,
  size,
  colors,
}: {
  name: string;
  size: number;
  colors: ReturnType<typeof useColors>;
}) {
  const letter = name.charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primary + "30",
        borderWidth: 2,
        borderColor: colors.primary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontSize: size * 0.42,
          fontFamily: "Inter_700Bold",
          color: colors.primary,
        }}
      >
        {letter}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { userId, userName, isConnected, conversations } = useLinkoraContext();
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    if (!userId) return;
    await Clipboard.setStringAsync(userId);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatId = (id: string) => {
    return id.replace(/(.{4})/g, "$1 ").trim();
  };

  const stats = {
    conversations: conversations.length,
    online: conversations.filter((c) => c.isOnline).length,
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.pageTitle, { color: colors.foreground }]}>
        Profile
      </Text>

      <View style={styles.avatarArea}>
        {userName ? (
          <AvatarCircle name={userName} size={84} colors={colors} />
        ) : null}
        <Text style={[styles.name, { color: colors.foreground }]}>
          {userName ?? "—"}
        </Text>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isConnected
                ? colors.online + "20"
                : colors.mutedForeground + "20",
            },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: isConnected
                  ? colors.online
                  : colors.mutedForeground,
              },
            ]}
          />
          <Text
            style={[
              styles.statusText,
              {
                color: isConnected ? colors.online : colors.mutedForeground,
              },
            ]}
          >
            {isConnected ? "Connected" : "Offline"}
          </Text>
        </View>
      </View>

      <View
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>
          YOUR LINKORA ID
        </Text>
        <Text style={[styles.idText, { color: colors.foreground }]}>
          {userId ? formatId(userId) : "—"}
        </Text>
        <Text style={[styles.idHint, { color: colors.mutedForeground }]}>
          Share this with contacts so they can reach you
        </Text>
        <Pressable
          onPress={copyId}
          style={({ pressed }) => [
            styles.copyButton,
            {
              backgroundColor: copied
                ? colors.online + "20"
                : colors.primary + "20",
              borderColor: copied ? colors.online : colors.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather
            name={copied ? "check" : "copy"}
            size={14}
            color={copied ? colors.online : colors.primary}
          />
          <Text
            style={[
              styles.copyText,
              { color: copied ? colors.online : colors.primary },
            ]}
          >
            {copied ? "Copied!" : "Copy ID"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View
          style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.statValue, { color: colors.foreground }]}>
            {stats.conversations}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            Chats
          </Text>
        </View>
        <View
          style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Text style={[styles.statValue, { color: colors.online }]}>
            {stats.online}
          </Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
            Online
          </Text>
        </View>
      </View>

      <View
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Text style={[styles.cardLabel, { color: colors.mutedForeground }]}>
          HOW LINKORA WORKS
        </Text>

        {[
          {
            icon: "wifi" as const,
            title: "Direct Connection",
            desc: "Messages travel directly between devices via WebRTC data channels.",
          },
          {
            icon: "server" as const,
            title: "Minimal Signaling",
            desc: "A lightweight server helps devices find each other — it never stores messages.",
          },
          {
            icon: "hard-drive" as const,
            title: "Local Storage Only",
            desc: "All conversations are saved on your device only. Delete the app, delete the history.",
          },
          {
            icon: "lock" as const,
            title: "No Account Required",
            desc: "Just your unique ID. No email, no phone number, no tracking.",
          },
        ].map((item) => (
          <View key={item.title} style={styles.featureRow}>
            <View
              style={[
                styles.featureIcon,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Feather name={item.icon} size={16} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text
                style={[styles.featureTitle, { color: colors.foreground }]}
              >
                {item.title}
              </Text>
              <Text
                style={[styles.featureDesc, { color: colors.mutedForeground }]}
              >
                {item.desc}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  avatarArea: {
    alignItems: "center",
    paddingVertical: 8,
    gap: 10,
  },
  name: {
    fontSize: 22,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  cardLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
  },
  idText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 4,
  },
  idHint: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  copyText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  featureRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    paddingTop: 8,
  },
  featureIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  featureDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  online: {
    color: "#34D399",
  },
});
