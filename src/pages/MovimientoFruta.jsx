import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Apple, ShoppingCart, CheckCircle } from "lucide-react";
import IngresoFruta from './IngresoFruta';
import SalidaFruta from './SalidaFruta';
import ConfirmarSalida from './ConfirmarSalida';

export default function MovimientoFruta() {
  const [activeTab, setActiveTab] = useState('ingreso');

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4 md:mb-6">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-800 flex items-center gap-2 md:gap-3">
            <Apple className="h-6 w-6 md:h-8 md:w-8 text-green-600" />
            <span className="break-words">Movimiento de Fruta</span>
          </h1>
          <p className="text-sm md:text-base text-slate-600 mt-1">Gestión completa de ingresos y salidas de fruta</p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 mb-4 md:mb-6 h-auto">
                <TabsTrigger value="ingreso" className="text-xs md:text-sm py-2 flex items-center gap-1 md:gap-2">
                  <Apple className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Ingreso de Fruta</span>
                  <span className="sm:hidden">Ingreso</span>
                </TabsTrigger>
                <TabsTrigger value="salida" className="text-xs md:text-sm py-2 flex items-center gap-1 md:gap-2">
                  <ShoppingCart className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Salida de Fruta</span>
                  <span className="sm:hidden">Salida</span>
                </TabsTrigger>
                <TabsTrigger value="confirmar" className="text-xs md:text-sm py-2 flex items-center gap-1 md:gap-2">
                  <CheckCircle className="h-3 w-3 md:h-4 md:w-4" />
                  <span className="hidden sm:inline">Confirmar Salidas</span>
                  <span className="sm:hidden">Confirmar</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ingreso" className="mt-0">
                <IngresoFruta embedded={true} />
              </TabsContent>

              <TabsContent value="salida" className="mt-0">
                <SalidaFruta embedded={true} />
              </TabsContent>

              <TabsContent value="confirmar" className="mt-0">
                <ConfirmarSalida embedded={true} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}