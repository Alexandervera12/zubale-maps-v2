import { useState, useCallback, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polygon, Polyline } from "@react-google-maps/api";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection } from "firebase/firestore";

// ── Firebase ──────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyCdY8bdceRG1XMhdomKZ2cpC_4a8ORrt_Q",
  authDomain: "zubale-maps.firebaseapp.com",
  projectId: "zubale-maps",
  storageBucket: "zubale-maps.firebasestorage.app",
  messagingSenderId: "509798983507",
  appId: "1:509798983507:web:0753320736901e2d93a3a6"
};
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// ── Paleta de ventanas ────────────────────────────────────────────
const VENTANA_PALETTE = {
  "V9":"#3b82f6","V10":"#f97316","V11":"#22c55e","V12":"#a855f7",
  "V13":"#ef4444","V14":"#14b8a6","V15":"#f59e0b","V16":"#ec4899",
  "V17":"#6366f1","V18":"#84cc16","V19":"#06b6d4","V20":"#f43f5e",
};
const VENTANAS = Object.keys(VENTANA_PALETTE);

const ROUTE_COLORS = [
  "#3b82f6","#22c55e","#f97316","#a855f7","#ef4444",
  "#14b8a6","#f59e0b","#ec4899","#6366f1","#84cc16",
  "#06b6d4","#f43f5e","#8b5cf6","#10b981","#fb923c",
];

// ── Pins ──────────────────────────────────────────────────────────
function makePinSvg(hex, taken = false) {
  const c = taken ? "#64748b" : (hex || "#3b82f6");
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30">
        <path d="M11 0C4.93 0 0 4.93 0 11C0 19.25 11 30 11 30S22 19.25 22 11C22 4.93 17.07 0 11 0Z" fill="${c}" opacity="${taken ? 0.4 : 1}"/>
        <circle cx="11" cy="11" r="4.5" fill="white" opacity="0.9"/>
        ${taken ? `<line x1="7" y1="7" x2="15" y2="15" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>` : ""}
      </svg>`
    )}`,
    scaledSize: { width: 22, height: 30 },
    anchor: { x: 11, y: 30 },
  };
}

function makeNumberPin(hex, num, taken = false) {
  const c = taken ? "#64748b" : (hex || "#3b82f6");
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
        <path d="M13 0C5.82 0 0 5.82 0 13C0 22.75 13 34 13 34S26 22.75 26 13C26 5.82 20.18 0 13 0Z" fill="${c}" opacity="${taken ? 0.4 : 1}"/>
        <circle cx="13" cy="13" r="8" fill="white" opacity="0.95"/>
        <text x="13" y="17" text-anchor="middle" font-size="10" font-weight="700" fill="${c}" font-family="sans-serif">${num}</text>
      </svg>`
    )}`,
    scaledSize: { width: 26, height: 34 },
    anchor: { x: 13, y: 34 },
  };
}

