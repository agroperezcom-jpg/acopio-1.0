import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { correccionRetroactivaEnvases } from '../utils/correccionRetroactivaEnvases';

/**
 * ═══════════════════════════════════════════════════════════════════
 * HOOK: CORRECCIÓN AUTOMÁTICA RETROACTIVA DE ENVASES (EJECUCIÓN ÚNICA)
 * ═══════════════════════════════════════════════════════════════════
 * 
 * Ejecuta corrección retroactiva de stocks de envases al cargar la app,
 * asegurando que TODOS los registros históricos se procesen correctamente
 * según lógica de checkboxes independientes (tildado=ocupados, destildado=vacíos)
 */
export function useCorreccionEnvasesRetroactiva() {
  const queryClient = useQueryClient();
  const [ejecutando, setEjecutando] = useState(false);
  const [ejecutado, setEjecutado] = useState(false);

  useEffect(() => {
    const STORAGE_KEY = 'correccion_envases_retroactiva_v4';
    
    const ejecutarCorreccion = async () => {
      // Verificar si ya se ejecutó
      const yaEjecutado = localStorage.getItem(STORAGE_KEY);
      if (yaEjecutado) {
        setEjecutado(true);
        return;
      }

      setEjecutando(true);

      try {
        const resultado = await correccionRetroactivaEnvases(base44);
        
        // Marcar como ejecutado con timestamp y resultado
        const infoEjecucion = {
          fecha: new Date().toISOString(),
          envasesCorregidos: resultado.corregidos,
          unidadesAjustadas: resultado.unidadesAjustadas,
          version: 'v4'
        };
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(infoEjecucion));
        
        // Invalidar queries para refrescar datos en toda la app
        queryClient.invalidateQueries({ queryKey: ['envases'] });
        queryClient.invalidateQueries({ queryKey: ['movimientos'] });
        queryClient.invalidateQueries({ queryKey: ['salidas'] });

        setEjecutado(true);
      } catch (error) {
        console.error('❌ Error en corrección retroactiva de envases:', error);
        // No marcar como ejecutado para reintentar en próxima carga
      } finally {
        setEjecutando(false);
      }
    };

    ejecutarCorreccion();
  }, [queryClient]);

  return { ejecutando, ejecutado };
}

/**
 * Resetea el flag de ejecución (útil para testing o re-ejecutar manualmente)
 */
export function resetCorreccionEnvasesRetroactiva() {
  localStorage.removeItem('correccion_envases_retroactiva_v2');
  localStorage.removeItem('correccion_envases_retroactiva_v3');
  localStorage.removeItem('correccion_envases_retroactiva_v4');
}

/**
 * Obtiene el estado actual de la corrección retroactiva
 */
export function obtenerEstadoCorreccionEnvases() {
  const info = localStorage.getItem('correccion_envases_retroactiva_v4');
  if (!info) {
    return { ejecutado: false, detalles: null };
  }
  
  try {
    const detalles = JSON.parse(info);
    return { ejecutado: true, detalles };
  } catch {
    return { ejecutado: false, detalles: null };
  }
}