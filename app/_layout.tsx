import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { JournalProvider } from "../store/journalStore";

export default function RootLayout() {
  return (
    <JournalProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </JournalProvider>
  );
}
