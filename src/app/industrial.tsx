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
import {
  getMedidoresLecturas,
  getAlarmasActivas,
  getGatewayEstado,
  getVariablesActivas,
  getAlarmaConfig,
} from "../services/api";

// Una lectura con más de estos segundos de antigüedad se considera sin datos
const UMBRAL_SIN_DATOS_S = 30;

interface Lectura {
  id: number;
  variable_id?: number;
  nombre: string;
  valor: number | string | null;
  unidad: string | null;
  medidor_nombre: string;
  registrado_en?: string;
  tipo?: string;
}

interface VariableActiva {
  id: number;
  slave_id: number;
}

interface AlarmaActiva {
  variable_id: number;
  prioridad: "P1" | "P2";
}

interface AlarmaConfig {
  lolo: number | string | null;
  lo: number | string | null;
  hi: number | string | null;
  hihi: number | string | null;
}

interface EstadoMedidor {
  baud: number | null;
  revisadas: number;
  total: number;
  verificado: boolean;
  detectando: boolean;
  baud_probando: number | null;
}

interface GatewayEstado {
  conectada: boolean;
  fallidas: number[];
  bus?: { medidores?: Record<string, EstadoMedidor> };
  ahora: string;
}

type Calidad = "ok" | "sin_respuesta" | "sin_datos" | "verificando";
type Tono = "ok" | "aviso" | "error" | "proceso";

// Convierte a número; MySQL entrega los decimales como texto
function num(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

// ── Rango de la barra: alarmas configuradas en el servidor o valores base por tipo ──
function rangoBase(nombre: string, unidad: string) {
  const n = nombre.toLowerCase();
  const u = unidad.toLowerCase();
  if (u === "v" || n.includes("voltaje"))
    return { min: 0, max: 150, unit: "V" };
  if (u === "a" || n.includes("corriente") || n.includes("current"))
    return { min: 0, max: 50, unit: "A" };
  if (u === "hz" || n.includes("frecuencia"))
    return { min: 55, max: 65, unit: "Hz" };
  if (n.includes("factor") || n.includes("fp"))
    return { min: 0, max: 1, unit: "cos φ" };
  if (u === "kw" || u === "kvar" || u === "kva" || n.includes("potencia"))
    return { min: 0, max: 100, unit: unidad || "kW" };
  if (u === "kwh" || n.includes("energia"))
    return { min: 0, max: 1000, unit: "kWh" };
  return { min: 0, max: 100, unit: "" };
}

function rango(l: Lectura, cfg: AlarmaConfig | null | undefined) {
  const base = rangoBase(l.nombre, l.unidad || "");
  const min = num(cfg?.lolo) ?? num(cfg?.lo) ?? base.min;
  const max = num(cfg?.hihi) ?? num(cfg?.hi) ?? base.max;
  return max > min ? { min, max, unit: base.unit } : base;
}

// ── Etiqueta estable: tipo + (slave × 100 + posición dentro del medidor) ──
function prefijo(nombre: string, unidad: string): string {
  const n = nombre.toLowerCase();
  const u = unidad.toLowerCase();
  if (u === "hz" || n.includes("frecuencia")) return "FT";
  if (n.includes("factor") || n.includes("fp")) return "FP";
  if (u === "kwh" || n.includes("energia")) return "ET";
  if (u === "kw" || u === "kvar" || u === "kva" || n.includes("potencia"))
    return "PT";
  if (u === "a" || n.includes("corriente") || n.includes("current"))
    return "IT";
  if (u === "v" || n.includes("voltaje")) return "VT";
  return "XT";
}

function tag(l: Lectura, slave: number | undefined, posicion: number): string {
  const numero = slave ? slave * 100 + posicion : posicion;
  return `${prefijo(l.nombre, l.unidad || "")}-${numero}`;
}

const TEXTO_CALIDAD: Record<Calidad, string> = {
  ok: "",
  sin_respuesta: "SIN RESPUESTA",
  sin_datos: "SIN DATOS",
  verificando: "VERIFICANDO…",
};

function Faceplate({
  tag,
  label,
  value,
  unit,
  min,
  max,
  alarm,
  calidad,
}: {
  tag: string;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  alarm: "p1" | "p2" | null;
  calidad: Calidad;
}) {
  const conDatos = calidad === "ok";
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
  const valueColor = conDatos ? alarmColor : Colors.textSecondary;
  const texto = calidad === "verificando" ? "---" : value.toFixed(2);

  return (
    <View style={[styles.faceplate, { backgroundColor: alarmBg }]}>
      <Text style={styles.tag}>{tag}</Text>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: valueColor }]}>
        {texto} <Text style={styles.unit}>{unit}</Text>
      </Text>
      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            {
              width: `${conDatos ? pct : 0}%` as any,
              backgroundColor: alarmColor,
            },
          ]}
        />
      </View>
      <View style={styles.barLabels}>
        <Text style={styles.barLabel}>{min}</Text>
        {!conDatos && (
          <Text style={styles.calidad}>{TEXTO_CALIDAD[calidad]}</Text>
        )}
        <Text style={styles.barLabel}>{max}</Text>
      </View>
    </View>
  );
}

