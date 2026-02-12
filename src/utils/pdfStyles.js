/**
 * Estilos comunes y configuración para los generadores de PDF
 */

// URL del logo de la empresa
export const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/694c069ad9a3c71a10fee653/2db155312_imagenesdeperfilISO_Mesadetrabajo1.jpg";

// HTML del logo
export const getLogoHTML = (size = 80) => `
  <div class="logo">
    <img src="${LOGO_URL}" 
         alt="Logo" 
         style="width: ${size}px; height: ${size}px; object-fit: contain; margin: 0 auto;">
  </div>
`;

// Estilos base comunes
export const getBaseStyles = () => `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { 
    font-family: 'Segoe UI', Arial, sans-serif; 
    font-size: 12px; 
    color: #333;
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
  }
`;

// Estilos de header común
export const getHeaderStyles = (primaryColor = '#22c55e', titleColor = '#166534') => `
  .header { 
    text-align: center; 
    padding: 20px 0; 
    border-bottom: 3px solid ${primaryColor};
    margin-bottom: 20px;
  }
  .logo { 
    margin-bottom: 10px;
    display: flex;
    justify-content: center;
  }
  .title { 
    font-size: 24px; 
    font-weight: bold; 
    color: ${titleColor};
    margin-bottom: 5px;
  }
  .subtitle { 
    font-size: 16px; 
    color: #666;
  }
`;

// Estilos de info-grid común
export const getInfoGridStyles = (bgColor = '#f0fdf4', textColor = '#166534') => `
  .info-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
    margin-bottom: 20px;
    padding: 15px;
    background: ${bgColor};
    border-radius: 8px;
  }
  .info-item label {
    font-size: 11px;
    color: #666;
    text-transform: uppercase;
  }
  .info-item p {
    font-size: 14px;
    font-weight: 600;
    color: ${textColor};
  }
`;

// Estilos de sección común
export const getSectionStyles = (borderColor = '#bbf7d0', titleColor = '#166534') => `
  .section { margin-bottom: 20px; }
  .section h3 { 
    font-size: 14px; 
    color: ${titleColor}; 
    border-bottom: 2px solid ${borderColor};
    padding-bottom: 5px;
    margin-bottom: 10px;
  }
`;

// Estilos de tabla común
export const getTableStyles = (headerBg = '#f0fdf4', headerColor = '#166534') => `
  table { 
    width: 100%; 
    border-collapse: collapse;
    font-size: 11px;
  }
  th, td { 
    padding: 8px 10px; 
    text-align: left; 
    border-bottom: 1px solid #e5e7eb;
  }
  th { 
    background: ${headerBg}; 
    font-weight: 600;
    color: ${headerColor};
  }
  .text-right { text-align: right; }
  .total-row { 
    background: #dcfce7; 
    font-weight: bold;
  }
`;

// Estilos de colores comunes
export const getColorStyles = () => `
  .ingreso { color: #16a34a; font-weight: 600; }
  .salida { color: #dc2626; font-weight: 600; }
  .ocupado { color: #f59e0b; font-weight: 600; }
  .vacio { color: #3b82f6; font-weight: 600; }
  .adeuda { color: #dc2626; font-weight: bold; }
  .ok { color: #16a34a; }
`;

// Estilos de footer común
export const getFooterStyles = () => `
  .footer {
    margin-top: 30px;
    padding-top: 15px;
    border-top: 1px solid #e5e7eb;
    text-align: center;
    font-size: 10px;
    color: #666;
  }
`;

// Estilos de impresión común
export const getPrintStyles = () => `
  @media print {
    body { padding: 10px; }
    .section { page-break-inside: avoid; }
  }
`;

// Función para obtener estilos completos con tema personalizado
export const getCompleteStyles = (theme = {}) => {
  const {
    primaryColor = '#22c55e',
    titleColor = '#166534',
    bgColor = '#f0fdf4',
    borderColor = '#bbf7d0',
    headerBg = '#f0fdf4',
    headerColor = '#166534'
  } = theme;

  return `
    ${getBaseStyles()}
    ${getHeaderStyles(primaryColor, titleColor)}
    ${getInfoGridStyles(bgColor, titleColor)}
    ${getSectionStyles(borderColor, titleColor)}
    ${getTableStyles(headerBg, headerColor)}
    ${getColorStyles()}
    ${getFooterStyles()}
    ${getPrintStyles()}
  `;
};

// Temas predefinidos
export const themes = {
  default: {
    primaryColor: '#22c55e',
    titleColor: '#166534',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    headerBg: '#f0fdf4',
    headerColor: '#166534'
  },
  purple: {
    primaryColor: '#9333ea',
    titleColor: '#6b21a8',
    bgColor: '#faf5ff',
    borderColor: '#e9d5ff',
    headerBg: '#faf5ff',
    headerColor: '#6b21a8'
  },
  blue: {
    primaryColor: '#6366f1',
    titleColor: '#4338ca',
    bgColor: '#f0f9ff',
    borderColor: '#bfdbfe',
    headerBg: '#dbeafe',
    headerColor: '#1e40af'
  }
};

// Estilos comunes como string (tema por defecto) para uso directo en <style>
export const commonPdfStyles = getCompleteStyles(themes.default);
