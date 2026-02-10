import { GluestackUIProvider } from '@gluestack-ui/themed';
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { config } from '../gluestack-ui.config';
import { JournalProvider } from "../store/journalStore";

export default function RootLayout() {
  return (
    <GluestackUIProvider config={config}>
      <JournalProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </JournalProvider>
    </GluestackUIProvider>
  );
}
