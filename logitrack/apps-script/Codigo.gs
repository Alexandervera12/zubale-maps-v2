/**
 * ─────────────────────────────────────────────────────────────────
 *  LogiTrack — Google Apps Script
 *  Pega este código en: Extensiones > Apps Script de tu Google Sheet
 * ─────────────────────────────────────────────────────────────────
 *
 *  ESTRUCTURA DE COLUMNAS ESPERADA:
 *  A = ID          B = Dirección       C = Ventana (AM / PM / Todo el día)
 *  ...             M = Latitud         N = Longitud
 *
 *  CONFIGURACIÓN: Reemplaza TU_API_KEY con tu Google Maps Geocoding API Key
 */

const GEOCODING_API_KEY = "TU_API_KEY_AQUI";
const SHEET_NAME = "Hoja1"; // Cambia al nombre de tu hoja

/**
 * Geocodifica todas las filas que tengan dirección pero no tengan coordenadas.
 * Ejecutar manualmente o via trigger "onChange".
 */
function geocodificarDirecciones() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();

  data.forEach((row, i) => {
    const rowNum = i + 2;
    const direccion = row[1]; // Columna B
    const latActual = row[12]; // Columna M
    const lngActual = row[13]; // Columna N

    // Solo geocodificar si hay dirección y aún no hay coordenadas
    if (!direccion || (latActual && lngActual)) return;

    try {
      const coords = geocodificar(direccion + ", Santiago, Chile");
      if (coords) {
        sheet.getRange(rowNum, 13).setValue(coords.lat); // M = Latitud
        sheet.getRange(rowNum, 14).setValue(coords.lng); // N = Longitud
        SpreadsheetApp.flush();
        Utilities.sleep(200); // Evitar rate limiting
      }
    } catch (e) {
      Logger.log(`Error en fila ${rowNum}: ${e.message}`);
    }
  });

  SpreadsheetApp.getUi().alert("✅ Geocodificación completada.");
}

/**
 * Llama a la API de Geocoding de Google y retorna { lat, lng }
 */
function geocodificar(direccion) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(direccion)}&key=${GEOCODING_API_KEY}`;
  const response = UrlFetchApp.fetch(url);
  const json = JSON.parse(response.getContentText());

  if (json.status === "OK" && json.results.length > 0) {
    const loc = json.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}

/**
 * Endpoint Web App — devuelve los datos como JSON para consumir desde React.
 * Despliega como "Web App" con acceso "Cualquier usuario".
 * URL resultante va en VITE_SHEETS_URL del .env
 */
function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return jsonResponse([]);
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 14).getValues();

  const result = data
    .filter(row => row[0] && row[1] && row[12] && row[13]) // Filtrar filas incompletas
    .map(row => ({
      id:      row[0],   // A
      address: row[1],   // B
      window:  row[2],   // C
      lat:     row[12],  // M
      lng:     row[13],  // N
    }));

  return jsonResponse(result);
}

function jsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Agrega menú personalizado en Google Sheets
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚚 LogiTrack")
    .addItem("Geocodificar direcciones", "geocodificarDirecciones")
    .addToUi();
}
