import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCompleteStyles, getLogoHTML, themes } from '@/utils/pdfStyles';

export function generateMovimientoPDF(movimiento, saldos) {
  const fecha = format(new Date(movimiento.fecha), "dd/MM/yyyy HH:mm", { locale: es });
  const fechaGeneracion = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: es });
  
  const esIngreso = movimiento.tipo_movimiento === "Ingreso de Fruta";
  
  let pesajesHTML = '';
  let resumenHTML = '';
  
  if (esIngreso && movimiento.pesajes?.length > 0) {
    // Agrupar pesajes por producto y envase
    const resumen = {};
    movimiento.pesajes.forEach(p => {
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

    pesajesHTML = `
      <div class="section">
        <h3>Detalle de Pesajes</h3>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Envase</th>
              <th>Cant.</th>
              <th>P. Bruto</th>
              <th>Tara</th>
              <th>P. Neto</th>
            </tr>
          </thead>
          <tbody>
            ${movimiento.pesajes.map(p => `
              <tr>
                <td>${p.producto_nombre || '-'}</td>
                <td>${p.envase_tipo || '-'}</td>
                <td>${p.cantidad || 1}</td>
                <td>${(p.peso_bruto || 0).toFixed(2)} kg</td>
                <td>${p.modo === 'libre' ? (p.tara_manual || 0).toFixed(2) : ((p.tara_unitaria || 0) * (p.cantidad || 1)).toFixed(2)} kg</td>
                <td><strong>${(p.peso_neto || 0).toFixed(2)} kg</strong></td>
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
              <th>Cantidad</th>
              <th>P. Bruto Total</th>
              <th>Tara Total</th>
              <th>P. Neto Total</th>
            </tr>
          </thead>
          <tbody>
            ${Object.values(resumen).map(r => `
              <tr>
                <td>${r.producto}</td>
                <td>${r.envase}</td>
                <td>${r.cantidad}</td>
                <td>${r.pesoBruto.toFixed(2)} kg</td>
                <td>${r.tara.toFixed(2)} kg</td>
                <td><strong>${r.pesoNeto.toFixed(2)} kg</strong></td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="3"><strong>TOTAL</strong></td>
              <td><strong>${Object.values(resumen).reduce((s, r) => s + r.pesoBruto, 0).toFixed(2)} kg</strong></td>
              <td><strong>${Object.values(resumen).reduce((s, r) => s + r.tara, 0).toFixed(2)} kg</strong></td>
              <td><strong>${Object.values(resumen).reduce((s, r) => s + r.pesoNeto, 0).toFixed(2)} kg</strong></td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  let envasesHTML = '';
  if (esIngreso && movimiento.cantidad_envases_llenos > 0) {
    envasesHTML = `
      <div class="section">
        <h3>Envases Llenos con Fruta</h3>
        <div style="padding: 15px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: #78350f; font-weight: 600;">Cantidad de Envases Llenos:</span>
            <span style="font-size: 18px; font-weight: bold; color: #92400e;">${movimiento.cantidad_envases_llenos} unidades</span>
          </div>
          <p style="font-size: 10px; color: #78350f; margin-top: 6px;">
            Envases que ingresaron ocupados con fruta → Stock Ocupados
          </p>
        </div>
      </div>
    `;
  }
  
  // Movimientos de envases VACÍOS (Movimiento de Envases Y historial)
  let envasesVaciosHTML = '';
  if (movimiento.tipo_movimiento === 'Movimiento de Envases' && movimiento.movimiento_envases?.length > 0) {
    const envConMov = movimiento.movimiento_envases.filter(e => e.cantidad_ingreso > 0 || e.cantidad_salida > 0);
    if (envConMov.length > 0) {
      const totalIngreso = envConMov.reduce((sum, e) => sum + (e.cantidad_ingreso || 0), 0);
      const totalSalida = envConMov.reduce((sum, e) => sum + (e.cantidad_salida || 0), 0);
      const balanceNeto = totalIngreso - totalSalida;
      
      envasesVaciosHTML = `
        <div class="section">
          <h3>Movimiento de Envases Vacíos</h3>
          <table>
            <thead>
              <tr>
                <th style="width: 40%;">Tipo de Envase</th>
                <th style="width: 30%; text-align: right;">Ingreso (Vacíos)</th>
                <th style="width: 30%; text-align: right;">Salida (Vacíos)</th>
              </tr>
            </thead>
            <tbody>
              ${envConMov.map(e => `
                <tr>
                  <td><strong>${e.envase_tipo}</strong></td>
                  <td style="text-align: right;">
                    ${e.cantidad_ingreso > 0 ? `<span class="ingreso">+${e.cantidad_ingreso}</span>` : '-'}
                  </td>
                  <td style="text-align: right;">
                    ${e.cantidad_salida > 0 ? `<span class="salida">-${e.cantidad_salida}</span>` : '-'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 15px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Total Ingreso:</span>
              <span class="ingreso" style="font-weight: 600;">+${totalIngreso} envases</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
              <span>Total Salida:</span>
              <span class="salida" style="font-weight: 600;">-${totalSalida} envases</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 2px solid #cbd5e1; font-weight: bold; font-size: 16px;">
              <span>Balance Neto:</span>
              <span>${balanceNeto > 0 ? '+' : ''}${balanceNeto} envases</span>
            </div>
          </div>
        </div>
      `;
    }
  }

  const nombreEntidad = movimiento.proveedor_nombre || movimiento.cliente_nombre || 'Sin especificar';
  
  const saldosHTML = saldos?.length > 0 ? `
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
  ` : '';

  const styles = getCompleteStyles(themes.default);
  const logoHTML = getLogoHTML(80);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Comprobante - ${movimiento.tipo_movimiento}</title>
      <style>
        ${styles}
        .saldos { 
          background: #fef3c7;
          padding: 15px;
          border-radius: 8px;
        }
        .saldos h3 { border-bottom-color: #fbbf24; }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoHTML}
        <div class="title">ACOPIO DE FRUTAS</div>
        <div class="subtitle">${movimiento.tipo_movimiento}</div>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <label>Fecha</label>
          <p>${fecha}</p>
        </div>
        <div class="info-item">
          <label>${movimiento.tipo_entidad || 'Proveedor'}</label>
          <p>${movimiento.proveedor_nombre || movimiento.cliente_nombre || ''}</p>
        </div>
        ${movimiento.fletero_nombre ? `
          <div class="info-item">
            <label>Fletero</label>
            <p>${movimiento.fletero_nombre}</p>
          </div>
        ` : ''}
      </div>

      ${pesajesHTML}
      ${envasesHTML}
      ${envasesVaciosHTML}
      ${saldosHTML}

      <div class="footer">
        <p>Comprobante generado el ${fechaGeneracion}</p>
        <p>Sistema de Gestión de Acopio</p>
      </div>
    </body>
    </html>
  `;

  return html;
}

export function downloadPDF(html, filename) {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}

async function htmlToPDFBlob(html, filename) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    document.body.appendChild(iframe);
    
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
    
    setTimeout(async () => {
      try {
        const canvas = await window.html2canvas(iframe.contentDocument.body, {
          scale: 2,
          useCORS: true,
          logging: false
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        const blob = pdf.output('blob');
        
        document.body.removeChild(iframe);
        resolve(blob);
      } catch (error) {
        console.error('Error generating PDF:', error);
        document.body.removeChild(iframe);
        resolve(null);
      }
    }, 500);
  });
}

export function generateResumenSaldosPDF(entidades, filtroTipo) {
  const fechaGeneracion = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: es });
  
  const totalProveedores = entidades.filter(e => e.tipo === 'Proveedor').length;
  const totalClientes = entidades.filter(e => e.tipo === 'Cliente').length;
  const totalEnvasesProveedores = entidades
    .filter(e => e.tipo === 'Proveedor')
    .reduce((sum, e) => sum + e.totalAdeudado, 0);
  const totalEnvasesClientes = entidades
    .filter(e => e.tipo === 'Cliente')
    .reduce((sum, e) => sum + e.totalAdeudado, 0);
  
  const proveedoresHTML = entidades.filter(e => e.tipo === 'Proveedor').length > 0 ? `
    <div class="section">
      <h3>Proveedores que Adeudan Envases</h3>
      <table>
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Envases por Tipo</th>
            <th>Total Adeudado</th>
          </tr>
        </thead>
        <tbody>
          ${entidades.filter(e => e.tipo === 'Proveedor').map(e => `
            <tr>
              <td><strong>${e.nombre}</strong></td>
              <td>
                ${e.envases.filter(env => env.saldo > 0).map(env => `${env.tipo}: ${env.saldo}`).join(' • ')}
              </td>
              <td class="total-cell">${e.totalAdeudado}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="2"><strong>TOTAL PROVEEDORES</strong></td>
            <td><strong>${totalEnvasesProveedores}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  ` : '';
  
  const clientesHTML = entidades.filter(e => e.tipo === 'Cliente').length > 0 ? `
    <div class="section">
      <h3>Clientes (Acopio Debe Envases)</h3>
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Envases por Tipo</th>
            <th>Total Adeudado</th>
          </tr>
        </thead>
        <tbody>
          ${entidades.filter(e => e.tipo === 'Cliente').map(e => `
            <tr>
              <td><strong>${e.nombre}</strong></td>
              <td>
                ${e.envases.filter(env => env.saldo > 0).map(env => `${env.tipo}: ${env.saldo}`).join(' • ')}
              </td>
              <td class="total-cell">${e.totalAdeudado}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="2"><strong>TOTAL CLIENTES</strong></td>
            <td><strong>${totalEnvasesClientes}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  ` : '';
  
  const resumenTheme = {
    primaryColor: '#dc2626',
    titleColor: '#991b1b',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    headerBg: '#fef2f2',
    headerColor: '#991b1b'
  };
  const resumenStyles = getCompleteStyles(resumenTheme);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Resumen de Saldos de Envases</title>
      <style>
        ${resumenStyles}
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin-bottom: 20px;
          padding: 15px;
          background: #fef2f2;
          border-radius: 8px;
        }
        .card {
          background: white;
          padding: 12px;
          border-radius: 6px;
          border-left: 4px solid #dc2626;
        }
        .card-label {
          font-size: 10px;
          color: #666;
          text-transform: uppercase;
        }
        .card-value {
          font-size: 20px;
          font-weight: bold;
          color: #991b1b;
          margin-top: 4px;
        }
        .total-cell {
          font-weight: bold;
          color: #dc2626;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${getLogoHTML(80)}
        <div class="title">ACOPIO DE FRUTAS</div>
        <div class="subtitle">Resumen de Saldos de Envases</div>
      </div>
      
      <div class="summary-cards">
        <div class="card">
          <div class="card-label">Proveedores con Deuda</div>
          <div class="card-value">${totalProveedores}</div>
          <div style="font-size: 9px; color: #666; margin-top: 4px;">
            Total: ${totalEnvasesProveedores} envases
          </div>
        </div>
        <div class="card">
          <div class="card-label">Clientes (Acopio Debe)</div>
          <div class="card-value">${totalClientes}</div>
          <div style="font-size: 9px; color: #666; margin-top: 4px;">
            Total: ${totalEnvasesClientes} envases
          </div>
        </div>
      </div>

      ${proveedoresHTML}
      ${clientesHTML}

      <div class="footer">
        <p>Resumen generado el ${fechaGeneracion}</p>
        <p>Sistema de Gestión de Acopio</p>
      </div>
    </body>
    </html>
  `;

  return html;
}

export function downloadResumenSaldosPDF(entidades, filtroTipo) {
  const html = generateResumenSaldosPDF(entidades, filtroTipo);
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}

export async function shareWhatsApp(movimiento, saldos, whatsappNumber) {
  if (!whatsappNumber || !whatsappNumber.trim()) {
    alert('No hay número de WhatsApp registrado para esta entidad');
    return;
  }

  // Crear mensaje de texto con resumen
  const fecha = format(new Date(movimiento.fecha), "dd/MM/yyyy HH:mm", { locale: es });
  let mensaje = `🍎 *COMPROBANTE DE ${movimiento.tipo_movimiento.toUpperCase()}*\n\n`;
  mensaje += `📅 Fecha: ${fecha}\n`;
  mensaje += `👤 ${movimiento.tipo_entidad || 'Proveedor'}: ${movimiento.proveedor_nombre || movimiento.cliente_nombre}\n`;
  
  if (movimiento.fletero_nombre) {
    mensaje += `🚚 Fletero: ${movimiento.fletero_nombre}\n`;
  }
  
  if (movimiento.pesajes?.length > 0) {
    const totalNeto = movimiento.pesajes.reduce((s, p) => s + (p.peso_neto || 0), 0);
    mensaje += `\n⚖️ *PESAJES*\n`;
    mensaje += `Total Peso Neto: ${totalNeto.toFixed(2)} kg\n`;
  }
  
  if (movimiento.movimiento_envases?.length > 0) {
    const envConMov = movimiento.movimiento_envases.filter(e => e.cantidad_ingreso > 0 || e.cantidad_salida > 0);
    if (envConMov.length > 0) {
      mensaje += `\n📦 *ENVASES VACÍOS*\n`;
      envConMov.forEach(e => {
        if (e.cantidad_ingreso > 0) mensaje += `✅ ${e.envase_tipo}: +${e.cantidad_ingreso} vacíos (devueltos)\n`;
        if (e.cantidad_salida > 0) mensaje += `🔴 ${e.envase_tipo}: -${e.cantidad_salida} vacíos (entregados)\n`;
      });
    }
  }

  // Limpiar número y abrir WhatsApp PRIMERO
  const cleanNumber = whatsappNumber.replace(/\D/g, '');
  const mensajeConInstruccion = mensaje + '\n\n📄 *Imprime o guarda el PDF desde la ventana que se abrió, luego adjúntalo aquí*';
  const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(mensajeConInstruccion)}`;
  window.open(whatsappUrl, '_blank');
  
  // Generar HTML del PDF y abrirlo DESPUÉS
  const html = generateMovimientoPDF(movimiento, saldos);
  
  setTimeout(() => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
  }, 300);
}