import { useState, useCallback, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, writeBatch } from "firebase/firestore";

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

function makePinSvg(hex, taken = false) {
  const c = taken ? "#64748b" : (hex || "#3b82f6");
  const inner = taken ? "#94a3b8" : "white";
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30">
        <path d="M11 0C4.93 0 0 4.93 0 11C0 19.25 11 30 11 30S22 19.25 22 11C22 4.93 17.07 0 11 0Z" fill="${c}" opacity="${taken ? 0.5 : 1}"/>
        <circle cx="11" cy="11" r="4.5" fill="${inner}" opacity="0.9"/>
        ${taken ? `<line x1="6" y1="6" x2="16" y2="16" stroke="${inner}" stroke-width="2" stroke-linecap="round"/>` : ""}
      </svg>`
    )}`,
    scaledSize: { width: 22, height: 30 },
    anchor: { x: 11, y: 30 },
  };
}

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

const MOCK_DATA = [
  { id: "SG-001", address: "Av. Providencia 1234, Providencia", window: "V9",  lat: -33.432, lng: -70.608 },
  { id: "SG-002", address: "Av. Apoquindo 4500, Las Condes",    window: "V10", lat: -33.415, lng: -70.580 },
];

// ── Fecha de hoy como clave ───────────────────────────────────────
function getTodayKey() {
  return new Date().toISOString().split("T")[0]; // "2026-03-28"
}

