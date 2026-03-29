import { useState, useCallback, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polygon, Polyline } from "@react-google-maps/api";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, getDocs } from "firebase/firestore";

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

const ZONE_PASSWORD = "Alexander0097";

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

const ZONE_COLORS = ["#ef4444","#f97316","#a855f7","#ec4899","#6366f1","#14b8a6"];

function makeRoutePinSvg(hex, routeNum, taken = false) {
  const c = taken ? "#64748b" : (hex || "#3b82f6");
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
        <path d="M14 0C6.27 0 0 6.27 0 14C0 24.5 14 36 14 36S28 24.5 28 14C28 6.27 21.73 0 14 0Z" fill="${c}" opacity="${taken?0.4:1}"/>
        <circle cx="14" cy="14" r="9" fill="white" opacity="0.95"/>
        <text x="14" y="18" text-anchor="middle" font-size="11" font-weight="700" fill="${c}" font-family="sans-serif">${routeNum}</text>
      </svg>`
    )}`,
    scaledSize:{width:28,height:36}, anchor:{x:14,y:36},
  };
}

function makePinSvg(hex, taken=false) {
  const c = taken ? "#64748b" : (hex||"#3b82f6");
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30">
        <path d="M11 0C4.93 0 0 4.93 0 11C0 19.25 11 30 11 30S22 19.25 22 11C22 4.93 17.07 0 11 0Z" fill="${c}" opacity="${taken?0.4:1}"/>
        <circle cx="11" cy="11" r="4.5" fill="white" opacity="0.9"/>
        ${taken?`<line x1="7" y1="7" x2="15" y2="15" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>`:""}
      </svg>`
    )}`,
    scaledSize:{width:22,height:30}, anchor:{x:11,y:30},
  };
}

function makeExcludedPin() {
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30">
        <path d="M11 0C4.93 0 0 4.93 0 11C0 19.25 11 30 11 30S22 19.25 22 11C22 4.93 17.07 0 11 0Z" fill="#ef4444" opacity="0.5"/>
        <circle cx="11" cy="11" r="4.5" fill="white" opacity="0.8"/>
        <text x="11" y="15" text-anchor="middle" font-size="10" font-weight="700" fill="#ef4444" font-family="sans-serif">✕</text>
      </svg>`
    )}`,
    scaledSize:{width:22,height:30}, anchor:{x:11,y:30},
  };
}

const MAP_CENTER = { lat:-33.47, lng:-70.64 };
const MAP_STYLE_DARK = [
  {elementType:"geometry",stylers:[{color:"#1a1f2e"}]},
  {elementType:"labels.text.stroke",stylers:[{color:"#1a1f2e"}]},
  {elementType:"labels.text.fill",stylers:[{color:"#64748b"}]},
  {featureType:"road",elementType:"geometry",stylers:[{color:"#2a3044"}]},
  {featureType:"road.highway",elementType:"geometry",stylers:[{color:"#3b4460"}]},
  {featureType:"water",elementType:"geometry",stylers:[{color:"#0f172a"}]},
  {featureType:"poi",stylers:[{visibility:"off"}]},
  {featureType:"transit",stylers:[{visibility:"off"}]},
];
const MAP_STYLE_LIGHT = [
  {featureType:"poi",stylers:[{visibility:"off"}]},
  {featureType:"transit",stylers:[{visibility:"off"}]},
];

