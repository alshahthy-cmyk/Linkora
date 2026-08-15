import { Feather } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Message } from "@/contexts/LinkoraContext";
import { useColors } from "@/hooks/useColors";

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function replyLabel(message: Message["replyTo"]) {
  if (!message) return "";
  if (message.type === "image") return "Photo";
  if (message.type === "video") return "Video";
  if (message.type === "voice") return "Voice message";
  if (message.type === "file") return "File";
  return message.content || "Message";
}

interface MessageBubbleProps {
  message: Message;
  onLongPress?: (message: Message) => void;
}

function VideoMessage({ source }: { source: string }) {
  const player = useVideoPlayer(source);
  return <VideoView style={styles.videoContent} player={player} nativeControls allowsFullscreen surfaceType="textureView" />;
}

function VoiceMessage({ source, durationMs, color, iconColor }: { source: string; durationMs?: number; color: string; iconColor: string }) {
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const durationSeconds = Math.max(1, Math.ceil(durationMs ? durationMs / 1000 : status.duration || 0));
  return (
    <Pressable
      onPress={() => {
        if (status.playing) player.pause();
        else {
          if (status.currentTime >= status.duration && status.duration > 0) player.seekTo(0);
          player.play();
        }
      }}
      style={styles.voiceRow}
    >
      <View style={[styles.voicePlay, { backgroundColor: color }]}><Feather name={status.playing ? "pause" : "play"} size={16} color={iconColor} /></View>
      <View style={styles.voiceTrack}><View style={[styles.voiceProgress, { width: `${Math.min(100, status.duration ? (status.currentTime / status.duration) * 100 : 0)}%`, backgroundColor: iconColor }]} /></View>
      <Text style={[styles.voiceDuration, { color: iconColor }]}>{durationSeconds}s</Text>
    </Pressable>
  );
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
            {!message.attachmentUnavailable && message.type === "video" && <VideoMessage source={message.content} />}
            {!message.attachmentUnavailable && message.type === "voice" && <VoiceMessage source={message.content} durationMs={message.durationMs} color={isMe ? "rgba(255,255,255,0.22)" : colors.primary + "22"} iconColor={isMe ? "#fff" : colors.primary} />}
            {!message.attachmentUnavailable && message.type === "file" && (
              <View style={styles.fileRow}>
                <View style={[styles.fileIcon, { backgroundColor: isMe ? "rgba(255,255,255,0.2)" : colors.primary + "25" }]}>
                  <Feather name="file" size={18} color={isMe ? "#fff" : colors.primary} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, { color: textColor }]} numberOfLines={1}>{message.fileName ?? "File"}</Text>
                  <Text style={[styles.fileSize, { color: metaColor }]}>{message.durationMs ? `${Math.ceil(message.durationMs / 1000)} sec` : formatSize(message.fileSize)}</Text>
                </View>
              </View>
            )}
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
  bubble: { maxWidth: "78%", borderRadius: 18, padding: 10, paddingHorizontal: 13, minWidth: 64, overflow: "hidden" },
  bubbleLeft: { borderBottomLeftRadius: 4 },
  bubbleRight: { borderBottomRightRadius: 4 },
  pressed: { opacity: 0.82 },
  messageText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 21 },
  imageContent: { width: 220, height: 180, borderRadius: 10 },
  videoContent: { width: 220, height: 148, borderRadius: 10 },
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 9, minWidth: 190, paddingVertical: 4 },
  voicePlay: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  voiceTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: "rgba(127,127,127,0.25)", overflow: "hidden" },
  voiceProgress: { height: 4, borderRadius: 2 },
  voiceDuration: { fontSize: 11, fontFamily: "Inter_500Medium", minWidth: 24 },
  replyPreview: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5, marginBottom: 7, gap: 2 },
  replyAuthor: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  replyText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  deletedRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  deletedText: { fontSize: 14, fontFamily: "Inter_400Regular", fontStyle: "italic" },
  unavailableAttachment: { flexDirection: "row", alignItems: "center", gap: 7, minWidth: 180, paddingVertical: 4 },
  unavailableAttachmentText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  fileRow: { flexDirection: "row", gap: 10, alignItems: "center", minWidth: 180 },
  fileIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  fileInfo: { flex: 1, gap: 2 },
  fileName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  fileSize: { fontSize: 12, fontFamily: "Inter_400Regular" },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 4 },
  time: { fontSize: 11, fontFamily: "Inter_400Regular" },
  systemRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8 },
  systemText: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
