import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLinkoraContext } from "@/contexts/LinkoraContext";
import { useColors } from "@/hooks/useColors";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CallScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { peerId } = useLocalSearchParams<{ peerId: string }>();
  const { conversations, endCall, activeCall } = useLinkoraContext();
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useSharedValue(1);

  const conversation = conversations.find((c) => c.peerId === peerId);
  const peerName = conversation?.peerName ?? peerId ?? "Unknown";
  const isActive = activeCall === peerId;

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1200 }),
        withTiming(1, { duration: 1200 }),
      ),
      -1,
      false,
    );
  }, []);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive && duration > 0) {
      router.back();
    }
  }, [isActive]);

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
    setMuted((m) => !m);
  };

  const handleSpeaker = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSpeaker((s) => !s);
  };

  const letter = peerName.charAt(0).toUpperCase();

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
      <Pressable
        onPress={() => router.back()}
        style={[styles.backBtn, { borderColor: colors.border }]}
        hitSlop={12}
      >
        <Feather name="chevron-down" size={20} color={colors.foreground} />
      </Pressable>

      <Text style={[styles.callLabel, { color: colors.mutedForeground }]}>
        {isActive ? "In call" : "Calling..."}
      </Text>

      <View style={styles.avatarArea}>
        <Animated.View
          style={[
            styles.pulseRing,
            pulseStyle,
            { borderColor: colors.primary + "50" },
          ]}
        />
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: colors.primary + "25",
              borderColor: colors.primary,
            },
          ]}
        >
          <Text style={[styles.avatarLetter, { color: colors.primary }]}>
            {letter}
          </Text>
        </View>
      </View>

      <Text style={[styles.peerName, { color: colors.foreground }]}>
        {peerName}
      </Text>
      <Text style={[styles.duration, { color: colors.mutedForeground }]}>
        {isActive ? formatDuration(duration) : "Waiting for response..."}
      </Text>

      {Platform.OS === "web" && (
        <View
          style={[styles.webNotice, { backgroundColor: colors.secondary }]}
        >
          <Feather name="video-off" size={14} color={colors.mutedForeground} />
          <Text style={[styles.webNoticeText, { color: colors.mutedForeground }]}>
            Video requires native app build (Android APK)
          </Text>
        </View>
      )}

      <View style={styles.controls}>
        <View style={styles.controlItem}>
          <Pressable
            onPress={handleMute}
            style={({ pressed }) => [
              styles.controlBtn,
              {
                backgroundColor: muted ? colors.destructive : colors.secondary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather
              name={muted ? "mic-off" : "mic"}
              size={22}
              color={muted ? "#fff" : colors.foreground}
            />
          </Pressable>
          <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>
            {muted ? "Unmute" : "Mute"}
          </Text>
        </View>

        <View style={styles.controlItem}>
          <Pressable
            onPress={handleEndCall}
            style={[styles.endCallBtn, { backgroundColor: colors.destructive }]}
          >
            <Feather name="phone-off" size={26} color="#fff" />
          </Pressable>
          <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>
            End
          </Text>
        </View>

        <View style={styles.controlItem}>
          <Pressable
            onPress={handleSpeaker}
            style={({ pressed }) => [
              styles.controlBtn,
              {
                backgroundColor: speaker ? colors.primary : colors.secondary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather
              name="volume-2"
              size={22}
              color={speaker ? "#fff" : colors.foreground}
            />
          </Pressable>
          <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>
            {speaker ? "Speaker" : "Earpiece"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    alignSelf: "flex-start",
    marginLeft: 16,
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  callLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
  },
  avatarArea: {
    alignItems: "center",
    justifyContent: "center",
    width: 160,
    height: 160,
  },
  pulseRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 52,
    fontFamily: "Inter_700Bold",
  },
  peerName: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  duration: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1,
  },
  webNotice: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  webNoticeText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  controls: {
    flexDirection: "row",
    gap: 36,
    alignItems: "center",
    paddingBottom: 10,
  },
  controlItem: {
    alignItems: "center",
    gap: 8,
  },
  controlBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
  },
  endCallBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },
  controlLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
});
