/**
 * Utilidades para operaciones decimales con precisión exacta
 * Evita errores de punto flotante en cálculos de kilos
 */

/**
 * Redondea un número a 2 decimales con precisión exacta
 * @param {number} num - Número a redondear
 * @returns {number} - Número redondeado a 2 decimales
 */
export function toFixed2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Suma números con precisión decimal exacta
 * @param {...number} nums - Números a sumar
 * @returns {number} - Suma exacta redondeada a 2 decimales
 */
export function sumaExacta(...nums) {
  const suma = nums.reduce((acc, num) => acc + (num || 0), 0);
  return toFixed2(suma);
}

/**
 * Resta números con precisión decimal exacta
 * @param {number} a - Minuendo
 * @param {number} b - Sustraendo
 * @returns {number} - Diferencia exacta redondeada a 2 decimales
 */
export function restaExacta(a, b) {
  return toFixed2((a || 0) - (b || 0));
}

/**
 * Multiplica números con precisión decimal exacta
 * @param {number} a - Factor 1
 * @param {number} b - Factor 2
 * @returns {number} - Producto exacto redondeado a 2 decimales
 */
export function multiplicaExacta(a, b) {
  return toFixed2((a || 0) * (b || 0));
}

/**
 * Calcula peso neto con precisión exacta
 * @param {number} pesoBruto - Peso bruto en kg
 * @param {number} tara - Tara total en kg
 * @returns {number} - Peso neto exacto (máximo 0)
 */
export function calcularPesoNeto(pesoBruto, tara) {
  const neto = restaExacta(pesoBruto, tara);
  return Math.max(0, neto);
}

/**
 * Agrupa y suma kilos por producto con precisión exacta
 * @param {Array} items - Array de items con producto_id y kilos
 * @param {string} kilosField - Nombre del campo de kilos
 * @returns {Object} - Objeto con producto_id como clave y suma exacta como valor
 */
export function agruparKilosPorProducto(items, kilosField = 'peso_neto') {
  const grupos = {};
  items.forEach(item => {
    if (item.producto_id && item[kilosField] != null) {
      if (!grupos[item.producto_id]) {
        grupos[item.producto_id] = 0;
      }
      grupos[item.producto_id] = sumaExacta(grupos[item.producto_id], item[kilosField]);
    }
  });
  return grupos;
}

/**
 * Recalcula stock de un producto basado en todos sus movimientos
 * @param {string} productoId - ID del producto
 * @param {Array} movimientos - Array de movimientos con pesajes
 * @param {Array} salidas - Array de salidas con detalles
 * @returns {number} - Stock exacto calculado
 */
export function recalcularStockExacto(productoId, movimientos, salidas) {
  let stockCalculado = 0;
  
  // Sumar ingresos de movimientos
  movimientos.forEach(mov => {
    if (mov.pesajes) {
      mov.pesajes.forEach(pesaje => {
        if (pesaje.producto_id === productoId && pesaje.peso_neto) {
          stockCalculado = sumaExacta(stockCalculado, pesaje.peso_neto);
        }
      });
    }
  });
  
  // Restar salidas - LÓGICA CORREGIDA: SIEMPRE restar ORIGINALES (pérdidas NO vuelven)
  salidas.forEach(salida => {
    if (salida.detalles) {
      salida.detalles.forEach(detalle => {
        if (detalle.producto_id === productoId) {
          // ═══════════════════════════════════════════════════════════════════
          // CORRECCIÓN CRÍTICA: Las PÉRDIDAS son IRREVERSIBLES
          // ═══════════════════════════════════════════════════════════════════
          // - Stock se reduce SIEMPRE por kilos_salida ORIGINALES (lo que salió del acopio)
          // - Las pérdidas (báscula + calidad) NO vuelven al inventario
          // - NUNCA restar "kilos efectivos" (esto DEVUELVE las pérdidas al stock - ERROR)
          // 
          // Ejemplo: 2637 kg originales, 2632 kg reales, 78.96 kg descuento
          //   → Stock se reduce por 2637 kg (los originales que salieron)
          //   → Pérdidas (5 + 78.96 = 83.96 kg) son definitivas, NO vuelven
          //   → Cliente paga por 2553.04 kg efectivos
          //   → Stock NUNCA debe aumentar por las pérdidas
          
          const kilosOriginalesSalidos = detalle.kilos_salida;
          stockCalculado = restaExacta(stockCalculado, kilosOriginalesSalidos);
        }
      });
    }
  });
  
  return Math.max(0, stockCalculado);
}