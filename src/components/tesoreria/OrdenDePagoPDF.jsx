import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const generarOrdenDePagoPDF = (pago, proveedor) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  let y = 20;

  // Título
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEN DE PAGO', pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Información de la empresa (ajustar según corresponda)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Sistema de Acopio', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text('Gestión de Frutas', pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Número y fecha
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Orden N°: ${pago.id.substring(0, 8).toUpperCase()}`, 20, y);
  doc.text(`Fecha: ${format(new Date(pago.fecha), 'dd/MM/yyyy', { locale: es })}`, pageWidth - 70, y);
  y += 15;

  // Datos del proveedor
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y - 5, pageWidth - 30, 35, 'F');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL PROVEEDOR', 20, y);
  y += 8;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Nombre: ${proveedor.nombre || pago.proveedor_nombre}`, 20, y);
  y += 6;
  if (proveedor.cuit) {
    doc.text(`CUIT: ${proveedor.cuit}`, 20, y);
    y += 6;
  }
  if (proveedor.direccion) {
    doc.text(`Dirección: ${proveedor.direccion}`, 20, y);
    y += 6;
  }
  if (proveedor.whatsapp) {
    doc.text(`WhatsApp: ${proveedor.whatsapp}`, 20, y);
    y += 6;
  }
  y += 10;

  // Detalles del pago
  doc.setFillColor(240, 240, 240);
  doc.rect(15, y - 5, pageWidth - 30, 10, 'F');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALLES DEL PAGO', 20, y);
  y += 12;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Concepto: ${pago.concepto}`, 20, y);
  y += 7;
  
  if (pago.comprobante) {
    doc.text(`Comprobante: ${pago.comprobante}`, 20, y);
    y += 7;
  }

  doc.setFont('helvetica', 'bold');
  doc.text(`Tipo de Pago: ${pago.tipo_pago}`, 20, y);
  y += 10;

  // Medios de pago
  if (pago.medios_pago_detalles && pago.medios_pago_detalles.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Medios de Pago:', 20, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    pago.medios_pago_detalles.forEach(medio => {
      doc.text(
        `• ${medio.tipo} - ${medio.origen_nombre}: $${(medio.monto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        25,
        y
      );
      y += 6;
    });
    y += 5;
  }

  // Comprobantes aplicados
  if (pago.ingresos_aplicados && pago.ingresos_aplicados.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Comprobantes de Compra Aplicados:', 20, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    pago.ingresos_aplicados.forEach((aplicado, idx) => {
      // Soportar tanto monto_aplicado (creación) como monto (imputación)
      const montoReal = aplicado.monto_aplicado || aplicado.monto || 0;
      doc.text(
        `${idx + 1}. Ingreso de Fruta - $${montoReal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
        25,
        y
      );
      y += 6;
    });
    y += 5;
  }

  // Notas
  if (pago.notas) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Observaciones:', 20, y);
    y += 7;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const notasLines = doc.splitTextToSize(pago.notas, pageWidth - 50);
    doc.text(notasLines, 20, y);
    y += notasLines.length * 6 + 10;
  }

  // Total
  y = Math.max(y, 230);
  doc.setFillColor(50, 50, 50);
  doc.rect(15, y - 5, pageWidth - 30, 15, 'F');
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL A PAGAR:', 20, y + 5);
  doc.text(
    `$ ${(pago.monto_total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`,
    pageWidth - 20,
    y + 5,
    { align: 'right' }
  );
  doc.setTextColor(0, 0, 0);
  y += 25;

  // Firmas
  y = doc.internal.pageSize.height - 40;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const firmaY = y + 15;
  doc.line(30, firmaY, 80, firmaY);
  doc.text('Autorizado por', 55, firmaY + 5, { align: 'center' });
  
  doc.line(pageWidth - 80, firmaY, pageWidth - 30, firmaY);
  doc.text('Recibí conforme', pageWidth - 55, firmaY + 5, { align: 'center' });

  // Pie de página
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Documento generado el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}`,
    pageWidth / 2,
    doc.internal.pageSize.height - 10,
    { align: 'center' }
  );

  // Descargar
  doc.save(`orden-pago-${pago.id.substring(0, 8)}-${proveedor.nombre.replace(/\s+/g, '-')}.pdf`);
};