// ── Mapa ──────────────────────────────────────────────────────────
const MAP_CENTER = { lat: -33.47, lng: -70.64 };
const MAP_STYLE_DARK = [
  { elementType: "geometry", stylers: [{ color: "#1a1f2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1f2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a3044" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3b4460" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];
const MAP_STYLE_LIGHT = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

// ── Algoritmo de ruteo ────────────────────────────────────────────
function dist(a, b) {
  return Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
}

function generateRoutes(orders, batchSize) {
  const remaining = [...orders];
  const routes = [];
  let ci = 0;
  while (remaining.length > 0) {
    const seed = remaining.shift();
    const route = [seed];
    while (route.length < batchSize && remaining.length > 0) {
      const cLat = route.reduce((s, o) => s + o.lat, 0) / route.length;
      const cLng = route.reduce((s, o) => s + o.lng, 0) / route.length;
      let bi = 0, bd = Infinity;
      remaining.forEach((o, i) => {
        const d = dist(o, { lat: cLat, lng: cLng });
        if (d < bd) { bd = d; bi = i; }
      });
      route.push(remaining.splice(bi, 1)[0]);
    }
    routes.push({
      id: `Ruta ${routes.length + 1}`,
      window: orders[0]?.window,
      color: ROUTE_COLORS[ci % ROUTE_COLORS.length],
      orders: route,
      hidden: false,
    });
    ci++;
  }
  return routes;
}

function convexHull(points) {
  if (points.length < 3) return points;
  const pts = [...points].sort((a, b) => a.lat - b.lat || a.lng - b.lng);
  const cross = (o, a, b) => (a.lat - o.lat) * (b.lng - o.lng) - (a.lng - o.lng) * (b.lat - o.lat);
  const lo = [], hi = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length-2], lo[lo.length-1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length-1; i >= 0; i--) { const p = pts[i]; while (hi.length >= 2 && cross(hi[hi.length-2], hi[hi.length-1], p) <= 0) hi.pop(); hi.push(p); }
  hi.pop(); lo.pop();
  return lo.concat(hi);
}

function expandHull(points) {
  if (points.length < 2) return points;
  const cLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const cLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  return points.map(p => ({
    lat: cLat + (p.lat - cLat) * 1.35 + (p.lat > cLat ? 0.001 : -0.001),
    lng: cLng + (p.lng - cLng) * 1.35 + (p.lng > cLng ? 0.001 : -0.001),
  }));
}

function getTodayKey() {
  return new Date().toISOString().split("T")[0];
}

const MOCK_DATA = [
  { id: "SG-001", address: "Av. Providencia 1234, Providencia", window: "V9",  lat: -33.432, lng: -70.608 },
  { id: "SG-002", address: "Av. Apoquindo 4500, Las Condes",    window: "V10", lat: -33.415, lng: -70.580 },
];

// ── App principal ─────────────────────────────────────────────────
export default function App() {
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const SHEETS_URL          = import.meta.env.VITE_SHEETS_URL;

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });

  // Datos
  const [data, setData]         = useState(MOCK_DATA);
  const [loading, setLoading]   = useState(false);
  const [lastSync, setLastSync] = useState(null);

  // Navegación
  const [mode, setMode] = useState("mapa");

  // Mapa tradicional
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);
  const [darkMap, setDarkMap]   = useState(true);
  const [hideTaken, setHideTaken] = useState(false);

  // Firebase estados
  const [takenIds, setTakenIds] = useState(new Set());

  // Ruteo
  const [selectedWindow, setSelectedWindow] = useState(null);
  const [batchSize, setBatchSize]           = useState(3);
  const [routes, setRoutes]                 = useState([]);
  const [activeRoute, setActiveRoute]       = useState(null);

  const mapRef = useRef(null);
  const onLoad = useCallback(map => { mapRef.current = map; }, []);

  // ── Fetch Sheets ──────────────────────────────────────────────
  const fetchSheets = useCallback(async () => {
    if (!SHEETS_URL) return;
    setLoading(true);
    try {
      const res  = await fetch(SHEETS_URL);
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        const clean = json.filter(d =>
          d.id && d.address && d.window &&
          typeof d.lat === "number" && !isNaN(d.lat) &&
          typeof d.lng === "number" && !isNaN(d.lng) &&
          d.lat !== 0 && d.lng !== 0
        );
        setData(clean);
        setLastSync(new Date().toLocaleTimeString("es-CL"));
      }
    } catch (e) { console.error("Error Sheets:", e); }
    finally { setLoading(false); }
  }, [SHEETS_URL]);

  useEffect(() => {
    fetchSheets();
    const iv = setInterval(fetchSheets, 60_000);
    return () => clearInterval(iv);
  }, [fetchSheets]);

  // ── Firebase listener ─────────────────────────────────────────
  useEffect(() => {
    const colRef = collection(db, "taken", getTodayKey(), "orders");
    const unsub = onSnapshot(colRef, snap => {
      const ids = new Set();
      snap.forEach(d => ids.add(d.id));
      setTakenIds(ids);
    });
    return () => unsub();
  }, []);

  // ── Marcar/desmarcar tomado ───────────────────────────────────
  async function toggleTaken(id) {
    const docRef = doc(db, "taken", getTodayKey(), "orders", id);
    if (takenIds.has(id)) await deleteDoc(docRef);
    else await setDoc(docRef, { takenAt: new Date().toISOString() });
    setSelected(null);
  }

  // ── Reset modo al cambiar ─────────────────────────────────────
  useEffect(() => { setSelected(null); setActiveRoute(null); }, [mode]);

  // ── Filtros mapa tradicional ──────────────────────────────────
  const filtered = data.filter(d => {
    const matchFilter = filter === "all" || d.window === filter;
    const q = search.toLowerCase();
    const matchSearch = d.id.toLowerCase().includes(q) || d.address.toLowerCase().includes(q);
    const matchHidden = hideTaken ? !takenIds.has(d.id) : true;
    return matchFilter && matchSearch && matchHidden;
  });

  const countByWindow = VENTANAS.reduce((acc, v) => {
    acc[v] = filtered.filter(d => d.window === v).length;
    return acc;
  }, {});

  const takenCount = data.filter(d => takenIds.has(d.id)).length;

  const windowCounts = VENTANAS.reduce((acc, v) => {
    acc[v] = data.filter(d => d.window === v).length;
    return acc;
  }, {});

  // ── Ruteo ─────────────────────────────────────────────────────
  function handleGenerate() {
    if (!selectedWindow) return;
    const windowOrders = data.filter(d => d.window === selectedWindow);
    const r = generateRoutes(windowOrders, batchSize);
    setRoutes(r);
    setActiveRoute(null);
    if (mapRef.current && windowOrders.length > 0) {
      mapRef.current.panTo({ lat: windowOrders[0].lat, lng: windowOrders[0].lng });
      mapRef.current.setZoom(13);
    }
  }

  function toggleHideRoute(routeId) {
    setRoutes(prev => prev.map(r => r.id === routeId ? { ...r, hidden: !r.hidden } : r));
  }

  // ── Estilos dinámicos ─────────────────────────────────────────
  const dark     = darkMap;
  const border   = dark ? "#1e2433" : "#e2e8f0";
  const textPri  = dark ? "#f1f5f9" : "#0f172a";
  const textMut  = dark ? "#64748b" : "#94a3b8";
  const inputBg  = dark ? "#1e2436" : "#f8fafc";
  const inputBdr = dark ? "#2a3044" : "#cbd5e1";
  const sideBg   = dark ? "#151820" : "#ffffff";
  const appBg    = dark ? "#0f1117" : "#f1f5f9";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: appBg, fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Barra navegación ──────────────────────────────────── */}
      <div style={{ height: 48, background: dark ? "#151820" : "#ffffff", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 4, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 16 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22d3ee" }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: textPri }}>Zubale Zones</span>
          <span style={{ fontSize: 11, padding: "1px 7px", borderRadius: 10, background: "#1e0535", color: "#d8b4fe", fontWeight: 600 }}>V2L</span>
        </div>

        {["mapa", "ruteo"].map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 500,
            background: mode === m ? (dark ? "#1e2436" : "#f1f5f9") : "transparent",
            color: mode === m ? textPri : textMut,
            borderBottom: mode === m ? "2px solid #3b82f6" : "2px solid transparent",
          }}>
            {m === "mapa" ? "Mapa" : "Ruteo"}
          </button>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {SHEETS_URL && (
            <span onClick={fetchSheets} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: loading ? "#2c1006" : "#0c1d35", color: loading ? "#fdba74" : "#93c5fd", fontWeight: 500, cursor: "pointer" }}>
              {loading ? "⟳ Cargando..." : lastSync ? `⟳ ${lastSync}` : "⟳ Live"}
            </span>
          )}
          <button onClick={() => setDarkMap(d => !d)} style={{ background: inputBg, border: `1px solid ${inputBdr}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500, color: textMut }}>
            {dark ? "☀ Claro" : "☾ Oscuro"}
          </button>
        </div>
      </div>

      {/* ── Contenido ─────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── SIDEBAR ─────────────────────────────────────────── */}
        <aside style={{ width: 290, minWidth: 290, background: sideBg, borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {mode === "mapa" ? (
            <>
              {/* Toggle ocultar tomados */}
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: textPri }}>Ocultar tomados</div>
                  <div style={{ fontSize: 11, color: textMut }}>{takenCount} de {data.length} tomados hoy</div>
                </div>
                <div onClick={() => setHideTaken(h => !h)} style={{ width: 44, height: 24, borderRadius: 12, cursor: "pointer", position: "relative", transition: "background 0.2s", background: hideTaken ? "#3b82f6" : (dark ? "#2a3044" : "#cbd5e1") }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, transition: "left 0.2s", left: hideTaken ? 23 : 3 }} />
                </div>
              </div>

              {/* Search */}
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}` }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por ID o dirección..."
                  style={{ width: "100%", background: inputBg, border: `1px solid ${inputBdr}`, color: textPri, fontSize: 13, padding: "8px 12px", borderRadius: 8, outline: "none", boxSizing: "border-box" }} />
              </div>

              {/* Filtro ventana */}
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}` }}>
                <p style={{ fontSize: 11, color: textMut, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ventana de entrega</p>
                <select value={filter} onChange={e => setFilter(e.target.value)}
                  style={{ width: "100%", background: inputBg, border: `1px solid ${inputBdr}`, color: textPri, fontSize: 13, padding: "8px 12px", borderRadius: 8, outline: "none", cursor: "pointer", boxSizing: "border-box" }}>
                  <option value="all">Todas las ventanas</option>
                  {VENTANAS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>

              {/* Leyenda */}
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}` }}>
                <p style={{ fontSize: 11, color: textMut, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Leyenda — clic para filtrar</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 6px" }}>
                  {VENTANAS.map(v => (
                    <div key={v} onClick={() => setFilter(filter === v ? "all" : v)}
                      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", padding: "4px 7px", borderRadius: 6, background: filter === v ? VENTANA_PALETTE[v] + "22" : "transparent", border: `1px solid ${filter === v ? VENTANA_PALETTE[v] + "66" : "transparent"}` }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: VENTANA_PALETTE[v], flexShrink: 0 }} />
                      <span style={{ fontWeight: filter === v ? 600 : 400, color: filter === v ? VENTANA_PALETTE[v] : textMut }}>{v}</span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: textMut }}>{countByWindow[v] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Lista */}
              <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                <div style={{ padding: "4px 8px 8px", fontSize: 11, color: textMut }}>Total: {filtered.length} registros</div>
                {filtered.length === 0
                  ? <p style={{ textAlign: "center", color: textMut, fontSize: 13, padding: 20 }}>Sin resultados</p>
                  : filtered.map(d => {
                    const taken = takenIds.has(d.id);
                    return (
                      <div key={d.id} onClick={() => goTo(d)}
                        style={{ padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 3, opacity: taken ? 0.45 : 1, border: `1px solid ${selected?.id === d.id ? VENTANA_PALETTE[d.window] : "transparent"}`, background: selected?.id === d.id ? VENTANA_PALETTE[d.window] + "15" : "transparent", transition: "all 0.15s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: taken ? textMut : textPri, textDecoration: taken ? "line-through" : "none" }}>{d.id}</span>
                          <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600, background: taken ? (dark ? "#1e2436" : "#f1f5f9") : VENTANA_PALETTE[d.window] + "28", color: taken ? "#475569" : VENTANA_PALETTE[d.window] }}>
                            {taken ? "Tomado" : d.window}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: textMut, lineHeight: 1.4 }}>{d.address}</div>
                      </div>
                    );
                  })
                }
              </div>
            </>
          ) : (
            <>
              {/* Paso 1: Ventana */}
              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${border}` }}>
                <p style={{ fontSize: 11, color: textMut, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Paso 1 — Ventana de entrega</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                  {VENTANAS.filter(v => windowCounts[v] > 0).map(v => (
                    <button key={v} onClick={() => { setSelectedWindow(v); setRoutes([]); setActiveRoute(null); }}
                      style={{ padding: "8px 6px", borderRadius: 6, border: `1px solid ${selectedWindow === v ? VENTANA_PALETTE[v] : border}`, background: selectedWindow === v ? VENTANA_PALETTE[v] : "transparent", color: selectedWindow === v ? "#fff" : textMut, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                      {v} <span style={{ opacity: 0.75, fontSize: 10 }}>({windowCounts[v]})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Paso 2: Batch */}
              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${border}` }}>
                <p style={{ fontSize: 11, color: textMut, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Paso 2 — Pedidos por ruta</p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setBatchSize(b => Math.max(2, b - 1))} style={{ width: 30, height: 30, borderRadius: 6, background: inputBg, border: `1px solid ${inputBdr}`, color: textMut, fontSize: 18, cursor: "pointer" }}>−</button>
                  <span style={{ fontSize: 24, fontWeight: 600, color: textPri, minWidth: 32, textAlign: "center" }}>{batchSize}</span>
                  <button onClick={() => setBatchSize(b => Math.min(10, b + 1))} style={{ width: 30, height: 30, borderRadius: 6, background: inputBg, border: `1px solid ${inputBdr}`, color: textMut, fontSize: 18, cursor: "pointer" }}>+</button>
                  <span style={{ fontSize: 12, color: textMut }}>pedidos por ruta</span>
                </div>
              </div>

              {/* Paso 3: Generar */}
              <div style={{ padding: "12px 14px", borderBottom: `1px solid ${border}` }}>
                <button onClick={handleGenerate} disabled={!selectedWindow}
                  style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", cursor: selectedWindow ? "pointer" : "default", fontSize: 13, fontWeight: 500, color: "#fff", background: selectedWindow ? VENTANA_PALETTE[selectedWindow] : "#334155" }}>
                  {selectedWindow ? `Generar rutas para ${selectedWindow}` : "Selecciona una ventana primero"}
                </button>
              </div>

              {/* Lista rutas con toggle ocultar */}
              <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
                {routes.length === 0 ? (
                  <div style={{ textAlign: "center", color: textMut, fontSize: 13, padding: "24px 16px", lineHeight: 1.6 }}>
                    Selecciona una ventana y genera las rutas
                  </div>
                ) : (
                  <>
                    <div style={{ padding: "4px 8px 8px", fontSize: 11, color: textMut }}>
                      {routes.length} rutas · {routes.reduce((s, r) => s + r.orders.length, 0)} pedidos
                    </div>
                    {routes.map(r => (
                      <div key={r.id}
                        style={{ borderRadius: 8, border: `1.5px solid ${activeRoute === r.id ? r.color : border}`, marginBottom: 5, overflow: "hidden", background: r.hidden ? (dark ? "#0f1117" : "#f8fafc") : (activeRoute === r.id ? r.color + "10" : "transparent"), opacity: r.hidden ? 0.5 : 1 }}>

                        <div style={{ padding: "8px 10px", display: "flex", alignItems: "center", gap: 7 }}>
                          {/* Color dot + nombre — clic para activar */}
                          <div onClick={() => setActiveRoute(activeRoute === r.id ? null : r.id)} style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, cursor: "pointer" }}>
                            <div style={{ width: 10, height: 10, borderRadius: "50%", background: r.hidden ? "#475569" : r.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: r.hidden ? textMut : textPri }}>{r.id}</span>
                            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600, background: r.color + "25", color: r.color }}>{r.orders.length} stops</span>
                          </div>

                          {/* Toggle ocultar ruta */}
                          <div
                            onClick={() => toggleHideRoute(r.id)}
                            title={r.hidden ? "Mostrar ruta" : "Ocultar ruta"}
                            style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s", background: r.hidden ? (dark ? "#2a3044" : "#cbd5e1") : r.color + "99" }}>
                            <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, transition: "left 0.2s", left: r.hidden ? 3 : 19 }} />
                          </div>
                        </div>

                        {/* Stops — solo si está expandida y no oculta */}
                        {activeRoute === r.id && !r.hidden && (
                          <div style={{ padding: "0 10px 8px" }}>
                            {r.orders.map((o, i) => {
                              const taken = takenIds.has(o.id);
                              return (
                                <div key={o.id} style={{ fontSize: 11, color: taken ? "#475569" : textMut, padding: "2px 0", display: "flex", gap: 5, alignItems: "center" }}>
                                  <span style={{ color: "#475569", fontWeight: 500, width: 14, flexShrink: 0 }}>{i + 1}.</span>
                                  <span style={{ textDecoration: taken ? "line-through" : "none" }}>{o.id}</span>
                                  {taken && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 6, background: "#1e2436", color: "#475569" }}>Tomado</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </aside>

        {/* ── MAPA ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, position: "relative" }}>
          {!isLoaded
            ? <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>Cargando mapa...</div>
            : (
              <GoogleMap
                mapContainerStyle={{ width: "100%", height: "100%" }}
                center={MAP_CENTER} zoom={11} onLoad={onLoad}
                options={{ styles: dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT, zoomControl: true }}
              >
                {/* ── Modo MAPA ── */}
                {mode === "mapa" && filtered.map(d => (
                  <Marker key={d.id} position={{ lat: d.lat, lng: d.lng }}
                    icon={makePinSvg(VENTANA_PALETTE[d.window], takenIds.has(d.id))}
                    onClick={() => setSelected(d)} />
                ))}

                {mode === "mapa" && selected && (
                  <InfoWindow position={{ lat: selected.lat, lng: selected.lng }} onCloseClick={() => setSelected(null)}>
                    <div style={{ fontFamily: "sans-serif", minWidth: 180, padding: 4 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#0f172a" }}>{selected.id}</p>
                      <p style={{ fontSize: 12, color: "#475569", marginBottom: 10, lineHeight: 1.4 }}>{selected.address}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, fontWeight: 600, background: VENTANA_PALETTE[selected.window] + "25", color: VENTANA_PALETTE[selected.window] }}>{selected.window}</span>
                        <button onClick={() => toggleTaken(selected.id)}
                          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, fontWeight: 600, cursor: "pointer", border: "none", background: takenIds.has(selected.id) ? "#dcfce7" : "#fee2e2", color: takenIds.has(selected.id) ? "#15803d" : "#b91c1c" }}>
                          {takenIds.has(selected.id) ? "✓ Desmarcar" : "Marcar tomado"}
                        </button>
                      </div>
                    </div>
                  </InfoWindow>
                )}

                {/* ── Modo RUTEO ── */}
                {mode === "ruteo" && routes.filter(r => !r.hidden).map(r => {
                  const hull = convexHull(r.orders);
                  const expanded = expandHull(hull);
                  const isActive = activeRoute === r.id;
                  return (
                    <div key={r.id}>
                      {expanded.length >= 3 && (
                        <Polygon
                          paths={expanded}
                          options={{ fillColor: r.color, fillOpacity: isActive ? 0.25 : 0.1, strokeColor: r.color, strokeOpacity: isActive ? 1 : 0.5, strokeWeight: isActive ? 2.5 : 1.5 }}
                          onClick={() => setActiveRoute(activeRoute === r.id ? null : r.id)}
                        />
                      )}
                      {isActive && (
                        <Polyline
                          path={r.orders.map(o => ({ lat: o.lat, lng: o.lng }))}
                          options={{ strokeColor: r.color, strokeOpacity: 0.5, strokeWeight: 2, geodesic: true }}
                        />
                      )}
                      {r.orders.map((o, i) => (
                        <Marker key={o.id} position={{ lat: o.lat, lng: o.lng }}
                          icon={makeNumberPin(r.color, i + 1, takenIds.has(o.id))}
                          onClick={() => setSelected(o)} />
                      ))}
                    </div>
                  );
                })}

                {/* InfoWindow en modo ruteo */}
                {mode === "ruteo" && selected && (
                  <InfoWindow position={{ lat: selected.lat, lng: selected.lng }} onCloseClick={() => setSelected(null)}>
                    <div style={{ fontFamily: "sans-serif", minWidth: 180, padding: 4 }}>
                      <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#0f172a" }}>{selected.id}</p>
                      <p style={{ fontSize: 12, color: "#475569", marginBottom: 10, lineHeight: 1.4 }}>{selected.address}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, fontWeight: 600, background: VENTANA_PALETTE[selected.window] + "25", color: VENTANA_PALETTE[selected.window] }}>{selected.window}</span>
                        <button onClick={() => toggleTaken(selected.id)}
                          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 8, fontWeight: 600, cursor: "pointer", border: "none", background: takenIds.has(selected.id) ? "#dcfce7" : "#fee2e2", color: takenIds.has(selected.id) ? "#15803d" : "#b91c1c" }}>
                          {takenIds.has(selected.id) ? "✓ Desmarcar" : "Marcar tomado"}
                        </button>
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            )
          }
        </div>
      </div>
    </div>
  );

  function goTo(d) {
    setSelected(d);
    if (mapRef.current) { mapRef.current.panTo({ lat: d.lat, lng: d.lng }); mapRef.current.setZoom(16); }
  }
}
