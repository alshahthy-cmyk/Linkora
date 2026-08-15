import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MessageBubble } from "@/components/MessageBubble";
import { type Message, type ReplyReference, useLinkoraContext } from "@/contexts/LinkoraContext";
import { useColors } from "@/hooks/useColors";

function formatLastSeen(timestamp?: number) {
  if (!timestamp) return "Offline";
  return `Last seen ${new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

function toReplyReference(message: Message): ReplyReference {
  return {
    id: message.id,
    content: message.type === "text" ? message.content : "",
    type: message.type,
    fromMe: message.fromMe,
  };
}

const MAX_INLINE_IMAGE_BYTES = 650 * 1024;

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { peerId } = useLocalSearchParams<{ peerId: string }>();
  const { conversations, sendMessage, sendTyping, deleteMessage, markAsRead, startCall, isConnected, connectionError } = useLinkoraContext();
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<ReplyReference | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingSentRef = useRef(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  const conversation = conversations.find((item) => item.peerId === peerId);
  const messages = conversation?.messages ?? [];
  const peerName = conversation?.peerName ?? peerId ?? "Unknown";
  const isOnline = conversation?.isOnline ?? false;
  const isTyping = conversation?.isTyping ?? false;
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  useEffect(() => {
    if (peerId) markAsRead(peerId);
  }, [peerId, messages.length, markAsRead]);

  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (peerId && typingSentRef.current) sendTyping(peerId, false);
    typingSentRef.current = false;
  }, [peerId, sendTyping]);

  const handleTextChange = (value: string) => {
    setText(value);
    if (!peerId) return;
    const shouldShowTyping = value.trim().length > 0;
    if (typingSentRef.current !== shouldShowTyping) {
      sendTyping(peerId, shouldShowTyping);
      typingSentRef.current = shouldShowTyping;
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (shouldShowTyping) {
      typingTimerRef.current = setTimeout(() => {
        if (!typingSentRef.current) return;
        sendTyping(peerId, false);
        typingSentRef.current = false;
      }, 1200);
    }
  };

  const handleSendText = () => {
    if (!text.trim() || !peerId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(peerId, peerName, { type: "text", content: text.trim(), replyTo: replyingTo ?? undefined });
    setText("");
    setReplyingTo(null);
    sendTyping(peerId, false);
    typingSentRef.current = false;
  };

  const sendPickedMedia = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!peerId) return;
    const mediaByteSize = asset.fileSize ?? 0;
    if (mediaByteSize > MAX_INLINE_IMAGE_BYTES) {
      Alert.alert("الصورة كبيرة", "لإبقاء المحادثة سريعة، اختر صورة أصغر من 650 كيلوبايت.");
      return;
    }
    try {
      const mimeType = asset.mimeType ?? "image/jpeg";
      const base64 = asset.base64;
      if (!base64) throw new Error("Media encoding unavailable");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      sendMessage(peerId, peerName, {
        type: "image",
        content: `data:${mimeType};base64,${base64}`,
        fileName: asset.fileName ?? "Photo",
        fileSize: mediaByteSize || undefined,
        mimeType,
        replyTo: replyingTo ?? undefined,
      });
      setReplyingTo(null);
    } catch {
      Alert.alert("الصورة", "تعذّر تجهيز الصورة المختارة.");
    }
  };

  const handlePickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("إذن الصور", "اسمح بالوصول إلى الصور لمشاركتها في Linkora.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.45 });
    if (!result.canceled && result.assets[0]) await sendPickedMedia(result.assets[0]);
  };

  const handleCaptureMedia = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("إذن الكاميرا", "اسمح باستخدام الكاميرا لالتقاط صورة للمحادثة.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.45 });
    if (!result.canceled && result.assets[0]) await sendPickedMedia(result.assets[0]);
  };

  const showMessageActions = useCallback((message: Message) => {
    if (message.deletedAt) return;
    const actions = [] as { text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void }[];
    if (message.type === "text" && message.content) {
      actions.push({ text: "Copy", onPress: () => { void Clipboard.setStringAsync(message.content); } });
    }
    actions.push({ text: "Reply", onPress: () => setReplyingTo(toReplyReference(message)) });
    if (message.fromMe && peerId) {
      actions.push({ text: "Delete for everyone", style: "destructive", onPress: () => deleteMessage(peerId, message.id) });
    }
    actions.push({ text: "Cancel", style: "cancel" });
    Alert.alert("Message", undefined, actions);
  }, [deleteMessage, peerId]);

  const handleCallPress = () => {
    if (!peerId) return;
    const beginCall = (mode: "audio" | "video") => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      startCall(peerId, mode);
      router.push(`/call/${peerId}`);
    };
    Alert.alert("Start call", `Call ${peerName}`, [
      { text: "Audio call", onPress: () => beginCall("audio") },
      { text: "Video call", onPress: () => beginCall("video") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const headerStatus = isTyping ? "يكتب الآن…" : isOnline ? "متصل الآن" : isConnected ? formatLastSeen(conversation?.lastSeenAt) : "جارٍ الاتصال…";

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: colors.background }]} behavior="padding" keyboardVerticalOffset={0}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}><Feather name="arrow-left" size={22} color={colors.foreground} /></Pressable>
        <View style={styles.headerCenter}>
          <View style={[styles.headerAvatar, { backgroundColor: colors.primary + "25" }]}><Text style={[styles.headerAvatarLetter, { color: colors.primary }]}>{peerName.charAt(0).toUpperCase()}</Text></View>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>{peerName}</Text>
            <Text style={[styles.headerStatus, { color: isOnline || isTyping ? colors.online : colors.mutedForeground }]} numberOfLines={1}>{headerStatus}</Text>
          </View>
        </View>
        <Pressable onPress={handleCallPress} style={styles.callBtn} hitSlop={12}><Feather name="video" size={20} color={colors.primary} /></Pressable>
      </View>

      {!isConnected && <View style={[styles.offlineBanner, { backgroundColor: colors.primary + "14" }]}><Feather name="wifi" size={12} color={colors.primary} /><Text style={[styles.offlineBannerText, { color: colors.primary }]}>{connectionError || "جارٍ الاتصال…"}</Text></View>}

      <FlatList<Message>
        ref={flatListRef}
        data={reversedMessages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} onLongPress={showMessageActions} />}
        removeClippedSubviews={Platform.OS === "android"}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={60}
        windowSize={7}
        contentContainerStyle={[styles.messagesList, { paddingBottom: 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListEmptyComponent={<View style={styles.emptyState}><Feather name="message-circle" size={36} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>Start the conversation</Text><Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Messages are delivered directly{"\n"}to {peerName}'s device</Text></View>}
      />

      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        {replyingTo && <View style={[styles.replyBar, { backgroundColor: colors.primary + "10", borderColor: colors.border }]}><View style={styles.replyBarCopy}><Text style={[styles.replyBarTitle, { color: colors.primary }]}>رد على {replyingTo.fromMe ? "رسالتك" : peerName}</Text><Text numberOfLines={1} style={[styles.replyBarText, { color: colors.mutedForeground }]}>{replyingTo.content || "صورة"}</Text></View><Pressable onPress={() => setReplyingTo(null)} hitSlop={10}><Feather name="x" size={18} color={colors.mutedForeground} /></Pressable></View>}
        <View style={styles.composerRow}>
          <Pressable onPress={handleCaptureMedia} style={styles.iconBtn} hitSlop={8}><Feather name="camera" size={20} color={colors.mutedForeground} /></Pressable>
          <Pressable onPress={handlePickMedia} style={styles.iconBtn} hitSlop={8}><Feather name="image" size={20} color={colors.mutedForeground} /></Pressable>
          <View style={[styles.textInputWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}><TextInput style={[styles.textInput, { color: colors.foreground }]} placeholder="اكتب رسالة…" placeholderTextColor={colors.mutedForeground} value={text} onChangeText={handleTextChange} multiline maxLength={4000} returnKeyType="default" /></View>
          {text.trim() ? (
            <Pressable onPress={handleSendText} style={({ pressed }) => [styles.sendBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}><Feather name="send" size={18} color="#fff" /></Pressable>
          ) : (
            <View style={[styles.sendBtn, { backgroundColor: colors.secondary }]}><Feather name="send" size={18} color={colors.mutedForeground} /></View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1, gap: 8 },
  backBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerAvatarLetter: { fontSize: 15, fontFamily: "Inter_700Bold" },
  headerName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  headerStatus: { fontSize: 12, fontFamily: "Inter_400Regular" },
  callBtn: { padding: 8, borderRadius: 10 },
  offlineBanner: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 7 },
  offlineBannerText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  messagesList: { paddingTop: 8 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 10, transform: [{ scaleY: -1 }] },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptyDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  inputBar: { borderTopWidth: 1, paddingHorizontal: 10, paddingTop: 7 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  replyBar: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 7 },
  replyBarCopy: { flex: 1, gap: 2 },
  replyBarTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  replyBarText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  iconBtn: { padding: 8, alignSelf: "flex-end", marginBottom: 2 },
  textInputWrap: { flex: 1, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 10 : 6, maxHeight: 120 },
  textInput: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 20 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
});