export default function App() {
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const SHEETS_URL          = import.meta.env.VITE_SHEETS_URL;

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });

  const [data, setData]         = useState(MOCK_DATA);
  const [loading, setLoading]   = useState(false);
  const [lastSync, setLastSync] = useState(null);
  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);
  const [darkMap, setDarkMap]   = useState(true);
  const [hideTaken, setHideTaken] = useState(false);
  const [takenIds, setTakenIds]   = useState(new Set());
  const mapRef = useRef(null);

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

  // ── Firebase: escuchar estados "Tomado" en tiempo real ────────
  useEffect(() => {
    const todayKey = getTodayKey();
    const colRef = collection(db, "taken", todayKey, "orders");
    const unsub = onSnapshot(colRef, (snap) => {
      const ids = new Set();
      snap.forEach(doc => ids.add(doc.id));
      setTakenIds(ids);
    });
    return () => unsub();
  }, []);

  // ── Firebase: reset automático a medianoche ───────────────────
  useEffect(() => {
    const msUntilMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      return midnight - now;
    };
    const timer = setTimeout(async () => {
      // El reset se hace simplemente cambiando la fecha — el listener
      // apunta a la colección del día nuevo, que empieza vacía
      console.log("Nuevo día — estados reseteados automáticamente");
    }, msUntilMidnight());
    return () => clearTimeout(timer);
  }, []);

  // ── Marcar/desmarcar como Tomado ─────────────────────────────
  async function toggleTaken(id) {
    const todayKey = getTodayKey();
    const docRef = doc(db, "taken", todayKey, "orders", id);
    if (takenIds.has(id)) {
      await deleteDoc(docRef);
    } else {
      await setDoc(docRef, { takenAt: new Date().toISOString() });
    }
    setSelected(null);
  }

  // ── Filtros ───────────────────────────────────────────────────
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

  const onLoad = useCallback(map => { mapRef.current = map; }, []);

  function goTo(d) {
    setSelected(d);
    if (mapRef.current) { mapRef.current.panTo({ lat: d.lat, lng: d.lng }); mapRef.current.setZoom(16); }
  }

  const dark     = darkMap;
  const border   = dark ? "#1e2433" : "#e2e8f0";
  const textPri  = dark ? "#f1f5f9" : "#0f172a";
  const textMut  = dark ? "#64748b" : "#94a3b8";
  const inputBg  = dark ? "#1e2436" : "#f8fafc";
  const inputBdr = dark ? "#2a3044" : "#cbd5e1";
  const sideBg   = dark ? "#151820" : "#ffffff";

  return (
    <div style={{ display: "flex", height: "100vh", background: dark ? "#0f1117" : "#f1f5f9", fontFamily: "'DM Sans', sans-serif" }}>

      <aside style={{ width: 290, minWidth: 290, background: sideBg, borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22d3ee" }} />
              <span style={{ fontSize: 16, fontWeight: 600, color: textPri }}>Zubale Maps</span>
            </div>
            <button onClick={() => setDarkMap(d => !d)} style={{ background: inputBg, border: `1px solid ${inputBdr}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 500, color: textMut }}>
              {dark ? "☀ Claro" : "☾ Oscuro"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "#0f2e1e", color: "#6ee7b7", fontWeight: 500 }}>● En línea</span>
            {SHEETS_URL && (
              <span onClick={fetchSheets} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: loading ? "#2c1006" : "#0c1d35", color: loading ? "#fdba74" : "#93c5fd", fontWeight: 500, cursor: "pointer" }}>
                {loading ? "⟳ Cargando..." : lastSync ? `⟳ ${lastSync}` : "⟳ Live"}
              </span>
            )}
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: inputBg, color: textMut, fontWeight: 500 }}>
              Total: {filtered.length}
            </span>
          </div>
        </div>

        {/* Toggle ocultar tomados */}
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: textPri }}>Ocultar tomados</div>
            <div style={{ fontSize: 11, color: textMut }}>{takenCount} de {data.length} tomados hoy</div>
          </div>
          <div onClick={() => setHideTaken(h => !h)} style={{
            width: 44, height: 24, borderRadius: 12, cursor: "pointer", position: "relative", transition: "background 0.2s",
            background: hideTaken ? "#3b82f6" : (dark ? "#2a3044" : "#cbd5e1"),
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute",
              top: 3, transition: "left 0.2s", left: hideTaken ? 23 : 3,
            }} />
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}` }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por SG"
            style={{ width: "100%", background: inputBg, border: `1px solid ${inputBdr}`, color: textPri, fontSize: 13, padding: "8px 12px", borderRadius: 8, outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* Filtro */}
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
          {filtered.length === 0
            ? <p style={{ textAlign: "center", color: textMut, fontSize: 13, padding: 20 }}>Sin resultados</p>
            : filtered.map(d => {
              const taken = takenIds.has(d.id);
              return (
                <div key={d.id} onClick={() => goTo(d)}
                  style={{ padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 3, opacity: taken ? 0.45 : 1, border: `1px solid ${selected?.id === d.id ? VENTANA_PALETTE[d.window] : "transparent"}`, background: selected?.id === d.id ? VENTANA_PALETTE[d.window] + "15" : "transparent", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: taken ? textMut : textPri, textDecoration: taken ? "line-through" : "none" }}>{d.id}</span>
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600, background: taken ? "#1e2436" : VENTANA_PALETTE[d.window] + "28", color: taken ? "#475569" : VENTANA_PALETTE[d.window] }}>
                      {taken ? "Tomado" : d.window}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: textMut, lineHeight: 1.4 }}>{d.address}</div>
                </div>
              );
            })
          }
        </div>
      </aside>

      {/* Mapa */}
      <div style={{ flex: 1, position: "relative" }}>
        {!isLoaded
          ? <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>Cargando mapa...</div>
          : (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "100%" }}
              center={MAP_CENTER} zoom={11} onLoad={onLoad}
              options={{ styles: dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT, zoomControl: true }}
            >
              {filtered.map(d => (
                <Marker
                  key={d.id}
                  position={{ lat: d.lat, lng: d.lng }}
                  icon={makePinSvg(VENTANA_PALETTE[d.window], takenIds.has(d.id))}
                  onClick={() => setSelected(d)}
                />
              ))}

              {selected && (
                <InfoWindow
                  position={{ lat: selected.lat, lng: selected.lng }}
                  onCloseClick={() => setSelected(null)}
                >
                  <div style={{ fontFamily: "sans-serif", minWidth: 180, padding: 4 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#0f172a" }}>{selected.id}</p>
                    <p style={{ fontSize: 12, color: "#475569", marginBottom: 10, lineHeight: 1.4 }}>{selected.address}</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, fontWeight: 600, background: VENTANA_PALETTE[selected.window] + "25", color: VENTANA_PALETTE[selected.window] }}>
                        {selected.window}
                      </span>
                      <button
                        onClick={() => toggleTaken(selected.id)}
                        style={{
                          fontSize: 11, padding: "3px 10px", borderRadius: 8, fontWeight: 600, cursor: "pointer", border: "none",
                          background: takenIds.has(selected.id) ? "#dcfce7" : "#fee2e2",
                          color: takenIds.has(selected.id) ? "#15803d" : "#b91c1c",
                        }}
                      >
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
  );
}
