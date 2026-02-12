import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { commonPdfStyles, getLogoHTML } from '@/utils/pdfStyles';

/**
 * Calcula los saldos de envases ACTUALIZADOS después de aplicar el movimiento
 */
export function calcularSaldosActualizados(movimiento, saldosAnteriores) {
  const saldosActualizados = {};
  
  // Copiar saldos anteriores
  saldosAnteriores.forEach(s => {
    saldosActualizados[s.envase_tipo] = s.saldo || 0;
  });
  
  // Aplicar movimiento actual
  (movimiento.movimiento_envases || []).forEach(e => {
    if (!saldosActualizados[e.envase_tipo]) {
      saldosActualizados[e.envase_tipo] = 0;
    }
    
    // SALIDA = le doy envases = aumenta deuda
    // INGRESO = me devuelve envases = reduce deuda
    const cambio = (e.cantidad_salida || 0) - (e.cantidad_ingreso || 0);
    saldosActualizados[e.envase_tipo] += cambio;
  });
  
  return Object.entries(saldosActualizados).map(([tipo, saldo]) => ({
    envase_tipo: tipo,
    saldo: saldo
  }));
}

/**
 * Genera el HTML del PDF para MOVIMIENTO DE ENVASES
 * CON saldos actualizados después del movimiento
 */
