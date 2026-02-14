import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { correccionRetroactivaPerdidas } from '../utils/correccionRetroactivaPerdidas';
import { correccionRetroactivaEnvases } from '../utils/correccionRetroactivaEnvases';

/**
 * ═══════════════════════════════════════════════════════════════════
 * HOOK DE CORRECCIÓN RETROACTIVA AUTOMÁTICA - ÚNICA EJECUCIÓN
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Este hook se ejecuta automáticamente UNA SOLA VEZ al cargar la app
 * para corregir todos los stocks eliminando sumas erróneas de pérdidas
 * en registros históricos previos.
 * 
 * Usa localStorage para evitar re-ejecuciones innecesarias.
 */
export function useCorreccionAutoRetroactiva() {
  const queryClient = useQueryClient();
  const ejecutadoRef = useRef(false);
  const STORAGE_KEY = 'acopio_correccion_perdidas_v1_ejecutada';
  
  useEffect(() => {
    // Evitar múltiples ejecuciones en desarrollo (React StrictMode)
    if (ejecutadoRef.current) return;
    ejecutadoRef.current = true;

    // Verificar si ya se ejecutó anteriormente
    const yaEjecutado = localStorage.getItem(STORAGE_KEY);
    
    if (yaEjecutado === 'true') return;

    const ejecutarCorreccion = async () => {
      try {
        // Ejecutar AMBAS correcciones en paralelo
        const [resultadoPerdidas, resultadoEnvases] = await Promise.all([
          correccionRetroactivaPerdidas(base44),
          correccionRetroactivaEnvases(base44)
        ]);

        // Marcar como ejecutado en localStorage
        localStorage.setItem(STORAGE_KEY, 'true');
        localStorage.setItem(STORAGE_KEY + '_fecha', new Date().toISOString());
        localStorage.setItem(STORAGE_KEY + '_resultado', JSON.stringify({
          productos: {
            corregidos: resultadoPerdidas.corregidos,
            perdidasTotales: resultadoPerdidas.perdidasTotales,
            kgAjustados: resultadoPerdidas.kgAjustados
          },
          envases: {
            corregidos: resultadoEnvases.corregidos,
            unidadesAjustadas: resultadoEnvases.unidadesAjustadas
          }
        }));

        // Invalidar queries para refrescar datos en toda la app
        queryClient.invalidateQueries({ queryKey: ['productos'] });
        queryClient.invalidateQueries({ queryKey: ['movimientos'] });
        queryClient.invalidateQueries({ queryKey: ['salidas'] });
        queryClient.invalidateQueries({ queryKey: ['envases'] });
      } catch (error) {
        console.error('\n❌ ERROR EN CORRECCIÓN RETROACTIVA AUTOMÁTICA:', error);
        // No marcar como ejecutado si falló, para que reintente en próxima carga
      }
    };

    // Ejecutar después de un pequeño delay para no bloquear renderizado inicial
    const timer = setTimeout(() => {
      ejecutarCorreccion();
    }, 2000);

    return () => clearTimeout(timer);
  }, [queryClient]);
}

/**
 * Función para resetear la corrección (solo para testing/debugging)
 * No usar en producción
 */
export function resetCorreccionRetroactiva() {
  const STORAGE_KEY = 'acopio_correccion_perdidas_v1_ejecutada';
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY + '_fecha');
  localStorage.removeItem(STORAGE_KEY + '_resultado');
}

/**
 * Función para verificar el estado de la corrección
 */
export function obtenerEstadoCorreccion() {
  const STORAGE_KEY = 'acopio_correccion_perdidas_v1_ejecutada';
  const ejecutada = localStorage.getItem(STORAGE_KEY) === 'true';
  const fecha = localStorage.getItem(STORAGE_KEY + '_fecha');
  const resultadoStr = localStorage.getItem(STORAGE_KEY + '_resultado');
  
  let resultado = null;
  if (resultadoStr) {
    try {
      resultado = JSON.parse(resultadoStr);
    } catch (e) {
      // Ignorar error de parsing
    }
  }

  return {
    ejecutada,
    fecha: fecha ? new Date(fecha) : null,
    resultado
  };
}