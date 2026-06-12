import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MessageBubble } from "@/components/MessageBubble";
import { useLinkoraContext } from "@/contexts/LinkoraContext";
import type { Message } from "@/contexts/LinkoraContext";
import { useColors } from "@/hooks/useColors";

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { peerId } = useLocalSearchParams<{ peerId: string }>();
  const { conversations, sendMessage, markAsRead, startCall, isConnected } =
    useLinkoraContext();
  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList<Message>>(null);

  const conversation = conversations.find((c) => c.peerId === peerId);
  const messages = conversation?.messages ?? [];
  const peerName = conversation?.peerName ?? peerId ?? "Unknown";
  const isOnline = conversation?.isOnline ?? false;

  useEffect(() => {
    if (peerId) markAsRead(peerId);
  }, [peerId, messages.length]);

  const handleSendText = () => {
    if (!text.trim() || !peerId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(peerId, peerName, { type: "text", content: text.trim() });
    setText("");
  };

  const handlePickImage = async () => {
    if (!peerId) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = `data:image/jpeg;base64,${asset.base64}`;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      sendMessage(peerId, peerName, { type: "image", content: uri });
    }
  };

  const handlePickFile = async () => {
    if (!peerId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const b64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        sendMessage(peerId, peerName, {
          type: "file",
          content: `data:application/octet-stream;base64,${b64}`,
          fileName: asset.name,
          fileSize: asset.size ?? undefined,
          mimeType: asset.mimeType ?? undefined,
        });
      }
    } catch {}
  };

  const handleCallPress = () => {
    if (!peerId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startCall(peerId);
    router.push(`/call/${peerId}`);
  };

  const HEADER_HEIGHT = 56;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View
            style={[
              styles.headerAvatar,
              { backgroundColor: colors.primary + "25" },
            ]}
          >
            <Text style={[styles.headerAvatarLetter, { color: colors.primary }]}>
              {peerName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text
              style={[styles.headerName, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {peerName}
            </Text>
            <Text
              style={[
                styles.headerStatus,
                { color: isOnline ? colors.online : colors.mutedForeground },
              ]}
            >
              {isOnline ? "Online" : isConnected ? "Offline" : "No connection"}
            </Text>
          </View>
        </View>

        <Pressable onPress={handleCallPress} style={styles.callBtn} hitSlop={12}>
          <Feather name="video" size={20} color={colors.primary} />
        </Pressable>
      </View>

      {!isConnected && (
        <View
          style={[styles.offlineBanner, { backgroundColor: colors.destructive + "20" }]}
        >
          <Feather name="wifi-off" size={12} color={colors.destructive} />
          <Text style={[styles.offlineBannerText, { color: colors.destructive }]}>
            Not connected — messages won't be delivered
          </Text>
        </View>
      )}

      <FlatList<Message>
        ref={flatListRef}
        data={[...messages].reverse()}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={[
          styles.messagesList,
          { paddingBottom: 12 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather
              name="message-circle"
              size={36}
              color={colors.mutedForeground}
            />
            <Text
              style={[styles.emptyTitle, { color: colors.foreground }]}
            >
              Start the conversation
            </Text>
            <Text
              style={[styles.emptyDesc, { color: colors.mutedForeground }]}
            >
              Messages are delivered directly{"\n"}to {peerName}'s device
            </Text>
          </View>
        }
      />

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <Pressable onPress={handlePickFile} style={styles.iconBtn} hitSlop={8}>
          <Feather name="paperclip" size={20} color={colors.mutedForeground} />
        </Pressable>

        <Pressable
          onPress={handlePickImage}
          style={styles.iconBtn}
          hitSlop={8}
        >
          <Feather name="image" size={20} color={colors.mutedForeground} />
        </Pressable>

        <View
          style={[
            styles.textInputWrap,
            { backgroundColor: colors.secondary, borderColor: colors.border },
          ]}
        >
          <TextInput
            style={[styles.textInput, { color: colors.foreground }]}
            placeholder="Message..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4000}
            returnKeyType="default"
          />
        </View>

        <Pressable
          onPress={handleSendText}
          disabled={!text.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor:
                text.trim() ? colors.primary : colors.secondary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather
            name="send"
            size={18}
            color={text.trim() ? "#fff" : colors.mutedForeground}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  backBtn: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarLetter: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  headerName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  headerStatus: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  callBtn: {
    padding: 8,
    borderRadius: 10,
  },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  offlineBannerText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  messagesList: {
    paddingTop: 8,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 10,
    transform: [{ scaleY: -1 }],
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 19,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 6,
  },
  iconBtn: {
    padding: 8,
    alignSelf: "flex-end",
    marginBottom: 2,
  },
  textInputWrap: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    maxHeight: 120,
  },
  textInput: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
});
