import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AddContactModal } from "@/components/AddContactModal";
import { ConversationItem } from "@/components/ConversationItem";
import type { Conversation } from "@/contexts/LinkoraContext";
import { useLinkoraContext } from "@/contexts/LinkoraContext";
import { useColors } from "@/hooks/useColors";

export default function ChatsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { conversations, isConnected, sendMessage } = useLinkoraContext();
  const [addModalVisible, setAddModalVisible] = useState(false);

  const sorted = [...conversations].sort(
    (a, b) => b.lastActivity - a.lastActivity,
  );

  const handleAddContact = (peerId: string, peerName: string) => {
    // Navigate directly to chat - message will create the conversation
    router.push(`/chat/${peerId}?name=${encodeURIComponent(peerName)}`);
  };

  const handleOpenChat = (conv: Conversation) => {
    router.push(`/chat/${conv.peerId}`);
  };

  const topPadding =
    Platform.OS === "web" ? insets.top + 67 : insets.top + 12;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPadding,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Linkora
          </Text>
          <View
            style={[
              styles.connectionDot,
              {
                backgroundColor: isConnected
                  ? colors.online
                  : colors.mutedForeground,
              },
            ]}
          />
        </View>

        <Pressable
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAddModalVisible(true);
          }}
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: colors.primary + "20",
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Feather name="edit" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <FlatList<Conversation>
        data={sorted}
        keyExtractor={(item) => item.peerId}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            onPress={() => handleOpenChat(item)}
          />
        )}
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom:
              Platform.OS === "web" ? insets.bottom + 84 : insets.bottom + 84,
          },
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => (
          <View
            style={[
              styles.separator,
              { backgroundColor: colors.border, marginLeft: 78 },
            ]}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: colors.primary + "15" },
              ]}
            >
              <Feather name="message-circle" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No conversations yet
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
              Tap the edit icon to start a new{"\n"}P2P conversation
            </Text>
            <Pressable
              onPress={() => setAddModalVisible(true)}
              style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
            >
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>New Chat</Text>
            </Pressable>
          </View>
        }
      />

      <AddContactModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onAdd={handleAddContact}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    flexGrow: 1,
    paddingTop: 6,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyDesc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 4,
  },
  emptyBtnText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
});
