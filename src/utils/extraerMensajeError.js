// Función helper para extraer mensajes de error descriptivos
export function extraerMensajeError(error, tipoOperacion = 'operación') {
  if (!error) return `Error al realizar ${tipoOperacion}`;
  
  const mensaje = error.message || error.toString() || '';
  
  // Errores comunes de base44
  if (mensaje.includes('duplicate') || mensaje.includes('unique') || mensaje.includes('ya existe')) {
    if (mensaje.includes('cuit') || mensaje.includes('CUIT')) {
      return 'El CUIT ya existe en el sistema';
    }
    if (mensaje.includes('nombre') || mensaje.includes('name')) {
      return 'Ya existe un registro con ese nombre';
    }
    if (mensaje.includes('email')) {
      return 'El email ya está registrado';
    }
    return 'Ya existe un registro con estos datos';
  }
  
  if (mensaje.includes('required') || mensaje.includes('obligatorio') || mensaje.includes('faltan')) {
    return 'Faltan campos obligatorios. Verifique que todos los campos requeridos estén completos';
  }
  
  if (mensaje.includes('foreign key') || mensaje.includes('constraint') || mensaje.includes('asociado')) {
    return 'No se puede eliminar: este registro tiene movimientos o datos asociados';
  }
  
  if (mensaje.includes('stock') || mensaje.includes('insuficiente')) {
    return 'Stock insuficiente para realizar esta operación';
  }
  
  if (mensaje.includes('validation') || mensaje.includes('validación')) {
    return 'Los datos ingresados no son válidos. Verifique el formato';
  }
  
  // Si el mensaje es descriptivo, usarlo directamente
  if (mensaje.length > 0 && mensaje.length < 200) {
    return mensaje;
  }
  
  return `Error al realizar ${tipoOperacion}. Intente nuevamente`;
}
