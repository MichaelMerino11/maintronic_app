import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: "#1a1a2e", borderTopColor: "#333" },
        tabBarActiveTintColor: "#00D4FF",
        tabBarInactiveTintColor: "#666",
        headerStyle: { backgroundColor: "#0D1B4B" },
        headerTintColor: "#ffffff",
        headerTitleStyle: { fontWeight: "bold" },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="solar"
        options={{
          title: "Solar",
          tabBarIcon: ({ color }) => (
            <Ionicons name="sunny" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="industrial"
        options={{
          title: "Industrial",
          tabBarIcon: ({ color }) => (
            <Ionicons name="flash" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alarmas"
        options={{
          title: "Alarmas",
          tabBarIcon: ({ color }) => (
            <Ionicons name="warning" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}