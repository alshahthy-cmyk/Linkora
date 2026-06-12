import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface IncomingCallModalProps {
  callerName: string;
  callerId: string;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({
  callerName,
  callerId,
  onAccept,
  onReject,
}: IncomingCallModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800 }),
        withTiming(1, { duration: 800 }),
      ),
      -1,
      false,
    );
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const letter = callerName.charAt(0).toUpperCase();

  const handleAccept = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAccept();
  };

  const handleReject = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    onReject();
  };

  return (
    <Modal visible transparent animationType="fade">
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: "rgba(0,0,0,0.85)",
            paddingTop: insets.top + 20,
            paddingBottom: insets.bottom + 30,
          },
        ]}
      >
        <Text style={[styles.incomingLabel, { color: colors.mutedForeground }]}>
          Incoming call
        </Text>

        <Animated.View style={[styles.avatarRing, pulseStyle]}>
          <View
            style={[
              styles.avatarInner,
              { backgroundColor: colors.primary + "30", borderColor: colors.primary },
            ]}
          >
            <Text style={[styles.avatarLetter, { color: colors.primary }]}>
              {letter}
            </Text>
          </View>
        </Animated.View>

        <Text style={[styles.callerName, { color: colors.foreground }]}>
          {callerName}
        </Text>
        <Text style={[styles.callerId, { color: colors.mutedForeground }]}>
          ID: {callerId}
        </Text>

        <View style={styles.actions}>
          <View style={styles.actionItem}>
            <Pressable
              onPress={handleReject}
              style={[
                styles.actionBtn,
                { backgroundColor: colors.destructive },
              ]}
            >
              <Feather name="phone-off" size={26} color="#fff" />
            </Pressable>
            <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>
              Decline
            </Text>
          </View>

          <View style={styles.actionItem}>
            <Pressable
              onPress={handleAccept}
              style={[styles.actionBtn, { backgroundColor: colors.online }]}
            >
              <Feather name="phone-call" size={26} color="#fff" />
            </Pressable>
            <Text style={[styles.actionLabel, { color: colors.mutedForeground }]}>
              Accept
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
  },
  incomingLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.5,
    marginTop: 40,
  },
  avatarRing: {
    marginTop: 40,
  },
  avatarInner: {
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
  callerName: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  callerId: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    letterSpacing: 1,
  },
  actions: {
    flexDirection: "row",
    gap: 60,
    marginBottom: 20,
  },
  actionItem: {
    alignItems: "center",
    gap: 10,
  },
  actionBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
