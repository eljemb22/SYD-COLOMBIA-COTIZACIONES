import React, { useState, useMemo } from 'react';
import {
  X,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Package,
  Layers,
  Building2,
  Hash,
  DollarSign,
  FileCheck,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { MedicalEquipment } from '../../types';
import { DetectedPurchaseOrder } from '../../services/gmailIntegrationService';
import {
  extractPartCandidatesFromOrder,
  convertOrderToPurchaseOrderAndSyncParts,
  ConvertOCToTrackingResult,
  ExtractedPartCandidate,
} from '../../utils/convertEmailToOCUtils';

interface ConvertToOCModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: DetectedPurchaseOrder | null;
  catalog: MedicalEquipment[];
  onAddEquipmentToCatalog?: (equipment: MedicalEquipment) => void;
  onBatchSaveEquipments?: (catalog: MedicalEquipment[], count: number, mode: 'append_update') => void;
  onNavigateToTracking?: () => void;
  onNavigateToCatalog?: () => void;
}

export const ConvertToOCModal: React.FC<ConvertToOCModalProps> = ({
  isOpen,
  onClose,
  order,
  catalog,
  onAddEquipmentToCatalog,
  onBatchSaveEquipments,
  onNavigateToTracking,
  onNavigateToCatalog,
}) => {
  if (!isOpen || !order) return null;

  const [ocNumberInput, setOcNumberInput] = useState<string>(() => {
    return (
      order.detectedOCNumber?.trim() ||
      `OC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
    );
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [conversionResult, setConversionResult] = useState<ConvertOCToTrackingResult | null>(null);

  // Extract candidate parts and evaluate against catalog
  const partCandidates: ExtractedPartCandidate[] = useMemo(() => {
    return extractPartCandidatesFromOrder(order, catalog);
  }, [order, catalog]);

  const newPartsCount = partCandidates.filter((p) => !p.isExisting).length;
  const existingPartsCount = partCandidates.filter((p) => p.isExisting).length;

  const totalEstimatedCost = partCandidates.reduce(
    (sum, p) => sum + (p.quantity || 1) * (p.unitPrice || 0),
    0
  );

  const handleConfirmConversion = async () => {
    setIsProcessing(true);
    try {
      const result = await convertOrderToPurchaseOrderAndSyncParts({
        order,
        customOCNumber: ocNumberInput,
        catalog,
        onAddEquipmentToCatalog,
        onBatchSaveEquipments,
      });
      setConversionResult(result);
    } catch (err) {
      console.error('Error al convertir orden de compra:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCOP = (val?: number) =>
    val ? `$${Math.round(val).toLocaleString('es-CO')}` : '$0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Convertir en Orden de Compra y Pasar a Seguimiento
              </h3>
              <p className="text-xs text-slate-400">
                Sincronización automática de partes en Catálogo (Ventana 3) y registro en Seguimiento de OC (Ventana 5)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm text-slate-300">
          {conversionResult ? (
            /* SUCCESS STATE */
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h4 className="text-xl font-bold text-white">
                  ¡Orden de Compra #{conversionResult.ocNumber} Creada con Éxito!
                </h4>
                <p className="text-sm text-slate-300 mt-1 max-w-lg mx-auto">
                  La orden ha sido transferida directamente al módulo de <strong>Seguimiento de OC (Ventana 5)</strong> y las partes han sido procesadas en el <strong>Catálogo de Equipos</strong>.
                </p>
              </div>

              {/* Stats Summary Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto text-left">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                    <PlusCircle className="w-4 h-4" />
                    <span>Partes Creadas</span>
                  </div>
                  <span className="text-2xl font-bold text-white font-mono">
                    {conversionResult.createdPartsCount}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Nuevas en Catálogo</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold mb-1">
                    <RefreshCw className="w-4 h-4" />
                    <span>Partes Actualizadas</span>
                  </div>
                  <span className="text-2xl font-bold text-white font-mono">
                    {conversionResult.updatedPartsCount}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Datos y costos al día</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
                    <Package className="w-4 h-4" />
                    <span>Total en OC</span>
                  </div>
                  <span className="text-2xl font-bold text-white font-mono">
                    {conversionResult.totalParts}
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Ítems vinculados</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-800">
                {onNavigateToTracking && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToTracking();
                    }}
                    className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-lg flex items-center gap-2"
                  >
                    <span>Ir a Seguimiento de OC (Ventana 5)</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {onNavigateToCatalog && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onNavigateToCatalog();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer border border-slate-700 flex items-center gap-2"
                  >
                    <span>Ver en Catálogo de Equipos</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white font-medium text-xs transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            /* CONFIGURATION & REVIEW FORM */
            <>
              {/* Order Meta Header */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Número de Orden de Compra (OC)
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-cyan-400" />
                    <input
                      type="text"
                      value={ocNumberInput}
                      onChange={(e) => setOcNumberInput(e.target.value.toUpperCase())}
                      placeholder="Ej. OC-100234, OC-2025-01"
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-mono text-white font-bold focus:outline-hidden focus:border-cyan-400"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Detectado en el correo. Puede modificarlo si lo requiere.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                    Proveedor Asignado
                  </label>
                  <div className="flex items-center gap-2 p-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-medium">
                    <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">
                      {order.senderName || order.sender || 'Proveedor SYD'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Se registrará automáticamente en el Directorio de Proveedores si no existe.
                  </p>
                </div>
              </div>

              {/* Dynamic Parts Verification Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-sm font-bold text-white">
                      Partes Detectadas en la Orden ({partCandidates.length})
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {newPartsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                        +{newPartsCount} por crear
                      </span>
                    )}
                    {existingPartsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                        {existingPartsCount} por actualizar
                      </span>
                    )}
                  </div>
                </div>

                {/* Explanation Banner */}
                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-xs text-cyan-200 flex items-start gap-2.5">
                  <Layers className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p>
                    <strong>Regla de unicidad por Número de Parte:</strong> Cada parte se verifica mediante su código único. Si la parte no está creada en el Catálogo, se creará automáticamente; si ya existe, se actualizarán sus costos y datos comerciales.
                  </p>
                </div>

                {/* Parts Table / List */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {partCandidates.map((cand, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 font-mono font-bold border border-slate-700">
                            N° {cand.code}
                          </span>
                          <span className="font-semibold text-white">
                            {cand.name}
                          </span>
                        </div>
                        <div className="text-slate-400 flex items-center gap-3 text-[11px]">
                          <span>Marca: {cand.brand}</span>
                          <span>•</span>
                          <span>Cantidad: {cand.quantity}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-medium">
                            Costo: {formatCOP(cand.unitPrice)}
                          </span>
                        </div>
                      </div>

                      {/* Status Action Badge */}
                      <div className="shrink-0">
                        {cand.isExisting ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold text-[11px]">
                            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                            <span>Existe: Actualizar Datos</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px]">
                            <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Nueva: Crear Automáticamente</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Summary & Action */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  <span>Total estimado de la OC: </span>
                  <strong className="text-emerald-400 font-mono text-sm font-bold">
                    {formatCOP(totalEstimatedCost || order.detectedEstimatedTotal)}
                  </strong>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isProcessing}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmConversion}
                    disabled={isProcessing || !ocNumberInput.trim()}
                    className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Procesando Partes y Creando OC...</span>
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-4 h-4" />
                        <span>Confirmar y Pasar a Seguimiento de OC</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
