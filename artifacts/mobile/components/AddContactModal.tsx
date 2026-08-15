import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

interface AddContactModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (peerId: string, peerName: string) => void;
}

export function AddContactModal({
  visible,
  onClose,
  onAdd,
}: AddContactModalProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [peerId, setPeerId] = useState("");
  const [peerName, setPeerName] = useState("");
  const [error, setError] = useState("");

  const handleAdd = () => {
    const id = peerId.trim().toUpperCase().replace(/\s/g, "");
    if (id.length < 4) {
      setError("أدخل معرّف Linkora صحيحاً");
      return;
    }
    const name = peerName.trim() || id;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd(id, name);
    setPeerId("");
    setPeerName("");
    setError("");
    onClose();
  };

  const handleClose = () => {
    setPeerId("");
    setPeerName("");
    setError("");
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          <View
            style={[styles.handle, { backgroundColor: colors.border }]}
          />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              محادثة جديدة
            </Text>
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={styles.body}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
              معرّف LINKORA *
            </Text>
            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: colors.secondary,
                  borderColor: error ? colors.destructive : colors.border,
                },
              ]}
            >
              <Feather name="hash" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="مثال: ABCD1234"
                placeholderTextColor={colors.mutedForeground}
                value={peerId}
                onChangeText={(t) => {
                  setPeerId(t.toUpperCase());
                  setError("");
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>
            {!!error && (
              <Text style={[styles.errorText, { color: colors.destructive }]}>
                {error}
              </Text>
            )}

            <Text
              style={[styles.fieldLabel, { color: colors.mutedForeground, marginTop: 12 }]}
            >
              اسم العرض (اختياري)
            </Text>
            <View
              style={[
                styles.inputWrap,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              <Feather name="user" size={16} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="كيف تود أن يظهر الاسم؟"
                placeholderTextColor={colors.mutedForeground}
                value={peerName}
                onChangeText={setPeerName}
                returnKeyType="done"
                onSubmitEditing={handleAdd}
              />
            </View>

            <View
              style={[styles.infoRow, { backgroundColor: colors.secondary }]}
            >
              <Feather
                name="info"
                size={13}
                color={colors.primary}
                style={{ marginTop: 1 }}
              />
              <Text
                style={[styles.infoText, { color: colors.mutedForeground }]}
              >
                تصل الرسائل عندما يكون الجهازان متصلين فقط. لا تُحفَظ
                المحادثات على أي خادم.
              </Text>
            </View>

            <Pressable
              onPress={handleAdd}
              style={({ pressed }) => [
                styles.addButton,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="message-circle" size={16} color="#fff" />
              <Text style={styles.addButtonText}>بدء المحادثة</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  keyboardView: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 16,
  },
  body: {
    paddingHorizontal: 20,
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.1,
    marginBottom: 4,
    alignSelf: "flex-end",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  infoRow: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    alignItems: "flex-start",
    marginTop: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    textAlign: "right",
  },
  addButton: {
    flexDirection: "row",
    height: 50,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },
});
