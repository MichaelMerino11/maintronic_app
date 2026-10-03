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
import { getMedidoresLecturas } from "../services/api";

interface Lectura {
  variable_id: number;
  nombre: string;
  valor: number;
  unidad: string;
  medidor_nombre: string;
  timestamp: string;
}

function Faceplate({
  tag,
  label,
  value,
  unit,
  min,
  max,
  alarm,
}: {
  tag: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  alarm?: "p1" | "p2" | null;
}) {
  const pct = Math.min(Math.max(((value - min) / (max - min)) * 100, 0), 100);
  const alarmColor =
    alarm === "p1"
      ? Colors.alarmP1
      : alarm === "p2"
        ? Colors.alarmP2
        : Colors.textPrimary;
  const alarmBg =
    alarm === "p1"
      ? Colors.alarmP1Bg
      : alarm === "p2"
        ? Colors.alarmP2Bg
        : Colors.card;

  return (
    <View style={[styles.faceplate, { backgroundColor: alarmBg }]}>
      <Text style={styles.tag}>{tag}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: alarmColor }]}>
        {value?.toFixed(2)} <Text style={styles.unit}>{unit}</Text>
      </Text>
      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            { width: `${pct}%` as any, backgroundColor: alarmColor },
          ]}
        />
      </View>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel}>{min}</Text>
        <Text style={styles.barLabel}>{max}</Text>
      </View>
    </View>
  );
}

function getAlarm(nombre: string, valor: number): "p1" | "p2" | null {
  const n = nombre.toLowerCase();
  if (n.includes("voltaje") && (valor < 110 || valor > 135)) return "p1";
  if (n.includes("frecuencia") && (valor < 59 || valor > 61)) return "p2";
  if (n.includes("factor") && valor < 0.85) return "p2";
  return null;
}

function getRange(nombre: string): { min: number; max: number; unit: string } {
  const n = nombre.toLowerCase();
  if (n.includes("voltaje")) return { min: 100, max: 150, unit: "V" };
  if (n.includes("corriente") || n.includes("current"))
    return { min: 0, max: 50, unit: "A" };
  if (n.includes("frecuencia")) return { min: 55, max: 65, unit: "Hz" };
  if (n.includes("factor") || n.includes("fp"))
    return { min: 0, max: 1, unit: "cos φ" };
  if (n.includes("potencia") || n.includes("kw"))
    return { min: 0, max: 100, unit: "kW" };
  if (n.includes("energia") || n.includes("kwh"))
    return { min: 0, max: 1000, unit: "kWh" };
  return { min: 0, max: 100, unit: "" };
}

function getTag(nombre: string, idx: number): string {
  const n = nombre.toLowerCase();
  if (n.includes("voltaje")) return `VT-L${idx + 1}`;
  if (n.includes("corriente") || n.includes("current")) return `IT-L${idx + 1}`;
  if (n.includes("frecuencia")) return "FT-001";
  if (n.includes("factor")) return "FP-001";
  if (n.includes("potencia")) return "PT-ACT";
  if (n.includes("energia")) return "ET-IND";
  return `VAR-${idx + 1}`;
}

export default function Industrial() {
  const [lecturas, setLecturas] = useState<Lectura[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await getMedidoresLecturas();
      setLecturas(res.data);
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

  // Agrupar por medidor
  const porMedidor = lecturas.reduce(
    (acc, l) => {
      const key = l.medidor_nombre || "Sin nombre";
      if (!acc[key]) acc[key] = [];
      acc[key].push(l);
      return acc;
    },
    {} as Record<string, Lectura[]>,
  );

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          IND-001 · PLANTA INDUSTRIAL · RS-485
        </Text>
        <Text style={styles.headerSub}>
          {error ? (
            <Text style={{ color: Colors.alarmP1 }}>● {error}</Text>
          ) : (
            `● ONLINE · ${lastUpdate}`
          )}
        </Text>
      </View>

      {Object.entries(porMedidor).map(([medidor, vars]) => (
        <View key={medidor}>
          <Text style={styles.groupTitle}>{medidor.toUpperCase()}</Text>
          <View style={styles.grid}>
            {vars.map((l, idx) => {
              const range = getRange(l.nombre);
              const alarm = getAlarm(l.nombre, l.valor);
              const tag = getTag(l.nombre, idx);
              return (
                <View key={l.variable_id} style={styles.faceplateWrapper}>
                  <Faceplate
                    tag={tag}
                    label={l.nombre}
                    value={l.valor}
                    unit={l.unidad || range.unit}
                    min={range.min}
                    max={range.max}
                    alarm={alarm}
                  />
                </View>
              );
            })}
          </View>
        </View>
      ))}

      {lecturas.length === 0 && !error && (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Sin lecturas disponibles</Text>
          <Text style={styles.emptySubText}>
            Verifica que modbus_dynamic.py esté corriendo
          </Text>
        </View>
      )}

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
    padding: 20,
  },
  loadingText: { marginTop: 12, color: Colors.textSecondary, fontSize: 14 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, fontWeight: "bold" },
  emptySubText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 6,
    textAlign: "center",
  },

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
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 8,
    gap: 6,
    marginBottom: 4,
  },
  faceplateWrapper: { width: "47%" },

  faceplate: {
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