export function generarPDFMovimientoEnvases(movimiento, entidad, fletero, saldosActualizados = []) {
  const fecha = format(new Date(movimiento.fecha), "dd/MM/yyyy HH:mm", { locale: es });
  const fechaGeneracion = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: es });
  
  const tipoEntidad = movimiento.tipo_entidad || 'Proveedor';
  const nombreEntidad = entidad?.nombre || movimiento.proveedor_nombre || movimiento.cliente_nombre || 'Sin especificar';
  const nombreFletero = fletero?.nombre || movimiento.fletero_nombre || '-';

  const esIngreso = (movimiento.movimiento_envases || []).some(e => (e.cantidad_ingreso || 0) > 0);
  const esSalida = (movimiento.movimiento_envases || []).some(e => (e.cantidad_salida || 0) > 0);
  
  let tipoMovimiento = '';
  if (esIngreso && esSalida) tipoMovimiento = 'Ingreso y Salida de Envases Vacíos';
  else if (esIngreso) tipoMovimiento = 'Ingreso de Envases Vacíos';
  else if (esSalida) tipoMovimiento = 'Salida de Envases Vacíos';
  else tipoMovimiento = 'Movimiento de Envases';

  const totalIngreso = (movimiento.movimiento_envases || []).reduce((sum, e) => sum + (e.cantidad_ingreso || 0), 0);
  const totalSalida = (movimiento.movimiento_envases || []).reduce((sum, e) => sum + (e.cantidad_salida || 0), 0);
  const balanceNeto = totalIngreso - totalSalida;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Movimiento de Envases</title>
      <style>
        ${commonPdfStyles}
        .header { border-bottom: 3px solid #6366f1; }
        .title { color: #4338ca; }
        .info-section { background: #f0f9ff; }
        .info-row { border-bottom: 1px solid #bfdbfe; }
        .info-value { color: #1e40af; }
        th { background: #dbeafe; color: #1e40af; }
        .totales { background: #f1f5f9; }
        .saldos-section { background: #f0fdf4; border-left: 4px solid #10b981; }
        .saldos-section h3 { color: #065f46; }
        .saldo-debe { background: #fee2e2; border-color: #fca5a5; }
        .saldo-ok { background: #dcfce7; border-color: #86efac; }
        .debe { color: #991b1b; }
        .ok { color: #065f46; }
      </style>
    </head>
    <body>
      <div class="header">
        ${getLogoHTML(80)}
        <div class="title">MOVIMIENTO DE ENVASES</div>
        <div class="subtitle">${tipoMovimiento}</div>
      </div>

      <div class="info-section">
        <div class="info-row">
          <span class="info-label">Fecha:</span>
          <span class="info-value">${fecha}</span>
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

      <div class="totales">
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
          <span>${balanceNeto > 0 ? '+' : ''}${balanceNeto} envases</span>
        </div>
      </div>

      ${movimiento.notas ? `
        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #f59e0b;">
          <h4 style="color: #92400e; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Notas:</h4>
          <p style="color: #78350f; font-size: 12px; line-height: 1.6;">${movimiento.notas}</p>
        </div>
      ` : ''}

      ${saldosActualizados.length > 0 ? `
        <div class="saldos-section">
          <h3>Saldo Actual de Envases - ${nombreEntidad}</h3>
          <div class="saldos-grid">
            ${saldosActualizados.map(s => `
              <div class="saldo-item ${s.saldo > 0 ? 'saldo-debe' : 'saldo-ok'}">
                <div class="saldo-tipo ${s.saldo > 0 ? 'debe' : 'ok'}">${s.envase_tipo}</div>
                <div class="saldo-valor ${s.saldo > 0 ? 'debe' : 'ok'}">
                  ${s.saldo > 0 ? `Adeuda ${s.saldo}` : 'Sin deuda'}
                </div>
              </div>
            `).join('')}
          </div>
          <p style="font-size: 11px; color: #065f46; margin-top: 12px;">
            * Saldo actualizado al ${fecha}
          </p>
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
        Comprobante generado el ${fechaGeneracion}<br>
        Sistema de Gestión de Acopio
      </div>
    </body>
    </html>
  `;
}

/**
 * Descarga el PDF del movimiento de envases
 */
export function descargarPDFMovimientoEnvases(movimiento, entidad, fletero, saldosActualizados = []) {
  const html = generarPDFMovimientoEnvases(movimiento, entidad, fletero, saldosActualizados);
  const ventana = window.open('', '_blank');
  ventana.document.write(html);
  ventana.document.close();
  
  setTimeout(() => {
    ventana.print();
  }, 250);
}

/**
 * Comparte movimiento de envases por WhatsApp
 */
export function compartirWhatsAppMovimientoEnvases(movimiento, entidad, whatsappNumber, saldosActualizados = []) {
  if (!whatsappNumber || !whatsappNumber.trim()) {
    alert('No hay número de WhatsApp registrado para esta entidad');
    return;
  }

  const tipoEntidad = movimiento.tipo_entidad || 'Proveedor';
  const nombreEntidad = entidad?.nombre || movimiento.proveedor_nombre || movimiento.cliente_nombre || 'Sin especificar';
  const fecha = format(new Date(movimiento.fecha), "dd/MM/yyyy HH:mm", { locale: es });

  const esIngreso = (movimiento.movimiento_envases || []).some(e => (e.cantidad_ingreso || 0) > 0);
  const esSalida = (movimiento.movimiento_envases || []).some(e => (e.cantidad_salida || 0) > 0);
  
  let tipoMovimiento = '';
  if (esIngreso && esSalida) tipoMovimiento = 'INGRESO Y SALIDA DE ENVASES VACÍOS';
  else if (esIngreso) tipoMovimiento = 'INGRESO DE ENVASES VACÍOS';
  else if (esSalida) tipoMovimiento = 'SALIDA DE ENVASES VACÍOS';
  else tipoMovimiento = 'MOVIMIENTO DE ENVASES';

  let texto = `📦 *${tipoMovimiento}*\n\n`;
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

  const totalIngreso = (movimiento.movimiento_envases || []).reduce((sum, e) => sum + (e.cantidad_ingreso || 0), 0);
  const totalSalida = (movimiento.movimiento_envases || []).reduce((sum, e) => sum + (e.cantidad_salida || 0), 0);
  const balance = totalIngreso - totalSalida;

  texto += `\n━━━━━━━━━━━━━━━\n`;
  texto += `*TOTALES:*\n`;
  texto += `✅ Total Ingreso: +${totalIngreso} envases\n`;
  texto += `❌ Total Salida: -${totalSalida} envases\n`;
  texto += `📊 Balance Neto: ${balance > 0 ? '+' : ''}${balance} envases\n`;

  if (saldosActualizados.length > 0) {
    texto += `\n━━━━━━━━━━━━━━━\n`;
    texto += `*SALDO ACTUAL - ${nombreEntidad}*\n`;
    saldosActualizados.forEach(s => {
      if (s.saldo > 0) {
        texto += `📦 ${s.envase_tipo}: Adeuda ${s.saldo} envases\n`;
      } else if (s.saldo < 0) {
        texto += `📦 ${s.envase_tipo}: A favor ${Math.abs(s.saldo)} envases\n`;
      } else {
        texto += `📦 ${s.envase_tipo}: Sin deuda\n`;
      }
    });
  }

  if (movimiento.notas) {
    texto += `\n📝 Notas: ${movimiento.notas}`;
  }
  
  const textoEncoded = encodeURIComponent(texto);
  const cleanNumber = whatsappNumber.replace(/\D/g, '');
  const url = `https://wa.me/${cleanNumber}?text=${textoEncoded}`;
  window.open(url, '_blank');
  
  // Abrir PDF después
  setTimeout(() => {
    descargarPDFMovimientoEnvases(movimiento, entidad, null, saldosActualizados);
  }, 300);
}