// ── Algoritmo Haversine ───────────────────────────────────────────
function distKm(a, b) {
  const R=6371, dLat=(b.lat-a.lat)*Math.PI/180, dLng=(b.lng-a.lng)*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

function calcGroupRadius(orders) {
  if(orders.length<2) return Infinity;
  const cLat=orders.reduce((s,o)=>s+o.lat,0)/orders.length;
  const cLng=orders.reduce((s,o)=>s+o.lng,0)/orders.length;
  const distances=orders.map(o=>distKm(o,{lat:cLat,lng:cLng})).sort((a,b)=>a-b);
  return distances[Math.floor(distances.length*0.75)]*2.5;
}

function generateRoutes(orders, batchSize) {
  if(orders.length===0) return {routes:[],sinAsignar:[]};
  const MAX_DIST_KM=Math.min(Math.max(calcGroupRadius(orders),0.5),5);
  const remaining=[...orders];
  const routes=[];
  let ci=0;
  while(remaining.length>0) {
    const seed=remaining.shift();
    const route=[seed];
    while(route.length<batchSize&&remaining.length>0) {
      const cLat=route.reduce((s,o)=>s+o.lat,0)/route.length;
      const cLng=route.reduce((s,o)=>s+o.lng,0)/route.length;
      let bi=-1,bd=Infinity;
      remaining.forEach((o,i)=>{const d=distKm(o,{lat:cLat,lng:cLng});if(d<bd&&d<=MAX_DIST_KM){bd=d;bi=i;}});
      if(bi===-1) break;
      route.push(remaining.splice(bi,1)[0]);
    }
    routes.push({id:`R${routes.length+1}`,label:`Ruta ${routes.length+1}`,window:orders[0]?.window,color:ROUTE_COLORS[ci%ROUTE_COLORS.length],orders:route,hidden:false,routeNum:routes.length+1});
    ci++;
  }
  return routes;
}

function convexHull(points) {
  if(points.length<3) return points;
  const pts=[...points].sort((a,b)=>a.lat-b.lat||a.lng-b.lng);
  const cross=(o,a,b)=>(a.lat-o.lat)*(b.lng-o.lng)-(a.lng-o.lng)*(b.lat-o.lat);
  const lo=[],hi=[];
  for(const p of pts){while(lo.length>=2&&cross(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
  for(let i=pts.length-1;i>=0;i--){const p=pts[i];while(hi.length>=2&&cross(hi[hi.length-2],hi[hi.length-1],p)<=0)hi.pop();hi.push(p);}
  hi.pop();lo.pop();return lo.concat(hi);
}

function expandHull(points) {
  if(points.length<2) return points;
  const cLat=points.reduce((s,p)=>s+p.lat,0)/points.length;
  const cLng=points.reduce((s,p)=>s+p.lng,0)/points.length;
  return points.map(p=>({lat:cLat+(p.lat-cLat)*1.3+(p.lat>cLat?0.0008:-0.0008),lng:cLng+(p.lng-cLng)*1.3+(p.lng>cLng?0.0008:-0.0008)}));
}

// ── Point in polygon (Ray casting) ───────────────────────────────
function pointInPolygon(point, polygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const xi=polygon[i].lng,yi=polygon[i].lat,xj=polygon[j].lng,yj=polygon[j].lat;
    if(((yi>point.lat)!==(yj>point.lat))&&(point.lng<(xj-xi)*(point.lat-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}

function isOrderExcluded(order, zones) {
  return zones.some(z=>pointInPolygon({lat:order.lat,lng:order.lng},z.points));
}

function getTodayKey() { return new Date().toISOString().split("T")[0]; }

const MOCK_DATA = [
  {id:"SG-001",address:"Av. Providencia 1234, Providencia",window:"V9",lat:-33.432,lng:-70.608},
  {id:"SG-002",address:"Av. Apoquindo 4500, Las Condes",window:"V10",lat:-33.415,lng:-70.580},
];

export default function App() {
  const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const SHEETS_URL = import.meta.env.VITE_SHEETS_URL;
  const {isLoaded} = useJsApiLoader({googleMapsApiKey:GOOGLE_MAPS_API_KEY});

  const [data,setData]           = useState(MOCK_DATA);
  const [loading,setLoading]     = useState(false);
  const [lastSync,setLastSync]   = useState(null);
  const [mode,setMode]           = useState("mapa");
  const [filter,setFilter]       = useState("all");
  const [search,setSearch]       = useState("");
  const [selected,setSelected]   = useState(null);
  const [darkMap,setDarkMap]     = useState(true);
  const [hideTaken,setHideTaken] = useState(false);
  const [takenIds,setTakenIds]   = useState(new Set());

  // Ruteo
  const [selectedWindow,setSelectedWindow] = useState(null);
  const [batchSize,setBatchSize]           = useState(3);
  const [routes,setRoutes]                 = useState([]);
  const [activeRoute,setActiveRoute]       = useState(null);
  const [sinAsignar,setSinAsignar]         = useState([]);

  // Zonas de exclusión
  const [zones,setZones]               = useState([]);
  const [drawing,setDrawing]           = useState(false);
  const [currentPoints,setCurrentPoints] = useState([]);
  const [showZoneModal,setShowZoneModal] = useState(false);
  const [zoneName,setZoneName]         = useState("");
  const [zonePassword,setZonePassword] = useState("");
  const [zoneError,setZoneError]       = useState("");
  const [deleteConfirm,setDeleteConfirm] = useState(null);
  const [deletePassword,setDeletePassword] = useState("");
  const [deleteError,setDeleteError]   = useState("");
  const [authOk,setAuthOk]             = useState(false);

  const mapRef = useRef(null);
  const onLoad = useCallback(map=>{mapRef.current=map;},[]);

  // Fetch Sheets
  const fetchSheets = useCallback(async()=>{
    if(!SHEETS_URL) return;
    setLoading(true);
    try {
      const res=await fetch(SHEETS_URL);
      const json=await res.json();
      if(Array.isArray(json)&&json.length>0) {
        const clean=json.filter(d=>d.id&&d.address&&d.window&&typeof d.lat==="number"&&!isNaN(d.lat)&&typeof d.lng==="number"&&!isNaN(d.lng)&&d.lat!==0&&d.lng!==0);
        setData(clean);
        setLastSync(new Date().toLocaleTimeString("es-CL"));
      }
    } catch(e){console.error(e);}
    finally{setLoading(false);}
  },[SHEETS_URL]);

  useEffect(()=>{fetchSheets();const iv=setInterval(fetchSheets,60000);return()=>clearInterval(iv);},[fetchSheets]);

  // Firebase: estados tomado
  useEffect(()=>{
    const colRef=collection(db,"taken",getTodayKey(),"orders");
    return onSnapshot(colRef,snap=>{const ids=new Set();snap.forEach(d=>ids.add(d.id));setTakenIds(ids);});
  },[]);

  // Firebase: zonas de exclusión (persistentes)
  useEffect(()=>{
    const colRef=collection(db,"exclusion_zones");
    return onSnapshot(colRef,snap=>{
      const zs=[];
      snap.forEach(d=>zs.push({id:d.id,...d.data()}));
      setZones(zs);
    });
  },[]);

  async function toggleTaken(id) {
    const docRef=doc(db,"taken",getTodayKey(),"orders",id);
    if(takenIds.has(id)) await deleteDoc(docRef);
    else await setDoc(docRef,{takenAt:new Date().toISOString()});
    setSelected(null);
  }

  useEffect(()=>{setSelected(null);setActiveRoute(null);},[mode]);

  // Guardar zona nueva
  async function saveZone() {
    if(zonePassword!==ZONE_PASSWORD){setZoneError("Contraseña incorrecta");return;}
    if(!zoneName.trim()){setZoneError("Escribe un nombre para la zona");return;}
    if(currentPoints.length<3){setZoneError("Dibuja al menos 3 puntos");return;}
    const id=`zone_${Date.now()}`;
    await setDoc(doc(db,"exclusion_zones",id),{
      name:zoneName.trim(),
      points:currentPoints,
      color:ZONE_COLORS[zones.length%ZONE_COLORS.length],
      createdAt:new Date().toISOString(),
    });
    setShowZoneModal(false);
    setZoneName("");
    setZonePassword("");
    setZoneError("");
    setCurrentPoints([]);
    setDrawing(false);
  }

  // Borrar zona
  async function deleteZone() {
    if(deletePassword!==ZONE_PASSWORD){setDeleteError("Contraseña incorrecta");return;}
    await deleteDoc(doc(db,"exclusion_zones",deleteConfirm));
    setDeleteConfirm(null);
    setDeletePassword("");
    setDeleteError("");
  }

  // Clic en el mapa al dibujar
  function handleMapClick(e) {
    if(!drawing) return;
    const point={lat:e.latLng.lat(),lng:e.latLng.lng()};
    setCurrentPoints(prev=>[...prev,point]);
  }

  // Cerrar polígono
  function closePolygon() {
    if(currentPoints.length<3){alert("Necesitas al menos 3 puntos para crear una zona");return;}
    setShowZoneModal(true);
  }

  // Cancelar dibujo
  function cancelDrawing() {
    setDrawing(false);
    setCurrentPoints([]);
    setShowZoneModal(false);
  }

  // Ruteo con exclusión
  function handleGenerate() {
    if(!selectedWindow) return;
    const windowOrders=data.filter(d=>d.window===selectedWindow);
    const nonExcluded=windowOrders.filter(o=>!isOrderExcluded(o,zones));
    const excluded=windowOrders.filter(o=>isOrderExcluded(o,zones));
    const r=generateRoutes(nonExcluded,batchSize);
    const asignados=new Set(r.flatMap(rt=>rt.orders.map(o=>o.id)));
    const noAsignados=nonExcluded.filter(o=>!asignados.has(o.id));
    setSinAsignar([...noAsignados,...excluded.map(o=>({...o,excluded:true}))]);
    setRoutes(r);
    setActiveRoute(null);
    if(mapRef.current&&windowOrders.length>0){mapRef.current.panTo({lat:windowOrders[0].lat,lng:windowOrders[0].lng});mapRef.current.setZoom(12);}
  }

  function toggleHideRoute(id){setRoutes(prev=>prev.map(r=>r.id===id?{...r,hidden:!r.hidden}:r));}

  function goTo(d){setSelected(d);if(mapRef.current){mapRef.current.panTo({lat:d.lat,lng:d.lng});mapRef.current.setZoom(16);}}

  const filtered=data.filter(d=>{
    const matchFilter=filter==="all"||d.window===filter;
    const q=search.toLowerCase();
    const matchSearch=d.id.toLowerCase().includes(q)||d.address.toLowerCase().includes(q);
    const matchHidden=hideTaken?!takenIds.has(d.id):true;
    return matchFilter&&matchSearch&&matchHidden;
  });
  const countByWindow=VENTANAS.reduce((acc,v)=>{acc[v]=filtered.filter(d=>d.window===v).length;return acc;},{});
  const takenCount=data.filter(d=>takenIds.has(d.id)).length;
  const windowCounts=VENTANAS.reduce((acc,v)=>{acc[v]=data.filter(d=>d.window===v).length;return acc;},{});

  const dark=darkMap;
  const border=dark?"#1e2433":"#e2e8f0";
  const textPri=dark?"#f1f5f9":"#0f172a";
  const textMut=dark?"#64748b":"#94a3b8";
  const inputBg=dark?"#1e2436":"#f8fafc";
  const inputBdr=dark?"#2a3044":"#cbd5e1";
  const sideBg=dark?"#151820":"#ffffff";
  const appBg=dark?"#0f1117":"#f1f5f9";

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:appBg,fontFamily:"'DM Sans', sans-serif"}}>

      {/* Nav */}
      <div style={{height:48,background:dark?"#151820":"#ffffff",borderBottom:`1px solid ${border}`,display:"flex",alignItems:"center",padding:"0 20px",gap:4,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginRight:16}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#22d3ee"}}/>
          <span style={{fontSize:15,fontWeight:600,color:textPri}}>Zubale Maps</span>
          <span style={{fontSize:11,padding:"1px 7px",borderRadius:10,background:"#1e0535",color:"#d8b4fe",fontWeight:600}}>V2</span>
        </div>
        {["mapa","ruteo","zonas"].map(m=>(
          <button key={m} onClick={()=>{setMode(m);cancelDrawing();}} style={{padding:"6px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,background:mode===m?(dark?"#1e2436":"#f1f5f9"):"transparent",color:mode===m?textPri:textMut,borderBottom:mode===m?"2px solid #3b82f6":"2px solid transparent"}}>
            {m==="mapa"?"Mapa":m==="ruteo"?"Ruteo":"Zonas"}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          {SHEETS_URL&&(
            <span onClick={fetchSheets} style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:loading?"#2c1006":"#0c1d35",color:loading?"#fdba74":"#93c5fd",fontWeight:500,cursor:"pointer"}}>
              {loading?"⟳ Cargando...":lastSync?`⟳ ${lastSync}`:"⟳ Live"}
            </span>
          )}
          <button onClick={()=>setDarkMap(d=>!d)} style={{background:inputBg,border:`1px solid ${inputBdr}`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:500,color:textMut}}>
            {dark?"☀ Claro":"☾ Oscuro"}
          </button>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* Sidebar */}
        <aside style={{width:290,minWidth:290,background:sideBg,borderRight:`1px solid ${border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>

          {mode==="mapa"&&(
            <>
              <div style={{padding:"10px 14px",borderBottom:`1px solid ${border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:500,color:textPri}}>Ocultar tomados</div>
                  <div style={{fontSize:11,color:textMut}}>{takenCount} de {data.length} tomados hoy</div>
                </div>
                <div onClick={()=>setHideTaken(h=>!h)} style={{width:44,height:24,borderRadius:12,cursor:"pointer",position:"relative",transition:"background 0.2s",background:hideTaken?"#3b82f6":(dark?"#2a3044":"#cbd5e1")}}>
                  <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,transition:"left 0.2s",left:hideTaken?23:3}}/>
                </div>
              </div>
              <div style={{padding:"10px 14px",borderBottom:`1px solid ${border}`}}>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por ID o dirección..."
                  style={{width:"100%",background:inputBg,border:`1px solid ${inputBdr}`,color:textPri,fontSize:13,padding:"8px 12px",borderRadius:8,outline:"none",boxSizing:"border-box"}}/>
              </div>
              <div style={{padding:"10px 14px",borderBottom:`1px solid ${border}`}}>
                <p style={{fontSize:11,color:textMut,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Ventana de entrega</p>
                <select value={filter} onChange={e=>setFilter(e.target.value)} style={{width:"100%",background:inputBg,border:`1px solid ${inputBdr}`,color:textPri,fontSize:13,padding:"8px 12px",borderRadius:8,outline:"none",cursor:"pointer",boxSizing:"border-box"}}>
                  <option value="all">Todas las ventanas</option>
                  {VENTANAS.map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div style={{padding:"10px 14px",borderBottom:`1px solid ${border}`}}>
                <p style={{fontSize:11,color:textMut,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Leyenda — clic para filtrar</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 6px"}}>
                  {VENTANAS.map(v=>(
                    <div key={v} onClick={()=>setFilter(filter===v?"all":v)} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer",padding:"4px 7px",borderRadius:6,background:filter===v?VENTANA_PALETTE[v]+"22":"transparent",border:`1px solid ${filter===v?VENTANA_PALETTE[v]+"66":"transparent"}`}}>
                      <div style={{width:9,height:9,borderRadius:"50%",background:VENTANA_PALETTE[v],flexShrink:0}}/>
                      <span style={{fontWeight:filter===v?600:400,color:filter===v?VENTANA_PALETTE[v]:textMut}}>{v}</span>
                      <span style={{marginLeft:"auto",fontSize:10,color:textMut}}>{countByWindow[v]||0}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:8}}>
                <div style={{padding:"4px 8px 8px",fontSize:11,color:textMut}}>Total: {filtered.length} registros</div>
                {filtered.length===0
                  ?<p style={{textAlign:"center",color:textMut,fontSize:13,padding:20}}>Sin resultados</p>
                  :filtered.map(d=>{
                    const taken=takenIds.has(d.id);
                    return(
                      <div key={d.id} onClick={()=>goTo(d)} style={{padding:"9px 12px",borderRadius:8,cursor:"pointer",marginBottom:3,opacity:taken?0.45:1,border:`1px solid ${selected?.id===d.id?VENTANA_PALETTE[d.window]:"transparent"}`,background:selected?.id===d.id?VENTANA_PALETTE[d.window]+"15":"transparent",transition:"all 0.15s"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                          <span style={{fontSize:13,fontWeight:600,color:taken?textMut:textPri,textDecoration:taken?"line-through":"none"}}>{d.id}</span>
                          <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:600,background:taken?(dark?"#1e2436":"#f1f5f9"):VENTANA_PALETTE[d.window]+"28",color:taken?"#475569":VENTANA_PALETTE[d.window]}}>
                            {taken?"Tomado":d.window}
                          </span>
                        </div>
                        <div style={{fontSize:11,color:textMut,lineHeight:1.4}}>{d.address}</div>
                      </div>
                    );
                  })
                }
              </div>
            </>
          )}

          {mode==="ruteo"&&(
            <>
              <div style={{padding:"12px 14px",borderBottom:`1px solid ${border}`}}>
                <p style={{fontSize:11,color:textMut,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Paso 1 — Ventana de entrega</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                  {VENTANAS.filter(v=>windowCounts[v]>0).map(v=>(
                    <button key={v} onClick={()=>{setSelectedWindow(v);setRoutes([]);setActiveRoute(null);setSinAsignar([]);}} style={{padding:"8px 6px",borderRadius:6,border:`1px solid ${selectedWindow===v?VENTANA_PALETTE[v]:border}`,background:selectedWindow===v?VENTANA_PALETTE[v]:"transparent",color:selectedWindow===v?"#fff":textMut,fontSize:12,fontWeight:500,cursor:"pointer"}}>
                      {v} <span style={{opacity:0.75,fontSize:10}}>({windowCounts[v]})</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{padding:"12px 14px",borderBottom:`1px solid ${border}`}}>
                <p style={{fontSize:11,color:textMut,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Paso 2 — Pedidos por ruta</p>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <button onClick={()=>setBatchSize(b=>Math.max(2,b-1))} style={{width:30,height:30,borderRadius:6,background:inputBg,border:`1px solid ${inputBdr}`,color:textMut,fontSize:18,cursor:"pointer"}}>−</button>
                  <span style={{fontSize:24,fontWeight:600,color:textPri,minWidth:32,textAlign:"center"}}>{batchSize}</span>
                  <button onClick={()=>setBatchSize(b=>Math.min(10,b+1))} style={{width:30,height:30,borderRadius:6,background:inputBg,border:`1px solid ${inputBdr}`,color:textMut,fontSize:18,cursor:"pointer"}}>+</button>
                  <span style={{fontSize:12,color:textMut}}>pedidos por ruta</span>
                </div>
                {zones.length>0&&<div style={{marginTop:8,fontSize:11,color:"#f59e0b"}}>⚠ {zones.length} zona{zones.length>1?"s":""} de exclusión activa{zones.length>1?"s":""}</div>}
              </div>
              <div style={{padding:"12px 14px",borderBottom:`1px solid ${border}`}}>
                <button onClick={handleGenerate} disabled={!selectedWindow} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",cursor:selectedWindow?"pointer":"default",fontSize:13,fontWeight:500,color:"#fff",background:selectedWindow?VENTANA_PALETTE[selectedWindow]:"#334155"}}>
                  {selectedWindow?`Generar rutas para ${selectedWindow}`:"Selecciona una ventana primero"}
                </button>
              </div>
              <div style={{flex:1,overflowY:"auto",padding:8}}>
                {routes.length===0?(
                  <div style={{textAlign:"center",color:textMut,fontSize:13,padding:"24px 16px",lineHeight:1.6}}>Selecciona una ventana y genera las rutas</div>
                ):(
                  <>
                    <div style={{padding:"4px 8px 8px",fontSize:11,color:textMut}}>
                      {routes.length} rutas · {routes.reduce((s,r)=>s+r.orders.length,0)} asignados
                      {sinAsignar.length>0&&<span style={{color:"#f59e0b",marginLeft:6}}>· {sinAsignar.length} excluidos</span>}
                    </div>
                    {routes.map(r=>(
                      <div key={r.id} style={{borderRadius:8,border:`1.5px solid ${activeRoute===r.id?r.color:border}`,marginBottom:5,overflow:"hidden",background:r.hidden?(dark?"#0f1117":"#f8fafc"):(activeRoute===r.id?r.color+"10":"transparent"),opacity:r.hidden?0.5:1}}>
                        <div style={{padding:"8px 10px",display:"flex",alignItems:"center",gap:7}}>
                          <div onClick={()=>setActiveRoute(activeRoute===r.id?null:r.id)} style={{display:"flex",alignItems:"center",gap:7,flex:1,cursor:"pointer"}}>
                            <div style={{width:22,height:22,borderRadius:"50%",background:r.hidden?"#475569":r.color,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff"}}>{r.routeNum}</div>
                            <span style={{fontSize:12,fontWeight:600,color:r.hidden?textMut:textPri}}>{r.label}</span>
                            <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:600,background:r.color+"25",color:r.color}}>{r.orders.length} stops</span>
                          </div>
                          <div onClick={()=>toggleHideRoute(r.id)} title={r.hidden?"Mostrar":"Ocultar"} style={{width:36,height:20,borderRadius:10,cursor:"pointer",position:"relative",flexShrink:0,transition:"background 0.2s",background:r.hidden?(dark?"#2a3044":"#cbd5e1"):r.color+"99"}}>
                            <div style={{width:14,height:14,borderRadius:"50%",background:"#fff",position:"absolute",top:3,transition:"left 0.2s",left:r.hidden?3:19}}/>
                          </div>
                        </div>
                        {activeRoute===r.id&&!r.hidden&&(
                          <div style={{padding:"0 10px 8px"}}>
                            {r.orders.map((o,i)=>{
                              const taken=takenIds.has(o.id);
                              return(
                                <div key={o.id} style={{fontSize:11,color:taken?"#475569":textMut,padding:"2px 0",display:"flex",gap:5,alignItems:"center"}}>
                                  <span style={{color:"#475569",fontWeight:500,width:14,flexShrink:0}}>{i+1}.</span>
                                  <span style={{textDecoration:taken?"line-through":"none"}}>{o.id} — {o.address.split(",")[0]}</span>
                                  {taken&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:6,background:"#1e2436",color:"#475569"}}>Tomado</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                    {sinAsignar.length>0&&(
                      <div style={{borderRadius:8,border:"1px solid #854f0b",marginTop:8,overflow:"hidden",background:dark?"#1c1206":"#fffbeb"}}>
                        <div style={{padding:"8px 10px",display:"flex",alignItems:"center",gap:7}}>
                          <div style={{width:9,height:9,borderRadius:"50%",background:"#f59e0b",flexShrink:0}}/>
                          <span style={{fontSize:12,fontWeight:600,color:"#f59e0b",flex:1}}>Excluidos / Sin asignar</span>
                          <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:600,background:"#f59e0b25",color:"#f59e0b"}}>{sinAsignar.length}</span>
                        </div>
                        <div style={{padding:"0 10px 8px"}}>
                          {sinAsignar.map(o=>(
                            <div key={o.id} style={{fontSize:11,color:textMut,padding:"1px 0",display:"flex",gap:5}}>
                              {o.excluded&&<span style={{color:"#ef4444",fontSize:10}}>✕</span>}
                              <span>{o.id} — {o.address.split(",")[0]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {mode==="zonas"&&(
            <>
              <div style={{padding:"12px 14px",borderBottom:`1px solid ${border}`}}>
                <p style={{fontSize:11,color:textMut,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Zonas de exclusión</p>
                <p style={{fontSize:12,color:textMut,marginBottom:10,lineHeight:1.5}}>Los pedidos dentro de estas zonas serán excluidos del ruteo automáticamente.</p>
                {!drawing?(
                  <button onClick={()=>setDrawing(true)} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:"#fff",background:"#ef4444"}}>
                    + Dibujar nueva zona
                  </button>
                ):(
                  <div>
                    <div style={{fontSize:12,color:"#f59e0b",marginBottom:8,padding:"8px",background:dark?"#1c1206":"#fffbeb",borderRadius:6,lineHeight:1.5}}>
                      Haz clic en el mapa para marcar los puntos. Mínimo 3 puntos.
                      <br/><strong style={{color:"#f1f5f9"}}>{currentPoints.length} puntos</strong> marcados
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={closePolygon} disabled={currentPoints.length<3} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:currentPoints.length>=3?"pointer":"default",fontSize:12,fontWeight:500,color:"#fff",background:currentPoints.length>=3?"#22c55e":"#334155"}}>
                        Cerrar zona
                      </button>
                      <button onClick={cancelDrawing} style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${border}`,cursor:"pointer",fontSize:12,fontWeight:500,color:textMut,background:"transparent"}}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{flex:1,overflowY:"auto",padding:8}}>
                {zones.length===0?(
                  <div style={{textAlign:"center",color:textMut,fontSize:13,padding:"24px 16px",lineHeight:1.6}}>
                    No hay zonas de exclusión. Dibuja una en el mapa.
                  </div>
                ):(
                  zones.map(z=>(
                    <div key={z.id} style={{borderRadius:8,border:`1px solid ${z.color}44`,marginBottom:5,padding:"10px 12px",background:z.color+"11"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:z.color,flexShrink:0}}/>
                        <span style={{fontSize:13,fontWeight:600,color:textPri,flex:1}}>{z.name}</span>
                        <button onClick={()=>{setDeleteConfirm(z.id);setDeletePassword("");setDeleteError("");}} style={{fontSize:11,padding:"2px 8px",borderRadius:6,border:`1px solid #ef444444`,background:"#ef444411",color:"#ef4444",cursor:"pointer"}}>
                          Borrar
                        </button>
                      </div>
                      <div style={{fontSize:11,color:textMut,marginTop:4}}>{z.points.length} puntos · creada {new Date(z.createdAt).toLocaleDateString("es-CL")}</div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </aside>

        {/* Mapa */}
        <div style={{flex:1,position:"relative"}}>
          {!isLoaded
            ?<div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#475569"}}>Cargando mapa...</div>
            :(
              <GoogleMap
                mapContainerStyle={{width:"100%",height:"100%"}}
                center={MAP_CENTER} zoom={11} onLoad={onLoad}
                onClick={mode==="zonas"&&drawing?handleMapClick:undefined}
                options={{styles:dark?MAP_STYLE_DARK:MAP_STYLE_LIGHT,zoomControl:true,cursor:drawing?"crosshair":"grab"}}
              >
                {/* Zonas de exclusión siempre visibles */}
                {zones.map(z=>(
                  <Polygon key={z.id} paths={z.points}
                    options={{fillColor:z.color,fillOpacity:0.15,strokeColor:z.color,strokeOpacity:0.8,strokeWeight:2,strokeDashArray:"8 4"}}/>
                ))}

                {/* Polígono en construcción */}
                {drawing&&currentPoints.length>=2&&(
                  <Polygon paths={currentPoints}
                    options={{fillColor:"#ef4444",fillOpacity:0.1,strokeColor:"#ef4444",strokeOpacity:0.8,strokeWeight:2}}/>
                )}
                {drawing&&currentPoints.map((p,i)=>(
                  <Marker key={i} position={p} icon={{url:`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#ef4444" stroke="white" stroke-width="1.5"/></svg>`)}`,scaledSize:{width:12,height:12},anchor:{x:6,y:6}}}/>
                ))}

                {/* Modo Mapa */}
                {mode==="mapa"&&filtered.map(d=>(
                  <Marker key={d.id} position={{lat:d.lat,lng:d.lng}} icon={makePinSvg(VENTANA_PALETTE[d.window],takenIds.has(d.id))} onClick={()=>setSelected(d)}/>
                ))}

                {mode==="mapa"&&selected&&(
                  <InfoWindow position={{lat:selected.lat,lng:selected.lng}} onCloseClick={()=>setSelected(null)}>
                    <div style={{fontFamily:"sans-serif",minWidth:180,padding:4}}>
                      <p style={{fontWeight:700,fontSize:14,marginBottom:4,color:"#0f172a"}}>{selected.id}</p>
                      <p style={{fontSize:12,color:"#475569",marginBottom:10,lineHeight:1.4}}>{selected.address}</p>
                      <div style={{display:"flex",gap:6}}>
                        <span style={{fontSize:11,padding:"2px 8px",borderRadius:8,fontWeight:600,background:VENTANA_PALETTE[selected.window]+"25",color:VENTANA_PALETTE[selected.window]}}>{selected.window}</span>
                        <button onClick={()=>toggleTaken(selected.id)} style={{fontSize:11,padding:"3px 10px",borderRadius:8,fontWeight:600,cursor:"pointer",border:"none",background:takenIds.has(selected.id)?"#dcfce7":"#fee2e2",color:takenIds.has(selected.id)?"#15803d":"#b91c1c"}}>
                          {takenIds.has(selected.id)?"✓ Desmarcar":"Marcar tomado"}
                        </button>
                      </div>
                    </div>
                  </InfoWindow>
                )}

                {/* Modo Ruteo */}
                {mode==="ruteo"&&routes.filter(r=>!r.hidden).map(r=>{
                  const hull=convexHull(r.orders);
                  const expanded=expandHull(hull);
                  const isActive=activeRoute===r.id;
                  return(
                    <div key={r.id}>
                      {expanded.length>=3&&(
                        <Polygon paths={expanded} options={{fillColor:r.color,fillOpacity:isActive?0.25:0.1,strokeColor:r.color,strokeOpacity:isActive?1:0.5,strokeWeight:isActive?2.5:1.5}} onClick={()=>setActiveRoute(activeRoute===r.id?null:r.id)}/>
                      )}
                      {isActive&&<Polyline path={r.orders.map(o=>({lat:o.lat,lng:o.lng}))} options={{strokeColor:r.color,strokeOpacity:0.5,strokeWeight:2,geodesic:true}}/>}
                      {r.orders.map(o=>(
                        <Marker key={o.id} position={{lat:o.lat,lng:o.lng}} icon={makeRoutePinSvg(r.color,r.routeNum,takenIds.has(o.id))} onClick={()=>setSelected(o)}/>
                      ))}
                    </div>
                  );
                })}
                {mode==="ruteo"&&sinAsignar.map(o=>(
                  <Marker key={o.id} position={{lat:o.lat,lng:o.lng}} icon={makeExcludedPin()} onClick={()=>setSelected(o)}/>
                ))}
                {mode==="ruteo"&&selected&&(
                  <InfoWindow position={{lat:selected.lat,lng:selected.lng}} onCloseClick={()=>setSelected(null)}>
                    <div style={{fontFamily:"sans-serif",minWidth:180,padding:4}}>
                      <p style={{fontWeight:700,fontSize:14,marginBottom:4,color:"#0f172a"}}>{selected.id}</p>
                      <p style={{fontSize:12,color:"#475569",marginBottom:10,lineHeight:1.4}}>{selected.address}</p>
                      <div style={{display:"flex",gap:6}}>
                        <span style={{fontSize:11,padding:"2px 8px",borderRadius:8,fontWeight:600,background:VENTANA_PALETTE[selected.window]+"25",color:VENTANA_PALETTE[selected.window]}}>{selected.window}</span>
                        <button onClick={()=>toggleTaken(selected.id)} style={{fontSize:11,padding:"3px 10px",borderRadius:8,fontWeight:600,cursor:"pointer",border:"none",background:takenIds.has(selected.id)?"#dcfce7":"#fee2e2",color:takenIds.has(selected.id)?"#15803d":"#b91c1c"}}>
                          {takenIds.has(selected.id)?"✓ Desmarcar":"Marcar tomado"}
                        </button>
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            )
          }

          {/* Modal guardar zona */}
          {showZoneModal&&(
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
              <div style={{background:dark?"#151820":"#fff",borderRadius:12,padding:24,width:320,border:`1px solid ${border}`}}>
                <p style={{fontSize:15,fontWeight:600,color:textPri,marginBottom:16}}>Guardar zona de exclusión</p>
                <div style={{marginBottom:12}}>
                  <p style={{fontSize:12,color:textMut,marginBottom:6}}>Nombre de la zona</p>
                  <input value={zoneName} onChange={e=>setZoneName(e.target.value)} placeholder="Ej: Cerro San Cristóbal"
                    style={{width:"100%",background:inputBg,border:`1px solid ${inputBdr}`,color:textPri,fontSize:13,padding:"8px 12px",borderRadius:8,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div style={{marginBottom:16}}>
                  <p style={{fontSize:12,color:textMut,marginBottom:6}}>Contraseña de administrador</p>
                  <input type="password" value={zonePassword} onChange={e=>setZonePassword(e.target.value)} placeholder="••••••••"
                    style={{width:"100%",background:inputBg,border:`1px solid ${inputBdr}`,color:textPri,fontSize:13,padding:"8px 12px",borderRadius:8,outline:"none",boxSizing:"border-box"}}/>
                </div>
                {zoneError&&<p style={{fontSize:12,color:"#ef4444",marginBottom:12}}>{zoneError}</p>}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={saveZone} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:"#fff",background:"#22c55e"}}>Guardar</button>
                  <button onClick={cancelDrawing} style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${border}`,cursor:"pointer",fontSize:13,color:textMut,background:"transparent"}}>Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {/* Modal borrar zona */}
          {deleteConfirm&&(
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
              <div style={{background:dark?"#151820":"#fff",borderRadius:12,padding:24,width:300,border:`1px solid ${border}`}}>
                <p style={{fontSize:15,fontWeight:600,color:textPri,marginBottom:8}}>Borrar zona</p>
                <p style={{fontSize:12,color:textMut,marginBottom:16}}>Esta acción es permanente. Ingresa la contraseña para confirmar.</p>
                <input type="password" value={deletePassword} onChange={e=>setDeletePassword(e.target.value)} placeholder="Contraseña"
                  style={{width:"100%",background:inputBg,border:`1px solid ${inputBdr}`,color:textPri,fontSize:13,padding:"8px 12px",borderRadius:8,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
                {deleteError&&<p style={{fontSize:12,color:"#ef4444",marginBottom:8}}>{deleteError}</p>}
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button onClick={deleteZone} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:"#fff",background:"#ef4444"}}>Borrar</button>
                  <button onClick={()=>setDeleteConfirm(null)} style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${border}`,cursor:"pointer",fontSize:13,color:textMut,background:"transparent"}}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
