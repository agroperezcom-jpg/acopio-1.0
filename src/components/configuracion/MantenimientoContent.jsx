import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, Loader2, RefreshCw, Package, Scale } from "lucide-react";

export default function MantenimientoContent({ ejecutandoCorreccion, onEjecutarCorreccion, progresoSincronizacion = '' }) {
  const correcciones = [
    {
      id: 'sincronizarSaldos',
      titulo: 'Sincronizar Saldos',
      descripcion: 'Recalcula saldo_actual de cada Proveedor y Cliente desde el historial de movimientos (por lotes, sin saturar la API).',
      tipo: 'sincronizarSaldos',
      icon: RefreshCw
    },
    {
      id: 'correccionSaldosEnvases',
      titulo: 'Inicializar saldos de envases',
      descripcion: 'Recalcula saldo_envases de cada Proveedor y Cliente desde todo el historial (Ingresos, Salidas, Movimientos de Envases). Sincroniza con la nueva estructura de datos.',
      tipo: 'correccionSaldosEnvases',
      icon: Package
    },
    {
      id: 'recalcularSaldosDesdeCC',
      titulo: 'Reparar saldo_actual desde Cuenta Corriente',
      descripcion: 'Sincroniza saldo_actual de cada Proveedor y Cliente con la tabla CuentaCorriente: suma Haber, resta Debe (solo montos ya guardados). No recalcula precios.',
      tipo: 'recalcularSaldosDesdeCC',
      icon: Scale
    },
    {
      id: 'autoRetroactiva',
      titulo: 'Corrección Automática Retroactiva',
      descripcion: 'Corrige pérdidas de productos y stocks de envases desde el inicio',
      tipo: 'autoRetroactiva',
      icon: Wrench
    },
    {
      id: 'envasesRetroactiva',
      titulo: 'Corrección de Envases Retroactiva',
      descripcion: 'Recalcula stocks de envases ocupados y vacíos',
      tipo: 'envasesRetroactiva',
      icon: Wrench
    },
    {
      id: 'segregacionEnvases',
      titulo: 'Corrección de Segregación de Envases',
      descripcion: 'Separa correctamente envases ocupados y vacíos',
      tipo: 'segregacionEnvases',
      icon: Wrench
    },
    {
      id: 'cuentaCorriente',
      titulo: 'Corregir Saldos de Cuenta Corriente',
      descripcion: 'Recalcula deudas y saldos de cuenta corriente',
      tipo: 'cuentaCorriente',
      icon: Wrench
    },
    {
      id: 'preciosSalidas',
      titulo: 'Corrección de Precios en Salidas',
      descripcion: 'Actualiza precios en salidas según períodos vigentes',
      tipo: 'preciosSalidas',
      icon: Wrench
    }
  ];

  return (
    <div className="space-y-6">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-900 font-medium mb-1">🔧 Mantenimiento y Correcciones</p>
        <p className="text-xs text-amber-800">
          Estas herramientas ejecutan procesos de corrección retroactiva sobre los datos históricos del sistema. 
          Úsalas con precaución y solo cuando sea necesario corregir inconsistencias en los datos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Procesos de Corrección</CardTitle>
        </CardHeader>
        <CardContent>
          {progresoSincronizacion && (ejecutandoCorreccion === 'sincronizarSaldos' || ejecutandoCorreccion === 'correccionSaldosEnvases' || ejecutandoCorreccion === 'recalcularSaldosDesdeCC') && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-medium">Progreso:</p>
              <p className="mt-1">{progresoSincronizacion}</p>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {correcciones.map((correccion) => {
              const Icon = correccion.icon || Wrench;
              const esSincronizar = correccion.tipo === 'sincronizarSaldos';
              const esSaldosEnvases = correccion.tipo === 'correccionSaldosEnvases';
              const esRecalcularCC = correccion.tipo === 'recalcularSaldosDesdeCC';
              return (
                <div
                  key={correccion.id}
                  className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors"
                >
                  <h3 className="font-semibold text-slate-800 mb-2">{correccion.titulo}</h3>
                  <p className="text-sm text-slate-600 mb-4">{correccion.descripcion}</p>
                  <Button
                    onClick={() => onEjecutarCorreccion(correccion.tipo)}
                    disabled={ejecutandoCorreccion !== null}
                    className="w-full"
                    variant={ejecutandoCorreccion === correccion.tipo ? 'secondary' : 'default'}
                  >
                    {ejecutandoCorreccion === correccion.tipo ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {esSincronizar ? 'Sincronizando...' : esSaldosEnvases ? 'Inicializando saldos...' : esRecalcularCC ? 'Reparando saldos...' : 'Ejecutando...'}
                      </>
                    ) : (
                      <>
                        <Icon className="h-4 w-4 mr-2" />
                        {esSincronizar ? 'Sincronizar Saldos' : esSaldosEnvases ? 'Inicializar saldos de envases' : esRecalcularCC ? 'Reparar saldo_actual desde CC' : 'Ejecutar Corrección'}
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
