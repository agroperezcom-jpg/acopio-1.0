/**
 * Servicio de Cuenta Corriente: actualización incremental de saldo_actual.
 * Proveedor y Cliente deben tener campo numérico saldo_actual.
 * Haber = aumenta deuda (delta > 0), Debe = disminuye (delta < 0).
 */

import { actualizarSaldoEntidad } from '@/utils/contabilidad';

/**
 * Ajusta el saldo vivo de una entidad en un monto delta.
 * @param {Object} base44 - Cliente base44
 * @param {string} entidadTipo - 'Cliente' | 'Proveedor'
 * @param {string} entidadId - ID de la entidad
 * @param {number} montoDelta - Monto a sumar al saldo (positivo = más deuda, negativo = pago/cobro)
 */
export async function ajustarSaldo(base44, entidadTipo, entidadId, montoDelta) {
  await actualizarSaldoEntidad(base44, entidadTipo, entidadId, montoDelta);
}
