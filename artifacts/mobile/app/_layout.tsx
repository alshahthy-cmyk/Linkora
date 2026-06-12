import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { IncomingCallModal } from "@/components/IncomingCallModal";
import { LinkoraProvider, useLinkoraContext } from "@/contexts/LinkoraContext";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const { isReady, userId, incomingCall, acceptCall, rejectCall } =
    useLinkoraContext();

  useEffect(() => {
    if (!isReady) return;
    if (!userId) {
      router.replace("/setup");
    }
  }, [isReady, userId]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="setup" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[peerId]" options={{ headerShown: false }} />
        <Stack.Screen name="call/[peerId]" options={{ headerShown: false }} />
      </Stack>

      {incomingCall && (
        <IncomingCallModal
          callerName={incomingCall.peerName}
          callerId={incomingCall.peerId}
          onAccept={() => {
            acceptCall();
            router.push(`/call/${incomingCall.peerId}`);
          }}
          onReject={rejectCall}
        />
      )}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <LinkoraProvider>
                <RootLayoutNav />
              </LinkoraProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
