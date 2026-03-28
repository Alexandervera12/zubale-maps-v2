import { useState, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";

// ─── Datos de ejemplo (reemplazar con fetch a Google Sheets) ──────────────────
const MOCK_DATA = [
  { id: "SRV-001", address: "Av. Providencia 1234, Providencia", window: "AM",         lat: -33.432, lng: -70.608 },
  { id: "SRV-002", address: "Av. Apoquindo 4500, Las Condes",    window: "PM",         lat: -33.415, lng: -70.580 },
  { id: "SRV-003", address: "Av. Vicuña Mackenna 7890, La Florida", window: "AM",      lat: -33.520, lng: -70.600 },
  { id: "SRV-004", address: "Av. Gran Avenida 3210, San Miguel", window: "Todo el día", lat: -33.499, lng: -70.659 },
  { id: "SRV-005", address: "Av. Grecia 680, Ñuñoa",             window: "PM",         lat: -33.456, lng: -70.601 },
  { id: "SRV-006", address: "Av. Las Rejas Norte 100, Pudahuel", window: "AM",         lat: -33.435, lng: -70.731 },
  { id: "SRV-007", address: "Av. Concha y Toro 500, Puente Alto", window: "PM",        lat: -33.588, lng: -70.570 },
  { id: "SRV-008", address: "Calle Compañía 1800, Santiago Centro", window: "Todo el día", lat: -33.439, lng: -70.650 },
  { id: "SRV-009", address: "Av. Departamental 4000, San Joaquín", window: "AM",       lat: -33.496, lng: -70.625 },
  { id: "SRV-010", address: "Av. Américo Vespucio 1200, Maipú",  window: "PM",         lat: -33.500, lng: -70.757 },
  { id: "SRV-011", address: "Av. Ossa 1780, La Reina",            window: "AM",        lat: -33.449, lng: -70.554 },
  { id: "SRV-012", address: "Av. Colón 9400, La Florida",         window: "Todo el día", lat: -33.533, lng: -70.578 },
  { id: "SRV-013", address: "Av. El Salto 4440, Huechuraba",      window: "PM",        lat: -33.382, lng: -70.641 },
  { id: "SRV-014", address: "Av. José Arrieta 9050, Peñalolén",   window: "AM",        lat: -33.480, lng: -70.531 },
  { id: "SRV-015", address: "Av. Portales 3270, Estación Central", window: "Todo el día", lat: -33.451, lng: -70.695 },
];

// ─── Colores por ventana ──────────────────────────────────────────────────────
const WINDOW_COLORS = {
  "AM":         { hex: "#3b82f6", label: "AM",         pin: "blue"   },
  "PM":         { hex: "#f97316", label: "PM",         pin: "orange" },
  "Todo el día":{ hex: "#a855f7", label: "Todo el día", pin: "purple" },
};

// SVG pin generator por color
function makePinSvg(color) {
  const colors = { blue: "#3b82f6", orange: "#f97316", purple: "#a855f7" };
  const c = colors[color] || "#3b82f6";
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
        <path d="M16 0 C7.16 0 0 7.16 0 16 C0 28 16 40 16 40 C16 40 32 28 32 16 C32 7.16 24.84 0 16 0Z" fill="${c}" />
        <circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/>
      </svg>
    `)}`,
    scaledSize: { width: 28, height: 36 },
    anchor: { x: 14, y: 36 },
  };
}

const MAP_CENTER = { lat: -33.47, lng: -70.64 };

// Estilo oscuro tipo "control room" para Google Maps
const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1a1f2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1f2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a3044" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1f2e" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3b4460" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#334155" }] },
];