export default function Industrial() {
  const [lecturas, setLecturas] = useState<Lectura[]>([]);
  const [alarmas, setAlarmas] = useState<AlarmaActiva[]>([]);
  const [gw, setGw] = useState<GatewayEstado | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [slaves, setSlaves] = useState<Record<number, number>>({});
  const [alarmCfg, setAlarmCfg] = useState<Record<number, AlarmaConfig | null>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");

  // Cada 3 s: lecturas, alarmas activas y estado de la Tinkerboard
  const fetchRapido = useCallback(async () => {
    const [rL, rA, rE] = await Promise.allSettled([
      getMedidoresLecturas(),
      getAlarmasActivas(),
      getGatewayEstado(),
    ]);
    if (rL.status === "fulfilled" && Array.isArray(rL.value.data)) {
      setLecturas(rL.value.data);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } else {
      setError("Sin conexión al servidor");
    }
    if (rA.status === "fulfilled" && Array.isArray(rA.value.data)) {
      setAlarmas(rA.value.data);
    }
    if (rE.status === "fulfilled" && rE.value.data) {
      const d: GatewayEstado = rE.value.data;
      setGw(d);
      if (d.ahora) setOffsetMs(new Date(d.ahora).getTime() - Date.now());
    } else {
      setGw(null);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Cada 30 s: a qué medidor pertenece cada variable y sus límites de alarma
  const fetchLento = useCallback(async () => {
    try {
      const res = await getVariablesActivas();
      const lista: VariableActiva[] = Array.isArray(res.data) ? res.data : [];
      const mapa: Record<number, number> = {};
      lista.forEach((v) => (mapa[v.id] = v.slave_id));
      setSlaves(mapa);

      const cfgs = await Promise.allSettled(
        lista.map((v) => getAlarmaConfig(v.id)),
      );
      const cfgMap: Record<number, AlarmaConfig | null> = {};
      lista.forEach((v, i) => {
        const r = cfgs[i];
        cfgMap[v.id] = r.status === "fulfilled" ? r.value.data : null;
      });
      setAlarmCfg(cfgMap);
    } catch (e) {
      // Se reintenta en el siguiente ciclo
    }
  }, []);

  useEffect(() => {
    fetchRapido();
    fetchLento();
    const rapido = setInterval(fetchRapido, 3000);
    const lento = setInterval(fetchLento, 30000);
    return () => {
      clearInterval(rapido);
      clearInterval(lento);
    };
  }, [fetchRapido, fetchLento]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRapido();
    fetchLento();
  };

  // ── Calidad de cada variable (misma lógica que el dashboard web) ──
  const ahora = Date.now() + offsetMs;
  const fallidas = new Set((gw?.fallidas || []).map(Number));
  const alarmaPorVariable: Record<number, "p1" | "p2"> = {};
  alarmas.forEach((a) => {
    alarmaPorVariable[a.variable_id] = a.prioridad === "P1" ? "p1" : "p2";
  });

  function estadoDe(slave: number | undefined): EstadoMedidor | undefined {
    return slave !== undefined
      ? gw?.bus?.medidores?.[String(slave)]
      : undefined;
  }

  function calidadDe(l: Lectura): Calidad {
    const e = estadoDe(slaves[l.id]);
    if (gw?.conectada && e && (e.detectando || !e.verificado))
      return "verificando";
    if (fallidas.has(l.id)) return "sin_respuesta";
    const ts = l.registrado_en ? new Date(l.registrado_en).getTime() : NaN;
    const reciente =
      Number.isFinite(ts) && (ahora - ts) / 1000 <= UMBRAL_SIN_DATOS_S;
    if (!gw?.conectada || !reciente || num(l.valor) === null)
      return "sin_datos";
    return "ok";
  }

  function estadoMedidor(vars: Lectura[]): { tono: Tono; texto: string } {
    const slave = slaves[vars[0]?.id];
    const e = estadoDe(slave);
    const total = vars.length;
    const ok = vars.filter((v) => !fallidas.has(v.id)).length;
    if (!gw) return { tono: "proceso", texto: "Consultando estado…" };
    if (!gw.conectada)
      return { tono: "error", texto: "Tinkerboard desconectada" };
    if (!e) return { tono: "proceso", texto: "Esperando primera lectura…" };
    if (e.detectando)
      return {
        tono: "proceso",
        texto: `No responde a ${e.baud} bps · buscando velocidad (${e.baud_probando ?? "…"} bps)`,
      };
    if (!e.verificado)
      return { tono: "proceso", texto: `Verificando a ${e.baud} bps…` };
    if (ok === total)
      return {
        tono: "ok",
        texto: `Responde a ${e.baud} bps · ${ok}/${total} variables`,
      };
    if (ok > 0)
      return {
        tono: "aviso",
        texto: `Responde a ${e.baud} bps · ${ok}/${total} variables`,
      };
    return { tono: "error", texto: `No responde a ${e.baud} bps` };
  }

  const colorTono: Record<Tono, string> = {
    ok: Colors.textSecondary,
    aviso: Colors.alarmP2,
    error: Colors.alarmP1,
    proceso: Colors.textPrimary,
  };

  // Agrupar por medidor, ordenando por id para que las etiquetas sean estables
  const porMedidor = [...lecturas]
    .sort((a, b) => a.id - b.id)
    .reduce(
      (acc, l) => {
        const key = l.medidor_nombre || "Sin nombre";
        if (!acc[key]) acc[key] = [];
        acc[key].push(l);
        return acc;
      },
      {} as Record<string, Lectura[]>,
    );

  const estadoGlobal = error
    ? { color: Colors.alarmP1, texto: "● SIN CONEXIÓN AL SERVIDOR" }
    : !gw
      ? { color: Colors.textSecondary, texto: "● CONSULTANDO GATEWAY…" }
      : !gw.conectada
        ? { color: Colors.alarmP1, texto: "● TINKERBOARD DESCONECTADA" }
        : { color: Colors.accent, texto: `● EN LÍNEA · ${lastUpdate}` };

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
        <Text style={[styles.headerSub, { color: estadoGlobal.color }]}>
          {estadoGlobal.texto}
        </Text>
      </View>

      {Object.entries(porMedidor).map(([medidor, vars]) => {
        const st = estadoMedidor(vars);
        const slave = slaves[vars[0]?.id];
        return (
          <View key={medidor}>
            <Text style={styles.groupTitle}>{medidor.toUpperCase()}</Text>
            <Text style={[styles.medidorEstado, { color: colorTono[st.tono] }]}>
              {st.texto}
            </Text>
            <View style={styles.grid}>
              {vars.map((l, idx) => {
                const calidad = calidadDe(l);
                const r = rango(l, alarmCfg[l.id]);
                const valor = calidad === "ok" ? (num(l.valor) ?? 0) : 0;
                const alarm =
                  calidad === "ok" ? (alarmaPorVariable[l.id] ?? null) : null;
                return (
                  <View key={l.id} style={styles.faceplateWrapper}>
                    <Faceplate
                      tag={tag(l, slave, idx + 1)}
                      label={l.nombre}
                      value={valor}
                      unit={l.unidad || r.unit}
                      min={r.min}
                      max={r.max}
                      alarm={alarm}
                      calidad={calidad}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}

      {lecturas.length === 0 && !error && (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Sin lecturas disponibles</Text>
          <Text style={styles.emptySubText}>
            Verifica que el script de lectura esté corriendo en la Tinkerboard
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
    letterSpacing: 1,
  },
  medidorEstado: {
    fontSize: 9,
    fontFamily: "monospace",
    paddingHorizontal: 10,
    paddingTop: 2,
    paddingBottom: 4,
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
    alignItems: "center",
    marginTop: 2,
  },
  barLabel: {
    fontSize: 8,
    color: Colors.textSecondary,
    fontFamily: "monospace",
  },
  calidad: {
    fontSize: 8,
    fontFamily: "monospace",
    fontWeight: "bold",
    color: Colors.textSecondary,
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