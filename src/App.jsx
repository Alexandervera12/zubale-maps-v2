import React, { useState, useCallback, useRef, useEffect } from "react";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Polygon, Polyline } from "@react-google-maps/api";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, writeBatch } from "firebase/firestore";

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

function makeRoutePinSvg(hex, routeNum, taken=false) {
  const c=taken?"#64748b":(hex||"#3b82f6");
  return {
    url:`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.27 0 0 6.27 0 14C0 24.5 14 36 14 36S28 24.5 28 14C28 6.27 21.73 0 14 0Z" fill="${c}" opacity="${taken?0.4:1}"/><circle cx="14" cy="14" r="9" fill="white" opacity="0.95"/><text x="14" y="18" text-anchor="middle" font-size="11" font-weight="700" fill="${c}" font-family="sans-serif">${routeNum}</text></svg>`)}`,
    scaledSize:{width:28,height:36},anchor:{x:14,y:36},
  };
}
function makePinSvg(hex, taken=false) {
  const c=taken?"#64748b":(hex||"#3b82f6");
  return {
    url:`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30"><path d="M11 0C4.93 0 0 4.93 0 11C0 19.25 11 30 11 30S22 19.25 22 11C22 4.93 17.07 0 11 0Z" fill="${c}" opacity="${taken?0.4:1}"/><circle cx="11" cy="11" r="4.5" fill="white" opacity="0.9"/>${taken?`<line x1="7" y1="7" x2="15" y2="15" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>`:""}
</svg>`)}`,
    scaledSize:{width:22,height:30},anchor:{x:11,y:30},
  };
}
function makeExcludedPin() {
  return { url:`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30"><path d="M11 0C4.93 0 0 4.93 0 11C0 19.25 11 30 11 30S22 19.25 22 11C22 4.93 17.07 0 11 0Z" fill="#ef4444" opacity="0.5"/><circle cx="11" cy="11" r="4.5" fill="white" opacity="0.8"/><text x="11" y="15" text-anchor="middle" font-size="10" font-weight="700" fill="#ef4444" font-family="sans-serif">✕</text></svg>`)}`,scaledSize:{width:22,height:30},anchor:{x:11,y:30}};
}
function makePendingPin() {
  return { url:`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30"><path d="M11 0C4.93 0 0 4.93 0 11C0 19.25 11 30 11 30S22 19.25 22 11C22 4.93 17.07 0 11 0Z" fill="#94a3b8" opacity="0.7"/><circle cx="11" cy="11" r="4.5" fill="white" opacity="0.8"/><text x="11" y="15" text-anchor="middle" font-size="10" font-weight="700" fill="#94a3b8" font-family="sans-serif">?</text></svg>`)}`,scaledSize:{width:22,height:30},anchor:{x:11,y:30}};
}

const MAP_CENTER={lat:-33.47,lng:-70.64};
const MAP_STYLE_DARK=[
  {elementType:"geometry",stylers:[{color:"#1a1f2e"}]},
  {elementType:"labels.text.stroke",stylers:[{color:"#1a1f2e"}]},
  {elementType:"labels.text.fill",stylers:[{color:"#64748b"}]},
  {featureType:"road",elementType:"geometry",stylers:[{color:"#2a3044"}]},
  {featureType:"road.highway",elementType:"geometry",stylers:[{color:"#3b4460"}]},
  {featureType:"water",elementType:"geometry",stylers:[{color:"#0f172a"}]},
  {featureType:"poi",stylers:[{visibility:"off"}]},
  {featureType:"transit",stylers:[{visibility:"off"}]},
];
const MAP_STYLE_LIGHT=[
  {featureType:"poi",stylers:[{visibility:"off"}]},
  {featureType:"transit",stylers:[{visibility:"off"}]},
];

