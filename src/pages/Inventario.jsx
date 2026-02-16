import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Package, Search, AlertTriangle, Edit, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AjusteManualEnvaseModal from '@/components/inventario/AjusteManualEnvaseModal';
import HistorialAjustesModal from '@/components/inventario/HistorialAjustesModal';
import DetalleProductoInventario from '@/components/inventario/DetalleProductoInventario';
import { toFixed2, sumaExacta } from '@/components/utils/precisionDecimal';
import { base44 } from '@/api/base44Client';

export default function Inventario() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedProducto, setSelectedProducto] = useState(null);
  const [ajusteModal, setAjusteModal] = useState({ open: false, envase: null, tipoAjuste: null, stockActual: 0 });
  const [historialModal, setHistorialModal] = useState(false);
  const umbralBajo = 100; // kg

  const { data: productos = [] } = useQuery({
    queryKey: ['productos'],
    queryFn: () => base44.entities.Producto.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: envases = [] } = useQuery({
    queryKey: ['envases'],
    queryFn: () => base44.entities.Envase.list(),
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const productosConStock = useMemo(() => {
    return productos
      .map(p => ({
        ...p,
        producto_completo: `${p.fruta} - ${p.variedad}`,
        stock: p.stock || 0,
        stockBajo: (p.stock || 0) < umbralBajo
      }))
      .sort((a, b) => b.stock - a.stock);
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    if (!search) return productosConStock;
    const searchLower = search.toLowerCase();
    return productosConStock.filter(p => 
      p.producto_completo.toLowerCase().includes(searchLower)
    );
  }, [productosConStock, search]);

  const totalStock = toFixed2(sumaExacta(...productosConStock.map(p => p.stock)));
  const productosStockBajo = productosConStock.filter(p => p.stockBajo).length;

  // Stock de envases: lectura desde entidad (stocks vivos actualizados por StockService)
  const envasesConStock = useMemo(() => {
    return envases
      .map(e => ({
        ...e,
        id: e.id,
        tipo: e.tipo,
        stock_vacios: Math.max(0, Number(e.stock_vacios) || 0),
        stock_ocupados: Math.max(0, Number(e.stock_ocupados) || 0),
        total: Math.max(0, (Number(e.stock_vacios) || 0) + (Number(e.stock_ocupados) || 0))
      }))
      .sort((a, b) => b.total - a.total);
  }, [envases]);

  const totalEnvasesVacios = envasesConStock.reduce((sum, e) => sum + e.stock_vacios, 0);
  const totalEnvasesOcupados = envasesConStock.reduce((sum, e) => sum + e.stock_ocupados, 0);

  const handleAjusteSuccess = () => {
    queryClient.invalidateQueries(['envases']);
    queryClient.invalidateQueries(['ajustes-manuales']);
    toast.success('Ajuste manual registrado correctamente');
  };

  const abrirAjuste = (envase, tipoAjuste) => {
    const stockActual = tipoAjuste === 'vacios' ? envase.stock_vacios : envase.stock_ocupados;
    setAjusteModal({ open: true, envase, tipoAjuste, stockActual });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Package className="h-8 w-8 text-indigo-600" />
            Inventario
          </h1>
          <p className="text-slate-600 mt-1">Control de stock y movimientos de productos / envases</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-100 rounded-lg">
                  <Package className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Stock Total</p>
                  <p className="text-2xl font-bold text-slate-800">{totalStock.toFixed(0)} kg</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Productos en Stock</p>
                  <p className="text-2xl font-bold text-slate-800">{productosConStock.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Stock Bajo</p>
                  <p className="text-2xl font-bold text-slate-800">{productosStockBajo}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <CardTitle>Productos</CardTitle>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Buscar producto..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Selecciona un producto para ver el historial de movimientos por período (ej. solo enero 2025).
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {productosFiltrados.map((producto) => (
                <button
                  key={producto.id}
                  onClick={() => setSelectedProducto(selectedProducto?.id === producto.id ? null : producto)}
                  className="w-full text-left"
                >
                  <div className={`p-4 rounded-lg border transition-all ${
                    producto.stockBajo 
                      ? 'border-red-200 bg-red-50 hover:bg-red-100' 
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-800">{producto.producto_completo}</h3>
                        <p className="text-sm text-slate-600 mt-1">
                          Stock Disponible (Kilos Netos): <strong className={
                            producto.stock < 0 ? 'text-red-700' : producto.stockBajo ? 'text-red-600' : 'text-green-600'
                          }>
                            {producto.stock.toFixed(2)} kg
                          </strong>
                          {producto.stock < 0 && (
                            <span className="ml-2 text-xs text-red-700 font-semibold">⚠️ Inventario negativo - Revisar ajustes</span>
                          )}
                        </p>
                      </div>
                      {producto.stockBajo && (
                        <div className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="h-5 w-5" />
                          <span className="text-sm font-medium">Stock Bajo</span>
                        </div>
                      )}
                    </div>

                    {selectedProducto?.id === producto.id && (
                      <DetalleProductoInventario producto={producto} />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Control de Envases</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHistorialModal(true)}
                className="flex items-center gap-2"
              >
                <History className="h-4 w-4" />
                Ver Historial de Ajustes
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-teal-100 rounded-lg">
                    <Package className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <p className="text-sm text-teal-700">Total Envases Vacíos</p>
                    <p className="text-2xl font-bold text-teal-600">{totalEnvasesVacios}</p>
                    <p className="text-xs text-teal-600">Disponibles para entregar</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Package className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-orange-700">Total Envases Ocupados</p>
                    <p className="text-2xl font-bold text-orange-600">{totalEnvasesOcupados}</p>
                    <p className="text-xs text-orange-600">Con fruta almacenada</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left p-3 font-semibold">Tipo de Envase</th>
                    <th className="text-right p-3 font-semibold">Vacíos</th>
                    <th className="text-right p-3 font-semibold">Ocupados</th>
                    <th className="text-right p-3 font-semibold">Total</th>
                    <th className="text-center p-3 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {envasesConStock.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-slate-500">
                        No hay envases registrados
                      </td>
                    </tr>
                  ) : (
                    envasesConStock.map((envase, idx) => (
                    <tr key={`${envase.tipo}-${idx}`} className="border-b hover:bg-slate-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-400" />
                          <span className="font-medium">{envase.tipo}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <span className="px-2 py-1 bg-teal-100 text-teal-700 rounded font-semibold">
                          {envase.stock_vacios}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded font-semibold">
                          {envase.stock_ocupados}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="font-bold text-slate-800">
                          {envase.total}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirAjuste(envase, 'vacios')}
                            className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                            title="Ajustar Vacíos"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Vacíos
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirAjuste(envase, 'ocupados')}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            title="Ajustar Ocupados"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Ocupados
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AjusteManualEnvaseModal
        open={ajusteModal.open}
        onClose={() => setAjusteModal({ open: false, envase: null, tipoAjuste: null, stockActual: 0 })}
        envase={ajusteModal.envase}
        tipoAjuste={ajusteModal.tipoAjuste}
        stockActual={ajusteModal.stockActual}
        onSuccess={handleAjusteSuccess}
      />

      <HistorialAjustesModal
        open={historialModal}
        onClose={() => setHistorialModal(false)}
        onDelete={() => {
          queryClient.invalidateQueries(['envases']);
          toast.success('El ajuste ha sido eliminado y el stock recalculado');
        }}
      />
    </div>
  );
}