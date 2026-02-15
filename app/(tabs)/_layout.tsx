import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useJournalStore } from "../../store/journalStore";
import { COLORS } from "../../theme/colors";
import { t, useLocale } from "../../utils/i18n";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isReady } = useJournalStore();
  const locale = useLocale();
  const [tabsKey, setTabsKey] = React.useState(0);

  React.useEffect(() => {
    setTabsKey((value) => value + 1);
  }, [locale]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.surface} />
      </View>
    );
  }

  return (
    <Tabs
      key={`tabs-${tabsKey}`}
      screenOptions={{
        headerStyle: {
          backgroundColor: COLORS.background,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: COLORS.primaryText,
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: 18,
        },
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.softBorder,
          borderTopWidth: 0.5,
          paddingTop: 6,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          height: 56 + (insets.bottom > 0 ? insets.bottom : 8),
        },
        tabBarActiveTintColor: COLORS.accentPink,
        tabBarInactiveTintColor: COLORS.secondaryText,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        key={`tab-index-${tabsKey}`}
        options={() => ({
          title: t("tabToday"),
          tabBarLabel: t("tabToday"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="create-outline" size={size} color={color} />
          ),
        })}
      />
      <Tabs.Screen
        name="calendar"
        key={`tab-calendar-${tabsKey}`}
        options={() => ({
          title: t("tabCalendar"),
          tabBarLabel: t("tabCalendar"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        })}
      />
      <Tabs.Screen
        name="search"
        key={`tab-search-${tabsKey}`}
        options={() => ({
          title: t("tabSearch"),
          tabBarLabel: t("tabSearch"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        })}
      />

      <Tabs.Screen
        name="stats"
        key={`tab-stats-${tabsKey}`}
        options={() => ({
          title: t("tabStats"),
          tabBarLabel: t("tabStats"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        })}
      />

      <Tabs.Screen
        name="sync"
        key={`tab-sync-${tabsKey}`}
        options={() => ({
          title: t("tabMy"),
          tabBarLabel: t("tabMy"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        })}
      />
    </Tabs>
  );
}
