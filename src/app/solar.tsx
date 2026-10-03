import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Colors } from "../theme/colors";
import { getSolarUltimo } from "../services/api";

interface SolarData {
  voltaje_panel: number;
  voltaje_bateria: number;
  voltaje_inversor: number;
  corriente_panel: number;
  corriente_bateria: number;
  corriente_inversor: number;
  potencia_entrada: number;
  potencia_salida: number;
  energia_kwh: number;
  registrado_en: string;
}

function Faceplate({
  tag,
  label,
  value,
  unit,
  min,
  max,
}: {
  tag: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
}) {
  const pct = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);

  return (
    <View style={styles.faceplate}>
      <Text style={styles.tag}>{tag}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>
        {value?.toFixed(2)} <Text style={styles.unit}>{unit}</Text>
      </Text>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct}%` as any }]} />
      </View>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel}>{min}</Text>
        <Text style={styles.barLabel}>{max}</Text>
      </View>
    </View>
  );
}

export default function Solar() {
  const [data, setData] = useState<SolarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await getSolarUltimo();
      setData(res.data);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (e) {
      setError("Sin conexión al servidor");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Conectando...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header ISA */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>SOLR-001 · SISTEMA FOTOVOLTAICO</Text>
        <Text style={styles.headerSub}>
          {error ? (
            <Text style={{ color: Colors.alarmP1 }}>● {error}</Text>
          ) : (
            `● ONLINE · ${lastUpdate}`
          )}
        </Text>
      </View>

      {/* Voltajes */}
      <Text style={styles.groupTitle}>VT-GROUP · Voltajes del Sistema</Text>
      <View style={styles.row}>
        <Faceplate
          tag="VT-P"
          label="V Panel"
          value={data?.voltaje_panel ?? 0}
          unit="V DC"
          min={0}
          max={100}
        />
        <Faceplate
          tag="VT-B"
          label="V Batería"
          value={data?.voltaje_bateria ?? 0}
          unit="V DC"
          min={0}
          max={20}
        />
        <Faceplate
          tag="VT-I"
          label="V Inversor"
          value={data?.voltaje_inversor ?? 0}
          unit="V DC"
          min={0}
          max={20}
        />
      </View>

      {/* Corrientes */}
      <Text style={styles.groupTitle}>IT-GROUP · Corrientes del Sistema</Text>
      <View style={styles.row}>
        <Faceplate
          tag="IT-P"
          label="I Panel"
          value={data?.corriente_panel ?? 0}
          unit="A DC"
          min={0}
          max={15}
        />
        <Faceplate
          tag="IT-B"
          label="I Batería"
          value={data?.corriente_bateria ?? 0}
          unit="A DC"
          min={0}
          max={15}
        />
        <Faceplate
          tag="IT-I"
          label="I Inversor"
          value={data?.corriente_inversor ?? 0}
          unit="A DC"
          min={0}
          max={15}
        />
      </View>

      {/* Potencias */}
      <Text style={styles.groupTitle}>PT-GROUP · Potencias y Energía</Text>
      <View style={styles.row}>
        <Faceplate
          tag="PT-ENT"
          label="P Entrada"
          value={data?.potencia_entrada ?? 0}
          unit="W"
          min={0}
          max={1000}
        />
        <Faceplate
          tag="PT-SAL"
          label="P Salida"
          value={data?.potencia_salida ?? 0}
          unit="W"
          min={0}
          max={1000}
        />
        <Faceplate
          tag="ET-DIA"
          label="Energía Hoy"
          value={data?.energia_kwh ?? 0}
          unit="kWh"
          min={0}
          max={10}
        />
      </View>

      {/* Norma */}
      <Text style={styles.norma}>
        ANSI/ISA-101.01-2015 · MAINTRONIC · UDLA 2026
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 12, color: Colors.textSecondary, fontSize: 14 },

  header: { backgroundColor: "#1a1a2e", padding: 12, marginBottom: 8 },
  headerTitle: {
    color: "#fff",
    fontFamily: "monospace",
    fontSize: 12,
    fontWeight: "bold",
  },
  headerSub: {
    color: Colors.accent,
    fontFamily: "monospace",
    fontSize: 11,
    marginTop: 2,
  },

  groupTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: Colors.textSecondary,
    fontFamily: "monospace",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
    letterSpacing: 1,
  },
  row: { flexDirection: "row", paddingHorizontal: 8, gap: 6, marginBottom: 4 },

  faceplate: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 4,
    padding: 8,
  },
  tag: {
    fontSize: 9,
    fontFamily: "monospace",
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  label: { fontSize: 10, color: Colors.textPrimary, marginTop: 2 },
  value: {
    fontSize: 18,
    fontFamily: "monospace",
    fontWeight: "bold",
    color: Colors.textPrimary,
    marginTop: 4,
  },
  unit: { fontSize: 11, fontWeight: "normal", color: Colors.textSecondary },

  barBg: { height: 6, backgroundColor: "#aaa", borderRadius: 3, marginTop: 8 },
  barFill: { height: 6, backgroundColor: "#1a1a2e", borderRadius: 3 },
  barLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  barLabel: {
    fontSize: 8,
    color: Colors.textSecondary,
    fontFamily: "monospace",
  },

  norma: {
    textAlign: "center",
    fontSize: 9,
    color: Colors.textSecondary,
    fontFamily: "monospace",
    padding: 16,
    marginTop: 8,
  },
});