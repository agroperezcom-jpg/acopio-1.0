import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Apple, Package, ShoppingCart, FileDown, MessageCircle, Edit, Trash2 } from "lucide-react";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * Tarjeta de un movimiento/salida. Optimizada con React.memo y useMemo
 * para evitar cálculos pesados en cada render.
 */
function TarjetaMovimiento({
  mov,
  isExpanded,
  onToggleExpand,
  onDownloadPDF,
  onShareWhatsApp,
  onEditarMovimiento,
  onDelete
}) {
  // Valores pesados memoizados - solo se recalculan cuando cambia mov
  const { kgNetos, kgEfectivos, totalEnvasesLlenos, countEnvaseVacio, envasesVaciosFiltrados } = useMemo(() => {
    let kgNetos = 0;
    let kgEfectivos = 0;
    let totalEnvasesLlenos = 0;
    let countEnvaseVacio = 0;
    let envasesVaciosFiltrados = [];

    if (mov.origen === 'movimiento' && mov.pesajes?.length > 0) {
      kgNetos = mov.pesajes.reduce((s, p) => s + (p.peso_neto || 0), 0);
    }
    if (mov.origen === 'salida' && mov.detalles?.length > 0) {
      kgEfectivos = mov.detalles.reduce((s, d) => s + ((d.kilos_reales || d.kilos_salida) - (d.descuento_kg || 0)), 0);
    }
    if (mov.envases_llenos?.length > 0) {
      totalEnvasesLlenos = mov.envases_llenos.reduce((sum, e) => sum + (e.cantidad || 0), 0);
    }
    if (mov.movimiento_envases?.length > 0) {
      envasesVaciosFiltrados = mov.movimiento_envases.filter(e => e.cantidad_ingreso > 0 || e.cantidad_salida > 0);
      countEnvaseVacio = envasesVaciosFiltrados.length;
    }

    return {
      kgNetos,
      kgEfectivos,
      totalEnvasesLlenos,
      countEnvaseVacio,
      envasesVaciosFiltrados
    };
  }, [mov]);

  return (
    <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="p-4 pb-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              mov.tipo === 'Ingreso de Fruta' 
                ? 'bg-green-100' 
                : mov.tipo === 'Salida de Fruta'
                ? 'bg-purple-100'
                : 'bg-amber-100'
            }`}>
              {mov.tipo === 'Ingreso de Fruta' 
                ? <Apple className="h-5 w-5 text-green-600" />
                : mov.tipo === 'Salida de Fruta'
                ? <ShoppingCart className="h-5 w-5 text-purple-600" />
                : <Package className="h-5 w-5 text-amber-600" />
              }
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                <h3 className="font-semibold text-sm md:text-base text-slate-800 truncate">
                  {mov.entidad_nombre}
                </h3>
                <Badge variant="outline" className="text-xs shrink-0">
                  {mov.entidad_tipo}
                </Badge>
                <Badge variant="outline" className={`text-xs shrink-0 ${
                  mov.tipo === 'Ingreso de Fruta'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : mov.tipo === 'Salida de Fruta'
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  <span className="hidden sm:inline">{mov.tipo}</span>
                  <span className="sm:hidden">{mov.tipo === 'Ingreso de Fruta' ? 'Ing.' : mov.tipo === 'Salida de Fruta' ? 'Sal.' : 'Env.'}</span>
                </Badge>
                {mov.origen === 'salida' && (
                  <Badge className={mov.estado === 'Confirmada' ? 'bg-green-600' : 'bg-amber-500'}>
                    {mov.estado}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {format(new Date(mov.fecha), "dd 'de' MMMM yyyy, HH:mm", { locale: es })}
                {mov.fletero_nombre && ` • Fletero: ${mov.fletero_nombre}`}
                {mov.numero_remito && ` • Remito: ${mov.numero_remito}`}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onToggleExpand(mov.id)}
            className="shrink-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-5 w-5" />
            ) : (
              <ChevronDown className="h-5 w-5" />
            )}
          </Button>
        </div>
      </CardHeader>

      {/* Resumen compacto */}
      <CardContent className="p-4 pt-2">
        <div className="flex flex-wrap gap-2 text-sm">
          {mov.origen === 'movimiento' && mov.pesajes?.length > 0 && (
            <span className="text-slate-600">
              {mov.pesajes.length} pesaje(s) • 
              <span className="font-medium text-green-700 ml-1">
                {kgNetos.toFixed(2)} kg netos
              </span>
            </span>
          )}
          {mov.origen === 'salida' && mov.detalles?.length > 0 && (
            <span className="text-slate-600">
              {mov.detalles.length} producto(s) • 
              <span className="font-medium text-purple-700 ml-1">
                {kgEfectivos.toFixed(2)} kg efectivos
              </span>
            </span>
          )}
          {mov.envases_llenos?.length > 0 && (
            <span className="text-slate-600">
              {totalEnvasesLlenos} envases llenos
            </span>
          )}
          {countEnvaseVacio > 0 && (
            <span className="text-slate-600">
              {countEnvaseVacio} tipo(s) envase vacío
            </span>
          )}
        </div>
      </CardContent>

      {/* Detalle expandido */}
      {isExpanded && (
        <CardContent className="pt-0 pb-4 px-4 border-t border-slate-100">
          <div className="space-y-4 mt-4">
            {/* Información adicional de salida */}
            {mov.origen === 'salida' && (
              <div className="p-3 bg-slate-50 rounded-lg space-y-2">
                {mov.comprobante_cliente && (
                  <p className="text-sm"><span className="font-medium">Comprobante Cliente:</span> {mov.comprobante_cliente}</p>
                )}
                {mov.deuda_total > 0 && (
                  <p className="text-sm"><span className="font-medium">Deuda Total:</span> <span className="text-green-700 font-bold">${mov.deuda_total.toFixed(2)}</span></p>
                )}
              </div>
            )}

            {/* Detalles de salida */}
            {mov.origen === 'salida' && mov.detalles?.length > 0 && (
             <div>
               <h4 className="font-medium text-slate-700 mb-2 text-sm md:text-base">Productos</h4>
               <div className="overflow-x-auto -mx-4 md:mx-0">
                 <div className="inline-block min-w-full align-middle px-4 md:px-0">
                   <table className="w-full text-xs md:text-sm">
                     <thead className="bg-slate-50">
                       <tr>
                         <th className="text-left p-2 whitespace-nowrap">Producto</th>
                         <th className="text-right p-2 whitespace-nowrap">Orig.</th>
                         {mov.estado === 'Confirmada' && (
                           <>
                             <th className="text-right p-2 whitespace-nowrap">Reales</th>
                             <th className="text-right p-2 whitespace-nowrap">Desc.</th>
                           </>
                         )}
                         <th className="text-right p-2 whitespace-nowrap">Efect.</th>
                       </tr>
                     </thead>
                     <tbody>
                       {mov.detalles.map((d, i) => {
                         const kilosReales = d.kilos_reales || d.kilos_salida;
                         const descuento = d.descuento_kg || 0;
                         const efectivos = kilosReales - descuento;
                         return (
                           <tr key={i} className="border-b border-slate-100">
                             <td className="p-2">{d.producto_nombre}</td>
                             <td className="p-2 text-right">{d.kilos_salida.toFixed(2)}</td>
                             {mov.estado === 'Confirmada' && (
                               <>
                                 <td className="p-2 text-right">{kilosReales.toFixed(2)}</td>
                                 <td className="p-2 text-right text-red-600">{descuento > 0 ? `-${descuento.toFixed(2)}` : '-'}</td>
                               </>
                             )}
                             <td className="p-2 text-right font-medium text-purple-700">{efectivos.toFixed(2)}</td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
            )}

            {/* Pesajes */}
            {mov.origen === 'movimiento' && mov.pesajes?.length > 0 && (
             <div>
               <h4 className="font-medium text-slate-700 mb-2 text-sm md:text-base">Pesajes</h4>
               <div className="overflow-x-auto -mx-4 md:mx-0">
                 <div className="inline-block min-w-full align-middle px-4 md:px-0">
                   <table className="w-full text-xs md:text-sm">
                     <thead className="bg-slate-50">
                       <tr>
                         <th className="text-left p-2 whitespace-nowrap">Producto</th>
                         <th className="text-left p-2 whitespace-nowrap">Envase</th>
                         <th className="text-right p-2 whitespace-nowrap">Cant.</th>
                         <th className="text-right p-2 whitespace-nowrap">Bruto</th>
                         <th className="text-right p-2 whitespace-nowrap">Tara</th>
                         <th className="text-right p-2 whitespace-nowrap">Neto</th>
                       </tr>
                     </thead>
                     <tbody>
                       {mov.pesajes.map((p, i) => (
                         <tr key={i} className="border-b border-slate-100">
                           <td className="p-2">{p.producto_nombre || '-'}</td>
                           <td className="p-2">{p.envase_tipo || '-'}</td>
                           <td className="p-2 text-right">{p.cantidad || 1}</td>
                           <td className="p-2 text-right">{(p.peso_bruto || 0).toFixed(2)}</td>
                           <td className="p-2 text-right">
                             {p.modo === 'libre' 
                               ? (p.tara_manual || 0).toFixed(2)
                               : ((p.tara_unitaria || 0) * (p.cantidad || 1)).toFixed(2)
                             }
                           </td>
                           <td className="p-2 text-right font-medium text-green-700">
                             {(p.peso_neto || 0).toFixed(2)}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
            )}

            {/* Envases Llenos (solo en Ingreso de Fruta) */}
            {mov.origen === 'movimiento' && mov.tipo === 'Ingreso de Fruta' && mov.envases_llenos?.length > 0 && (
              <div>
                <h4 className="font-medium text-slate-700 mb-2 text-sm md:text-base">Envases Llenos con Fruta</h4>
                <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                  <div className="space-y-1">
                    {mov.envases_llenos.map((e, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">{e.envase_tipo}</span>
                        <span className="text-sm font-bold text-green-700">{e.cantidad} unidades</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">Envases que ingresaron ocupados con fruta del proveedor</p>
                </div>
              </div>
            )}

            {/* Envases Llenos (solo en Salida de Fruta) */}
            {mov.origen === 'salida' && mov.envases_llenos?.length > 0 && (
              <div>
                <h4 className="font-medium text-slate-700 mb-2">Envases Llenos con Fruta</h4>
                <div className="p-3 bg-amber-50 rounded-lg border-l-4 border-amber-500">
                  <div className="space-y-1">
                    {mov.envases_llenos.map((e, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">{e.envase_tipo}</span>
                        <span className="text-sm font-bold text-amber-700">{e.cantidad} unidades</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 mt-2">Envases que salieron ocupados con fruta</p>
                </div>
              </div>
            )}

            {/* Envases Vacíos */}
            {envasesVaciosFiltrados.length > 0 && (
             <div>
               <h4 className="font-medium text-slate-700 mb-2 text-sm md:text-base">Movimiento de Envases Vacíos</h4>
               <div className="overflow-x-auto -mx-4 md:mx-0">
                 <div className="inline-block min-w-full align-middle px-4 md:px-0">
                   <table className="w-full text-xs md:text-sm">
                     <thead className="bg-slate-50">
                       <tr>
                         <th className="text-left p-2 whitespace-nowrap">Tipo</th>
                         <th className="text-center p-2 whitespace-nowrap">Ingreso</th>
                         <th className="text-center p-2 whitespace-nowrap">Salida</th>
                       </tr>
                     </thead>
                     <tbody>
                       {envasesVaciosFiltrados.map((e, i) => (
                         <tr key={i} className="border-b border-slate-100">
                           <td className="p-2">{e.envase_tipo}</td>
                           <td className="p-2 text-center text-green-600 font-medium">
                             {e.cantidad_ingreso > 0 ? `+${e.cantidad_ingreso}` : '-'}
                           </td>
                           <td className="p-2 text-center text-red-600 font-medium">
                             {e.cantidad_salida > 0 ? `-${e.cantidad_salida}` : '-'}
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               </div>
             </div>
            )}

            {/* Acciones */}
            <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 pt-4 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownloadPDF(mov)}
                className="text-xs md:text-sm w-full md:w-auto"
              >
                <FileDown className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Descargar PDF</span>
                <span className="sm:hidden">PDF</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onShareWhatsApp(mov)}
                className="text-green-600 hover:text-green-700 text-xs md:text-sm w-full md:w-auto"
              >
                <MessageCircle className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">WhatsApp</span>
                <span className="sm:hidden">Enviar</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditarMovimiento(mov)}
                className="text-blue-600 hover:text-blue-700 text-xs md:text-sm w-full md:w-auto"
              >
                <Edit className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDelete(mov)}
                className="text-red-600 hover:text-red-700 text-xs md:text-sm w-full md:w-auto"
              >
                <Trash2 className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                Eliminar
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default React.memo(TarjetaMovimiento);
