import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useJournalStore } from "../store/journalStore";
import { COLORS } from "../theme/colors";

export default function Index() {
  const { isReady } = useJournalStore();

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.surface} />
      </View>
    );
  }

  return <Redirect href="/(tabs)" />;
}
