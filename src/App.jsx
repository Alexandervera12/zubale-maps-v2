import { useState, useCallback, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";

// Colores para V9-V20
const VENTANA_PALETTE = {
  "V9":  "#3b82f6", "V10": "#f97316", "V11": "#22c55e", "V12": "#a855f7",
  "V13": "#ef4444", "V14": "#14b8a6", "V15": "#f59e0b", "V16": "#ec4899",
  "V17": "#6366f1", "V18": "#84cc16", "V19": "#06b6d4", "V20": "#f43f5e",
};
const VENTANAS = Object.keys(VENTANA_PALETTE);

function makePinSvg(hex) {
  const c = hex || "#3b82f6";
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.16 0 0 7.16 0 16C0 28 16 40 16 40S32 28 32 16C32 7.16 24.84 0 16 0Z" fill="${c}"/><circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/></svg>`
    )}`,
    scaledSize: { width: 28, height: 36 },
    anchor: { x: 14, y: 36 },
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

// Datos mock de respaldo (se usan si no hay SHEETS_URL configurada)
const MOCK_DATA = [
  { id: "SG-001", address: "Av. Providencia 1234, Providencia",   window: "V9",  lat: -33.432, lng: -70.608 },
  { id: "SG-002", address: "Av. Apoquindo 4500, Las Condes",       window: "V10", lat: -33.415, lng: -70.580 },
  { id: "SG-003", address: "Av. Vicuña Mackenna 7890, La Florida", window: "V11", lat: -33.520, lng: -70.600 },
  { id: "SG-004", address: "Av. Gran Avenida 3210, San Miguel",    window: "V12", lat: -33.499, lng: -70.659 },
  { id: "SG-005", address: "Av. Grecia 680, Nuñoa",                window: "V13", lat: -33.456, lng: -70.601 },
  { id: "SG-006", address: "Av. Las Rejas Norte 100, Pudahuel",    window: "V14", lat: -33.435, lng: -70.731 },
];

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
  const mapRef = useRef(null);

  // ── Fetch desde Google Sheets ──────────────────────────────────
  const fetchSheets = useCallback(async () => {
    if (!SHEETS_URL) return;
    setLoading(true);
    try {
      const res  = await fetch(SHEETS_URL);
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        setData(json);
        setLastSync(new Date().toLocaleTimeString("es-CL"));
      }
    } catch (e) {
      console.error("Error cargando Sheets:", e);
    } finally {
      setLoading(false);
    }
  }, [SHEETS_URL]);

  useEffect(() => {
    fetchSheets();
    const interval = setInterval(fetchSheets, 60_000);
    return () => clearInterval(interval);
  }, [fetchSheets]);

  // ── Filtros ────────────────────────────────────────────────────
  const filtered = data.filter(d => {
    const matchFilter = filter === "all" || d.window === filter;
    const q = search.toLowerCase();
    return matchFilter && (d.id.toLowerCase().includes(q) || d.address.toLowerCase().includes(q));
  });

  const countByWindow = VENTANAS.reduce((acc, v) => {
    acc[v] = filtered.filter(d => d.window === v).length;
    return acc;
  }, {});

  const onLoad = useCallback(map => { mapRef.current = map; }, []);

  function goTo(d) {
    setSelected(d);
    if (mapRef.current) mapRef.current.panTo({ lat: d.lat, lng: d.lng });
  }

  // ── Estilos dinámicos ──────────────────────────────────────────
  const dark       = darkMap;
  const border     = dark ? "#1e2433" : "#e2e8f0";
  const textPri    = dark ? "#f1f5f9" : "#0f172a";
  const textMuted  = dark ? "#64748b" : "#94a3b8";
  const inputBg    = dark ? "#1e2436" : "#f8fafc";
  const inputBdr   = dark ? "#2a3044" : "#cbd5e1";
  const sideBg     = dark ? "#151820" : "#ffffff";

  return (
    <div style={{ display: "flex", height: "100vh", background: dark ? "#0f1117" : "#f1f5f9", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside style={{ width: 290, minWidth: 290, background: sideBg, borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22d3ee" }} />
              <span style={{ fontSize: 16, fontWeight: 600, color: textPri }}>LogiTrack</span>
            </div>
            <button onClick={() => setDarkMap(d => !d)} style={{ background: inputBg, border: `1px solid ${inputBdr}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 500, color: textMuted }}>
              {dark ? "☀ Claro" : "☾ Oscuro"}
            </button>
          </div>

          {/* Status pills */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "#0f2e1e", color: "#6ee7b7", fontWeight: 500 }}>● En línea</span>
            {SHEETS_URL ? (
              <span
                onClick={fetchSheets}
                title="Clic para actualizar"
                style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: loading ? "#2c1006" : "#0c1d35", color: loading ? "#fdba74" : "#93c5fd", fontWeight: 500, cursor: "pointer" }}
              >
                {loading ? "⟳ Cargando..." : lastSync ? `⟳ ${lastSync}` : "⟳ Conectando..."}
              </span>
            ) : (
              <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "#2c1006", color: "#fdba74", fontWeight: 500 }}>Demo</span>
            )}
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: inputBg, color: textMuted, fontWeight: 500 }}>Total: {filtered.length}</span>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}` }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ID o dirección..."
            style={{ width: "100%", background: inputBg, border: `1px solid ${inputBdr}`, color: textPri, fontSize: 13, padding: "8px 12px", borderRadius: 8, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Filtro select */}
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}` }}>
          <p style={{ fontSize: 11, color: textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ventana de entrega</p>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ width: "100%", background: inputBg, border: `1px solid ${inputBdr}`, color: textPri, fontSize: 13, padding: "8px 12px", borderRadius: 8, outline: "none", cursor: "pointer", boxSizing: "border-box" }}
          >
            <option value="all">Todas las ventanas</option>
            {VENTANAS.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>

        {/* Leyenda clicable */}
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}` }}>
          <p style={{ fontSize: 11, color: textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Leyenda — clic para filtrar</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 6px" }}>
            {VENTANAS.map(v => (
              <div key={v} onClick={() => setFilter(filter === v ? "all" : v)}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer", padding: "4px 7px", borderRadius: 6, background: filter === v ? VENTANA_PALETTE[v] + "22" : "transparent", border: `1px solid ${filter === v ? VENTANA_PALETTE[v] + "66" : "transparent"}` }}
              >
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: VENTANA_PALETTE[v], flexShrink: 0 }} />
                <span style={{ fontWeight: filter === v ? 600 : 400, color: filter === v ? VENTANA_PALETTE[v] : textMuted }}>{v}</span>
                <span style={{ marginLeft: "auto", fontSize: 10, color: textMuted }}>{countByWindow[v] || 0}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {filtered.length === 0
            ? <p style={{ textAlign: "center", color: textMuted, fontSize: 13, padding: 20 }}>Sin resultados</p>
            : filtered.map(d => (
              <div key={d.id} onClick={() => goTo(d)}
                style={{ padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 3, border: `1px solid ${selected?.id === d.id ? VENTANA_PALETTE[d.window] : "transparent"}`, background: selected?.id === d.id ? VENTANA_PALETTE[d.window] + "15" : "transparent", transition: "all 0.15s" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: textPri }}>{d.id}</span>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600, background: VENTANA_PALETTE[d.window] + "28", color: VENTANA_PALETTE[d.window] }}>{d.window}</span>
                </div>
                <div style={{ fontSize: 11, color: textMuted, lineHeight: 1.4 }}>{d.address}</div>
              </div>
            ))
          }
        </div>
      </aside>

      {/* ── Mapa ────────────────────────────────────────────── */}
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
                <Marker key={d.id} position={{ lat: d.lat, lng: d.lng }} icon={makePinSvg(VENTANA_PALETTE[d.window])} onClick={() => setSelected(d)} />
              ))}
              {selected && (
                <InfoWindow position={{ lat: selected.lat, lng: selected.lng }} onCloseClick={() => setSelected(null)}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: 160, padding: 4 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#0f172a" }}>{selected.id}</p>
                    <p style={{ fontSize: 12, color: "#475569", marginBottom: 6, lineHeight: 1.4 }}>{selected.address}</p>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, fontWeight: 600, background: VENTANA_PALETTE[selected.window] + "25", color: VENTANA_PALETTE[selected.window] }}>{selected.window}</span>
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
