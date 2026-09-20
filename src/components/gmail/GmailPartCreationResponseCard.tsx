import React, { useState } from 'react';
import {
  Sparkles,
  Package,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Building,
  Tag,
  ArrowRight,
  FileCheck,
  Pencil,
  Plus,
  Trash2,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { DetectedPurchaseOrder, DetectedPartToImport } from '../../services/gmailIntegrationService';
import { MedicalEquipment, TechnicalDocument } from '../../types';
import { cleanSupplierName } from '../../utils/cleanSupplierUtils';
import { MASTER_EQUIPMENTS_CATALOG } from '../../data/masterEquipmentsCatalog';
import { EditDetectedPartModal } from './EditDetectedPartModal';

interface GmailPartCreationResponseCardProps {
  order: DetectedPurchaseOrder;
  onAddEquipmentToCatalog: (equipment: MedicalEquipment) => void;
  onSaveDocument?: (doc: TechnicalDocument) => void;
  onNavigateToTab?: (tab: string) => void;
  onUpdateOrder?: (updatedOrder: DetectedPurchaseOrder) => void;
  onOpenOrderClassificationModal?: () => void;
  equipments?: MedicalEquipment[];
}

export const GmailPartCreationResponseCard: React.FC<GmailPartCreationResponseCardProps> = ({
  order,
  onAddEquipmentToCatalog,
  onSaveDocument,
  onNavigateToTab,
  onUpdateOrder,
  onOpenOrderClassificationModal,
  equipments,
}) => {
  const [importedCodes, setImportedCodes] = useState<string[]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState<string | null>(null);
  const [editingPart, setEditingPart] = useState<DetectedPartToImport | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const parts = order.detectedPartsToImport || [];
  if (parts.length === 0 && order.emailType !== 'part_creation_response') {
    return null;
  }

  const formatCOP = (val?: number) => {
    if (val === undefined || isNaN(val)) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleImportPart = (part: DetectedPartToImport) => {
    if (!part.code || !/^\d{4,8}$/.test(part.code.trim())) {
      alert('⚠️ Falta el número de parte oficial asignado por Compras (código numérico de 4 a 8 dígitos). Por favor modifique la parte para ingresar el número oficial antes de crearla en el Catálogo Maestro.');
      handleStartEditPart(part);
      return;
    }

    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
    const newEquipment: MedicalEquipment = {
      id: `eq-part-${part.code}-${uniqueSuffix}`,
      code: part.code,
      name: part.name,
      brand: part.brand || 'SYD',
      model: part.model || 'Estándar',
      category: (part.category as any) || 'Accesorios',
      productGroup: 'Equipos Médicos',
      description: part.description || `Parte creada desde respuesta de compras (${order.senderEmail})`,
      baseCostCOP: part.baseCostCOP || 0,
      baseCostUSD: 0,
      taxExempt: part.taxExempt || false,
      taxRate: part.taxExempt ? 0 : (part.taxRate || 0.19),
      defaultMarginList: 'L1',
      customFactor: 1.0,
      supplier: cleanSupplierName(part.supplier) || cleanSupplierName(order.senderName) || 'Proveedor SYD',
      invimaRecordNumber: part.invimaRecordNumber || '',
      invimaStatus: 'Vigente',
      warrantyMonths: 12,
      originCountry: 'Colombia',
      technicalSpecs: [
        `Parte creada por departamento de compras`,
        `Referencia: ${part.name}`,
        `Marca: ${part.brand || 'SYD'}`,
        ...(part.subReferences ? [`Sub-referencias: ${part.subReferences}`] : []),
      ],
      standardAccessories: [],
      imageUrl: '',
      hasDocSheet: true,
      hasInvimaDoc: true,
      hasManual: false,
      hasQualityCert: false,
    };

    onAddEquipmentToCatalog(newEquipment);
    setImportedCodes((prev) => [...prev, part.code]);

    // If there were attachments in email, save as TechnicalDocument in Ventana 7
    if (onSaveDocument && order.attachments && order.attachments.length > 0) {
      order.attachments.forEach((att) => {
        const isInvima = att.filename.toLowerCase().includes('invima') || att.filename.toLowerCase().includes('registro');
        const doc: TechnicalDocument = {
          id: `doc-gmail-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          equipmentName: part.name,
          equipmentCode: part.code,
          docType: isInvima ? 'Registro INVIMA' : 'Ficha Técnica',
          title: att.filename,
          fileName: att.filename,
          fileSize: `${Math.round((att.size || 1048576) / 1024)} KB`,
          uploadDate: new Date().toISOString().split('T')[0],
          status: 'Vigente',
          invimaNumber: part.invimaRecordNumber,
          notes: `Documento importado desde correo de respuesta de compras (${order.senderEmail})`,
        };
        onSaveDocument(doc);
      });
    }

    setShowSuccessToast(`✓ Parte "${part.code} - ${part.name}" registrada y creada exitosamente en el Catálogo.`);
    setTimeout(() => setShowSuccessToast(null), 6000);
  };

  const handleImportAll = () => {
    const validParts = parts.filter((p) => p.code && /^\d{4,8}$/.test(p.code.trim()));
    if (validParts.length === 0) {
      alert('⚠️ Ninguna parte tiene un número oficial de parte (código numérico de 4 a 8 dígitos). Por favor modifique las partes para ingresar el número oficial asignado por Compras.');
      return;
    }
    validParts.forEach((p) => {
      if (!importedCodes.includes(p.code)) {
        handleImportPart(p);
      }
    });
  };

  const handleStartEditPart = (partToEdit: DetectedPartToImport) => {
    setEditingPart(partToEdit);
    setIsEditModalOpen(true);
  };

  const handleStartAddNewPart = () => {
    setEditingPart(null);
    setIsEditModalOpen(true);
  };

  const handleSavePartChanges = (updatedPart: DetectedPartToImport, andImportToCatalog?: boolean) => {
    const existingIdx = parts.findIndex((p) => p.code === updatedPart.code);
    let newPartsList: DetectedPartToImport[];

    if (existingIdx >= 0) {
      newPartsList = [...parts];
      newPartsList[existingIdx] = updatedPart;
    } else if (editingPart) {
      // It was an edit of code
      newPartsList = parts.map((p) => (p.code === editingPart.code ? updatedPart : p));
    } else {
      // New part added
      newPartsList = [...parts, updatedPart];
    }

    if (onUpdateOrder) {
      onUpdateOrder({
        ...order,
        detectedPartsToImport: newPartsList,
      });
    }

    if (andImportToCatalog) {
      handleImportPart(updatedPart);
    }
  };

  const handleDeletePart = (codeToDelete: string) => {
    if (!confirm(`¿Desea quitar la parte "${codeToDelete}" de la lista detectada?`)) {
      return;
    }
    const newPartsList = parts.filter((p) => p.code !== codeToDelete);
    if (onUpdateOrder) {
      onUpdateOrder({
        ...order,
        detectedPartsToImport: newPartsList,
      });
    }
  };

  return (
    <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-3 space-y-2.5 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-emerald-500/20 text-emerald-300">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-white">
              Partes Oficiales Detectadas
            </h4>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.2 rounded-full font-mono font-bold border border-emerald-500/30">
              {parts.length} {parts.length === 1 ? 'parte' : 'partes'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Add Part Button */}
          <button
            type="button"
            onClick={handleStartAddNewPart}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-cyan-600/40 text-xs font-semibold transition cursor-pointer"
            title="Agregar un código de parte adicional manualmente"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>Agregar Parte</span>
          </button>

          {/* Reclassify button */}
          {onOpenOrderClassificationModal && (
            <button
              type="button"
              onClick={onOpenOrderClassificationModal}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-purple-300 hover:text-white border border-purple-800/40 text-xs font-medium transition cursor-pointer"
              title="Cambiar tipo de detección a Orden de Compra o Informativo"
            >
              <Layers className="w-3 h-3 text-purple-400" />
              <span>Cambiar Tipo</span>
            </button>
          )}

          {/* Create All Equipment Button */}
          {parts.length > 1 && (
            <button
              type="button"
              onClick={handleImportAll}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-xs transition cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Crear Todos</span>
            </button>
          )}
        </div>
      </div>

      {showSuccessToast && (
        <div className="p-2.5 bg-emerald-900/90 border border-emerald-400 rounded-lg text-emerald-100 text-xs font-medium flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{showSuccessToast}</span>
          </div>
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('catalogo')}
              className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-2 py-0.5 rounded text-xs font-bold transition cursor-pointer shrink-0"
            >
              <span>Ir al Catálogo</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Parts List */}
      <div className="space-y-1.5">
        {parts.map((part, index) => {
          const isAlreadyInApp =
            (Boolean(part.code) && Boolean(equipments?.some((eq) => eq.code && eq.code.trim().toUpperCase() === part.code.trim().toUpperCase()))) ||
            (Boolean(part.code) && Boolean(MASTER_EQUIPMENTS_CATALOG.some((eq) => eq.code && eq.code.trim().toUpperCase() === part.code.trim().toUpperCase())));
          const isImported = importedCodes.includes(part.code) || isAlreadyInApp;
          return (
            <div
              key={`part-response-${part.code || 'item'}-${index}`}
              className={`p-2 sm:p-2.5 rounded-lg border transition flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                isAlreadyInApp || isImported
                  ? 'bg-emerald-950/20 border-emerald-500/40'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold text-xs border border-cyan-500/40">
                    #{part.code}
                  </span>
                  <span className="font-bold text-white text-xs">{part.name}</span>
                  {part.taxExempt && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded font-semibold border border-amber-500/30">
                      Exento IVA 0%
                    </span>
                  )}
                  {part.category && (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded border border-slate-700">
                      {part.category}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-slate-400">
                  <span>Marca: <strong className="text-slate-200">{part.brand || 'SYD'}</strong></span>
                  <span>Modelo: <strong className="text-slate-200">{part.model || 'Estándar'}</strong></span>
                  <span>Proveedor: <strong className="text-slate-200">{cleanSupplierName(part.supplier) || 'Asignado'}</strong></span>
                  {part.subReferences && (
                    <span className="text-cyan-300 flex items-center gap-0.5 font-mono">
                      <Tag className="w-3 h-3 text-cyan-400" />
                      Refs: <strong className="text-white">{part.subReferences}</strong>
                    </span>
                  )}
                  {part.invimaRecordNumber && (
                    <span className="text-emerald-300 flex items-center gap-0.5 font-mono">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      INVIMA: {part.invimaRecordNumber}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {part.baseCostCOP > 0 && (
                  <div className="text-right mr-1">
                    <span className="text-[10px] text-slate-500 block leading-tight">Costo Base</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">{formatCOP(part.baseCostCOP)}</span>
                  </div>
                )}

                {/* Edit Button with Pencil */}
                <button
                  type="button"
                  onClick={() => handleStartEditPart(part)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-slate-700 text-xs font-medium transition cursor-pointer"
                  title="Modificar nombre, descripción, invima, precio o marca"
                >
                  <Pencil className="w-3 h-3 text-cyan-400" />
                  <span>Modificar</span>
                </button>

                {/* Remove from list */}
                <button
                  type="button"
                  onClick={() => handleDeletePart(part.code)}
                  className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition cursor-pointer"
                  title="Quitar de la lista"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {isAlreadyInApp ? (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-300 font-bold bg-emerald-500/20 px-2.5 py-1 rounded-md border border-emerald-500/40">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Ya Creada en la App</span>
                    </span>
                    {onNavigateToTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateToTab('catalogo')}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white rounded border border-slate-700 text-xs transition font-medium cursor-pointer"
                        title="Ver repuesto en el Catálogo Maestro"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Ver en Catálogo</span>
                      </button>
                    )}
                  </div>
                ) : isImported ? (
                  <div className="flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-300 font-bold bg-emerald-500/20 px-2 py-1 rounded-md border border-emerald-500/40">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Creado</span>
                    </span>
                    {onNavigateToTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateToTab('catalogo')}
                        className="p-1 text-cyan-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition"
                        title="Ver en Catálogo de Equipos"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : !part.code || !/^\d{4,8}$/.test(part.code.trim()) ? (
                  <button
                    type="button"
                    onClick={() => handleStartEditPart(part)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition cursor-pointer"
                    title="Falta número oficial de parte (4 a 8 dígitos). Clic para asignarlo antes de crearla."
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Falta N° de Parte</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleImportPart(part)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs shadow-xs transition cursor-pointer active:scale-95"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Crear Equipo</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Part Modal */}
      <EditDetectedPartModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        part={editingPart}
        order={order}
        onSavePart={handleSavePartChanges}
      />
    </div>
  );
};
