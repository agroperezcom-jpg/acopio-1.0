/**
 * Utilidades para gestión de queries y cache de React Query
 */

/**
 * Invalida todas las queries críticas del sistema para asegurar consistencia de datos
 * Útil después de operaciones de creación, edición o borrado que afectan múltiples entidades
 * 
 * @param {Object} queryClient - Instancia de QueryClient de React Query
 */
export function invalidarTodoElSistema(queryClient) {
  if (!queryClient) {
    console.warn('invalidarTodoElSistema: queryClient no proporcionado');
    return;
  }

  // Invalidar queries críticas del sistema
  queryClient.invalidateQueries({ queryKey: ['movimientos'] });
  queryClient.invalidateQueries({ queryKey: ['movimientos-infinite'] });
  queryClient.invalidateQueries({ queryKey: ['salidas'] });
  queryClient.invalidateQueries({ queryKey: ['salidas-infinite'] });
  queryClient.invalidateQueries({ queryKey: ['cuentacorriente'] });
  queryClient.invalidateQueries({ queryKey: ['movimientostesoreria'] });
  queryClient.invalidateQueries({ queryKey: ['productos'] });
  queryClient.invalidateQueries({ queryKey: ['envases'] });
  queryClient.invalidateQueries({ queryKey: ['cobros'] });
  queryClient.invalidateQueries({ queryKey: ['cobros-infinite'] });
  queryClient.invalidateQueries({ queryKey: ['pagos'] });
  queryClient.invalidateQueries({ queryKey: ['pagos-infinite'] });
  queryClient.invalidateQueries({ queryKey: ['proveedores'] });
  queryClient.invalidateQueries({ queryKey: ['clientes'] });
  queryClient.invalidateQueries({ queryKey: ['fleteros'] });
  queryClient.invalidateQueries({ queryKey: ['cajas'] });
  queryClient.invalidateQueries({ queryKey: ['bancos'] });
  queryClient.invalidateQueries({ queryKey: ['cheques'] });
}

/**
 * Invalida queries relacionadas con movimientos y salidas
 * Útil después de operaciones que afectan el historial
 * 
 * @param {Object} queryClient - Instancia de QueryClient de React Query
 */
export function invalidarMovimientos(queryClient) {
  if (!queryClient) return;
  
  queryClient.invalidateQueries({ queryKey: ['movimientos'] });
  queryClient.invalidateQueries({ queryKey: ['movimientos-infinite'] });
  queryClient.invalidateQueries({ queryKey: ['salidas'] });
  queryClient.invalidateQueries({ queryKey: ['salidas-infinite'] });
  queryClient.invalidateQueries({ queryKey: ['productos'] });
  queryClient.invalidateQueries({ queryKey: ['envases'] });
  queryClient.invalidateQueries({ queryKey: ['cuentacorriente'] });
}

/**
 * Invalida queries relacionadas con tesorería
 * Útil después de operaciones financieras
 * 
 * @param {Object} queryClient - Instancia de QueryClient de React Query
 */
export function invalidarTesoreria(queryClient) {
  if (!queryClient) return;
  
  queryClient.invalidateQueries({ queryKey: ['cobros'] });
  queryClient.invalidateQueries({ queryKey: ['pagos'] });
  queryClient.invalidateQueries({ queryKey: ['movimientostesoreria'] });
  queryClient.invalidateQueries({ queryKey: ['cuentacorriente'] });
  queryClient.invalidateQueries({ queryKey: ['cajas'] });
  queryClient.invalidateQueries({ queryKey: ['bancos'] });
  queryClient.invalidateQueries({ queryKey: ['cheques'] });
}
