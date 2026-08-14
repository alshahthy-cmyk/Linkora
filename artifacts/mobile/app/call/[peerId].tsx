import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RTCView } from "react-native-webrtc";

import { useLinkoraContext } from "@/contexts/LinkoraContext";
import { useColors } from "@/hooks/useColors";

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export default function CallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { peerId } = useLocalSearchParams<{ peerId: string }>();
  const {
    conversations,
    endCall,
    activeCall,
    activeCallMode,
    localStream,
    remoteStream,
    isMuted,
    isSpeakerOn,
    setCallMuted,
    setSpeakerEnabled,
  } = useLinkoraContext();
  const [duration, setDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useSharedValue(1);

  const conversation = conversations.find((conversationItem) => conversationItem.peerId === peerId);
  const peerName = conversation?.peerName ?? peerId ?? "Unknown";
  const isActive = activeCall === peerId;
  const isVideoCall = activeCallMode === "video";
  const isConnected = Boolean(remoteStream);
  const letter = peerName.charAt(0).toUpperCase();

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1.08, { duration: 1200 }), withTiming(1, { duration: 1200 })),
      -1,
      false,
    );
  }, [pulse]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => setDuration((current) => current + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive && duration > 0) router.back();
  }, [duration, isActive]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: pulse.value * 0.6 + 0.4,
  }));

  const handleEndCall = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    endCall();
    router.back();
  };

  const handleMute = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCallMuted(!isMuted);
  };

  const handleSpeaker = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSpeakerEnabled(!isSpeakerOn);
  };

  const statusLabel = isConnected ? "Connected" : isActive ? "Calling..." : "Call ended";

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        },
      ]}
    >
      <Pressable onPress={() => router.back()} style={[styles.backBtn, { borderColor: colors.border }]} hitSlop={12}>
        <Feather name="chevron-down" size={20} color={colors.foreground} />
      </Pressable>

      <Text style={[styles.callLabel, { color: colors.mutedForeground }]}>{statusLabel}</Text>

      {isVideoCall && Platform.OS !== "web" ? (
        <View style={styles.videoStage}>
          {remoteStream ? (
            <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
          ) : (
            <View style={[styles.remoteVideo, styles.waitingVideo, { backgroundColor: colors.secondary }]}>
              <Feather name="video" size={28} color={colors.mutedForeground} />
              <Text style={[styles.waitingVideoText, { color: colors.mutedForeground }]}>Waiting for video…</Text>
            </View>
          )}
          {localStream ? <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" mirror /> : null}
        </View>
      ) : (
        <View style={styles.avatarArea}>
          <Animated.View style={[styles.pulseRing, pulseStyle, { borderColor: `${colors.primary}50` }]} />
          <View style={[styles.avatar, { backgroundColor: `${colors.primary}25`, borderColor: colors.primary }]}>
            <Text style={[styles.avatarLetter, { color: colors.primary }]}>{letter}</Text>
          </View>
        </View>
      )}

      <Text style={[styles.peerName, { color: colors.foreground }]}>{peerName}</Text>
      <Text style={[styles.duration, { color: colors.mutedForeground }]}>{isActive ? formatDuration(duration) : "Waiting for response..."}</Text>

      {Platform.OS === "web" && (
        <View style={[styles.webNotice, { backgroundColor: colors.secondary }]}>
          <Feather name="video-off" size={14} color={colors.mutedForeground} />
          <Text style={[styles.webNoticeText, { color: colors.mutedForeground }]}>Calls require the Android app build</Text>
        </View>
      )}

      <View style={styles.controls}>
        <View style={styles.controlItem}>
          <Pressable
            onPress={handleMute}
            style={({ pressed }) => [styles.controlBtn, { backgroundColor: isMuted ? colors.destructive : colors.secondary, opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name={isMuted ? "mic-off" : "mic"} size={22} color={isMuted ? "#fff" : colors.foreground} />
          </Pressable>
          <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>{isMuted ? "Unmute" : "Mute"}</Text>
        </View>

        <View style={styles.controlItem}>
          <Pressable onPress={handleEndCall} style={[styles.endCallBtn, { backgroundColor: colors.destructive }]}>
            <Feather name="phone-off" size={26} color="#fff" />
          </Pressable>
          <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>End</Text>
        </View>

        <View style={styles.controlItem}>
          <Pressable
            onPress={handleSpeaker}
            style={({ pressed }) => [styles.controlBtn, { backgroundColor: isSpeakerOn ? colors.primary : colors.secondary, opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="volume-2" size={22} color={isSpeakerOn ? "#fff" : colors.foreground} />
          </Pressable>
          <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>{isSpeakerOn ? "Speaker" : "Earpiece"}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "space-between" },
  backBtn: { alignSelf: "flex-start", marginLeft: 16, padding: 10, borderRadius: 20, borderWidth: 1 },
  callLabel: { fontSize: 14, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
  avatarArea: { alignItems: "center", justifyContent: "center", width: 160, height: 160 },
  pulseRing: { position: "absolute", width: 160, height: 160, borderRadius: 80, borderWidth: 2 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 52, fontFamily: "Inter_700Bold" },
  videoStage: { width: "88%", maxWidth: 380, aspectRatio: 0.72, borderRadius: 28, overflow: "hidden", position: "relative" },
  remoteVideo: { width: "100%", height: "100%" },
  waitingVideo: { alignItems: "center", justifyContent: "center", gap: 10 },
  waitingVideoText: { fontFamily: "Inter_500Medium", fontSize: 13 },
  localVideo: { position: "absolute", right: 12, top: 12, width: 104, height: 148, borderRadius: 16, overflow: "hidden", borderWidth: 2, borderColor: "#fff" },
  peerName: { fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  duration: { fontSize: 16, fontFamily: "Inter_500Medium", letterSpacing: 1 },
  webNotice: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  webNoticeText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  controls: { flexDirection: "row", gap: 36, alignItems: "center", paddingBottom: 10 },
  controlItem: { alignItems: "center", gap: 8 },
  controlBtn: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center" },
  endCallBtn: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center" },
  controlLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
});
