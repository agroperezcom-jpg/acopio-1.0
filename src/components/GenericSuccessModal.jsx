import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, FileDown, MessageCircle, FileText } from "lucide-react";

/**
 * Modal genérico de éxito que unifica SuccessModal y SuccessModalEnvases
 * @param {boolean} open - Controla si el modal está abierto
 * @param {function} onClose - Callback cuando se cierra el modal
 * @param {string} title - Título del modal (ej: "¡Movimiento Registrado!")
 * @param {string} message - Mensaje opcional personalizado (por defecto: "El movimiento se ha registrado correctamente")
 * @param {function} onDownloadPDF - Callback para descargar PDF (opcional)
 * @param {function} onShareWhatsApp - Callback para compartir por WhatsApp (opcional)
 * @param {boolean} isGenerating - Indica si se está generando el PDF (opcional)
 * @param {boolean} requireWhatsAppNumber - Si es true, muestra un input para ingresar número de WhatsApp antes de compartir
 */
export default function GenericSuccessModal({
  open,
  onClose,
  title = "¡Operación Exitosa!",
  message = "El movimiento se ha registrado correctamente",
  onDownloadPDF,
  onShareWhatsApp,
  isGenerating = false,
  requireWhatsAppNumber = false
}) {
  const [whatsappNumber, setWhatsappNumber] = useState('');

  const handleShareWhatsApp = () => {
    if (requireWhatsAppNumber) {
      if (!whatsappNumber.trim()) {
        alert('Por favor ingrese un número de WhatsApp');
        return;
      }
      // Si requiere número, el callback debe recibirlo
      if (onShareWhatsApp) {
        onShareWhatsApp(whatsappNumber);
      }
    } else {
      // Si no requiere número, llamar directamente
      if (onShareWhatsApp) {
        onShareWhatsApp();
      }
    }
  };

  const hasActions = onDownloadPDF || onShareWhatsApp;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={requireWhatsAppNumber ? "max-w-md" : "sm:max-w-md"}>
        <DialogHeader>
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <DialogTitle className="text-xl">{title}</DialogTitle>
            <p className="text-sm text-slate-500 mt-2">
              {message}
            </p>
          </div>
        </DialogHeader>
        
        {hasActions && (
          <div className="space-y-4 mt-6">
            {onDownloadPDF && (
              <Button
                size="lg"
                variant="outline"
                onClick={onDownloadPDF}
                disabled={isGenerating}
                className={`w-full ${requireWhatsAppNumber ? 'h-auto py-3 justify-start' : 'h-20 flex-col'} flex items-center gap-2`}
              >
                {requireWhatsAppNumber ? (
                  <>
                    <FileText className="h-5 w-5 text-red-600" />
                    <div className="text-left">
                      <div className="font-medium">Descargar PDF</div>
                      <div className="text-xs text-slate-500">Imprimir o guardar el comprobante</div>
                    </div>
                  </>
                ) : (
                  <>
                    <FileDown className="h-6 w-6 text-blue-600" />
                    <span className="text-sm font-medium">Descargar PDF</span>
                  </>
                )}
              </Button>
            )}

            {onShareWhatsApp && (
              <div className="space-y-2">
                {requireWhatsAppNumber && (
                  <>
                    <Label className="text-sm font-medium">Compartir por WhatsApp</Label>
                    <div className="flex gap-2">
                      <Input
                        type="tel"
                        placeholder="+54 9 11 1234-5678"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        className="flex-1"
                      />
                      <Button 
                        onClick={handleShareWhatsApp}
                        className="bg-green-600 hover:bg-green-700"
                        disabled={isGenerating}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Enviar
                      </Button>
                    </div>
                  </>
                )}
                {!requireWhatsAppNumber && (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleShareWhatsApp}
                    disabled={isGenerating}
                    className="w-full h-20 flex flex-col items-center justify-center gap-2 hover:bg-green-50 hover:border-green-300"
                  >
                    <MessageCircle className="h-6 w-6 text-green-600" />
                    <span className="text-sm font-medium">Compartir WhatsApp</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <Button
          variant="ghost"
          onClick={onClose}
          className="mt-4 w-full"
        >
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  );
}