export default function App() {
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [filter, setFilter]       = useState("all");
  const [search, setSearch]       = useState("");
  const [selected, setSelected]   = useState(null);
  const mapRef = useRef(null);

  const onLoad = useCallback((map) => { mapRef.current = map; }, []);

  const filtered = MOCK_DATA.filter((d) => {
    const matchFilter = filter === "all" || d.window === filter;
    const q = search.toLowerCase();
    const matchSearch = d.id.toLowerCase().includes(q) || d.address.toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const counts = {
    am:  filtered.filter(d => d.window === "AM").length,
    pm:  filtered.filter(d => d.window === "PM").length,
    all: filtered.filter(d => d.window === "Todo el día").length,
  };

  function goTo(d) {
    setSelected(d);
    if (mapRef.current) mapRef.current.panTo({ lat: d.lat, lng: d.lng });
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0f1117", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside style={{
        width: 280, minWidth: 280,
        background: "#151820",
        borderRight: "1px solid #1e2433",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>

        {/* Header estilo Zubale */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e2433" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#22d3ee",
              boxShadow: "0 0 8px #22d3ee99",
            }} />
            <span style={{ fontSize: 16, fontWeight: 600, color: "#f8fafc", letterSpacing: "-0.02em" }}>
              LogiTrack
            </span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "#0f2e1e", color: "#6ee7b7", fontWeight: 500 }}>
              ● En línea
            </span>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, background: "#0c1d35", color: "#93c5fd", fontWeight: 500 }}>
              ⟳ Live
            </span>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e2433" }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por ID o dirección..."
            style={{
              width: "100%", background: "#1e2436",
              border: "1px solid #2a3044", color: "#e2e8f0",
              fontSize: 13, padding: "8px 12px", borderRadius: 8, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Filter */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1e2433" }}>
          <p style={{ fontSize: 11, color: "#475569", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Ventana de entrega
          </p>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            style={{
              width: "100%", background: "#1e2436",
              border: "1px solid #2a3044", color: "#e2e8f0",
              fontSize: 13, padding: "8px 12px", borderRadius: 8, outline: "none", cursor: "pointer",
              boxSizing: "border-box",
            }}
          >
            <option value="all">Todas las ventanas</option>
            <option value="AM">AM — Mañana</option>
            <option value="PM">PM — Tarde</option>
            <option value="Todo el día">Todo el día</option>
          </select>
        </div>

        {/* Stats chips */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e2433", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { label: "AM",    val: counts.am,  bg: "#0c1d35", color: "#93c5fd" },
            { label: "PM",    val: counts.pm,  bg: "#2c1006", color: "#fdba74" },
            { label: "Día",   val: counts.all, bg: "#1e0535", color: "#d8b4fe" },
            { label: "Total", val: filtered.length, bg: "#1e2436", color: "#94a3b8" },
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, borderRadius: 8, padding: "5px 10px",
              fontSize: 11, fontWeight: 500,
            }}>
              <span style={{ color: "#64748b" }}>{s.label} </span>
              <span style={{ color: s.color }}>{s.val}</span>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid #1e2433" }}>
          {Object.entries(WINDOW_COLORS).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, fontSize: 12, color: "#94a3b8" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: v.hex, flexShrink: 0 }} />
              {v.label}
            </div>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {filtered.length === 0
            ? <p style={{ textAlign: "center", color: "#475569", fontSize: 13, padding: 20 }}>Sin resultados</p>
            : filtered.map(d => (
              <div
                key={d.id}
                onClick={() => goTo(d)}
                style={{
                  padding: "10px 12px", borderRadius: 8, cursor: "pointer",
                  marginBottom: 4,
                  border: `1px solid ${selected?.id === d.id ? "#3b82f6" : "transparent"}`,
                  background: selected?.id === d.id ? "#1e2436" : "transparent",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{d.id}</span>
                  <span style={{
                    fontSize: 10, padding: "2px 7px", borderRadius: 10, fontWeight: 600,
                    background: d.window === "AM" ? "#0c1d35" : d.window === "PM" ? "#2c1006" : "#1e0535",
                    color: d.window === "AM" ? "#93c5fd" : d.window === "PM" ? "#fdba74" : "#d8b4fe",
                  }}>
                    {d.window}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.4 }}>{d.address}</div>
              </div>
            ))
          }
        </div>
      </aside>

      {/* ── Map ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative" }}>
        {!isLoaded ? (
          <div style={{
            height: "100%", display: "flex", alignItems: "center",
            justifyContent: "center", color: "#475569", fontSize: 14,
          }}>
            Cargando mapa...
          </div>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%" }}
            center={MAP_CENTER}
            zoom={11}
            onLoad={onLoad}
            options={{ styles: MAP_STYLE, disableDefaultUI: false, zoomControl: true }}
          >
            {filtered.map(d => (
              <Marker
                key={d.id}
                position={{ lat: d.lat, lng: d.lng }}
                icon={makePinSvg(WINDOW_COLORS[d.window]?.pin)}
                onClick={() => setSelected(d)}
              />
            ))}

            {selected && (
              <InfoWindow
                position={{ lat: selected.lat, lng: selected.lng }}
                onCloseClick={() => setSelected(null)}
              >
                <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: 160, padding: 4 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#0f172a" }}>{selected.id}</p>
                  <p style={{ fontSize: 12, color: "#475569", marginBottom: 6, lineHeight: 1.4 }}>{selected.address}</p>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 8, fontWeight: 600,
                    background: selected.window === "AM" ? "#dbeafe" : selected.window === "PM" ? "#ffedd5" : "#f3e8ff",
                    color: selected.window === "AM" ? "#1d4ed8" : selected.window === "PM" ? "#c2410c" : "#7e22ce",
                  }}>
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
