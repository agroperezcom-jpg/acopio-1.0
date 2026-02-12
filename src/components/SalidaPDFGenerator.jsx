import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getCompleteStyles, getLogoHTML, themes } from '@/utils/pdfStyles';

export function generateSalidaPDF(salida) {
  const fecha = format(new Date(salida.fecha), "dd/MM/yyyy HH:mm", { locale: es });
  const fechaGeneracion = format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: es });
  
  const esConfirmada = salida.estado === 'Confirmada';
  
  let detallesHTML = '';
  let totalKilosSalida = 0;
  let totalKilosReales = 0;
  let totalDescuento = 0;
  let totalEfectivos = 0;
  let deudaTotal = 0;

  if (salida.detalles?.length > 0) {
    salida.detalles.forEach(d => {
      const kilosSalida = d.kilos_salida || 0;
      const kilosReales = d.kilos_reales || kilosSalida;
      const descuento = d.descuento_kg || 0;
      const efectivos = kilosReales - descuento;
      const precioKg = d.precio_kg || 0;
      const deuda = efectivos * precioKg;

      totalKilosSalida += kilosSalida;
      totalKilosReales += kilosReales;
      totalDescuento += descuento;
      totalEfectivos += efectivos;
      deudaTotal += deuda;

      detallesHTML += `
        <tr>
          <td>${d.producto_nombre}</td>
          <td class="text-right">${kilosSalida.toFixed(2)} kg</td>
          ${esConfirmada ? `
            <td class="text-right">${kilosReales.toFixed(2)} kg</td>
            <td class="text-right text-red-600">${descuento.toFixed(2)} kg</td>
            <td class="text-right"><strong>${efectivos.toFixed(2)} kg</strong></td>
            ${precioKg > 0 ? `<td class="text-right">$${precioKg.toFixed(2)}</td>` : '<td>-</td>'}
            ${precioKg > 0 ? `<td class="text-right"><strong>$${deuda.toFixed(2)}</strong></td>` : '<td>-</td>'}
          ` : ''}
        </tr>
        ${esConfirmada && d.motivo_ajuste ? `
          <tr>
            <td colspan="${precioKg > 0 ? '7' : '5'}" class="text-xs text-slate-600 italic">
              Motivo: ${d.motivo_ajuste}
            </td>
          </tr>
        ` : ''}
      `;
    });
  }

  let envasesHTML = '';
  if (salida.cantidad_envases_llenos > 0) {
    envasesHTML = `
      <div class="section">
        <h3>Envases Llenos con Fruta</h3>
        <div style="padding: 15px; background: #fef3c7; border-radius: 8px; border-left: 4px solid #f59e0b;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: #78350f; font-weight: 600;">Cantidad de Envases Llenos:</span>
            <span style="font-size: 18px; font-weight: bold; color: #92400e;">${salida.cantidad_envases_llenos} unidades</span>
          </div>
          <p style="font-size: 10px; color: #78350f; margin-top: 6px;">
            Envases que salieron ocupados con fruta → Stock Ocupados
          </p>
        </div>
      </div>
    `;
  }

  const styles = getCompleteStyles(themes.purple);
  const logoHTML = getLogoHTML(70);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Remito ${salida.numero_remito}</title>
      <style>
        ${styles}
        .estado-badge { 
          ${esConfirmada ? 'background: #22c55e;' : 'background: #f59e0b;'} 
          color: white; 
          padding: 6px 16px; 
          border-radius: 20px; 
          display: inline-block; 
          margin-top: 8px; 
          font-weight: 600; 
        }
        .text-red-600 { color: #dc2626; }
        .alert-box {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 12px;
          margin: 15px 0;
          border-radius: 4px;
        }
        .alert-box h4 {
          color: #92400e;
          font-size: 11px;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .alert-box p {
          color: #78350f;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoHTML}
        <div class="title">ACOPIO DE FRUTAS</div>
        <div class="subtitle">Remito de Salida</div>
        <div class="estado-badge">${salida.estado}</div>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <label>Comprobante Asociado (Remito R)</label>
          <p>${salida.numero_remito}</p>
        </div>
        <div class="info-item">
          <label>Fecha</label>
          <p>${fecha}</p>
        </div>
        <div class="info-item">
          <label>Cliente</label>
          <p>${salida.cliente_nombre}</p>
        </div>
        ${salida.fletero_nombre ? `
          <div class="info-item">
            <label>Fletero</label>
            <p>${salida.fletero_nombre}</p>
          </div>
        ` : ''}
        ${esConfirmada && salida.comprobante_cliente ? `
          <div class="info-item">
            <label>Comprobante de Cliente</label>
            <p>${salida.comprobante_cliente}</p>
          </div>
        ` : ''}
      </div>

      ${!esConfirmada ? `
        <div class="alert-box">
          <h4>⚠️ Salida Pendiente de Confirmación</h4>
          <p>Los kilos mostrados son provisionales. Se actualizarán al confirmar recepción con el cliente.</p>
        </div>
      ` : ''}

      <div class="section">
        <h3>${esConfirmada ? 'Detalle de Productos - Ajustado' : 'Detalle de Productos'}</h3>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th class="text-right">Kilos Salida Original</th>
              ${esConfirmada ? `
                <th class="text-right">Kilos Reales</th>
                <th class="text-right">Descuento</th>
                <th class="text-right">Kilos Efectivos</th>
                <th class="text-right">Precio/Kg</th>
                <th class="text-right">Deuda</th>
              ` : ''}
            </tr>
          </thead>
          <tbody>
            ${detallesHTML}
            <tr class="total-row">
              <td><strong>TOTALES</strong></td>
              <td class="text-right"><strong>${totalKilosSalida.toFixed(2)} kg</strong></td>
              ${esConfirmada ? `
                <td class="text-right"><strong>${totalKilosReales.toFixed(2)} kg</strong></td>
                <td class="text-right text-red-600"><strong>${totalDescuento.toFixed(2)} kg</strong></td>
                <td class="text-right"><strong>${totalEfectivos.toFixed(2)} kg</strong></td>
                <td></td>
                <td class="text-right"><strong>${deudaTotal > 0 ? '$' + deudaTotal.toFixed(2) : '-'}</strong></td>
              ` : ''}
            </tr>
          </tbody>
        </table>
      </div>

      ${envasesHTML}

      ${esConfirmada && deudaTotal > 0 ? `
        <div class="section" style="background: #fef3c7; padding: 15px; border-radius: 8px; border: 2px solid #fbbf24;">
          <h3 style="border: none; color: #92400e; margin-bottom: 8px;">💰 Resumen de Deuda</h3>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; color: #78350f;">Deuda Total del Cliente:</span>
            <span style="font-size: 20px; font-weight: bold; color: #92400e;">$${deudaTotal.toFixed(2)}</span>
          </div>
          <p style="font-size: 9px; color: #78350f; margin-top: 6px;">
            Calculado sobre ${totalEfectivos.toFixed(2)} kg efectivos (descontando clasificación/pérdidas)
          </p>
        </div>
      ` : ''}

      ${salida.notas ? `
        <div class="section">
          <h3>Notas Adicionales</h3>
          <p style="color: #666; font-size: 10px;">${salida.notas}</p>
        </div>
      ` : ''}

      <div class="footer">
        <p>Comprobante generado el ${fechaGeneracion}</p>
        <p>Sistema de Gestión de Acopio</p>
      </div>
    </body>
    </html>
  `;

  return html;
}

export function downloadSalidaPDF(html, numero_remito) {
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

export async function shareSalidaWhatsApp(salida, whatsappNumber) {
  if (!whatsappNumber || !whatsappNumber.trim()) {
    alert('No hay número de WhatsApp registrado para este cliente');
    return;
  }

  // Generar PDF
  const html = generateSalidaPDF(salida);
  const pdfBlob = await htmlToPDFBlob(html, `remito_${salida.numero_remito}.pdf`);
  
  if (!pdfBlob) {
    alert('Error al generar el PDF');
    return;
  }

  const fecha = format(new Date(salida.fecha), "dd/MM/yyyy HH:mm", { locale: es });
  const esConfirmada = salida.estado === 'Confirmada';
  
  let mensaje = `🧾 *REMITO DE SALIDA ${esConfirmada ? '- CONFIRMADO' : '- PENDIENTE'}*\n\n`;
  mensaje += `📋 Remito: ${salida.numero_remito}\n`;
  if (esConfirmada && salida.comprobante_cliente) {
    mensaje += `📄 Comprobante Cliente: ${salida.comprobante_cliente}\n`;
  }
  mensaje += `📅 Fecha: ${fecha}\n`;
  mensaje += `👤 Cliente: ${salida.cliente_nombre}\n`;
  if (salida.fletero_nombre) {
    mensaje += `🚚 Fletero: ${salida.fletero_nombre}\n`;
  }
  
  mensaje += `\n📦 *PRODUCTOS*\n`;
  let totalEfectivos = 0;
  let deudaTotal = 0;
  
  salida.detalles?.forEach(d => {
    const kilosReales = d.kilos_reales || d.kilos_salida;
    const descuento = d.descuento_kg || 0;
    const efectivos = kilosReales - descuento;
    const precioKg = d.precio_kg || 0;
    const deuda = efectivos * precioKg;
    
    totalEfectivos += efectivos;
    deudaTotal += deuda;
    
    mensaje += `• ${d.producto_nombre}\n`;
    if (esConfirmada) {
      mensaje += `  Original: ${d.kilos_salida.toFixed(2)} kg\n`;
      mensaje += `  Real: ${kilosReales.toFixed(2)} kg\n`;
      if (descuento > 0) {
        mensaje += `  Descuento: -${descuento.toFixed(2)} kg\n`;
      }
      mensaje += `  Efectivos: ${efectivos.toFixed(2)} kg\n`;
      if (precioKg > 0) {
        mensaje += `  Deuda: $${deuda.toFixed(2)}\n`;
      }
    } else {
      mensaje += `  ${d.kilos_salida.toFixed(2)} kg\n`;
    }
  });
  
  if (esConfirmada) {
    mensaje += `\n⚖️ *Total Kilos Efectivos:* ${totalEfectivos.toFixed(2)} kg`;
    if (deudaTotal > 0) {
      mensaje += `\n💰 *DEUDA TOTAL: $${deudaTotal.toFixed(2)}*`;
    }
  } else {
    const totalProvisional = salida.detalles?.reduce((sum, d) => sum + (d.kilos_salida || 0), 0) || 0;
    mensaje += `\n⚖️ Total Provisorio: ${totalProvisional.toFixed(2)} kg`;
  }
  
  if (salida.cantidad_envases_llenos > 0) {
    mensaje += `\n\n📦 *ENVASES LLENOS*\n`;
    mensaje += `🟠 Envases con fruta: ${salida.cantidad_envases_llenos} unidades\n`;
  }
  
  // Intentar usar Web Share API para adjuntar PDF
  if (navigator.share && navigator.canShare) {
    const file = new File([pdfBlob], `remito_${salida.numero_remito}.pdf`, { type: 'application/pdf' });
    const shareData = {
      title: `Remito de Salida - ${salida.numero_remito}`,
      text: mensaje,
      files: [file]
    };

    try {
      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch (error) {
      console.log('Web Share API no disponible o cancelado');
    }
  }

  // Fallback: descargar PDF y abrir WhatsApp
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `remito_${salida.numero_remito}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // Abrir WhatsApp con mensaje
  setTimeout(() => {
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const mensajeConInstruccion = mensaje + '\n\n📎 *PDF descargado - por favor adjúntalo manualmente*';
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(mensajeConInstruccion)}`;
    window.open(whatsappUrl, '_blank');
  }, 500);
}