import { View, Text, StyleSheet } from "react-native";

export default function Alarmas() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Pantalla Alarmas</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#B4B4B4",
    justifyContent: "center",
    alignItems: "center",
  },
  text: { fontSize: 18, color: "#1a1a1a" },
});