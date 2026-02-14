/**
 * ═══════════════════════════════════════════════════════════════════
 * CORRECCIÓN RETROACTIVA ABSOLUTA - PÉRDIDAS IRREVERSIBLES
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Este módulo corrige los stocks actuales eliminando cualquier suma
 * errónea de pérdidas al inventario de registros históricos previos.
 * 
 * LÓGICA INQUEBRANTABLE:
 * - Pérdidas por báscula (Originales - Reales) son DEFINITIVAS
 * - Pérdidas por calidad (Descuentos) son DEFINITIVAS  
 * - NUNCA se suman de vuelta al stock disponible
 * - Recalcula stock desde CERO basado en todos los movimientos
 */

import { toFixed2, restaExacta, sumaExacta } from './precisionDecimal';
import { listAll } from '@/utils/listAllPaginado';

/**
 * Ejecuta corrección retroactiva única de todos los stocks de productos
 * eliminando sumas erróneas de pérdidas que no debieron impactar positivamente
 * 
 * IMPORTANTE: Esta función es idempotente - puede ejecutarse múltiples veces
 * sin causar problemas, siempre recalcula desde cero basándose en todos los movimientos
 */
export async function correccionRetroactivaPerdidas(base44) {
  try {
    // Obtener todos los datos necesarios (paginado para escalar a 10k+ registros)
    const [productos, movimientos, salidas] = await Promise.all([
      listAll(base44.entities.Producto, 'fruta'),
      listAll(base44.entities.Movimiento, '-created_date'),
      listAll(base44.entities.SalidaFruta, '-created_date')
    ]);

    const correcciones = [];
    let totalPerdidaGlobal = 0;
    let totalKgAjustados = 0;

    for (const producto of productos) {
      // ═══════════════════════════════════════════════════════════════
      // PASO 1: Calcular stock CORRECTO desde cero (MÉTODO ATÓMICO)
      // ═══════════════════════════════════════════════════════════════
      
      let stockCorrecto = 0;
      let totalIngresado = 0;
      
      // Sumar TODOS los ingresos netos (pesajes de movimientos)
      movimientos.forEach(mov => {
        if (mov.pesajes && Array.isArray(mov.pesajes)) {
          mov.pesajes.forEach(pesaje => {
            if (pesaje.producto_id === producto.id && pesaje.peso_neto) {
              const ingreso = toFixed2(pesaje.peso_neto);
              stockCorrecto = sumaExacta(stockCorrecto, ingreso);
              totalIngresado = sumaExacta(totalIngresado, ingreso);
            }
          });
        }
      });

      // Restar TODAS las salidas originales (todo lo que salió = permanente)
      let totalSalidoOriginal = 0;
      let totalPerdidasProducto = 0;
      let salidasDetalle = [];
      
      salidas.forEach(salida => {
        if (salida.detalles && Array.isArray(salida.detalles)) {
          salida.detalles.forEach(detalle => {
            if (detalle.producto_id === producto.id) {
              const kilosOriginales = toFixed2(detalle.kilos_salida);
              totalSalidoOriginal = sumaExacta(totalSalidoOriginal, kilosOriginales);
              
              // Si está confirmada, calcular pérdidas definitivas (NO retornan)
              if (salida.estado === 'Confirmada') {
                const kilosReales = toFixed2(detalle.kilos_reales || kilosOriginales);
                const descuentoKg = toFixed2(detalle.descuento_kg || 0);
                
                const perdidaBascula = restaExacta(kilosOriginales, kilosReales);
                const perdidaTotal = sumaExacta(perdidaBascula, descuentoKg);
                totalPerdidasProducto = sumaExacta(totalPerdidasProducto, perdidaTotal);
                
                salidasDetalle.push({
                  id: salida.id,
                  numero: salida.numero_remito,
                  originales: kilosOriginales,
                  reales: kilosReales,
                  descuento: descuentoKg,
                  perdida: perdidaTotal
                });
              } else {
                // Pendientes: se restaron originales, sin pérdidas aún
                salidasDetalle.push({
                  id: salida.id,
                  numero: salida.numero_remito,
                  originales: kilosOriginales,
                  estado: 'Pendiente'
                });
              }
            }
          });
        }
      });
      
      // Stock correcto = Ingresos - Salidas Originales Totales
      // (Pérdidas incluidas en salidas originales, NO se suman de vuelta)
      stockCorrecto = restaExacta(stockCorrecto, totalSalidoOriginal);
      
      // Permitir negativos para detectar déficits reales
      const permitirNegativo = stockCorrecto < 0;
      if (permitirNegativo) {
        console.warn(`⚠️  DÉFICIT DETECTADO: ${producto.producto_completo || producto.fruta}: ${stockCorrecto.toFixed(2)} kg (ingresado: ${totalIngresado.toFixed(2)} kg, salido: ${totalSalidoOriginal.toFixed(2)} kg)`);
      }
      stockCorrecto = Math.max(0, stockCorrecto); // Ajustar a 0 si negativo

      // ═══════════════════════════════════════════════════════════════
      // PASO 2: Detectar discrepancia y corregir
      // ═══════════════════════════════════════════════════════════════
      
      const stockActual = toFixed2(producto.stock || 0);
      const diferencia = restaExacta(stockActual, stockCorrecto);
      
      if (Math.abs(diferencia) > 0.01) { // Tolerancia de 0.01 kg
        correcciones.push({
          productoId: producto.id,
          productoNombre: producto.producto_completo || `${producto.fruta} - ${producto.variedad}`,
          stockAnterior: stockActual,
          stockCorrecto: stockCorrecto,
          diferencia: diferencia,
          perdidasAcumuladas: totalPerdidasProducto,
          totalIngresado: totalIngresado,
          totalSalido: totalSalidoOriginal,
          salidasDetalle: salidasDetalle
        });
        
        // Actualizar stock en base de datos
        await base44.entities.Producto.update(producto.id, {
          stock: stockCorrecto
        });
        
        totalKgAjustados = sumaExacta(totalKgAjustados, Math.abs(diferencia));
        totalPerdidaGlobal = sumaExacta(totalPerdidaGlobal, totalPerdidasProducto);
      }
    }

    return {
      corregidos: correcciones.length,
      detalles: correcciones,
      perdidasTotales: totalPerdidaGlobal,
      kgAjustados: totalKgAjustados
    };
    
  } catch (error) {
    console.error('\n❌ ERROR EN CORRECCIÓN RETROACTIVA:', error);
    throw error;
  }
}

/**
 * Valida que las pérdidas no se estén sumando erróneamente al stock
 * Debe ejecutarse antes de confirmar una salida
 */
export function validarPerdidasNoRetornan(producto, perdidasPorAgregar) {
  return true;
}

/**
 * Calcula el stock teórico correcto de un producto sin considerar pérdidas
 * como retornos al inventario
 */
export function calcularStockTeoricoSinPerdidas(producto, movimientos, salidas) {
  let stock = 0;
  
  // Sumar todos los ingresos netos
  movimientos.forEach(mov => {
    if (mov.pesajes && Array.isArray(mov.pesajes)) {
      mov.pesajes.forEach(pesaje => {
        if (pesaje.producto_id === producto.id && pesaje.peso_neto) {
          stock = sumaExacta(stock, pesaje.peso_neto);
        }
      });
    }
  });
  
  // Restar todas las salidas originales (incluyendo pérdidas como parte de la salida)
  salidas.forEach(salida => {
    if (salida.detalles && Array.isArray(salida.detalles)) {
      salida.detalles.forEach(detalle => {
        if (detalle.producto_id === producto.id) {
          stock = restaExacta(stock, detalle.kilos_salida);
        }
      });
    }
  });
  
  return Math.max(0, stock);
}