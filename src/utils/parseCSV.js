/**
 * ═══════════════════════════════════════════════════════════════════
 * UTILIDAD: PARSER DE CSV ROBUSTO
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Parsea líneas CSV soportando comas dentro de celdas entre comillas.
 * Maneja correctamente:
 * - Comas dentro de celdas entre comillas dobles
 * - Comillas escapadas dentro de celdas
 * - Celdas sin comillas
 * 
 * @param {string} line - Línea CSV a parsear
 * @returns {Array<string>} - Array de valores parseados
 */
export function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Comilla escapada dentro de comillas
        current += '"';
        i++; // Saltar la siguiente comilla
      } else {
        // Toggle de estado de comillas
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Coma fuera de comillas = separador de campo
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Agregar el último campo
  result.push(current.trim());
  
  return result;
}
