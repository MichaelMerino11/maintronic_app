import axios from "axios";

// IP del servidor en la VPN ZeroTier (PC de Michelle)
const API_BASE = "http://10.22.38.25:3000/api";

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
export const getVariablesActivas = () =>
  api.get("/medidores/variables/activas");
export const getAlarmasActivas = () =>
  api.get("/medidores/alarmas/log/activas");
export const getAlarmaConfig = (variableId: number) =>
  api.get(`/medidores/variables/${variableId}/alarma`);

// ── GATEWAY (Tinkerboard) ──
export const getGatewayEstado = () => api.get("/gateway/estado");

export default api;