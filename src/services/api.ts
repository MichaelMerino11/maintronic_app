import axios from "axios";

// IP DE MICHELLE O MAIKI AQUI
const API_BASE = "http://192.168.18.15:3000/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
});

// ── SOLAR ──
export const getSolarUltimo = () => api.get("/solar/ultimo?dispositivo_id=2");

// ── INDUSTRIAL ──
export const getIndustrialUltimo = () =>
  api.get("/industrial/ultimo?dispositivo_id=3");

// ── MEDIDORES ──
export const getMedidoresLecturas = () => api.get("/medidores/lecturas/ultimo");

export const getAlarmasActivas = () =>
  api.get("/medidores/alarmas/log/activas");

export default api;