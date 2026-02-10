import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { COLORS } from "../../theme/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.textOnDark,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.borderMuted,
        },
        tabBarActiveTintColor: "#4299e1",
        tabBarInactiveTintColor: "#a0aec0",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "오늘",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="create-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: "캘린더",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "검색",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="stats"
        options={{
          title: "통계",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="sync"
        options={{
          title: "동기화",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cloud-upload-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
