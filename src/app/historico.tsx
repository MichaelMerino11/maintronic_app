import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import Svg, {
  Polyline,
  Path,
  Line,
  Circle,
  Text as SvgText,
} from "react-native-svg";
import { useLocalSearchParams } from "expo-router";
import { Colors } from "../theme/colors";
import {
  getVariablesActivas,
  getSerieVariable,
  getAlarmaConfig,
  getAlarmasHistorico,
} from "../services/api";

interface Variable {
  id: number;
  nombre: string;
  unidad: string | null;
  medidor_nombre: string;
  slave_id: number;
}

interface Punto {
  t: string;
  promedio: number | string;
  minimo: number | string;
  maximo: number | string;
  n: number;
}

interface AlarmaConfig {
  lolo: number | string | null;
  lo: number | string | null;
  hi: number | string | null;
  hihi: number | string | null;
}

interface EventoAlarma {
  id: number;
  tipo: string;
  prioridad: "P1" | "P2";
  valor: number | string;
  activa: number;
  inicio_en: string;
  fin_en: string | null;
}

const PERIODOS = [
  { label: "1 h", horas: 1 },
  { label: "6 h", horas: 6 },
  { label: "24 h", horas: 24 },
  { label: "7 d", horas: 168 },
];

function num(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function hora(iso: string, horas: number): string {
  const d = new Date(iso);
  return horas > 24
    ? d.toLocaleDateString([], { day: "2-digit", month: "2-digit" }) +
        " " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmt(v: number | null, dec = 2): string {
  return v === null ? "---" : v.toFixed(dec);
}

// ── Gráfica: promedio (línea), mínimo–máximo (banda) y límites de alarma ──
function Grafica({
  puntos,
  ancho,
  alto,
  cfg,
  horas,
}: {
  puntos: Punto[];
  ancho: number;
  alto: number;
  cfg: AlarmaConfig | null;
  horas: number;
}) {
  const pad = { l: 44, r: 10, t: 10, b: 22 };
  const datos = puntos
    .map((p) => ({
      t: p.t,
      avg: num(p.promedio),
      min: num(p.minimo),
      max: num(p.maximo),
    }))
    .filter((p) => p.avg !== null) as {
    t: string;
    avg: number;
    min: number;
    max: number;
  }[];

  if (!datos.length) {
    return (
      <View style={[styles.graficaVacia, { height: alto }]}>
        <Text style={styles.vacioTexto}>Sin lecturas en este periodo</Text>
      </View>
    );
  }

  const limites = [
    { v: num(cfg?.hihi), color: Colors.alarmP1 },
    { v: num(cfg?.hi), color: Colors.alarmP2 },
    { v: num(cfg?.lo), color: Colors.alarmP2 },
    { v: num(cfg?.lolo), color: Colors.alarmP1 },
  ].filter((l) => l.v !== null) as { v: number; color: string }[];

  let yMin = Math.min(...datos.map((d) => d.min), ...limites.map((l) => l.v));
  let yMax = Math.max(...datos.map((d) => d.max), ...limites.map((l) => l.v));
  if (yMax - yMin < 1e-6) {
    yMin -= 1;
    yMax += 1;
  }
  const margen = (yMax - yMin) * 0.08;
  yMin -= margen;
  yMax += margen;

  const w = ancho - pad.l - pad.r;
  const h = alto - pad.t - pad.b;
  const x = (i: number) =>
    pad.l + (datos.length === 1 ? w / 2 : (i / (datos.length - 1)) * w);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * h;

  const linea = datos.map((d, i) => `${x(i)},${y(d.avg)}`).join(" ");
  const banda =
    datos.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.max)}`).join(" ") +
    " " +
    [...datos]
      .map((d, i) => ({ d, i }))
      .reverse()
      .map(({ d, i }) => `L${x(i)},${y(d.min)}`)
      .join(" ") +
    " Z";

  const ticks = [yMax - margen, (yMax + yMin) / 2, yMin + margen];

  return (
    <Svg width={ancho} height={alto}>
      {ticks.map((v, i) => (
        <Line
          key={`g${i}`}
          x1={pad.l}
          x2={ancho - pad.r}
          y1={y(v)}
          y2={y(v)}
          stroke={Colors.cardBorder}
          strokeWidth={1}
        />
      ))}
      {ticks.map((v, i) => (
        <SvgText
          key={`t${i}`}
          x={pad.l - 4}
          y={y(v) + 3}
          fontSize={9}
          fontFamily="monospace"
          fill={Colors.textSecondary}
          textAnchor="end"
        >
          {v.toFixed(1)}
        </SvgText>
      ))}

      <Path d={banda} fill={Colors.textSecondary} opacity={0.18} />

      {limites.map((l, i) => (
        <Line
          key={`l${i}`}
          x1={pad.l}
          x2={ancho - pad.r}
          y1={y(l.v)}
          y2={y(l.v)}
          stroke={l.color}
          strokeWidth={1}
          strokeDasharray="5 4"
        />
      ))}

      {datos.length === 1 ? (
        <Circle cx={x(0)} cy={y(datos[0].avg)} r={3} fill="#1a1a2e" />
      ) : (
        <Polyline
          points={linea}
          fill="none"
          stroke="#1a1a2e"
          strokeWidth={1.8}
        />
      )}

      <SvgText
        x={pad.l}
        y={alto - 6}
        fontSize={9}
        fontFamily="monospace"
        fill={Colors.textSecondary}
      >
        {hora(datos[0].t, horas)}
      </SvgText>
      <SvgText
        x={ancho - pad.r}
        y={alto - 6}
        fontSize={9}
        fontFamily="monospace"
        fill={Colors.textSecondary}
        textAnchor="end"
      >
        {hora(datos[datos.length - 1].t, horas)}
      </SvgText>
    </Svg>
  );
}

export default function Historico() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { width } = useWindowDimensions();

  const [variables, setVariables] = useState<Variable[]>([]);
  const [varId, setVarId] = useState<number | null>(
    params.id ? Number(params.id) : null,
  );
  const [horas, setHoras] = useState(1);
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [cfg, setCfg] = useState<AlarmaConfig | null>(null);
  const [eventos, setEventos] = useState<EventoAlarma[]>([]);
  const [cargando, setCargando] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si se abre desde una tarjeta de Industrial, seleccionar esa variable
  useEffect(() => {
    if (params.id) setVarId(Number(params.id));
  }, [params.id]);

  useEffect(() => {
    getVariablesActivas()
      .then((res) => {
        const lista: Variable[] = Array.isArray(res.data) ? res.data : [];
        setVariables(lista);
        setVarId((actual) => actual ?? lista[0]?.id ?? null);
      })
      .catch(() => setError("Sin conexión al servidor"));
  }, []);

  const cargar = useCallback(async () => {
    if (varId === null) return;
    setCargando(true);
    const [rS, rC, rE] = await Promise.allSettled([
      getSerieVariable(varId, horas),
      getAlarmaConfig(varId),
      getAlarmasHistorico(varId, horas),
    ]);
    if (rS.status === "fulfilled" && Array.isArray(rS.value.data?.puntos)) {
      setPuntos(rS.value.data.puntos);
      setError(null);
    } else {
      setPuntos([]);
      setError("No se pudo cargar el histórico");
    }
    setCfg(rC.status === "fulfilled" ? rC.value.data : null);
    setEventos(
      rE.status === "fulfilled" && Array.isArray(rE.value.data)
        ? rE.value.data
        : [],
    );
    setCargando(false);
    setRefreshing(false);
  }, [varId, horas]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const variable = variables.find((v) => v.id === varId);
  const unidad = variable?.unidad || "";

  // Estadísticas del periodo
  const mins = puntos
    .map((p) => num(p.minimo))
    .filter((v): v is number => v !== null);
  const maxs = puntos
    .map((p) => num(p.maximo))
    .filter((v): v is number => v !== null);
  const total = puntos.reduce((s, p) => s + (Number(p.n) || 0), 0);
  const suma = puntos.reduce(
    (s, p) => s + (num(p.promedio) ?? 0) * (Number(p.n) || 0),
    0,
  );
  const stats = {
    min: mins.length ? Math.min(...mins) : null,
    max: maxs.length ? Math.max(...maxs) : null,
    prom: total ? suma / total : null,
  };

  // Variables agrupadas por medidor para el selector
  const porMedidor = variables.reduce(
    (acc, v) => {
      (acc[v.medidor_nombre] = acc[v.medidor_nombre] || []).push(v);
      return acc;
    },
    {} as Record<string, Variable[]>,
  );

  return (
    <ScrollView
      style={styles.scroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            cargar();
          }}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>HISTÓRICO · MEDIDORES RS-485</Text>
        <Text
          style={[styles.headerSub, error ? { color: Colors.alarmP1 } : null]}
        >
          {error
            ? `● ${error}`
            : variable
              ? `${variable.medidor_nombre} · ${variable.nombre}`
              : "Selecciona una variable"}
        </Text>
      </View>

      {Object.entries(porMedidor).map(([medidor, vars]) => (
        <View key={medidor}>
          <Text style={styles.groupTitle}>{medidor.toUpperCase()}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {vars.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => setVarId(v.id)}
                style={[styles.chip, v.id === varId && styles.chipActivo]}
                accessibilityRole="button"
                accessibilityState={{ selected: v.id === varId }}
              >
                <Text
                  style={[
                    styles.chipTexto,
                    v.id === varId && styles.chipTextoActivo,
                  ]}
                >
                  {v.nombre}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ))}

      <View style={styles.periodos}>
        {PERIODOS.map((p) => (
          <Pressable
            key={p.horas}
            onPress={() => setHoras(p.horas)}
            style={[styles.periodo, p.horas === horas && styles.chipActivo]}
            accessibilityRole="button"
            accessibilityState={{ selected: p.horas === horas }}
          >
            <Text
              style={[
                styles.chipTexto,
                p.horas === horas && styles.chipTextoActivo,
              ]}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>
          {variable ? `${variable.nombre} (${unidad || "—"})` : "—"}
        </Text>
        {cargando && !puntos.length ? (
          <View style={[styles.graficaVacia, { height: 200 }]}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : (
          <Grafica
            puntos={puntos}
            ancho={width - 36}
            alto={200}
            cfg={cfg}
            horas={horas}
          />
        )}
        <Text style={styles.leyenda}>
          Línea: promedio · Banda gris: mínimo y máximo · Líneas punteadas:
          límites de alarma
        </Text>
      </View>

      <View style={styles.statsFila}>
        {[
          { label: "MÍN", valor: fmt(stats.min) },
          { label: "MÁX", valor: fmt(stats.max) },
          { label: "PROM", valor: fmt(stats.prom) },
          { label: "LECTURAS", valor: total ? String(total) : "---" },
        ].map((s) => (
          <View key={s.label} style={styles.stat}>
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={styles.statValor}>{s.valor}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.groupTitle}>ALARMAS DEL PERIODO</Text>
      {eventos.length === 0 ? (
        <Text style={styles.sinEventos}>Sin alarmas en este periodo</Text>
      ) : (
        eventos.map((e) => (
          <View
            key={e.id}
            style={[
              styles.evento,
              {
                borderLeftColor:
                  e.prioridad === "P1" ? Colors.alarmP1 : Colors.alarmP2,
              },
            ]}
          >
            <Text
              style={[
                styles.eventoTipo,
                {
                  color: e.prioridad === "P1" ? Colors.alarmP1 : Colors.alarmP2,
                },
              ]}
            >
              {e.prioridad} · {e.tipo} · {fmt(num(e.valor))} {unidad}
            </Text>
            <Text style={styles.eventoHora}>
              {hora(e.inicio_en, 168)} →{" "}
              {e.activa ? "ACTIVA" : e.fin_en ? hora(e.fin_en, 168) : "—"}
            </Text>
          </View>
        ))
      )}

      <Text style={styles.norma}>
        ANSI/ISA-101.01-2015 · MAINTRONIC · UDLA 2026
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: "#1a1a2e", padding: 12, marginBottom: 4 },
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
  chips: { paddingHorizontal: 8, gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
  },
  chipActivo: { backgroundColor: "#1a1a2e", borderColor: "#1a1a2e" },
  chipTexto: {
    fontSize: 11,
    fontFamily: "monospace",
    color: Colors.textPrimary,
  },
  chipTextoActivo: { color: "#fff", fontWeight: "bold" },
  periodos: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
    paddingTop: 12,
  },
  periodo: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 4,
    paddingVertical: 8,
    minHeight: 36,
    justifyContent: "center",
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 4,
    margin: 8,
    padding: 10,
  },
  cardTitulo: {
    fontSize: 11,
    fontFamily: "monospace",
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  graficaVacia: { alignItems: "center", justifyContent: "center" },
  vacioTexto: {
    fontSize: 11,
    fontFamily: "monospace",
    color: Colors.textSecondary,
  },
  leyenda: {
    fontSize: 8,
    fontFamily: "monospace",
    color: Colors.textSecondary,
    marginTop: 6,
  },
  statsFila: { flexDirection: "row", gap: 6, paddingHorizontal: 8 },
  stat: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 4,
    padding: 8,
  },
  statLabel: {
    fontSize: 8,
    fontFamily: "monospace",
    color: Colors.textSecondary,
  },
  statValor: {
    fontSize: 14,
    fontFamily: "monospace",
    fontWeight: "bold",
    color: Colors.textPrimary,
    marginTop: 2,
  },
  sinEventos: {
    fontSize: 11,
    fontFamily: "monospace",
    color: Colors.textSecondary,
    paddingHorizontal: 10,
  },
  evento: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderLeftWidth: 4,
    borderRadius: 4,
    marginHorizontal: 8,
    marginBottom: 6,
    padding: 8,
  },
  eventoTipo: { fontSize: 11, fontFamily: "monospace", fontWeight: "bold" },
  eventoHora: {
    fontSize: 10,
    fontFamily: "monospace",
    color: Colors.textSecondary,
    marginTop: 2,
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