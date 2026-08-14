import { Feather } from "@expo/vector-icons";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

const MAX_MEDIA_BYTES = 6 * 1024 * 1024;

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { peerId } = useLocalSearchParams<{ peerId: string }>();
  const { conversations, sendMessage, sendTyping, deleteMessage, markAsRead, startCall, isConnected } = useLinkoraContext();
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<ReplyReference | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flatListRef = useRef<FlatList<Message>>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  const conversation = conversations.find((item) => item.peerId === peerId);
  const messages = conversation?.messages ?? [];
  const peerName = conversation?.peerName ?? peerId ?? "Unknown";
  const isOnline = conversation?.isOnline ?? false;
  const isTyping = conversation?.isTyping ?? false;

  useEffect(() => {
    if (peerId) markAsRead(peerId);
  }, [peerId, messages.length, markAsRead]);

  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (peerId) sendTyping(peerId, false);
  }, [peerId, sendTyping]);

  const handleTextChange = (value: string) => {
    setText(value);
    if (!peerId) return;
    sendTyping(peerId, value.trim().length > 0);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => sendTyping(peerId, false), 1200);
  };

  const handleSendText = () => {
    if (!text.trim() || !peerId) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(peerId, peerName, { type: "text", content: text.trim(), replyTo: replyingTo ?? undefined });
    setText("");
    setReplyingTo(null);
    sendTyping(peerId, false);
  };

  const sendPickedMedia = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!peerId) return;
    if ((asset.fileSize ?? 0) > MAX_MEDIA_BYTES) {
      Alert.alert("Media too large", "Choose a photo or video smaller than 6 MB for this test version.");
      return;
    }
    try {
      const isVideo = asset.type === "video";
      const mimeType = asset.mimeType ?? (isVideo ? "video/mp4" : "image/jpeg");
      const base64 = asset.base64 ?? await new File(asset.uri).base64();
      if (!base64) throw new Error("Media encoding unavailable");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      sendMessage(peerId, peerName, {
        type: isVideo ? "video" : "image",
        content: `data:${mimeType};base64,${base64}`,
        fileName: asset.fileName ?? (isVideo ? "Video" : "Photo"),
        fileSize: asset.fileSize ?? undefined,
        mimeType,
        replyTo: replyingTo ?? undefined,
      });
      setReplyingTo(null);
    } catch {
      Alert.alert("Media", "The selected media could not be prepared.");
    }
  };

  const handlePickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Media permission", "Allow photo and video access to share media in Linkora.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], base64: true, quality: 0.7, videoMaxDuration: 30 });
    if (!result.canceled && result.assets[0]) await sendPickedMedia(result.assets[0]);
  };

  const handleCaptureMedia = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera permission", "Allow camera access to capture a photo or video for your chat.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], base64: true, quality: 0.7, videoMaxDuration: 30 });
    if (!result.canceled && result.assets[0]) await sendPickedMedia(result.assets[0]);
  };

  const handlePickFile = async () => {
    if (!peerId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if ((asset.size ?? 0) > 8 * 1024 * 1024) {
          Alert.alert("File too large", "Choose a file smaller than 8 MB for this test version.");
          return;
        }
        const base64 = await new File(asset.uri).base64();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        sendMessage(peerId, peerName, {
          type: "file",
          content: `data:${asset.mimeType ?? "application/octet-stream"};base64,${base64}`,
          fileName: asset.name,
          fileSize: asset.size ?? undefined,
          mimeType: asset.mimeType ?? "application/octet-stream",
          replyTo: replyingTo ?? undefined,
        });
        setReplyingTo(null);
      }
    } catch {
      Alert.alert("Attachment", "The selected file could not be prepared.");
    }
  };

  const handleVoiceMessage = async () => {
    if (!peerId) return;
    try {
      if (!recorderState.isRecording) {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          Alert.alert("Microphone permission", "Allow microphone access to record a voice message.");
          return;
        }
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      }

      await audioRecorder.stop();
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const uri = audioRecorder.uri;
      if (!uri) throw new Error("Recording is unavailable");
      const recordedFile = new File(uri);
      const fileSize = recordedFile.exists ? recordedFile.size : undefined;
      if ((fileSize ?? 0) > 3 * 1024 * 1024) {
        Alert.alert("Voice message too large", "Record a shorter message than 3 MB for this test version.");
        return;
      }
      const base64 = await recordedFile.base64();
      sendMessage(peerId, peerName, {
        type: "voice",
        content: `data:audio/m4a;base64,${base64}`,
        fileName: "Voice message",
        fileSize,
        mimeType: "audio/m4a",
        durationMs: recorderState.durationMillis,
        replyTo: replyingTo ?? undefined,
      });
      setReplyingTo(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Voice message", "The recording could not be saved. Please try again.");
    }
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

  const headerStatus = isTyping ? "Typing…" : isOnline ? "Online" : isConnected ? formatLastSeen(conversation?.lastSeenAt) : "No connection";

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

      {!isConnected && <View style={[styles.offlineBanner, { backgroundColor: colors.destructive + "20" }]}><Feather name="wifi-off" size={12} color={colors.destructive} /><Text style={[styles.offlineBannerText, { color: colors.destructive }]}>Not connected — messages will wait locally</Text></View>}

      <FlatList<Message>
        ref={flatListRef}
        data={[...messages].reverse()}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} onLongPress={showMessageActions} />}
        contentContainerStyle={[styles.messagesList, { paddingBottom: 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListEmptyComponent={<View style={styles.emptyState}><Feather name="message-circle" size={36} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>Start the conversation</Text><Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>Messages are delivered directly{"\n"}to {peerName}'s device</Text></View>}
      />

      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
        {replyingTo && <View style={[styles.replyBar, { backgroundColor: colors.primary + "10", borderColor: colors.border }]}><View style={styles.replyBarCopy}><Text style={[styles.replyBarTitle, { color: colors.primary }]}>Replying to {replyingTo.fromMe ? "yourself" : peerName}</Text><Text numberOfLines={1} style={[styles.replyBarText, { color: colors.mutedForeground }]}>{replyingTo.content || (replyingTo.type === "image" ? "Photo" : replyingTo.type === "video" ? "Video" : replyingTo.type === "voice" ? "Voice message" : "File")}</Text></View><Pressable onPress={() => setReplyingTo(null)} hitSlop={10}><Feather name="x" size={18} color={colors.mutedForeground} /></Pressable></View>}
        <View style={styles.composerRow}>
          <Pressable onPress={handlePickFile} style={styles.iconBtn} hitSlop={8}><Feather name="paperclip" size={20} color={colors.mutedForeground} /></Pressable>
          <Pressable onPress={handleCaptureMedia} style={styles.iconBtn} hitSlop={8}><Feather name="camera" size={20} color={colors.mutedForeground} /></Pressable>
          <Pressable onPress={handlePickMedia} style={styles.iconBtn} hitSlop={8}><Feather name="image" size={20} color={colors.mutedForeground} /></Pressable>
          <View style={[styles.textInputWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}><TextInput style={[styles.textInput, { color: colors.foreground }]} placeholder="Message..." placeholderTextColor={colors.mutedForeground} value={text} onChangeText={handleTextChange} multiline maxLength={4000} returnKeyType="default" /></View>
          {text.trim() ? (
            <Pressable onPress={handleSendText} style={({ pressed }) => [styles.sendBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}><Feather name="send" size={18} color="#fff" /></Pressable>
          ) : (
            <Pressable onPress={handleVoiceMessage} style={({ pressed }) => [styles.sendBtn, { backgroundColor: recorderState.isRecording ? colors.destructive : colors.primary, opacity: pressed ? 0.8 : 1 }]}><Feather name={recorderState.isRecording ? "square" : "mic"} size={18} color="#fff" /></Pressable>
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
