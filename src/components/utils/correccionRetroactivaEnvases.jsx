/**
 * ═══════════════════════════════════════════════════════════════════
 * CORRECCIÓN RETROACTIVA v4 - ENVASES (DEVOLUCIONES NO SUMAN)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * LÓGICA REAL DEL NEGOCIO:
 * 
 * INGRESO DE FRUTA (Proveedor):
 * - INGRESO (Devolución): NO suma a stock (mis envases devueltos)
 * - SALIDA (Entrega): Resta de Stock Vacíos
 * 
 * SALIDA DE FRUTA (Cliente):
 * - SALIDA (Entrega): Resta de Stock Vacíos
 * - INGRESO (Devolución): SÍ suma (envases del cliente)
 * 
 * Stock Vacíos = Compra inicial - Entregas + Devoluciones de clientes
 */

import { toFixed2 } from './precisionDecimal';
import { listAll } from '@/utils/listAllPaginado';

/**
 * Ejecuta corrección retroactiva única de todos los stocks de envases
 * eliminando aplicaciones erróneas de lógica en registros históricos
 * 
 * IMPORTANTE: Esta función es idempotente - puede ejecutarse múltiples veces
 * sin causar problemas, siempre recalcula desde cero basándose en todos los movimientos
 */
export async function correccionRetroactivaEnvases(base44) {
  try {
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║  🔧 CORRECCIÓN RETROACTIVA ABSOLUTA - ENVASES OCUPADOS/VACÍOS   ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
    
    // Obtener todos los datos necesarios (paginado para escalar a 10k+ registros)
    const [envases, movimientos, salidas] = await Promise.all([
      listAll(base44.entities.Envase, 'tipo'),
      listAll(base44.entities.Movimiento, '-created_date'),
      listAll(base44.entities.SalidaFruta, '-created_date')
    ]);

    const correcciones = [];
    let totalEnvasesAjustados = 0;

    for (const envase of envases) {
      // ═══════════════════════════════════════════════════════════════
      // PASO 1: Calcular stocks CORRECTOS desde cero (MÉTODO ATÓMICO)
      // ═══════════════════════════════════════════════════════════════
      
      let stockOcupadosCorrecto = 0;
      let stockVaciosCorrecto = 0;
      const detalleMovimientos = [];

      // Procesar TODOS los movimientos (Ingreso de Fruta y Mov. Envases)
      movimientos.forEach(mov => {
        if (mov.movimiento_envases && Array.isArray(mov.movimiento_envases)) {
          mov.movimiento_envases.forEach(me => {
            if (me.envase_id === envase.id) {
              const ingreso = parseInt(me.cantidad_ingreso) || 0;
              const salida = parseInt(me.cantidad_salida) || 0;
              
              const esIngresoFruta = mov.tipo_movimiento === 'Ingreso de Fruta';
              
              // INGRESO - Solo suma si NO es devolución de proveedor
              if (ingreso > 0 && !esIngresoFruta) {
                stockVaciosCorrecto += ingreso;
                detalleMovimientos.push({
                  id: mov.id,
                  tipo: mov.tipo_movimiento,
                  operacion: `Ingreso +${ingreso} VACÍOS`,
                  ocupados: stockOcupadosCorrecto,
                  vacios: stockVaciosCorrecto
                });
              } else if (ingreso > 0 && esIngresoFruta) {
                detalleMovimientos.push({
                  id: mov.id,
                  tipo: mov.tipo_movimiento,
                  operacion: `Devolución ${ingreso} (NO suma - proveedor)`,
                  ocupados: stockOcupadosCorrecto,
                  vacios: stockVaciosCorrecto
                });
              }
              
              // SALIDA - SIEMPRE resta de Stock Vacíos
              if (salida > 0) {
                stockVaciosCorrecto -= salida;
                detalleMovimientos.push({
                  id: mov.id,
                  tipo: mov.tipo_movimiento,
                  operacion: `Salida -${salida} VACÍOS`,
                  ocupados: stockOcupadosCorrecto,
                  vacios: stockVaciosCorrecto
                });
              }
            }
          });
        }
      });

      // Procesar TODAS las salidas de fruta
      salidas.forEach(sal => {
        if (sal.movimiento_envases && Array.isArray(sal.movimiento_envases)) {
          sal.movimiento_envases.forEach(me => {
            if (me.envase_id === envase.id) {
              const ingreso = parseInt(me.cantidad_ingreso) || 0;
              const salida = parseInt(me.cantidad_salida) || 0;
              const ingresoConFruta = me.ingreso_con_fruta === true;
              
              // INGRESO en Salida de Fruta - SÍ suma (devolución de cliente)
              if (ingreso > 0) {
                if (ingresoConFruta) {
                  stockOcupadosCorrecto += ingreso;
                  detalleMovimientos.push({
                    id: sal.id,
                    tipo: 'Salida de Fruta',
                    operacion: `Ingreso +${ingreso} OCUPADOS (cliente)`,
                    ocupados: stockOcupadosCorrecto,
                    vacios: stockVaciosCorrecto
                  });
                } else {
                  stockVaciosCorrecto += ingreso;
                  detalleMovimientos.push({
                    id: sal.id,
                    tipo: 'Salida de Fruta',
                    operacion: `Ingreso +${ingreso} VACÍOS (cliente)`,
                    ocupados: stockOcupadosCorrecto,
                    vacios: stockVaciosCorrecto
                  });
                }
              }
              
              // SALIDA - SIEMPRE resta de Stock Vacíos
              if (salida > 0) {
                stockVaciosCorrecto -= salida;
                detalleMovimientos.push({
                  id: sal.id,
                  tipo: 'Salida de Fruta',
                  operacion: `Salida -${salida} VACÍOS`,
                  ocupados: stockOcupadosCorrecto,
                  vacios: stockVaciosCorrecto
                });
              }
            }
          });
        }
      });

      // Permitir negativos para detectar déficits reales
      const deficitOcupados = stockOcupadosCorrecto < 0;
      const deficitVacios = stockVaciosCorrecto < 0;
      
      if (deficitOcupados) {
        console.warn(`⚠️  DÉFICIT DETECTADO: ${envase.tipo} - Ocupados: ${stockOcupadosCorrecto} (ajustando a 0)`);
      }
      if (deficitVacios) {
        console.warn(`⚠️  DÉFICIT DETECTADO: ${envase.tipo} - Vacíos: ${stockVaciosCorrecto} (ajustando a 0)`);
      }
      
      stockOcupadosCorrecto = Math.max(0, stockOcupadosCorrecto);
      stockVaciosCorrecto = Math.max(0, stockVaciosCorrecto);

      // ═══════════════════════════════════════════════════════════════
      // PASO 2: Detectar discrepancia y corregir
      // ═══════════════════════════════════════════════════════════════
      
      const ocupadosActual = parseInt(envase.stock_ocupados) || 0;
      const vaciosActual = parseInt(envase.stock_vacios) || 0;
      
      const diferenciaOcupados = ocupadosActual - stockOcupadosCorrecto;
      const diferenciaVacios = vaciosActual - stockVaciosCorrecto;
      
      if (Math.abs(diferenciaOcupados) > 0 || Math.abs(diferenciaVacios) > 0) {
        correcciones.push({
          envaseId: envase.id,
          envaseTipo: envase.tipo,
          ocupadosAnterior: ocupadosActual,
          ocupadosCorrecto: stockOcupadosCorrecto,
          diferenciaOcupados: diferenciaOcupados,
          vaciosAnterior: vaciosActual,
          vaciosCorrecto: stockVaciosCorrecto,
          diferenciaVacios: diferenciaVacios,
          movimientosAplicados: detalleMovimientos.length
        });
        
        // Actualizar stock en base de datos
        await base44.entities.Envase.update(envase.id, {
          stock_ocupados: stockOcupadosCorrecto,
          stock_vacios: stockVaciosCorrecto
        });
        
        totalEnvasesAjustados += Math.abs(diferenciaOcupados) + Math.abs(diferenciaVacios);
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🔧 CORRECCIÓN APLICADA - Envase: ${envase.tipo}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   📦 OCUPADOS (CON FRUTA):`);
        console.log(`      Anterior: ${ocupadosActual} unidades`);
        console.log(`      Correcto: ${stockOcupadosCorrecto} unidades`);
        console.log(`      Diferencia: ${diferenciaOcupados} unidades`);
        console.log(`   `);
        console.log(`   📦 VACÍOS (SIN FRUTA):`);
        console.log(`      Anterior: ${vaciosActual} unidades`);
        console.log(`      Correcto: ${stockVaciosCorrecto} unidades`);
        console.log(`      Diferencia: ${diferenciaVacios} unidades`);
        console.log(`   `);
        console.log(`   📊 MOVIMIENTOS PROCESADOS: ${detalleMovimientos.length}`);
        if (detalleMovimientos.length > 0 && detalleMovimientos.length <= 10) {
          console.log(`   📋 DETALLE:`);
          detalleMovimientos.forEach((mov, idx) => {
            console.log(`      ${idx + 1}. ${mov.tipo} - ${mov.operacion} (O:${mov.ocupados}, V:${mov.vacios})`);
          });
        } else if (detalleMovimientos.length > 10) {
          console.log(`   📋 (Mostrando últimos 5 de ${detalleMovimientos.length}):`);
          detalleMovimientos.slice(-5).forEach((mov, idx) => {
            console.log(`      ${detalleMovimientos.length - 4 + idx}. ${mov.tipo} - ${mov.operacion} (O:${mov.ocupados}, V:${mov.vacios})`);
          });
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // RESUMEN DE CORRECCIÓN
    // ═══════════════════════════════════════════════════════════════
    
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ CORRECCIÓN RETROACTIVA DE ENVASES COMPLETADA                ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log(`   Envases Corregidos: ${correcciones.length}`);
    console.log(`   Unidades Ajustadas (total): ${totalEnvasesAjustados}`);
    console.log(`   `);
    console.log(`   🔐 GARANTÍA DE CORRECCIÓN v4:`);
    console.log(`      • Stocks recalculados con LÓGICA REAL DEL NEGOCIO`);
    console.log(`      • Devoluciones de proveedores NO suman a stock`);
    console.log(`      • Entregas SIEMPRE restan de Stock Vacíos`);
    console.log(`      • Devoluciones de clientes SÍ suman a stock`);
    console.log('════════════════════════════════════════════════════════════════════\n');

    return {
      corregidos: correcciones.length,
      detalles: correcciones,
      unidadesAjustadas: totalEnvasesAjustados
    };
    
  } catch (error) {
    console.error('\n❌ ERROR EN CORRECCIÓN RETROACTIVA DE ENVASES:', error);
    throw error;
  }
}

/**
 * Valida que los stocks de envases sean coherentes
 */
export function validarStocksEnvases(envase, cantidadOperacion, esOcupado, esSalida) {
  const stockDisponible = esOcupado ? (envase.stock_ocupados || 0) : (envase.stock_vacios || 0);
  
  if (esSalida && cantidadOperacion > stockDisponible) {
    console.warn(`⚠️  Stock insuficiente: ${envase.tipo} - Requiere ${cantidadOperacion} ${esOcupado ? 'ocupados' : 'vacíos'}, disponible: ${stockDisponible}`);
    return false;
  }
  
  return true;
}