// ── Haversine ─────────────────────────────────────────────────────
function distKm(a,b) {
  const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180;
  const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

// Diámetro = distancia máxima entre cualquier par del grupo
// Diámetro = distancia máxima entre cualquier par del grupo
function groupDiameter(group) {
  let max = 0;
  for (let i = 0; i < group.length; i++)
    for (let j = i+1; j < group.length; j++)
      max = Math.max(max, distKm(group[i], group[j]));
  return max;
}

// PASO 1: Solución inicial greedy — grupo más compacto disponible
function greedyRoutes(orders, batchSize, maxDistKm) {
  const pool = [...orders];
  const routes = [];
  let colorIdx = 0;
  while (pool.length >= batchSize) {
    let bestGrp = null, bestDiam = Infinity;
    for (let si = 0; si < pool.length; si++) {
      const seed = pool[si];
      const neighbors = pool.filter((_,i)=>i!==si).sort((a,b)=>distKm(seed,a)-distKm(seed,b)).slice(0,Math.min((batchSize-1)*4,pool.length-1));
      const need = batchSize-1;
      function combine(start,current) {
        if(current.length===need){
          const grp=[seed,...current];
          const diam=groupDiameter(grp);
          const cost=groupDiameter(grp);
          if(diam<=maxDistKm&&cost<bestDiam){bestDiam=cost;bestGrp=[...grp];}
          return;
        }
        if(neighbors.length-start<need-current.length)return;
        for(let i=start;i<neighbors.length;i++)combine(i+1,[...current,neighbors[i]]);
      }
      combine(0,[]);
    }
    if(!bestGrp)break;
    bestGrp.forEach(o=>{const idx=pool.findIndex(p=>p.id===o.id);if(idx!==-1)pool.splice(idx,1);});
    routes.push({id:`R${routes.length+1}`,label:`Ruta ${routes.length+1}`,color:ROUTE_COLORS[colorIdx%ROUTE_COLORS.length],orders:bestGrp,hidden:false,routeNum:routes.length+1});
    colorIdx++;
  }
  return {routes,sinAsignar:pool};
}

// PASO 2: Recocido simulado (Simulated Annealing)
// Acepta swaps que empeoran levemente para escapar mínimos locales
// Encuentra soluciones que el swap greedy no puede ver
function optimizeSwaps(routes, maxDistKm) {
  if(routes.length<2)return routes;
  
  function totalCost(rs){return rs.reduce((s,r)=>s+groupDiameter(r.orders),0);}
  
  // Primero hacer swap greedy determinístico
  const rs=routes.map(r=>({...r,orders:[...r.orders]}));
  let improved=true;
  while(improved){
    improved=false;
    for(let ri=0;ri<rs.length;ri++){
      for(let rj=ri+1;rj<rs.length;rj++){
        for(let pi=0;pi<rs[ri].orders.length;pi++){
          for(let pj=0;pj<rs[rj].orders.length;pj++){
            const dBefore=groupDiameter(rs[ri].orders)+groupDiameter(rs[rj].orders);
            const tmp=rs[ri].orders[pi];rs[ri].orders[pi]=rs[rj].orders[pj];rs[rj].orders[pj]=tmp;
            const d1=groupDiameter(rs[ri].orders),d2=groupDiameter(rs[rj].orders);
            if(groupDiameter(rs[ri].orders)+groupDiameter(rs[rj].orders)<dBefore&&d1<=maxDistKm&&d2<=maxDistKm){improved=true;}
            else{rs[rj].orders[pj]=rs[ri].orders[pi];rs[ri].orders[pi]=tmp;}
          }
        }
      }
    }
  }
  
  // Luego recocido simulado para escapar mínimos locales
  let current=rs.map(r=>({...r,orders:[...r.orders]}));
  let best=current.map(r=>({...r,orders:[...r.orders]}));
  let bestCost=totalCost(best);
  let temp=2.0;
  const cooling=0.993;
  const iterations=Math.min(3000, routes.length*routes[0].orders.length*200);
  
  for(let iter=0;iter<iterations;iter++){
    temp*=cooling;
    const ri=Math.floor(Math.random()*current.length);
    let rj=Math.floor(Math.random()*current.length);
    while(rj===ri)rj=Math.floor(Math.random()*current.length);
    const pi=Math.floor(Math.random()*current[ri].orders.length);
    const pj=Math.floor(Math.random()*current[rj].orders.length);
    const costBefore=groupDiameter(current[ri].orders)+groupDiameter(current[rj].orders);
    const tmp=current[ri].orders[pi];current[ri].orders[pi]=current[rj].orders[pj];current[rj].orders[pj]=tmp;
    const d1=groupDiameter(current[ri].orders),d2=groupDiameter(current[rj].orders);
    const delta=(groupDiameter(current[ri].orders)+groupDiameter(current[rj].orders))-costBefore;
    const accept=delta<0||(Math.random()<Math.exp(-delta/temp));
    if(accept&&d1<=maxDistKm&&d2<=maxDistKm){
      const newCost=totalCost(current);
      if(newCost<bestCost){bestCost=newCost;best=current.map(r=>({...r,orders:[...r.orders]}));}
    } else {
      current[rj].orders[pj]=current[ri].orders[pi];current[ri].orders[pi]=tmp;
    }
  }
  return best;
}

// PASO 3: Intentar absorber pendientes en rutas existentes via swap
function absorbPending(routes, sinAsignar, maxDistKm) {
  if(sinAsignar.length===0||routes.length===0)return{routes,sinAsignar};
  const rs=routes.map(r=>({...r,orders:[...r.orders]}));
  const remaining=[...sinAsignar];
  for(let pi=remaining.length-1;pi>=0;pi--){
    const pending=remaining[pi];
    let bestRi=-1,bestOi=-1,bestImprovement=0;
    for(let ri=0;ri<rs.length;ri++){
      for(let oi=0;oi<rs[ri].orders.length;oi++){
        const dBefore=groupDiameter(rs[ri].orders);
        const testOrders=[...rs[ri].orders];testOrders[oi]=pending;
        const dAfter=groupDiameter(testOrders);
        const improvement=dBefore-dAfter;
        if(groupDiameter(testOrders)<=maxDistKm&&improvement>bestImprovement){bestImprovement=improvement;bestRi=ri;bestOi=oi;}
      }
    }
    if(bestRi!==-1){
      const displaced=rs[bestRi].orders[bestOi];
      rs[bestRi].orders[bestOi]=pending;
      remaining.splice(pi,1);
      remaining.push(displaced);
    }
  }
  return{routes:rs,sinAsignar:remaining};
}

// Pipeline: greedy → swap optimization → absorb pending
function generateRoutes(orders, batchSize, maxDistKm) {
  if(orders.length===0)return{routes:[],sinAsignar:[]};
  const{routes:initial,sinAsignar}=greedyRoutes(orders,batchSize,maxDistKm);
  const optimized=optimizeSwaps(initial,maxDistKm);
  return absorbPending(optimized,sinAsignar,maxDistKm);
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
function pointInPolygon(point,polygon) {
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const xi=polygon[i].lng,yi=polygon[i].lat,xj=polygon[j].lng,yj=polygon[j].lat;
    if(((yi>point.lat)!==(yj>point.lat))&&(point.lng<(xj-xi)*(point.lat-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}
function isExcluded(order,zones){return zones.some(z=>pointInPolygon({lat:order.lat,lng:order.lng},z.points));}
function getTodayKey(){return new Date().toISOString().split("T")[0];}
function getRoutedKey(){return `routed_${new Date().toISOString().split("T")[0]}`;}

const MOCK_DATA=[
  {id:"SG-001",address:"Av. Providencia 1234, Providencia",window:"V9",lat:-33.432,lng:-70.608},
  {id:"SG-002",address:"Av. Apoquindo 4500, Las Condes",window:"V10",lat:-33.415,lng:-70.580},
];

export default function App() {
  const GOOGLE_MAPS_API_KEY=import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const SHEETS_URL=import.meta.env.VITE_SHEETS_URL;
  const {isLoaded}=useJsApiLoader({googleMapsApiKey:GOOGLE_MAPS_API_KEY});

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
  const [routedIds,setRoutedIds] = useState(new Set());
  const [selectedWindow,setSelectedWindow] = useState(null);
  const [generating,setGenerating]         = useState(false);
  const [reassigning,setReassigning]       = useState(null);
  const [batchSize,setBatchSize]           = useState(3);
  const [maxDistKm,setMaxDistKm]           = useState(3);
  const [routes,setRoutes]                 = useState([]);
  const [activeRoute,setActiveRoute]       = useState(null);
  const [sinAsignar,setSinAsignar]         = useState([]);
  const [excludedOrders,setExcludedOrders] = useState([]);
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

  // Zonas de organización
  const [orgZones,setOrgZones]             = useState([]);
  const [drawingOrg,setDrawingOrg]         = useState(false);
  const [orgPoints,setOrgPoints]           = useState([]);
  const [showOrgModal,setShowOrgModal]     = useState(false);
  const [orgZoneName,setOrgZoneName]       = useState("");
  const [orgZoneColor,setOrgZoneColor]     = useState("#3b82f6");
  const [orgPassword,setOrgPassword]       = useState("");
  const [orgError,setOrgError]             = useState("");
  const [activeOrgZone,setActiveOrgZone]   = useState(null);
  const [orgFilter,setOrgFilter]           = useState("all");
  const [deleteOrgConfirm,setDeleteOrgConfirm] = useState(null);
  const [deleteOrgPassword,setDeleteOrgPassword] = useState("");
  const [deleteOrgError,setDeleteOrgError] = useState("");

  const zKeyRef=useRef(0);
  const xKeyRef=useRef(0);
  useEffect(()=>{
    const h=(e)=>{
      if(e.key==="z"||e.key==="Z"){
        const now=Date.now();
        if(now-zKeyRef.current<600) setMode("zonas");
        zKeyRef.current=now;
      }
      if(e.key==="x"||e.key==="X"){
        const now=Date.now();
        if(now-xKeyRef.current<600){setMode("orgZonas");setDrawingOrg(true);}
        xKeyRef.current=now;
      }
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[]);

  const mapRef=useRef(null);
  const onLoad=useCallback(map=>{mapRef.current=map;},[]);

  const fetchSheets=useCallback(async()=>{
    if(!SHEETS_URL)return;
    setLoading(true);
    try{
      const res=await fetch(SHEETS_URL);
      const json=await res.json();
      if(Array.isArray(json)&&json.length>0){
        const clean=json.filter(d=>d.id&&d.address&&d.window&&typeof d.lat==="number"&&!isNaN(d.lat)&&typeof d.lng==="number"&&!isNaN(d.lng)&&d.lat!==0&&d.lng!==0);
        setData(clean);
        setLastSync(new Date().toLocaleTimeString("es-CL"));
      }
    }catch(e){console.error(e);}
    finally{setLoading(false);}
  },[SHEETS_URL]);

  useEffect(()=>{fetchSheets();const iv=setInterval(fetchSheets,60000);return()=>clearInterval(iv);},[fetchSheets]);
  useEffect(()=>{
    return onSnapshot(collection(db,"taken",getTodayKey(),"orders"),s=>{const ids=new Set();s.forEach(d=>ids.add(d.id));setTakenIds(ids);});
  },[]);
  useEffect(()=>{
    return onSnapshot(collection(db,"routed",getRoutedKey(),"orders"),s=>{const ids=new Set();s.forEach(d=>ids.add(d.id));setRoutedIds(ids);});
  },[]);
  useEffect(()=>{
    return onSnapshot(collection(db,"exclusion_zones"),s=>{const zs=[];s.forEach(d=>zs.push({id:d.id,...d.data()}));setZones(zs);});
  },[]);

  // Firebase: escuchar rutas de la ventana seleccionada en tiempo real
  useEffect(()=>{
    if(!selectedWindow) return;
    const key=getRoutedKey();
    const colRef=collection(db,"shared_routes",key+"_"+selectedWindow,"routes");
    return onSnapshot(colRef,s=>{
      const loaded=[];
      s.forEach(d=>loaded.push({id:d.id,...d.data()}));
      loaded.sort((a,b)=>a.routeNum-b.routeNum);
      if(loaded.length>0) setRoutes(loaded);
      else setRoutes([]);
    });
  },[selectedWindow]);

  async function toggleTaken(id){
    const r=doc(db,"taken",getTodayKey(),"orders",id);
    if(takenIds.has(id))await deleteDoc(r);
    else await setDoc(r,{takenAt:new Date().toISOString()});
    setSelected(null);
  }
  async function markAsRouted(orders){
    const key=getRoutedKey();
    await Promise.all(orders.map(o=>setDoc(doc(db,"routed",key,"orders",o.id),{routedAt:new Date().toISOString()})));
  }

  // Guardar rutas en Firebase (por ventana)
  async function saveRoutesToFirebase(routes) {
    if(!selectedWindow) return;
    const key = getRoutedKey()+"_"+selectedWindow;
    const batch = writeBatch(db);
    routes.forEach(r => {
      const ref = doc(db, "shared_routes", key, "routes", r.id);
      batch.set(ref, {
        id: r.id, label: r.label, color: r.color,
        routeNum: r.routeNum, hidden: r.hidden,
        window: selectedWindow, orders: r.orders,
        updatedAt: new Date().toISOString(),
      });
    });
    await batch.commit();
  }

  // Borrar rutas compartidas (al reordenar)
  async function clearSharedRoutes() {
    const key = getRoutedKey();
    const snap = await collection(db, "shared_routes", key, "routes");
    // Se sobreescriben al guardar nuevas, no hace falta borrar
  }

  // Firebase: zonas de organización (permanentes)
  useEffect(()=>{
    return onSnapshot(collection(db,"org_zones"),s=>{
      const zs=[];s.forEach(d=>zs.push({id:d.id,...d.data()}));
      setOrgZones(zs);
    });
  },[]);

  useEffect(()=>{setSelected(null);setActiveRoute(null);},[mode]);

  async function handleGenerate(includeAll=false){
    if(!selectedWindow||generating)return;
    setGenerating(true);
    await new Promise(r=>setTimeout(r,50)); // allow UI to update
    const windowOrders=data.filter(d=>d.window===selectedWindow);
    const excl=windowOrders.filter(o=>isExcluded(o,zones));
    const nonExcluded=windowOrders.filter(o=>!isExcluded(o,zones));
    const toRoute=includeAll?nonExcluded:nonExcluded.filter(o=>!routedIds.has(o.id));
    const {routes:r,sinAsignar:sa}=generateRoutes(toRoute,batchSize,maxDistKm);
    const ruteados=r.flatMap(rt=>rt.orders);
    if(ruteados.length>0) markAsRouted(ruteados);
    setRoutes(r);
    setSinAsignar(sa);
    setExcludedOrders(excl);
    setActiveRoute(null);
    setGenerating(false);
    // Guardar rutas en Firebase para que todos las vean
    if(r.length>0) saveRoutesToFirebase(r);
    if(mapRef.current&&toRoute.length>0){mapRef.current.panTo({lat:toRoute[0].lat,lng:toRoute[0].lng});mapRef.current.setZoom(12);}
  }

  // Mover un pedido de una ruta a otra manualmente
  function reassignOrder(orderId, fromRouteId, toRouteId) {
    setRoutes(prev => {
      const rs = prev.map(r => ({...r, orders:[...r.orders]}));
      const fromR = rs.find(r=>r.id===fromRouteId);
      const toR   = rs.find(r=>r.id===toRouteId);
      if(!fromR||!toR) return prev;
      const idx = fromR.orders.findIndex(o=>o.id===orderId);
      if(idx===-1) return prev;
      const [order] = fromR.orders.splice(idx,1);
      toR.orders.push(order);
      const updated = rs.filter(r=>r.orders.length>0);
      saveRoutesToFirebase(updated);
      return updated;
    });
    setSelected(null);
    setReassigning(null);
  }

  // Mover un pedido de sinAsignar a una ruta
  function assignToRoute(orderId, toRouteId) {
    setSinAsignar(prev => prev.filter(o=>o.id!==orderId));
    setRoutes(prev => {
      const updated = prev.map(r => r.id===toRouteId ? {...r, orders:[...r.orders, sinAsignar.find(o=>o.id===orderId)].filter(Boolean)} : r);
      saveRoutesToFirebase(updated);
      return updated;
    });
    setSelected(null);
    setReassigning(null);
  }

  function toggleHideRoute(id){setRoutes(prev=>prev.map(r=>r.id===id?{...r,hidden:!r.hidden}:r));}

  // ── Org zones functions ─────────────────────────────────────────
  function cancelOrgDrawing(){setDrawingOrg(false);setOrgPoints([]);setShowOrgModal(false);setOrgZoneName("");setOrgPassword("");setOrgError("");}

  function handleOrgMapClick(e){
    if(!drawingOrg)return;
    setOrgPoints(prev=>[...prev,{lat:e.latLng.lat(),lng:e.latLng.lng()}]);
  }

  function closeOrgPolygon(){
    if(orgPoints.length<3){alert("Mínimo 3 puntos");return;}
    setShowOrgModal(true);
  }

  async function saveOrgZone(){
    if(orgPassword!==ZONE_PASSWORD){setOrgError("Contraseña incorrecta");return;}
    if(!orgZoneName.trim()){setOrgError("Escribe un nombre");return;}
    const id=`orgzone_${Date.now()}`;
    await setDoc(doc(db,"org_zones",id),{
      name:orgZoneName.trim(), points:orgPoints,
      color:orgZoneColor, createdAt:new Date().toISOString(),
    });
    cancelOrgDrawing();
  }

  async function deleteOrgZone(){
    if(deleteOrgPassword!==ZONE_PASSWORD){setDeleteOrgError("Contraseña incorrecta");return;}
    await deleteDoc(doc(db,"org_zones",deleteOrgConfirm));
    setDeleteOrgConfirm(null);setDeleteOrgPassword("");setDeleteOrgError("");
  }

  // Pedidos dentro de una zona
  function ordersInZone(zone){
    return data.filter(d=>pointInPolygon({lat:d.lat,lng:d.lng},zone.points));
  }

  // Pedidos fuera de todas las zonas
  function ordersOutsideAllZones(){
    return data.filter(d=>!orgZones.some(z=>pointInPolygon({lat:d.lat,lng:d.lng},z.points)));
  }

  async function saveZone(){
    if(zonePassword!==ZONE_PASSWORD){setZoneError("Contraseña incorrecta");return;}
    if(!zoneName.trim()){setZoneError("Escribe un nombre");return;}
    if(currentPoints.length<3){setZoneError("Mínimo 3 puntos");return;}
    const id=`zone_${Date.now()}`;
    await setDoc(doc(db,"exclusion_zones",id),{name:zoneName.trim(),points:currentPoints,color:ZONE_COLORS[zones.length%ZONE_COLORS.length],createdAt:new Date().toISOString()});
    setShowZoneModal(false);setZoneName("");setZonePassword("");setZoneError("");setCurrentPoints([]);setDrawing(false);
  }
  async function deleteZone(){
    if(deletePassword!==ZONE_PASSWORD){setDeleteError("Contraseña incorrecta");return;}
    await deleteDoc(doc(db,"exclusion_zones",deleteConfirm));
    setDeleteConfirm(null);setDeletePassword("");setDeleteError("");
  }
  function handleMapClick(e){if(!drawing)return;setCurrentPoints(prev=>[...prev,{lat:e.latLng.lat(),lng:e.latLng.lng()}]);}
  function closePolygon(){if(currentPoints.length<3){alert("Mínimo 3 puntos");return;}setShowZoneModal(true);}
  function cancelDrawing(){setDrawing(false);setCurrentPoints([]);setShowZoneModal(false);setZoneName("");setZonePassword("");setZoneError("");}
  function goTo(d){setSelected(d);if(mapRef.current){mapRef.current.panTo({lat:d.lat,lng:d.lng});mapRef.current.setZoom(16);}}

  const filtered=data.filter(d=>{
    const mf=filter==="all"||d.window===filter;
    const q=search.toLowerCase();
    return mf&&(d.id.toLowerCase().includes(q)||d.address.toLowerCase().includes(q))&&(hideTaken?!takenIds.has(d.id):true);
  });
  const countByWindow=VENTANAS.reduce((acc,v)=>{acc[v]=filtered.filter(d=>d.window===v).length;return acc;},{});
  const takenCount=data.filter(d=>takenIds.has(d.id)).length;
  const windowCounts=VENTANAS.reduce((acc,v)=>{acc[v]=data.filter(d=>d.window===v).length;return acc;},{});
  const pendingCount=selectedWindow?data.filter(d=>d.window===selectedWindow&&!isExcluded(d,zones)&&!routedIds.has(d.id)).length:0;

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
      <div style={{height:48,background:dark?"#151820":"#ffffff",borderBottom:`1px solid ${border}`,display:"flex",alignItems:"center",padding:"0 20px",gap:4,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginRight:16}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#22d3ee"}}/>
          <span style={{fontSize:15,fontWeight:600,color:textPri}}>Zubale Maps</span>
          <span style={{fontSize:11,padding:"1px 7px",borderRadius:10,background:"#1e0535",color:"#d8b4fe",fontWeight:600}}>V2</span>
        </div>
        {["mapa","ruteo","orgZonas",...(mode==="zonas"?["zonas"]:[])].map(m=>(
          <button key={m} onClick={()=>{setMode(m);if(m!=="zonas")cancelDrawing();}} style={{padding:"6px 16px",borderRadius:6,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,background:mode===m?(dark?"#1e2436":"#f1f5f9"):"transparent",color:mode===m?textPri:textMut,borderBottom:mode===m?"2px solid #3b82f6":"2px solid transparent"}}>
            {m==="mapa"?"Mapa":m==="ruteo"?"Ruteo":m==="orgZonas"?"Zonas":"Excl."}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          {SHEETS_URL&&<span onClick={fetchSheets} style={{fontSize:11,padding:"3px 9px",borderRadius:20,background:loading?"#2c1006":"#0c1d35",color:loading?"#fdba74":"#93c5fd",fontWeight:500,cursor:"pointer"}}>{loading?"⟳ Cargando...":lastSync?`⟳ ${lastSync}`:"⟳ Live"}</span>}
          <button onClick={()=>setDarkMap(d=>!d)} style={{background:inputBg,border:`1px solid ${inputBdr}`,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:500,color:textMut}}>{dark?"☀ Claro":"☾ Oscuro"}</button>
        </div>
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        <aside style={{width:290,minWidth:290,background:sideBg,borderRight:`1px solid ${border}`,display:"flex",flexDirection:"column",overflow:"hidden"}}>

          {mode==="mapa"&&(<>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div><div style={{fontSize:12,fontWeight:500,color:textPri}}>Ocultar tomados</div><div style={{fontSize:11,color:textMut}}>{takenCount} de {data.length} tomados hoy</div></div>
              <div onClick={()=>setHideTaken(h=>!h)} style={{width:44,height:24,borderRadius:12,cursor:"pointer",position:"relative",background:hideTaken?"#3b82f6":(dark?"#2a3044":"#cbd5e1")}}>
                <div style={{width:18,height:18,borderRadius:"50%",background:"#fff",position:"absolute",top:3,transition:"left 0.2s",left:hideTaken?23:3}}/>
              </div>
            </div>
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${border}`}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por ID o dirección..." style={{width:"100%",background:inputBg,border:`1px solid ${inputBdr}`,color:textPri,fontSize:13,padding:"8px 12px",borderRadius:8,outline:"none",boxSizing:"border-box"}}/>
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
              {filtered.length===0?<p style={{textAlign:"center",color:textMut,fontSize:13,padding:20}}>Sin resultados</p>
                :filtered.map(d=>{const taken=takenIds.has(d.id);return(
                  <div key={d.id} onClick={()=>goTo(d)} style={{padding:"9px 12px",borderRadius:8,cursor:"pointer",marginBottom:3,opacity:taken?0.45:1,border:`1px solid ${selected?.id===d.id?VENTANA_PALETTE[d.window]:"transparent"}`,background:selected?.id===d.id?VENTANA_PALETTE[d.window]+"15":"transparent",transition:"all 0.15s"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{fontSize:13,fontWeight:600,color:taken?textMut:textPri,textDecoration:taken?"line-through":"none"}}>{d.id}</span>
                      <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:600,background:taken?(dark?"#1e2436":"#f1f5f9"):VENTANA_PALETTE[d.window]+"28",color:taken?"#475569":VENTANA_PALETTE[d.window]}}>{taken?"Tomado":d.window}</span>
                    </div>
                    <div style={{fontSize:11,color:textMut,lineHeight:1.4}}>{d.address}</div>
                  </div>
                );})}
            </div>
          </>)}

          {mode==="ruteo"&&(<>
            <div style={{padding:"12px 14px",borderBottom:`1px solid ${border}`}}>
              <p style={{fontSize:11,color:textMut,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>Paso 1 — Ventana de entrega</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                {VENTANAS.filter(v=>windowCounts[v]>0).map(v=>(
                  <button key={v} onClick={()=>setSelectedWindow(v)} style={{padding:"8px 6px",borderRadius:6,border:`1px solid ${selectedWindow===v?VENTANA_PALETTE[v]:border}`,background:selectedWindow===v?VENTANA_PALETTE[v]:"transparent",color:selectedWindow===v?"#fff":textMut,fontSize:12,fontWeight:500,cursor:"pointer",position:"relative"}}>
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
            </div>
            <div style={{padding:"12px 14px",borderBottom:`1px solid ${border}`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <p style={{fontSize:11,color:textMut,textTransform:"uppercase",letterSpacing:"0.06em"}}>Distancia máx. entre puntos</p>
                <span style={{fontSize:13,fontWeight:600,color:textPri}}>{maxDistKm} km</span>
              </div>
              <input type="range" min="1" max="5" step="0.5" value={maxDistKm} onChange={e=>setMaxDistKm(parseFloat(e.target.value))} style={{width:"100%"}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:textMut,marginTop:3}}>
                <span>1 km</span><span>3 km</span><span>5 km</span>
              </div>
            </div>
            <div style={{padding:"12px 14px",borderBottom:`1px solid ${border}`,display:"flex",flexDirection:"column",gap:6}}>
              {selectedWindow&&<div style={{fontSize:11,color:textMut,marginBottom:2}}>{pendingCount} pendientes · {routedIds.size} ruteados hoy{zones.length>0&&<span style={{color:"#f59e0b",marginLeft:6}}>· {zones.length} zona{zones.length>1?"s":""} excluida{zones.length>1?"s":""}</span>}</div>}
              <button onClick={()=>handleGenerate(false)} disabled={!selectedWindow||pendingCount===0||generating} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",cursor:selectedWindow&&pendingCount>0&&!generating?"pointer":"default",fontSize:13,fontWeight:500,color:"#fff",background:selectedWindow&&pendingCount>0&&!generating?VENTANA_PALETTE[selectedWindow]:"#334155"}}>
                {generating?"⟳ Optimizando rutas...":selectedWindow?pendingCount>0?`Generar rutas (${pendingCount} nuevos)`:"Sin pedidos nuevos":"Selecciona una ventana"}
              </button>
              <button onClick={()=>handleGenerate(true)} disabled={!selectedWindow||generating} style={{width:"100%",padding:"9px",borderRadius:8,border:`1px solid ${border}`,cursor:selectedWindow&&!generating?"pointer":"default",fontSize:12,fontWeight:500,color:textMut,background:"transparent"}}>
                {generating?"⟳ Optimizando...":"Reordenar todo (incluye ya ruteados)"}
              </button>
            </div>
            <div style={{flex:1,overflowY:"auto",padding:8}}>
              {routes.length===0?<div style={{textAlign:"center",color:textMut,fontSize:13,padding:"24px 16px",lineHeight:1.6}}>Selecciona una ventana y genera las rutas</div>:(
                <>
                  <div style={{padding:"4px 8px 8px",fontSize:11,color:textMut}}>
                    {routes.length} rutas · {routes.reduce((s,r)=>s+r.orders.length,0)} asignados
                    {sinAsignar.length>0&&<span style={{color:"#94a3b8",marginLeft:6}}>· {sinAsignar.length} pendientes</span>}
                    {excludedOrders.length>0&&<span style={{color:"#f59e0b",marginLeft:6}}>· {excludedOrders.length} excluidos</span>}
                  </div>
                  {routes.map(r=>(
                    <div key={r.id} style={{borderRadius:8,border:`1.5px solid ${activeRoute===r.id?r.color:border}`,marginBottom:5,overflow:"hidden",background:r.hidden?(dark?"#0f1117":"#f8fafc"):(activeRoute===r.id?r.color+"10":"transparent"),opacity:r.hidden?0.5:1}}>
                      <div style={{padding:"8px 10px",display:"flex",alignItems:"center",gap:7}}>
                        <div onClick={()=>setActiveRoute(activeRoute===r.id?null:r.id)} style={{display:"flex",alignItems:"center",gap:7,flex:1,cursor:"pointer"}}>
                          <div style={{width:22,height:22,borderRadius:"50%",background:r.hidden?"#475569":r.color,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff"}}>{r.routeNum}</div>
                          <span style={{fontSize:12,fontWeight:600,color:r.hidden?textMut:textPri}}>{r.label}</span>
                          <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,fontWeight:600,background:r.color+"25",color:r.color}}>{r.orders.length} stops</span>

                        </div>
                        <div onClick={()=>toggleHideRoute(r.id)} style={{width:36,height:20,borderRadius:10,cursor:"pointer",position:"relative",flexShrink:0,background:r.hidden?(dark?"#2a3044":"#cbd5e1"):r.color+"99"}}>
                          <div style={{width:14,height:14,borderRadius:"50%",background:"#fff",position:"absolute",top:3,transition:"left 0.2s",left:r.hidden?3:19}}/>
                        </div>
                      </div>
                      {activeRoute===r.id&&!r.hidden&&(
                        <div style={{padding:"0 10px 8px"}}>
                          {r.orders.map((o,i)=>{const taken=takenIds.has(o.id);return(
                            <div key={o.id} style={{fontSize:11,color:taken?"#475569":textMut,padding:"2px 0",display:"flex",gap:5,alignItems:"center"}}>
                              <span style={{color:"#475569",fontWeight:500,width:14,flexShrink:0}}>{i+1}.</span>
                              <span style={{textDecoration:taken?"line-through":"none"}}>{o.id} — {o.address.split(",")[0]}</span>
                              {taken&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:6,background:"#1e2436",color:"#475569"}}>Tomado</span>}
                            </div>
                          );})}
                        </div>
                      )}
                    </div>
                  ))}
                  {sinAsignar.length>0&&(
                    <div style={{borderRadius:8,border:`1px solid ${dark?"#2a3044":"#cbd5e1"}`,marginTop:8,overflow:"hidden",background:dark?"#151820":"#f8fafc"}}>
                      <div style={{padding:"8px 10px",display:"flex",alignItems:"center",gap:7}}>
                        <div style={{width:9,height:9,borderRadius:"50%",background:"#94a3b8",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:600,color:textMut,flex:1}}>Sin ruta (quedan disponibles)</span>
                        <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:dark?"#1e2436":"#f1f5f9",color:textMut}}>{sinAsignar.length}</span>
                      </div>
                      <div style={{padding:"0 10px 8px"}}>
                        <div style={{fontSize:11,color:textMut,marginBottom:4}}>No completaron el batch de {batchSize} dentro de {maxDistKm}km.</div>
                        {sinAsignar.map(o=><div key={o.id} style={{fontSize:11,color:textMut,padding:"1px 0"}}>{o.id} — {o.address.split(",")[0]}</div>)}
                      </div>
                    </div>
                  )}
                  {excludedOrders.length>0&&(
                    <div style={{borderRadius:8,border:"1px solid #854f0b",marginTop:6,overflow:"hidden",background:dark?"#1c1206":"#fffbeb"}}>
                      <div style={{padding:"8px 10px",display:"flex",alignItems:"center",gap:7}}>
                        <div style={{width:9,height:9,borderRadius:"50%",background:"#f59e0b",flexShrink:0}}/>
                        <span style={{fontSize:12,fontWeight:600,color:"#f59e0b",flex:1}}>Zona excluida</span>
                        <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:"#f59e0b25",color:"#f59e0b"}}>{excludedOrders.length}</span>
                      </div>
                      <div style={{padding:"0 10px 8px"}}>
                        {excludedOrders.map(o=><div key={o.id} style={{fontSize:11,color:textMut,padding:"1px 0",display:"flex",gap:5}}><span style={{color:"#ef4444",fontSize:10}}>✕</span><span>{o.id} — {o.address.split(",")[0]}</span></div>)}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>)}

          {mode==="orgZonas"&&(<>
            <div style={{padding:"12px 14px",borderBottom:`1px solid ${border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"#22c55e"}}/>
                <p style={{fontSize:13,fontWeight:600,color:textPri}}>Zonas de organización</p>
              </div>
              <p style={{fontSize:12,color:textMut,marginBottom:10,lineHeight:1.5}}>Agrupa pedidos por zona geográfica. Doble X para dibujar.</p>
              {/* Filtro ventana */}
              <select value={orgFilter} onChange={e=>setOrgFilter(e.target.value)} style={{width:"100%",background:inputBg,border:`1px solid ${inputBdr}`,color:textPri,fontSize:13,padding:"7px 10px",borderRadius:8,outline:"none",cursor:"pointer",boxSizing:"border-box",marginBottom:8}}>
                <option value="all">Todas las ventanas</option>
                {VENTANAS.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              {drawingOrg&&(
                <div>
                  <div style={{fontSize:12,color:"#f59e0b",marginBottom:8,padding:"8px",background:dark?"#1c1206":"#fffbeb",borderRadius:6,lineHeight:1.5}}>
                    Clic en el mapa para marcar puntos. Mínimo 3.<br/>
                    <strong style={{color:"#f1f5f9"}}>{orgPoints.length} puntos</strong> marcados
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={closeOrgPolygon} disabled={orgPoints.length<3} style={{flex:1,padding:"7px",borderRadius:8,border:"none",cursor:orgPoints.length>=3?"pointer":"default",fontSize:12,fontWeight:500,color:"#fff",background:orgPoints.length>=3?"#22c55e":"#334155"}}>Guardar zona</button>
                    <button onClick={cancelOrgDrawing} style={{flex:1,padding:"7px",borderRadius:8,border:`1px solid ${border}`,cursor:"pointer",fontSize:12,color:textMut,background:"transparent"}}>Cancelar</button>
                  </div>
                </div>
              )}
            </div>
            <div style={{flex:1,overflowY:"auto",padding:8}}>
              {orgZones.length===0&&!drawingOrg?(
                <div style={{textAlign:"center",color:textMut,fontSize:13,padding:"24px 16px",lineHeight:1.6}}>
                  No hay zonas. Presiona doble X para dibujar.
                </div>
              ):(
                <>
                  {orgZones.map(z=>{
                    const allOrders=ordersInZone(z);
                    const filtered=orgFilter==="all"?allOrders:allOrders.filter(d=>d.window===orgFilter);
                    const isActive=activeOrgZone===z.id;
                    return(
                      <div key={z.id} style={{borderRadius:8,border:`1.5px solid ${isActive?z.color:border}`,marginBottom:6,overflow:"hidden",background:isActive?z.color+"12":"transparent"}}>
                        <div style={{padding:"9px 12px",display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setActiveOrgZone(isActive?null:z.id)}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:z.color,flexShrink:0}}/>
                          <span style={{fontSize:13,fontWeight:600,color:textPri,flex:1}}>{z.name}</span>
                          <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:z.color+"25",color:z.color,fontWeight:600}}>{filtered.length} pedidos</span>
                          <button onClick={e=>{e.stopPropagation();setDeleteOrgConfirm(z.id);setDeleteOrgPassword("");setDeleteOrgError("");}} style={{fontSize:10,padding:"2px 7px",borderRadius:6,border:`1px solid #ef444444`,background:"#ef444411",color:"#ef4444",cursor:"pointer"}}>✕</button>
                        </div>
                        {isActive&&(
                          <div style={{padding:"0 10px 10px",maxHeight:200,overflowY:"auto"}}>
                            {filtered.length===0
                              ?<p style={{fontSize:11,color:textMut}}>Sin pedidos {orgFilter!=="all"?`en ${orgFilter}`:""}</p>
                              :filtered.map(d=>(
                                <div key={d.id} onClick={()=>goTo(d)} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 0",cursor:"pointer",fontSize:11,color:textMut}}>
                                  <div style={{width:6,height:6,borderRadius:"50%",background:VENTANA_PALETTE[d.window]||"#64748b",flexShrink:0}}/>
                                  <span style={{color:textPri,fontWeight:500}}>{d.id}</span>
                                  <span style={{fontSize:10,padding:"1px 5px",borderRadius:6,background:VENTANA_PALETTE[d.window]+"22",color:VENTANA_PALETTE[d.window]}}>{d.window}</span>
                                  <span style={{fontSize:10,color:textMut,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.address.split(",")[0]}</span>
                                </div>
                              ))
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {/* Pedidos fuera de zonas */}
                  {(()=>{
                    const outside=ordersOutsideAllZones();
                    const filtered=orgFilter==="all"?outside:outside.filter(d=>d.window===orgFilter);
                    if(filtered.length===0) return null;
                    return(
                      <div style={{borderRadius:8,border:`1px solid ${dark?"#2a3044":"#cbd5e1"}`,marginTop:4,overflow:"hidden"}}>
                        <div style={{padding:"9px 12px",display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:10,height:10,borderRadius:"50%",background:"#64748b",flexShrink:0}}/>
                          <span style={{fontSize:12,fontWeight:600,color:textMut,flex:1}}>Sin zona asignada</span>
                          <span style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:dark?"#1e2436":"#f1f5f9",color:textMut,fontWeight:600}}>{filtered.length}</span>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </>)}

          {mode==="zonas"&&(<>
            <div style={{padding:"12px 14px",borderBottom:`1px solid ${border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{width:8,height:8,borderRadius:"50%",background:"#ef4444"}}/>
                <p style={{fontSize:13,fontWeight:600,color:textPri}}>Zonas de exclusión</p>
                <button onClick={()=>setMode("mapa")} style={{marginLeft:"auto",fontSize:11,padding:"2px 8px",borderRadius:6,border:`1px solid ${border}`,background:"transparent",color:textMut,cursor:"pointer"}}>✕ Salir</button>
              </div>
              <p style={{fontSize:12,color:textMut,marginBottom:10,lineHeight:1.5}}>Pedidos dentro de estas zonas serán excluidos del ruteo.</p>
              {!drawing
                ?<button onClick={()=>setDrawing(true)} style={{width:"100%",padding:"10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:"#fff",background:"#ef4444"}}>+ Dibujar nueva zona</button>
                :<div>
                  <div style={{fontSize:12,color:"#f59e0b",marginBottom:8,padding:"8px",background:dark?"#1c1206":"#fffbeb",borderRadius:6,lineHeight:1.5}}>
                    Clic en el mapa para marcar puntos. Mínimo 3.<br/><strong style={{color:"#f1f5f9"}}>{currentPoints.length} puntos</strong> marcados
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={closePolygon} disabled={currentPoints.length<3} style={{flex:1,padding:"8px",borderRadius:8,border:"none",cursor:currentPoints.length>=3?"pointer":"default",fontSize:12,fontWeight:500,color:"#fff",background:currentPoints.length>=3?"#22c55e":"#334155"}}>Cerrar zona</button>
                    <button onClick={cancelDrawing} style={{flex:1,padding:"8px",borderRadius:8,border:`1px solid ${border}`,cursor:"pointer",fontSize:12,color:textMut,background:"transparent"}}>Cancelar</button>
                  </div>
                </div>
              }
            </div>
            <div style={{flex:1,overflowY:"auto",padding:8}}>
              {zones.length===0?<div style={{textAlign:"center",color:textMut,fontSize:13,padding:"24px 16px"}}>No hay zonas. Dibuja una en el mapa.</div>
                :zones.map(z=>(
                  <div key={z.id} style={{borderRadius:8,border:`1px solid ${z.color}44`,marginBottom:5,padding:"10px 12px",background:z.color+"11"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:10,height:10,borderRadius:"50%",background:z.color,flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:600,color:textPri,flex:1}}>{z.name}</span>
                      <button onClick={()=>{setDeleteConfirm(z.id);setDeletePassword("");setDeleteError("");}} style={{fontSize:11,padding:"2px 8px",borderRadius:6,border:"1px solid #ef444444",background:"#ef444411",color:"#ef4444",cursor:"pointer"}}>Borrar</button>
                    </div>
                    <div style={{fontSize:11,color:textMut,marginTop:4}}>{z.points.length} puntos · {new Date(z.createdAt).toLocaleDateString("es-CL")}</div>
                  </div>
                ))
              }
            </div>
          </>)}
        </aside>

        <div style={{flex:1,position:"relative"}}>
          {!isLoaded?<div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:"#475569"}}>Cargando mapa...</div>:(
            <GoogleMap mapContainerStyle={{width:"100%",height:"100%"}} center={MAP_CENTER} zoom={11} onLoad={onLoad}
              onClick={mode==="zonas"&&drawing?handleMapClick:mode==="orgZonas"&&drawingOrg?handleOrgMapClick:undefined}
              options={{styles:dark?MAP_STYLE_DARK:MAP_STYLE_LIGHT,zoomControl:true}}>

              {zones.map(z=><Polygon key={z.id} paths={z.points} options={{fillColor:z.color,fillOpacity:0.06,strokeColor:z.color,strokeOpacity:0.6,strokeWeight:1.5}}/>)}
              {drawing&&currentPoints.length>=2&&<Polygon paths={currentPoints} options={{fillColor:"#ef4444",fillOpacity:0.1,strokeColor:"#ef4444",strokeOpacity:0.8,strokeWeight:2}}/>}
              {drawing&&currentPoints.map((p,i)=><Marker key={i} position={p} icon={{url:`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="5" fill="#ef4444" stroke="white" stroke-width="1.5"/></svg>`)}`,scaledSize:{width:12,height:12},anchor:{x:6,y:6}}}/>)}

              {mode==="mapa"&&filtered.map(d=><Marker key={d.id} position={{lat:d.lat,lng:d.lng}} icon={makePinSvg(VENTANA_PALETTE[d.window],takenIds.has(d.id))} onClick={()=>setSelected(d)}/>)}
              {mode==="mapa"&&selected&&(
                <InfoWindow position={{lat:selected.lat,lng:selected.lng}} onCloseClick={()=>setSelected(null)}>
                  <div style={{fontFamily:"sans-serif",minWidth:180,padding:4}}>
                    <p style={{fontWeight:700,fontSize:14,marginBottom:4,color:"#0f172a"}}>{selected.id}</p>
                    <p style={{fontSize:12,color:"#475569",marginBottom:10,lineHeight:1.4}}>{selected.address}</p>
                    <div style={{display:"flex",gap:6}}>
                      <span style={{fontSize:11,padding:"2px 8px",borderRadius:8,fontWeight:600,background:VENTANA_PALETTE[selected.window]+"25",color:VENTANA_PALETTE[selected.window]}}>{selected.window}</span>
                      <button onClick={()=>toggleTaken(selected.id)} style={{fontSize:11,padding:"3px 10px",borderRadius:8,fontWeight:600,cursor:"pointer",border:"none",background:takenIds.has(selected.id)?"#dcfce7":"#fee2e2",color:takenIds.has(selected.id)?"#15803d":"#b91c1c"}}>{takenIds.has(selected.id)?"✓ Desmarcar":"Marcar tomado"}</button>
                    </div>
                  </div>
                </InfoWindow>
              )}

              {mode==="ruteo"&&routes.filter(r=>!r.hidden).map(r=>{
                const hull=convexHull(r.orders);
                const expanded=expandHull(hull);
                const isActive=activeRoute===r.id;
                return(
                  <React.Fragment key={r.id}>
                    {expanded.length>=3&&<Polygon paths={expanded} options={{fillColor:r.color,fillOpacity:isActive?0.25:0.12,strokeColor:r.color,strokeOpacity:isActive?1:0.6,strokeWeight:isActive?2.5:1.5}} onClick={()=>setActiveRoute(activeRoute===r.id?null:r.id)}/>}
                    {isActive&&<Polyline path={r.orders.map(o=>({lat:o.lat,lng:o.lng}))} options={{strokeColor:r.color,strokeOpacity:0.5,strokeWeight:2,geodesic:true}}/>}
                    {r.orders.map(o=><Marker key={o.id} position={{lat:o.lat,lng:o.lng}} icon={makeRoutePinSvg(r.color,r.routeNum,takenIds.has(o.id))} onClick={()=>setSelected(o)}/>)}
                  </React.Fragment>
                );
              })}
              {mode==="ruteo"&&sinAsignar.map(o=><Marker key={o.id} position={{lat:o.lat,lng:o.lng}} icon={makePendingPin()} onClick={()=>setSelected(o)}/>)}
              {mode==="ruteo"&&excludedOrders.map(o=><Marker key={o.id} position={{lat:o.lat,lng:o.lng}} icon={makeExcludedPin()} onClick={()=>setSelected(o)}/>)}
              {mode==="ruteo"&&selected&&(
                <InfoWindow position={{lat:selected.lat,lng:selected.lng}} onCloseClick={()=>{setSelected(null);setReassigning(null);}}>
                  <div style={{fontFamily:"sans-serif",minWidth:200,padding:4}}>
                    <p style={{fontWeight:700,fontSize:14,marginBottom:2,color:"#0f172a"}}>{selected.id}</p>
                    <p style={{fontSize:11,color:"#475569",marginBottom:8,lineHeight:1.4}}>{selected.address}</p>
                    <div style={{display:"flex",gap:6,marginBottom:reassigning===selected.id?8:0}}>
                      <span style={{fontSize:11,padding:"2px 8px",borderRadius:8,fontWeight:600,background:VENTANA_PALETTE[selected.window]+"25",color:VENTANA_PALETTE[selected.window]}}>{selected.window}</span>
                      <button onClick={()=>toggleTaken(selected.id)} style={{fontSize:11,padding:"3px 8px",borderRadius:8,fontWeight:600,cursor:"pointer",border:"none",background:takenIds.has(selected.id)?"#dcfce7":"#fee2e2",color:takenIds.has(selected.id)?"#15803d":"#b91c1c"}}>{takenIds.has(selected.id)?"✓ Desmarcar":"Marcar tomado"}</button>
                      <button onClick={()=>setReassigning(reassigning===selected.id?null:selected.id)} style={{fontSize:11,padding:"3px 8px",borderRadius:8,fontWeight:600,cursor:"pointer",border:"1px solid #3b82f688",background:"#eff6ff",color:"#1d4ed8"}}>↔ Mover</button>
                    </div>
                    {reassigning===selected.id&&(
                      <div>
                        <p style={{fontSize:11,color:"#475569",marginBottom:4}}>Mover a:</p>
                        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                          {routes.filter(r=>!r.orders.some(o=>o.id===selected.id)).map(r=>(
                            <button key={r.id} onClick={()=>{
                              const fromRoute=routes.find(rt=>rt.orders.some(o=>o.id===selected.id));
                              if(fromRoute) reassignOrder(selected.id,fromRoute.id,r.id);
                              else assignToRoute(selected.id,r.id);
                            }} style={{fontSize:11,padding:"3px 8px",borderRadius:8,fontWeight:600,cursor:"pointer",border:`1px solid ${r.color}88`,background:r.color+"22",color:r.color}}>
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          )}

          {/* Org zones on map - always visible */}
          {orgZones.map(z=>(
            <Polygon key={z.id} paths={z.points} options={{fillColor:z.color,fillOpacity:activeOrgZone===z.id?0.2:0.08,strokeColor:z.color,strokeOpacity:activeOrgZone===z.id?0.9:0.5,strokeWeight:activeOrgZone===z.id?2:1.5}}
              onClick={()=>mode==="orgZonas"&&setActiveOrgZone(activeOrgZone===z.id?null:z.id)}/>
          ))}
          {drawingOrg&&orgPoints.length>=2&&<Polygon paths={orgPoints} options={{fillColor:"#22c55e",fillOpacity:0.1,strokeColor:"#22c55e",strokeOpacity:0.8,strokeWeight:2}}/>}
          {drawingOrg&&orgPoints.map((p,i)=><Marker key={i} position={p} icon={{url:`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><circle cx="6" cy="6" r="5" fill="#22c55e" stroke="white" stroke-width="1.5"/></svg>`)}`,scaledSize:{width:12,height:12},anchor:{x:6,y:6}}}/>)}

          {/* Org zones modal */}
          {showOrgModal&&(
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
              <div style={{background:dark?"#151820":"#fff",borderRadius:12,padding:24,width:320,border:`1px solid ${border}`}}>
                <p style={{fontSize:15,fontWeight:600,color:textPri,marginBottom:16}}>Guardar zona de organización</p>
                <div style={{marginBottom:12}}>
                  <p style={{fontSize:12,color:textMut,marginBottom:6}}>Nombre de la zona</p>
                  <input value={orgZoneName} onChange={e=>setOrgZoneName(e.target.value)} placeholder="Ej: Zona Norte" style={{width:"100%",background:inputBg,border:`1px solid ${inputBdr}`,color:textPri,fontSize:13,padding:"8px 12px",borderRadius:8,outline:"none",boxSizing:"border-box"}}/>
                </div>
                <div style={{marginBottom:12}}>
                  <p style={{fontSize:12,color:textMut,marginBottom:6}}>Color de la zona</p>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {["#3b82f6","#22c55e","#f97316","#a855f7","#ef4444","#14b8a6","#f59e0b","#ec4899"].map(c=>(
                      <div key={c} onClick={()=>setOrgZoneColor(c)} style={{width:24,height:24,borderRadius:"50%",background:c,cursor:"pointer",border:orgZoneColor===c?"3px solid #fff":"2px solid transparent",boxSizing:"border-box"}}/>
                    ))}
                  </div>
                </div>
                <div style={{marginBottom:16}}>
                  <p style={{fontSize:12,color:textMut,marginBottom:6}}>Contraseña</p>
                  <input type="password" value={orgPassword} onChange={e=>setOrgPassword(e.target.value)} placeholder="••••••••" style={{width:"100%",background:inputBg,border:`1px solid ${inputBdr}`,color:textPri,fontSize:13,padding:"8px 12px",borderRadius:8,outline:"none",boxSizing:"border-box"}}/>
                </div>
                {orgError&&<p style={{fontSize:12,color:"#ef4444",marginBottom:12}}>{orgError}</p>}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={saveOrgZone} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:"#fff",background:"#22c55e"}}>Guardar</button>
                  <button onClick={cancelOrgDrawing} style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${border}`,cursor:"pointer",fontSize:13,color:textMut,background:"transparent"}}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
          {deleteOrgConfirm&&(
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
              <div style={{background:dark?"#151820":"#fff",borderRadius:12,padding:24,width:300,border:`1px solid ${border}`}}>
                <p style={{fontSize:15,fontWeight:600,color:textPri,marginBottom:8}}>Borrar zona</p>
                <p style={{fontSize:12,color:textMut,marginBottom:16}}>Esta acción es permanente.</p>
                <input type="password" value={deleteOrgPassword} onChange={e=>setDeleteOrgPassword(e.target.value)} placeholder="Contraseña" style={{width:"100%",background:inputBg,border:`1px solid ${inputBdr}`,color:textPri,fontSize:13,padding:"8px 12px",borderRadius:8,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
                {deleteOrgError&&<p style={{fontSize:12,color:"#ef4444",marginBottom:8}}>{deleteOrgError}</p>}
                <div style={{display:"flex",gap:8,marginTop:8}}>
                  <button onClick={deleteOrgZone} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:"#fff",background:"#ef4444"}}>Borrar</button>
                  <button onClick={()=>setDeleteOrgConfirm(null)} style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${border}`,cursor:"pointer",fontSize:13,color:textMut,background:"transparent"}}>Cancelar</button>
                </div>
              </div>
            </div>
          )}

          {showZoneModal&&(
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
              <div style={{background:dark?"#151820":"#fff",borderRadius:12,padding:24,width:320,border:`1px solid ${border}`}}>
                <p style={{fontSize:15,fontWeight:600,color:textPri,marginBottom:16}}>Guardar zona de exclusión</p>
                <div style={{marginBottom:12}}><p style={{fontSize:12,color:textMut,marginBottom:6}}>Nombre de la zona</p><input value={zoneName} onChange={e=>setZoneName(e.target.value)} placeholder="Ej: Cerro San Cristóbal" style={{width:"100%",background:inputBg,border:`1px solid ${inputBdr}`,color:textPri,fontSize:13,padding:"8px 12px",borderRadius:8,outline:"none",boxSizing:"border-box"}}/></div>
                <div style={{marginBottom:16}}><p style={{fontSize:12,color:textMut,marginBottom:6}}>Contraseña de administrador</p><input type="password" value={zonePassword} onChange={e=>setZonePassword(e.target.value)} placeholder="••••••••" style={{width:"100%",background:inputBg,border:`1px solid ${inputBdr}`,color:textPri,fontSize:13,padding:"8px 12px",borderRadius:8,outline:"none",boxSizing:"border-box"}}/></div>
                {zoneError&&<p style={{fontSize:12,color:"#ef4444",marginBottom:12}}>{zoneError}</p>}
                <div style={{display:"flex",gap:8}}>
                  <button onClick={saveZone} style={{flex:1,padding:"10px",borderRadius:8,border:"none",cursor:"pointer",fontSize:13,fontWeight:500,color:"#fff",background:"#22c55e"}}>Guardar</button>
                  <button onClick={cancelDrawing} style={{flex:1,padding:"10px",borderRadius:8,border:`1px solid ${border}`,cursor:"pointer",fontSize:13,color:textMut,background:"transparent"}}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
          {deleteConfirm&&(
            <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}}>
              <div style={{background:dark?"#151820":"#fff",borderRadius:12,padding:24,width:300,border:`1px solid ${border}`}}>
                <p style={{fontSize:15,fontWeight:600,color:textPri,marginBottom:8}}>Borrar zona</p>
                <p style={{fontSize:12,color:textMut,marginBottom:16}}>Esta acción es permanente.</p>
                <input type="password" value={deletePassword} onChange={e=>setDeletePassword(e.target.value)} placeholder="Contraseña" style={{width:"100%",background:inputBg,border:`1px solid ${inputBdr}`,color:textPri,fontSize:13,padding:"8px 12px",borderRadius:8,outline:"none",boxSizing:"border-box",marginBottom:8}}/>
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
