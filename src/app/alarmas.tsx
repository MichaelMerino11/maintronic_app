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
import { getAlarmasActivas } from "../services/api";

interface Alarma {
  id: number;
  variable_id: number;
  nombre: string;
  medidor_nombre: string;
  valor: number;
  unidad: string;
  tipo: "HIHI" | "HI" | "LO" | "LOLO";
  prioridad: "P1" | "P2";
  inicio_en: string;
}

function AlarmCard({ alarma }: { alarma: Alarma }) {
  const isP1 = alarma.prioridad === "P1";
  const color = isP1 ? Colors.alarmP1 : Colors.alarmP2;
  const bg = isP1 ? Colors.alarmP1Bg : Colors.alarmP2Bg;

  const tipoLabel: Record<string, string> = {
    HIHI: "MUY ALTO",
    HI: "ALTO",
    LO: "BAJO",
    LOLO: "MUY BAJO",
  };

  return (
    <View
      style={[styles.card, { backgroundColor: bg, borderLeftColor: color }]}
    >
      <View style={styles.cardHeader}>
        <Text style={[styles.prioridad, { color }]}>{alarma.prioridad}</Text>
        <Text style={[styles.tipo, { color }]}>
          {tipoLabel[alarma.tipo] ?? alarma.tipo}
        </Text>
        <Text style={styles.tiempo}>
          {new Date(alarma.inicio_en).toLocaleTimeString()}
        </Text>
      </View>
      <Text style={styles.variable}>{alarma.nombre}</Text>
      <Text style={styles.medidor}>{alarma.medidor_nombre}</Text>
      <Text style={[styles.valor, { color }]}>
        Valor: {alarma.valor?.toFixed(3)} {alarma.unidad}
      </Text>
    </View>
  );
}

export default function Alarmas() {
  const [alarmas, setAlarmas] = useState<Alarma[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await getAlarmasActivas();
      setAlarmas(res.data);
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
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const p1 = alarmas.filter((a) => a.prioridad === "P1");
  const p2 = alarmas.filter((a) => a.prioridad === "P2");

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
        <Text style={styles.headerTitle}>ALM-001 · GESTIÓN DE ALARMAS</Text>
        <Text style={styles.headerSub}>
          {error ? (
            <Text style={{ color: Colors.alarmP1 }}>● {error}</Text>
          ) : (
            `● ONLINE · ${lastUpdate}`
          )}
        </Text>
      </View>

      {/* Resumen */}
      <View style={styles.resumen}>
        <View style={[styles.resumenCard, { borderColor: Colors.alarmP1 }]}>
          <Text style={[styles.resumenNum, { color: Colors.alarmP1 }]}>
            {p1.length}
          </Text>
          <Text style={styles.resumenLabel}>CRÍTICAS P1</Text>
        </View>
        <View style={[styles.resumenCard, { borderColor: Colors.alarmP2 }]}>
          <Text style={[styles.resumenNum, { color: Colors.alarmP2 }]}>
            {p2.length}
          </Text>
          <Text style={styles.resumenLabel}>ALTAS P2</Text>
        </View>
        <View style={[styles.resumenCard, { borderColor: "#666" }]}>
          <Text style={[styles.resumenNum, { color: "#666" }]}>
            {alarmas.length}
          </Text>
          <Text style={styles.resumenLabel}>TOTAL</Text>
        </View>
      </View>

      {/* Sin alarmas */}
      {alarmas.length === 0 && !error && (
        <View style={styles.sinAlarmas}>
          <Text style={styles.sinAlarmasIcon}>✓</Text>
          <Text style={styles.sinAlarmasText}>SIN ALARMAS ACTIVAS</Text>
          <Text style={styles.sinAlarmasSub}>
            Todos los parámetros dentro de rango normal
          </Text>
        </View>
      )}

      {/* P1 Críticas */}
      {p1.length > 0 && (
        <>
          <Text style={[styles.groupTitle, { color: Colors.alarmP1 }]}>
            ● ALARMAS CRÍTICAS — P1
          </Text>
          {p1.map((a) => (
            <AlarmCard key={a.id} alarma={a} />
          ))}
        </>
      )}

      {/* P2 Altas */}
      {p2.length > 0 && (
        <>
          <Text style={[styles.groupTitle, { color: Colors.alarmP2 }]}>
            ● ALARMAS ALTAS — P2
          </Text>
          {p2.map((a) => (
            <AlarmCard key={a.id} alarma={a} />
          ))}
        </>
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

  resumen: {
    flexDirection: "row",
    paddingHorizontal: 10,
    gap: 8,
    marginBottom: 8,
  },
  resumenCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderRadius: 6,
    padding: 12,
    alignItems: "center",
  },
  resumenNum: { fontSize: 28, fontWeight: "bold", fontFamily: "monospace" },
  resumenLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontFamily: "monospace",
    marginTop: 2,
  },

  sinAlarmas: { alignItems: "center", padding: 40 },
  sinAlarmasIcon: { fontSize: 48, color: "#4CAF50" },
  sinAlarmasText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#4CAF50",
    fontFamily: "monospace",
    marginTop: 8,
  },
  sinAlarmasSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 6,
    textAlign: "center",
  },

  groupTitle: {
    fontSize: 10,
    fontWeight: "bold",
    fontFamily: "monospace",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 4,
    letterSpacing: 1,
  },

  card: {
    marginHorizontal: 10,
    marginBottom: 8,
    padding: 12,
    borderRadius: 4,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  prioridad: { fontSize: 11, fontWeight: "bold", fontFamily: "monospace" },
  tipo: { fontSize: 11, fontFamily: "monospace", flex: 1 },
  tiempo: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontFamily: "monospace",
  },
  variable: { fontSize: 13, fontWeight: "bold", color: Colors.textPrimary },
  medidor: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  valor: {
    fontSize: 12,
    fontFamily: "monospace",
    marginTop: 6,
    fontWeight: "bold",
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