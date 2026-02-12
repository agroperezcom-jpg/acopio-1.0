import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { commonPdfStyles, getLogoHTML } from '@/utils/pdfStyles';

/**
 * Genera el contenido HTML para el PDF de movimiento de envases
 */
function generarHTMLMovimientoEnvases(movimiento, entidad, fletero, saldos = []) {
  const tipoEntidad = movimiento.tipo_entidad || 'Proveedor';
  const nombreEntidad = entidad?.nombre || movimiento.proveedor_nombre || movimiento.cliente_nombre || 'Sin especificar';
  const nombreFletero = fletero?.nombre || movimiento.fletero_nombre || '-';

  const esIngreso = movimiento.movimiento_envases?.some(e => (e.cantidad_ingreso || 0) > 0);
  const esSalida = movimiento.movimiento_envases?.some(e => (e.cantidad_salida || 0) > 0);
  
  let tipoMovimiento = '';
  if (esIngreso && esSalida) tipoMovimiento = 'Ingreso y Salida de Envases Vacíos';
  else if (esIngreso) tipoMovimiento = 'Ingreso de Envases Vacíos';
  else if (esSalida) tipoMovimiento = 'Salida de Envases Vacíos';
  else tipoMovimiento = 'Movimiento de Envases';

  const totalIngreso = movimiento.movimiento_envases?.reduce((sum, e) => sum + (e.cantidad_ingreso || 0), 0) || 0;
  const totalSalida = movimiento.movimiento_envases?.reduce((sum, e) => sum + (e.cantidad_salida || 0), 0) || 0;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        ${commonPdfStyles}
        .header { border-bottom: 3px solid #6366f1; }
        .header h1 { color: #1e293b; }
        .header h2 { color: #64748b; }
        .info-section { background: #f8fafc; }
        th { background: #6366f1; color: white; }
        .totals { background: #f1f5f9; }
        .notas { background: #fef3c7; border-left: 4px solid #f59e0b; }
        .notas-title { color: #92400e; }
        .notas-text { color: #78350f; }
      </style>
    </head>
    <body>
      <div class="header">
        ${getLogoHTML(80)}
        <h1>MOVIMIENTO DE ENVASES</h1>
        <h2>${tipoMovimiento}</h2>
      </div>

      <div class="info-section">
        <div class="info-row">
          <span class="info-label">Fecha:</span>
          <span class="info-value">${format(new Date(movimiento.fecha), "dd/MM/yyyy HH:mm", { locale: es })}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${tipoEntidad}:</span>
          <span class="info-value">${nombreEntidad}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Fletero:</span>
          <span class="info-value">${nombreFletero}</span>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 40%;">Tipo de Envase</th>
            <th style="width: 30%; text-align: right;">Ingreso (Vacíos)</th>
            <th style="width: 30%; text-align: right;">Salida (Vacíos)</th>
          </tr>
        </thead>
        <tbody>
          ${(movimiento.movimiento_envases || []).map(env => `
            <tr>
              <td><strong>${env.envase_tipo}</strong></td>
              <td style="text-align: right;">
                ${env.cantidad_ingreso > 0 ? `<span class="ingreso">+${env.cantidad_ingreso}</span>` : '-'}
              </td>
              <td style="text-align: right;">
                ${env.cantidad_salida > 0 ? `<span class="salida">-${env.cantidad_salida}</span>` : '-'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>Total Ingreso:</span>
          <span class="ingreso">+${totalIngreso} envases</span>
        </div>
        <div class="total-row">
          <span>Total Salida:</span>
          <span class="salida">-${totalSalida} envases</span>
        </div>
        <div class="total-row">
          <span>Balance Neto:</span>
          <span>${totalIngreso - totalSalida > 0 ? '+' : ''}${totalIngreso - totalSalida} envases</span>
        </div>
      </div>

      ${movimiento.notas ? `
        <div class="notas">
          <div class="notas-title">Notas:</div>
          <div class="notas-text">${movimiento.notas}</div>
        </div>
      ` : ''}

      ${saldos.length > 0 ? `
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #10b981;">
          <h3 style="color: #065f46; font-weight: 600; margin-bottom: 12px; font-size: 16px;">Saldo Actual de Envases - ${nombreEntidad}</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
            ${saldos.map(s => `
              <div style="background: ${s.saldo > 0 ? '#fee2e2' : '#dcfce7'}; padding: 12px; border-radius: 6px; border: 1px solid ${s.saldo > 0 ? '#fca5a5' : '#86efac'};">
                <p style="font-size: 14px; color: ${s.saldo > 0 ? '#991b1b' : '#065f46'};">
                  <strong>${s.envase_tipo}:</strong><br>
                  ${s.saldo > 0 ? `Adeuda <strong>${s.saldo}</strong> envases` : '<strong>Sin deuda</strong>'}
                </p>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="firma-section">
        <div class="firma-linea">
          <div></div>
          <p><strong>Firma y Aclaración</strong></p>
          <p>${nombreEntidad}</p>
        </div>
      </div>

      <div class="footer">
        Comprobante generado el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}<br>
        Sistema de Gestión de Acopio
      </div>
    </body>
    </html>
  `;
}

/**
 * Descarga el PDF del movimiento de envases
 */
export function descargarPDFMovimientoEnvases(movimiento, entidad, fletero, saldos = []) {
  const html = generarHTMLMovimientoEnvases(movimiento, entidad, fletero, saldos);
  const ventana = window.open('', '_blank');
  ventana.document.write(html);
  ventana.document.close();
  
  setTimeout(() => {
    ventana.print();
  }, 250);
}

/**
 * Genera un resumen de texto para WhatsApp
 */
function generarTextoWhatsApp(movimiento, entidad) {
  const tipoEntidad = movimiento.tipo_entidad || 'Proveedor';
  const nombreEntidad = entidad?.nombre || movimiento.proveedor_nombre || movimiento.cliente_nombre || 'Sin especificar';
  const fecha = format(new Date(movimiento.fecha), "dd/MM/yyyy HH:mm", { locale: es });

  const esIngreso = movimiento.movimiento_envases?.some(e => (e.cantidad_ingreso || 0) > 0);
  const esSalida = movimiento.movimiento_envases?.some(e => (e.cantidad_salida || 0) > 0);
  
  let tipoMovimiento = '';
  if (esIngreso && esSalida) tipoMovimiento = 'INGRESO Y SALIDA DE ENVASES VACÍOS';
  else if (esIngreso) tipoMovimiento = 'INGRESO DE ENVASES VACÍOS';
  else if (esSalida) tipoMovimiento = 'SALIDA DE ENVASES VACÍOS';
  else tipoMovimiento = 'MOVIMIENTO DE ENVASES';

  let texto = `*${tipoMovimiento}*\n\n`;
  texto += `📅 Fecha: ${fecha}\n`;
  texto += `👤 ${tipoEntidad}: ${nombreEntidad}\n\n`;
  texto += `*DETALLE DE ENVASES:*\n`;

  (movimiento.movimiento_envases || []).forEach(env => {
    texto += `\n📦 ${env.envase_tipo}\n`;
    if (env.cantidad_ingreso > 0) {
      texto += `   ✅ Ingreso: +${env.cantidad_ingreso} vacíos\n`;
    }
    if (env.cantidad_salida > 0) {
      texto += `   ❌ Salida: -${env.cantidad_salida} vacíos\n`;
    }
  });

  const totalIngreso = movimiento.movimiento_envases?.reduce((sum, e) => sum + (e.cantidad_ingreso || 0), 0) || 0;
  const totalSalida = movimiento.movimiento_envases?.reduce((sum, e) => sum + (e.cantidad_salida || 0), 0) || 0;
  const balance = totalIngreso - totalSalida;

  texto += `\n━━━━━━━━━━━━━━━\n`;
  texto += `*TOTALES:*\n`;
  texto += `✅ Total Ingreso: +${totalIngreso} envases\n`;
  texto += `❌ Total Salida: -${totalSalida} envases\n`;
  texto += `📊 Balance Neto: ${balance > 0 ? '+' : ''}${balance} envases\n`;

  if (movimiento.notas) {
    texto += `\n📝 Notas: ${movimiento.notas}`;
  }

  return texto;
}

/**
 * Comparte el movimiento de envases por WhatsApp
 */
export function compartirWhatsAppMovimientoEnvases(movimiento, entidad, numero, saldos = []) {
  let texto = generarTextoWhatsApp(movimiento, entidad);
  
  // Agregar saldos si existen
  if (saldos.length > 0) {
    texto += `\n━━━━━━━━━━━━━━━\n`;
    texto += `*SALDO ACTUAL - ${entidad?.nombre || movimiento.proveedor_nombre || movimiento.cliente_nombre}*\n`;
    saldos.forEach(s => {
      texto += `📦 ${s.envase_tipo}: ${s.saldo > 0 ? `Adeuda ${s.saldo} envases` : 'Sin deuda'}\n`;
    });
  }
  
  const textoEncoded = encodeURIComponent(texto);
  const url = `https://wa.me/${numero}?text=${textoEncoded}`;
  window.open(url, '_blank');
}