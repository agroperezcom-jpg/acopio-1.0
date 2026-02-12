import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { listAllPrecios } from '@/utils/listAllPrecios';

// Hook centralizado para caché de precios
export function usePreciosCache() {
  const { data: periodosPrecios = [] } = useQuery({
    queryKey: ['periodosprecios_cache'],
    queryFn: () => listAllPrecios(base44.entities.PeriodoPrecio, '-fecha_desde'),
    staleTime: 30 * 60 * 1000, // 30 minutos
    refetchOnWindowFocus: false,
    refetchOnReconnect: true
  });

  const obtenerPrecioVigente = (productoId, fecha, tipoPrecio = 'compra') => {
    if (!productoId || !fecha) return 0;

    const preciosOrdenados = periodosPrecios
      .filter(pp => pp.producto_id === productoId && pp.activo)
      .sort((a, b) => new Date(b.fecha_desde) - new Date(a.fecha_desde));
    
    const fechaMovimiento = new Date(fecha);
    const precioVigente = preciosOrdenados.find(pp => new Date(pp.fecha_desde) <= fechaMovimiento);
    
    if (precioVigente) {
      return tipoPrecio === 'compra' ? precioVigente.precio_compra_kg : precioVigente.precio_venta_kg;
    }
    
    const precioMasReciente = preciosOrdenados[0];
    return precioMasReciente ? 
      (tipoPrecio === 'compra' ? precioMasReciente.precio_compra_kg : precioMasReciente.precio_venta_kg) : 0;
  };

  return { periodosPrecios, obtenerPrecioVigente };
}