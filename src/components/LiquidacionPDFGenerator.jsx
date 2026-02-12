import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { commonPdfStyles, getLogoHTML } from '@/utils/pdfStyles';

/**
 * Genera el contenido HTML para el PDF de liquidación de sueldo
 */
function generarHTMLLiquidacion(liquidacion, empleado) {
  const totalViajes = liquidacion.viajes?.length || 0;
  const totalKilos = liquidacion.viajes?.reduce((sum, v) => sum + (v.kilos_llevados || 0), 0) || 0;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        ${commonPdfStyles}
        body { padding: 30px; max-width: 900px; }
        .header { border-bottom: 3px solid #3b82f6; }
        .header h1 { color: #1e293b; font-size: 28px; }
        .header h2 { color: #64748b; font-size: 18px; }
        .info-section { background: #f8fafc; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .section-title { font-size: 18px; color: #1e293b; margin: 25px 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
        th { background: #3b82f6; color: white; }
        .totals-box { background: #f1f5f9; }
        .total-row.final { margin-top: 15px; padding-top: 15px; border-top: 2px solid #cbd5e1; font-size: 20px; }
        .total-row.final .amount { color: #16a34a; }
      </style>
    </head>
    <body>
      <div class="header">
        ${getLogoHTML(80)}
        <h1>LIQUIDACIÓN DE SUELDO</h1>
        <h2>Período: ${liquidacion.periodo}</h2>
      </div>

      <div class="info-section">
        <div class="info-row">
          <span class="info-label">Empleado:</span>
          <span class="info-value">${liquidacion.empleado_nombre}</span>
        </div>
        <div class="info-row">
          <span class="info-label">CUIT/DNI:</span>
          <span class="info-value">${empleado?.cuit_dni || '-'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Fecha Liquidación:</span>
          <span class="info-value">${format(new Date(liquidacion.fecha_liquidacion), 'dd/MM/yyyy', { locale: es })}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Fecha de Pago:</span>
          <span class="info-value">${format(new Date(liquidacion.fecha_pago), 'dd/MM/yyyy', { locale: es })}</span>
        </div>
      </div>

      ${liquidacion.viajes && liquidacion.viajes.length > 0 ? `
        <div class="section-title">Detalle de Viajes</div>
        <table>
          <thead>
            <tr>
              <th style="width: 12%;">Fecha</th>
              <th style="width: 28%;">Ida</th>
              <th style="width: 28%;">Vuelta</th>
              <th style="width: 12%; text-align: right;">Kilos</th>
              <th style="width: 20%; text-align: right;">Importe</th>
            </tr>
          </thead>
          <tbody>
            ${liquidacion.viajes.map(viaje => {
              let idaTexto = '';
              if (viaje.ida_opcion1 && viaje.ida_cantidad1) {
                idaTexto += `${viaje.ida_opcion1}: ${viaje.ida_cantidad1}`;
              }
              if (viaje.ida_opcion2 && viaje.ida_cantidad2) {
                idaTexto += (idaTexto ? '<br/>' : '') + `${viaje.ida_opcion2}: ${viaje.ida_cantidad2}`;
              }
              if (!idaTexto) idaTexto = '-';

              let vueltaTexto = '';
              if (viaje.vuelta_opcion1 && viaje.vuelta_cantidad1) {
                vueltaTexto += `${viaje.vuelta_opcion1}: ${viaje.vuelta_cantidad1}`;
              }
              if (viaje.vuelta_opcion2 && viaje.vuelta_cantidad2) {
                vueltaTexto += (vueltaTexto ? '<br/>' : '') + `${viaje.vuelta_opcion2}: ${viaje.vuelta_cantidad2}`;
              }
              if (!vueltaTexto) vueltaTexto = '-';

              return `
                <tr>
                  <td>${format(new Date(viaje.fecha_viaje), 'dd/MM/yyyy', { locale: es })}</td>
                  <td>${idaTexto}</td>
                  <td>${vueltaTexto}</td>
                  <td style="text-align: right;">${viaje.kilos_llevados || 0} kg</td>
                  <td style="text-align: right; font-weight: 600;">$${viaje.importe_viaje.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
            <tr style="background: #e0f2fe; font-weight: bold;">
              <td colspan="3">TOTALES</td>
              <td style="text-align: right;">${totalKilos.toFixed(2)} kg</td>
              <td style="text-align: right;">$${liquidacion.total_viajes.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      ` : ''}

      <div class="totals-box">
        ${liquidacion.sueldo_base > 0 ? `
          <div class="total-row">
            <span>Sueldo Base:</span>
            <span class="amount">$${liquidacion.sueldo_base.toFixed(2)}</span>
          </div>
        ` : ''}
        ${liquidacion.total_viajes > 0 ? `
          <div class="total-row">
            <span>Total Viajes (${totalViajes} viajes):</span>
            <span class="amount">$${liquidacion.total_viajes.toFixed(2)}</span>
          </div>
        ` : ''}
        ${liquidacion.otros_conceptos > 0 ? `
          <div class="total-row">
            <span>Otros Conceptos:</span>
            <span class="amount">$${liquidacion.otros_conceptos.toFixed(2)}</span>
          </div>
        ` : ''}
        ${liquidacion.descuentos > 0 ? `
          <div class="total-row" style="color: #dc2626;">
            <span>Descuentos:</span>
            <span class="amount">-$${liquidacion.descuentos.toFixed(2)}</span>
          </div>
        ` : ''}
        <div class="total-row final">
          <span>TOTAL A PAGAR:</span>
          <span class="amount">$${liquidacion.total_liquidacion.toFixed(2)}</span>
        </div>
      </div>

      ${liquidacion.notas ? `
        <div class="section-title">Observaciones</div>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6;">${liquidacion.notas}</p>
      ` : ''}

      <div class="footer">
        <p>Documento generado el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Descarga el PDF de la liquidación
 */
export function descargarPDFLiquidacion(liquidacion, empleado) {
  const html = generarHTMLLiquidacion(liquidacion, empleado);
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
function generarTextoWhatsApp(liquidacion, empleado) {
  const totalViajes = liquidacion.viajes?.length || 0;
  const totalKilos = liquidacion.viajes?.reduce((sum, v) => sum + (v.kilos_llevados || 0), 0) || 0;

  let texto = `*LIQUIDACIÓN DE SUELDO*\n\n`;
  texto += `👤 Empleado: ${liquidacion.empleado_nombre}\n`;
  texto += `📅 Período: ${liquidacion.periodo}\n`;
  texto += `💰 Fecha de Pago: ${format(new Date(liquidacion.fecha_pago), 'dd/MM/yyyy', { locale: es })}\n\n`;

  if (liquidacion.viajes && liquidacion.viajes.length > 0) {
    texto += `*DETALLE DE VIAJES:*\n`;
    texto += `Total viajes: ${totalViajes}\n`;
    texto += `Total kilos: ${totalKilos.toFixed(2)} kg\n`;
    texto += `Importe viajes: $${liquidacion.total_viajes.toFixed(2)}\n\n`;
  }

  texto += `━━━━━━━━━━━━━━━\n`;
  texto += `*LIQUIDACIÓN:*\n`;
  
  if (liquidacion.sueldo_base > 0) {
    texto += `Sueldo Base: $${liquidacion.sueldo_base.toFixed(2)}\n`;
  }
  if (liquidacion.total_viajes > 0) {
    texto += `Total Viajes: $${liquidacion.total_viajes.toFixed(2)}\n`;
  }
  if (liquidacion.otros_conceptos > 0) {
    texto += `Otros Conceptos: $${liquidacion.otros_conceptos.toFixed(2)}\n`;
  }
  if (liquidacion.descuentos > 0) {
    texto += `Descuentos: -$${liquidacion.descuentos.toFixed(2)}\n`;
  }
  
  texto += `\n*TOTAL A PAGAR: $${liquidacion.total_liquidacion.toFixed(2)}*\n`;

  if (liquidacion.notas) {
    texto += `\n📝 Observaciones: ${liquidacion.notas}`;
  }

  return texto;
}

/**
 * Comparte la liquidación por WhatsApp
 */
export function compartirWhatsAppLiquidacion(liquidacion, empleado, numero) {
  const texto = generarTextoWhatsApp(liquidacion, empleado);
  const textoEncoded = encodeURIComponent(texto);
  const url = `https://wa.me/${numero}?text=${textoEncoded}`;
  window.open(url, '_blank');
}