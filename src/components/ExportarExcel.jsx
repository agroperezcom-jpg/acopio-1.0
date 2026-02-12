import * as XLSX from 'xlsx';

export function exportarExcel(datos, nombreArchivo) {
  if (!datos || datos.length === 0) {
    alert('No hay datos para exportar');
    return;
  }

  // Crear workbook y worksheet
  const ws = XLSX.utils.json_to_sheet(datos);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');

  // Descargar archivo XLSX
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`);
}