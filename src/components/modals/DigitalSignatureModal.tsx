import React, { useState, useRef, useEffect } from 'react';
import {
  Minimize2,
  X,
  CheckCheck,
  Trash2,
  Loader2,
} from 'lucide-react';
export interface DigitalSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSignature: (signatureData: { dataUrl: string; signerName: string; signerRole?: string }) => void;
  existingSignature?: { dataUrl: string; signedAt: string; signerName: string; signerRole?: string } | null;
}

export const DigitalSignatureModal: React.FC<DigitalSignatureModalProps> = ({
  isOpen,
  onClose,
  onSaveSignature,
  existingSignature,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [signerName, setSignerName] = useState(existingSignature?.signerName || '');
  const [signerRole, setSignerRole] = useState(existingSignature?.signerRole || '');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!existingSignature);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configurar estilo de dibujo
    ctx.strokeStyle = 'var(--syd-accent-light)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let isDrawingActive = false;

    const startDrawing = (e: MouseEvent | TouchEvent) => {
      isDrawingActive = true;
      setIsDrawing(true);
      const rect = canvas.getBoundingClientRect();
      const x = (e as MouseEvent).clientX - rect.left || (e as TouchEvent).touches[0].clientX - rect.left;
      const y = (e as MouseEvent).clientY - rect.top || (e as TouchEvent).touches[0].clientY - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!isDrawingActive) return;
      e.preventDefault();
      const rect = canvas.getContext('2d')!.canvas.getBoundingClientRect();
      const x = (e as MouseEvent).clientX - rect.left || (e as TouchEvent).touches[0].clientX - rect.left;
      const y = (e as MouseEvent).clientY - rect.top || (e as TouchEvent).touches[0].clientY - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      isDrawingActive = false;
      setIsDrawing(false);
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    // Cargar firma existente si hay
    if (existingSignature?.dataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
      };
      img.src = existingSignature.dataUrl;
    }

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseout', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [existingSignature]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
  };

  const getSignatureDataUrl = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
  };

  const handleSave = () => {
    if (!hasSignature || !signerName.trim()) return;
    setIsSaving(true);
    const dataUrl = getSignatureDataUrl();
    if (dataUrl) {
      onSaveSignature({
        dataUrl,
        signerName: signerName.trim(),
        signerRole: signerRole.trim() || undefined,
      });
    }
    setIsSaving(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1a2e] border border-[#334d6e] rounded-2xl shadow-2xl w-[90%] sm:w-[700px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#132238] border-b border-[#243b5a] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCheck className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-bold text-white">Firma Digital</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-[#1e314b] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* Instrucciones */}
          <div className="bg-[#15243b] border border-[#243b5a] rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-cyan-400 flex items-center justify-center text-sm font-bold">
                ℹ️
              </div>
              <div>
                <p className="text-sm font-medium text-white">Firma Digital de la Cotización</p>
                <p className="text-xs text-slate-400 mt-1">
                  Dibuje su firma en el área inferior con el mouse o dedo. Esta firma se adjuntará
                  al documento de cotización como evidencia de aceptación.
                </p>
              </div>
            </div>
          </div>

          {/* Nombre y rol del firmante */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nombre del Firmante</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Juan Pérez"
                className="w-full bg-[#14233a] border border-[#2d4972] rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--syd-accent)] outline-none"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Cargo / Rol</label>
              <input
                type="text"
                value={signerRole}
                onChange={(e) => setSignerRole(e.target.value)}
                placeholder="Gerente de Ventas"
                className="w-full bg-[#14233a] border border-[#2d4972] rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--syd-accent)] outline-none"
              />
            </div>
          </div>

          {/* Canvas de firma */}
          <div className="bg-[#15243b] border-2 border-dashed border-[#334d6e]/50 rounded-xl p-2 flex items-center justify-center min-h-[300px]">
            {hasSignature ? (
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={200}
                  className="w-full max-w-full h-auto rounded border border-[#2d4972] bg-white/10"
                />
                <div className="absolute -top-4 -right-4 flex gap-2">
                  <button
                    type="button"
                    onClick={clearSignature}
                    className="p-2 text-rose-400 hover:text-white hover:bg-[#1e314b] rounded-lg transition"
                    title="Limpiar firma"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-slate-400">
                <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center mb-3 text-slate-500">
                  <span className="text-2xl">✍️</span>
                </div>
                <p className="text-sm">Dibuje su firma aquí</p>
                <p className="text-[10px] text-slate-500 mt-1">Soporte para mouse o pantalla táctil</p>
              </div>
            )}
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-lg text-sm font-bold text-slate-400 hover:text-slate-200 bg-[#0f1a2e] border border-[#2d4972] hover:border-[var(--syd-accent)] disabled:opacity-50 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!hasSignature || !signerName.trim() || isSaving}
              className="px-6 py-2 rounded-lg text-sm font-bold text-white bg-linear-to-r from-cyan-400 to-blue-600 hover:from-cyan-300 hover:to-blue-500 shadow-[0_0_15px_rgba(14,165,233,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSaving ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando firma...</span>
                </div>
              ) : (
                <span>Guardar Firma</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const clearSignature = () => {
  // Esta función se define en el componente principal
};