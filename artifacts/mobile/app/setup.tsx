import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLinkoraContext } from "@/contexts/LinkoraContext";
import { useColors } from "@/hooks/useColors";

export default function SetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setupUser } = useLinkoraContext();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name");
      return;
    }
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    try {
      setLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await setupUser(trimmed);
      router.replace("/(tabs)");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#0A0C17", "#0D1030", "#0A0C17"]}
      style={StyleSheet.absoluteFill}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + 40,
              paddingBottom: insets.bottom + 24,
            },
          ]}
        >
          <View style={styles.logoArea}>
            <View
              style={[styles.iconRing, { borderColor: colors.primary + "40" }]}
            >
              <View
                style={[styles.iconInner, { backgroundColor: colors.primary }]}
              >
                <Feather name="link" size={28} color="#fff" />
              </View>
            </View>
            <Text style={[styles.appName, { color: colors.foreground }]}>
              Linkora
            </Text>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              Peer-to-peer messaging.{"\n"}No servers. No tracking.
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              YOUR NAME
            </Text>
            <View
              style={[
                styles.inputContainer,
                {
                  borderColor: error ? colors.destructive : colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <Feather
                name="user"
                size={18}
                color={colors.mutedForeground}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="How should people know you?"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  setError("");
                }}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleStart}
                maxLength={30}
              />
            </View>
            {!!error && (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            )}

            <View
              style={[styles.infoBox, { backgroundColor: colors.secondary }]}
            >
              <Feather
                name="shield"
                size={14}
                color={colors.primary}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[styles.infoText, { color: colors.mutedForeground }]}
              >
                You'll get a unique ID to share with contacts. All messages are
                end-to-end via P2P — nothing stored on any server.
              </Text>
            </View>

            <Pressable
              onPress={handleStart}
              disabled={loading}
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Get Started</Text>
                  <Feather name="arrow-right" size={18} color="#fff" />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: "space-between",
  },
  logoArea: {
    alignItems: "center",
    marginTop: 20,
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 54,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  infoBox: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 14,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  button: {
    flexDirection: "row",
    height: 54,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
