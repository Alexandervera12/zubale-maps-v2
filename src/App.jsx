import { useState, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";

const MOCK_DATA = [
  { id: "SRV-001", address: "Av. Providencia 1234, Providencia",       window: "V9",  lat: -33.432, lng: -70.608 },
  { id: "SRV-002", address: "Av. Apoquindo 4500, Las Condes",           window: "V10", lat: -33.415, lng: -70.580 },
  { id: "SRV-003", address: "Av. Vicuña Mackenna 7890, La Florida",     window: "V11", lat: -33.520, lng: -70.600 },
  { id: "SRV-004", address: "Av. Gran Avenida 3210, San Miguel",        window: "V12", lat: -33.499, lng: -70.659 },
  { id: "SRV-005", address: "Av. Grecia 680, Nuñoa",                    window: "V13", lat: -33.456, lng: -70.601 },
  { id: "SRV-006", address: "Av. Las Rejas Norte 100, Pudahuel",        window: "V14", lat: -33.435, lng: -70.731 },
  { id: "SRV-007", address: "Av. Concha y Toro 500, Puente Alto",       window: "V15", lat: -33.588, lng: -70.570 },
  { id: "SRV-008", address: "Calle Compania 1800, Santiago Centro",     window: "V16", lat: -33.439, lng: -70.650 },
  { id: "SRV-009", address: "Av. Departamental 4000, San Joaquin",      window: "V17", lat: -33.496, lng: -70.625 },
  { id: "SRV-010", address: "Av. Americo Vespucio 1200, Maipu",         window: "V18", lat: -33.500, lng: -70.757 },
  { id: "SRV-011", address: "Av. Ossa 1780, La Reina",                  window: "V19", lat: -33.449, lng: -70.554 },
  { id: "SRV-012", address: "Av. Colon 9400, La Florida",               window: "V20", lat: -33.533, lng: -70.578 },
  { id: "SRV-013", address: "Av. El Salto 4440, Huechuraba",            window: "V9",  lat: -33.382, lng: -70.641 },
  { id: "SRV-014", address: "Av. Jose Arrieta 9050, Penalolen",         window: "V11", lat: -33.480, lng: -70.531 },
  { id: "SRV-015", address: "Av. Portales 3270, Estacion Central",      window: "V13", lat: -33.451, lng: -70.695 },
];

const VENTANA_PALETTE = {
  "V9":  "#3b82f6",
  "V10": "#f97316",
  "V11": "#22c55e",
  "V12": "#a855f7",
  "V13": "#ef4444",
  "V14": "#14b8a6",
  "V15": "#f59e0b",
  "V16": "#ec4899",
  "V17": "#6366f1",
  "V18": "#84cc16",
  "V19": "#06b6d4",
  "V20": "#f43f5e",
};

const VENTANAS = Object.keys(VENTANA_PALETTE);

function makePinSvg(hex) {
  const c = hex || "#3b82f6";
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0 C7.16 0 0 7.16 0 16 C0 28 16 40 16 40 C16 40 32 28 32 16 C32 7.16 24.84 0 16 0Z" fill="${c}" /><circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/></svg>`
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
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1f2e" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3b4460" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const MAP_STYLE_LIGHT = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export default function App() {
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });

  const [filter, setFilter]     = useState("all");
  const [search, setSearch]     = useState("");
  const [selected, setSelected] = useState(null);
  const [darkMap, setDarkMap]   = useState(true);
  const mapRef = useRef(null);

  const onLoad = useCallback((map) => { mapRef.current = map; }, []);

  const filtered = MOCK_DATA.filter((d) => {
    const matchFilter = filter === "all" || d.window === filter;
    const q = search.toLowerCase();
    return matchFilter && (d.id.toLowerCase().includes(q) || d.address.toLowerCase().includes(q));
  });

  const countByWindow = VENTANAS.reduce((acc, v) => {
    acc[v] = filtered.filter(d => d.window === v).length;
    return acc;
  }, {});

  function goTo(d) {
    setSelected(d);
    if (mapRef.current) mapRef.current.panTo({ lat: d.lat, lng: d.lng });
  }

  const dark = darkMap;
  const border = dark ? "#1e2433" : "#e2e8f0";
  const textPrimary = dark ? "#f1f5f9" : "#0f172a";
  const textMuted = dark ? "#64748b" : "#94a3b8";
  const inputBg = dark ? "#1e2436" : "#f8fafc";
  const inputBorder = dark ? "#2a3044" : "#cbd5e1";

  return (
    <div style={{ display: "flex", height: "100vh", background: dark ? "#0f1117" : "#f1f5f9", fontFamily: "'DM Sans', sans-serif" }}>

      <aside style={{ width: 290, minWidth: 290, background: dark ? "#151820" : "#ffffff", borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22d3ee" }} />
              <span style={{ fontSize: 16, fontWeight: 600, color: textPrimary }}>LogiTrack</span>
            </div>
            <button
              onClick={() => setDarkMap(d => !d)}
              style={{ background: inputBg, border: `1px solid ${inputBorder}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 500, color: textMuted }}
            >
              {dark ? "☀ Claro" : "☾ Oscuro"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "#0f2e1e", color: "#6ee7b7", fontWeight: 500 }}>● En línea</span>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "#0c1d35", color: "#93c5fd", fontWeight: 500 }}>⟳ Live</span>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: inputBg, color: textMuted, fontWeight: 500 }}>Total: {filtered.length}</span>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}` }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ID o dirección..."
            style={{ width: "100%", background: inputBg, border: `1px solid ${inputBorder}`, color: textPrimary, fontSize: 13, padding: "8px 12px", borderRadius: 8, outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {/* Filtro */}
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}` }}>
          <p style={{ fontSize: 11, color: textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ventana de entrega</p>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{ width: "100%", background: inputBg, border: `1px solid ${inputBorder}`, color: textPrimary, fontSize: 13, padding: "8px 12px", borderRadius: 8, outline: "none", cursor: "pointer", boxSizing: "border-box" }}
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
              <div
                key={v}
                onClick={() => setFilter(filter === v ? "all" : v)}
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
              <div
                key={d.id}
                onClick={() => goTo(d)}
                style={{ padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 3, border: `1px solid ${selected?.id === d.id ? VENTANA_PALETTE[d.window] : "transparent"}`, background: selected?.id === d.id ? VENTANA_PALETTE[d.window] + "15" : "transparent", transition: "all 0.15s" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary }}>{d.id}</span>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600, background: VENTANA_PALETTE[d.window] + "28", color: VENTANA_PALETTE[d.window] }}>
                    {d.window}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: textMuted, lineHeight: 1.4 }}>{d.address}</div>
              </div>
            ))
          }
        </div>
      </aside>

      {/* Mapa */}
      <div style={{ flex: 1, position: "relative" }}>
        {!isLoaded ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 14 }}>
            Cargando mapa...
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={MAP_CENTER}
            zoom={11}
            onLoad={onLoad}
            options={{ styles: dark ? MAP_STYLE_DARK : MAP_STYLE_LIGHT, disableDefaultUI: false, zoomControl: true }}
          >
            {filtered.map(d => (
              <Marker
                key={d.id}
                position={{ lat: d.lat, lng: d.lng }}
                icon={makePinSvg(VENTANA_PALETTE[d.window])}
                onClick={() => setSelected(d)}
              />
            ))}
            {selected && (
              <InfoWindow position={{ lat: selected.lat, lng: selected.lng }} onCloseClick={() => setSelected(null)}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: 160, padding: 4 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#0f172a" }}>{selected.id}</p>
                  <p style={{ fontSize: 12, color: "#475569", marginBottom: 6, lineHeight: 1.4 }}>{selected.address}</p>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, fontWeight: 600, background: VENTANA_PALETTE[selected.window] + "25", color: VENTANA_PALETTE[selected.window] }}>
                    {selected.window}
                  </span>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
      </div>
    </div>
  );
}
