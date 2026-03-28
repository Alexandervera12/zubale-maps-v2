/**
 * useSheetData.js
 * Hook para traer datos desde el Apps Script Web App
 * Reemplaza MOCK_DATA en App.jsx con esto cuando tengas el endpoint listo.
 *
 * Uso en App.jsx:
 *   import useSheetData from "./hooks/useSheetData";
 *   const { data, loading, error, refetch } = useSheetData();
 */
import { useState, useEffect, useCallback } from "react";

const SHEETS_URL = import.meta.env.VITE_SHEETS_URL;

export default function useSheetData() {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchData = useCallback(async () => {
    if (!SHEETS_URL) {
      setError("VITE_SHEETS_URL no configurado en .env");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res  = await fetch(SHEETS_URL);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError("Error al cargar datos: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Auto-refresco cada 60 segundos
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
