import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { commonPdfStyles, getLogoHTML } from '@/utils/pdfStyles';

/**
 * Genera el HTML del PDF para INGRESO DE FRUTA
 * SIN saldos de envases - solo información de fruta, kilos y pesajes
 */
export function generarPDFIngresoFruta(movimiento) {
  const fecha = format(new Date(movimiento.fecha), "dd/MM/yyyy HH:mm", { locale: es });
  const fechaGeneracion = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: es });
  
  // Agrupar pesajes por producto y envase
  const resumen = {};
  (movimiento.pesajes || []).forEach(p => {
    const key = `${p.producto_nombre || 'Sin producto'}_${p.envase_tipo || 'Sin envase'}`;
    if (!resumen[key]) {
      resumen[key] = {
        producto: p.producto_nombre || 'Sin producto',
        envase: p.envase_tipo || '-',
        cantidad: 0,
        pesoBruto: 0,
        tara: 0,
        pesoNeto: 0
      };
    }
    resumen[key].cantidad += p.cantidad || 1;
    resumen[key].pesoBruto += p.peso_bruto || 0;
    resumen[key].tara += p.modo === 'libre' ? (p.tara_manual || 0) : ((p.tara_unitaria || 0) * (p.cantidad || 1));
    resumen[key].pesoNeto += p.peso_neto || 0;
  });

  const totalPesoBruto = Object.values(resumen).reduce((s, r) => s + r.pesoBruto, 0);
  const totalTara = Object.values(resumen).reduce((s, r) => s + r.tara, 0);
  const totalPesoNeto = Object.values(resumen).reduce((s, r) => s + r.pesoNeto, 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Ingreso de Fruta</title>
      <style>
        ${commonPdfStyles}
        .header { border-bottom: 3px solid #22c55e; }
        .title { color: #166534; }
        .info-section { background: #f0fdf4; }
        .info-row { border-bottom: 1px solid #bbf7d0; }
        .info-value { color: #166534; }
        .section h3 { color: #166534; border-bottom-color: #bbf7d0; }
        th { background: #f0fdf4; color: #166534; }
        .total-row { background: #dcfce7; }
        .envases-llenos { background: #fef3c7; border-left: 4px solid #f59e0b; }
        .envases-llenos h3 { color: #92400e; border-bottom-color: #fde68a; }
        .envase-tipo { color: #92400e; }
        .envase-cantidad { color: #d97706; }
      </style>
    </head>
    <body>
      <div class="header">
        ${getLogoHTML(80)}
        <div class="title">ACOPIO DE FRUTAS</div>
        <div class="subtitle">Ingreso de Fruta</div>
      </div>
      
      <div class="info-section">
        <div class="info-row">
          <span class="info-label">Fecha:</span>
          <span class="info-value">${fecha}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Proveedor:</span>
          <span class="info-value">${movimiento.proveedor_nombre || 'Sin especificar'}</span>
        </div>
        ${movimiento.fletero_nombre ? `
          <div class="info-row">
            <span class="info-label">Fletero:</span>
            <span class="info-value">${movimiento.fletero_nombre}</span>
          </div>
        ` : ''}
      </div>

      <div class="section">
        <h3>Detalle de Pesajes</h3>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Envase</th>
              <th style="text-align: right;">Cant.</th>
              <th style="text-align: right;">P. Bruto</th>
              <th style="text-align: right;">Tara</th>
              <th style="text-align: right;">P. Neto</th>
            </tr>
          </thead>
          <tbody>
            ${(movimiento.pesajes || []).map(p => `
              <tr>
                <td><strong>${p.producto_nombre || '-'}</strong></td>
                <td>${p.envase_tipo || '-'}</td>
                <td style="text-align: right;">${p.cantidad || 1}</td>
                <td style="text-align: right;">${(p.peso_bruto || 0).toFixed(2)} kg</td>
                <td style="text-align: right;">${p.modo === 'libre' ? (p.tara_manual || 0).toFixed(2) : ((p.tara_unitaria || 0) * (p.cantidad || 1)).toFixed(2)} kg</td>
                <td style="text-align: right;"><strong>${(p.peso_neto || 0).toFixed(2)} kg</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <h3>Resumen por Producto</h3>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Envase</th>
              <th style="text-align: right;">Cantidad</th>
              <th style="text-align: right;">P. Bruto Total</th>
              <th style="text-align: right;">Tara Total</th>
              <th style="text-align: right;">P. Neto Total</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(resumen).map(r => `
              <tr>
                <td><strong>${r.producto}</strong></td>
                <td>${r.envase}</td>
                <td style="text-align: right;">${r.cantidad}</td>
                <td style="text-align: right;">${r.pesoBruto.toFixed(2)} kg</td>
                <td style="text-align: right;">${r.tara.toFixed(2)} kg</td>
                <td style="text-align: right;"><strong>${r.pesoNeto.toFixed(2)} kg</strong></td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3"><strong>TOTAL</strong></td>
              <td style="text-align: right;"><strong>${totalPesoBruto.toFixed(2)} kg</strong></td>
              <td style="text-align: right;"><strong>${totalTara.toFixed(2)} kg</strong></td>
              <td style="text-align: right;"><strong>${totalPesoNeto.toFixed(2)} kg</strong></td>
            </tr>
          </tbody>
        </table>
      </div>

      ${(movimiento.envases_llenos && movimiento.envases_llenos.length > 0) ? `
        <div class="envases-llenos">
          <h3>Envases Llenos con Fruta</h3>
          <div class="envases-grid">
            ${movimiento.envases_llenos.map(e => `
              <div class="envase-item">
                <div class="envase-tipo">${e.envase_tipo}</div>
                <div class="envase-cantidad">${e.cantidad} unidades</div>
              </div>
            `).join('')}
          </div>
          <p style="font-size: 10px; color: #78350f; margin-top: 12px;">
            * Envases que ingresaron llenos con fruta
          </p>
        </div>
      ` : ''}

      ${movimiento.notas ? `
        <div style="background: #eff6ff; padding: 15px; border-radius: 8px; margin-top: 20px; border-left: 4px solid #3b82f6;">
          <h4 style="color: #1e40af; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Notas:</h4>
          <p style="color: #1e3a8a; font-size: 12px; line-height: 1.6;">${movimiento.notas}</p>
        </div>
      ` : ''}

      <div class="footer">
        <p>Comprobante generado el ${fechaGeneracion}</p>
        <p>Sistema de Gestión de Acopio</p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Descarga el PDF de ingreso de fruta
 */
export function descargarPDFIngresoFruta(movimiento) {
  const html = generarPDFIngresoFruta(movimiento);
  const ventana = window.open('', '_blank');
  ventana.document.write(html);
  ventana.document.close();
  
  setTimeout(() => {
    ventana.print();
  }, 250);
}

/**
 * Comparte ingreso de fruta por WhatsApp
 */
export function compartirWhatsAppIngresoFruta(movimiento, whatsappNumber) {
  if (!whatsappNumber || !whatsappNumber.trim()) {
    alert('No hay número de WhatsApp registrado para este proveedor');
    return;
  }

  const fecha = format(new Date(movimiento.fecha), "dd/MM/yyyy HH:mm", { locale: es });
  const totalNeto = (movimiento.pesajes || []).reduce((s, p) => s + (p.peso_neto || 0), 0);
  
  let texto = `🍎 *INGRESO DE FRUTA*\n\n`;
  texto += `📅 Fecha: ${fecha}\n`;
  texto += `👤 Proveedor: ${movimiento.proveedor_nombre || 'Sin especificar'}\n`;
  if (movimiento.fletero_nombre) {
    texto += `🚚 Fletero: ${movimiento.fletero_nombre}\n`;
  }
  texto += `\n⚖️ *RESUMEN*\n`;
  texto += `Total Peso Neto: *${totalNeto.toFixed(2)} kg*\n`;
  
  if (movimiento.pesajes && movimiento.pesajes.length > 0) {
    texto += `\n📦 *DETALLE POR PRODUCTO*\n`;
    const resumenProductos = {};
    movimiento.pesajes.forEach(p => {
      if (!resumenProductos[p.producto_nombre]) {
        resumenProductos[p.producto_nombre] = 0;
      }
      resumenProductos[p.producto_nombre] += p.peso_neto || 0;
    });
    Object.entries(resumenProductos).forEach(([prod, kg]) => {
      texto += `• ${prod}: ${kg.toFixed(2)} kg\n`;
    });
  }
  
  if (movimiento.envases_llenos && movimiento.envases_llenos.length > 0) {
    texto += `\n📦 *ENVASES LLENOS CON FRUTA*\n`;
    movimiento.envases_llenos.forEach(e => {
      texto += `• ${e.envase_tipo}: ${e.cantidad} unidades\n`;
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
    descargarPDFIngresoFruta(movimiento);
  }, 300);
}