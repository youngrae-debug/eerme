import { GluestackUIProvider } from "@gluestack-ui/themed";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { config } from "../gluestack-ui.config";
import { initializeSubscriptionSDK } from "../services/subscription";
import { JournalProvider } from "../store/journalStore";

export default function RootLayout() {
  React.useEffect(() => {
    initializeSubscriptionSDK().catch((error) => {
      console.warn("RevenueCat initialization failed", error);
    });
  }, []);

  return (
    <SafeAreaProvider>
      <GluestackUIProvider config={config}>
        <JournalProvider>
          <StatusBar style="dark" backgroundColor="#F4EFE7" />
          <Stack screenOptions={{ headerShown: false }} />
        </JournalProvider>
      </GluestackUIProvider>
    </SafeAreaProvider>
  );
}
