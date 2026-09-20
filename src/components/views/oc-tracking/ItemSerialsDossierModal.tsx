import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Zap,
  Printer,
  FileText,
  ShieldCheck,
  Building,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Download,
  Trash2,
  FileSpreadsheet,
  Tag,
  Clock,
  Sparkles,
  ExternalLink,
  Award,
  BookOpen,
  Wrench,
  ChevronRight,
  Eye,
  FileCheck,
  Box,
  Ban,
  Edit3,
  Check,
} from 'lucide-react';
import {
  MedicalEquipment,
  OCTrackingContract,
  OCTrackingItem,
  ItemSerialNumberRecord,
  IndividualSerialDoc,
  SerialUnitStatus,
  TechnicalDocument,
} from '../../../types';
import {
  findMatchingGeneralDocuments,
  generateHojaDeVidaHtml,
  generateActaEntregaHtml,
  generateConsolidatedDossierHtml,
} from '../../../utils/dossierGenerator';

interface ItemSerialsDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  contract: OCTrackingContract;
  item: OCTrackingItem;
  equipments: MedicalEquipment[];
  allDocuments: TechnicalDocument[];
  onSaveSerials: (contractId: string, itemId: string, serials: ItemSerialNumberRecord[]) => void;
  onOpenNewGeneralDocument?: (equipmentId?: string, equipmentName?: string) => void;
}

const SERIAL_STATUS_OPTIONS: { status: SerialUnitStatus; label: string; color: string }[] = [
  { status: 'En Bodega', label: 'En Bodega SYD', color: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  { status: 'En Pruebas Técnicas', label: 'En Pruebas Técnicas / Calidad', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  { status: 'Listo para Despacho', label: 'Listo para Despacho', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { status: 'Despachado', label: 'Despachado al Cliente', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  { status: 'Entregado e Instalado', label: 'Entregado e Instalado en IPS', color: 'bg-green-500/20 text-green-300 border-green-500/40' },
];

const PRESET_ANEXO_NAMES = [
  'Acta de Entrega Firmada',
  'Pruebas de Seguridad Eléctrica',
  'Certificado de Calibración / Metrología',
  'Certificado de Garantía',
  'Registro Fotográfico / Placas',
  'Remisión de Despacho',
  'Manual Específico de Usuario',
];

export const ItemSerialsDossierModal: React.FC<ItemSerialsDossierModalProps> = ({
  isOpen,
  onClose,
  contract,
  item,
  equipments,
  allDocuments,
  onSaveSerials,
  onOpenNewGeneralDocument,
}) => {
  const [serials, setSerials] = useState<ItemSerialNumberRecord[]>([]);
  const [activeSerialId, setActiveSerialId] = useState<string | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [genPrefix, setGenPrefix] = useState('MD-2026-');
  const [genStartNum, setGenStartNum] = useState('101');
  const [genDianNum, setGenDianNum] = useState('');
  const [previewModalDoc, setPreviewModalDoc] = useState<{ title: string; html: string } | null>(null);

  // Custom attachment modal state
  const [customDocModal, setCustomDocModal] = useState<{
    file: File;
    title: string;
    preset: string;
  } | null>(null);

  // Inline edit state for doc title
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocTitle, setEditingDocTitle] = useState<string>('');

  // Initialize or load existing serials
  useEffect(() => {
    if (isOpen && item) {
      if (item.serialNumbers && item.serialNumbers.length > 0) {
        setSerials(item.serialNumbers);
        setActiveSerialId(item.serialNumbers[0].id);
      } else {
        // Pre-create empty slots up to item.quantity
        const initialSlots: ItemSerialNumberRecord[] = Array.from({ length: item.quantity || 1 }).map((_, idx) => ({
          id: `sn-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          identifierType: 'serial',
          serialNumber: '',
          inventoryPlate: '',
          status: 'En Bodega',
          dianDeclarationNumber: '',
          dianDate: new Date().toISOString().split('T')[0],
          receptionDate: new Date().toISOString().split('T')[0],
          technicianName: 'Ing. Biomédico SYD',
          hospitalLocation: 'Servicio Hospitalario',
          notes: '',
          documents: [],
        }));
        setSerials(initialSlots);
        setActiveSerialId(initialSlots[0]?.id || null);
      }
    }
  }, [isOpen, item]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (previewModalDoc) {
          setPreviewModalDoc(null);
        } else if (customDocModal) {
          setCustomDocModal(null);
        } else if (isGeneratorOpen) {
          setIsGeneratorOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewModalDoc, customDocModal, isGeneratorOpen, onClose]);

  // Find general docs from Ventana 6 for this equipment
  const generalDocs = useMemo(() => {
    return findMatchingGeneralDocuments(item, allDocuments, equipments);
  }, [item, allDocuments, equipments]);

  // Equipment master from catalog if exists
  const equipmentMaster = useMemo(() => {
    return equipments.find(
      (e) =>
        (item.equipmentId && e.id === item.equipmentId) ||
        (e.code && item.code && e.code.toLowerCase() === item.code.toLowerCase()) ||
        (e.model && item.model && e.model.toLowerCase() === item.model.toLowerCase())
    );
  }, [item, equipments]);

  const activeSerial = useMemo(() => {
    return serials.find((s) => s.id === activeSerialId) || serials[0] || null;
  }, [serials, activeSerialId]);

  if (!isOpen) return null;

  const validSerialsCount = serials.filter(
    (s) => s.identifierType === 'na' || (s.serialNumber && s.serialNumber.trim().length > 0)
  ).length;
  const isComplete = validSerialsCount >= (item.quantity || 1);

  // Add individual serial
  const handleAddSerial = () => {
    const newSn: ItemSerialNumberRecord = {
      id: `sn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      identifierType: 'serial',
      serialNumber: '',
      inventoryPlate: '',
      status: 'En Bodega',
      dianDeclarationNumber: genDianNum || (serials[0]?.dianDeclarationNumber || ''),
      dianDate: new Date().toISOString().split('T')[0],
      receptionDate: new Date().toISOString().split('T')[0],
      technicianName: serials[0]?.technicianName || 'Ing. Biomédico SYD',
      hospitalLocation: serials[0]?.hospitalLocation || 'Servicio Hospitalario',
      notes: '',
      documents: [],
    };
    const updated = [...serials, newSn];
    setSerials(updated);
    setActiveSerialId(newSn.id);
  };

  // Remove a serial slot
  const handleRemoveSerial = (idToRemove: string) => {
    const updated = serials.filter((s) => s.id !== idToRemove);
    setSerials(updated);
    if (activeSerialId === idToRemove) {
      setActiveSerialId(updated[0]?.id || null);
    }
  };

  // Quick Range / Consecutives Generator
  const handleGenerateConsecutives = (e: React.FormEvent) => {
    e.preventDefault();
    const start = parseInt(genStartNum, 10) || 1;
    const qty = item.quantity || 1;

    const generated: ItemSerialNumberRecord[] = Array.from({ length: qty }).map((_, idx) => {
      const currentNum = (start + idx).toString().padStart(genStartNum.length, '0');
      const sNumber = `${genPrefix.trim()}${currentNum}`;
      return {
        id: `sn-gen-${Date.now()}-${idx}`,
        identifierType: 'serial',
        serialNumber: sNumber,
        inventoryPlate: '',
        status: 'En Bodega',
        dianDeclarationNumber: genDianNum.trim(),
        dianDate: new Date().toISOString().split('T')[0],
        receptionDate: new Date().toISOString().split('T')[0],
        technicianName: 'Ing. Biomédico SYD',
        hospitalLocation: 'Servicio Hospitalario',
        notes: '',
        documents: [],
      };
    });

    setSerials(generated);
    setActiveSerialId(generated[0]?.id || null);
    setIsGeneratorOpen(false);
  };

  // Update field on active serial
  const handleUpdateActiveSerial = (field: keyof ItemSerialNumberRecord, value: any) => {
    if (!activeSerialId) return;
    setSerials((prev) =>
      prev.map((s) => (s.id === activeSerialId ? { ...s, [field]: value } : s))
    );
  };

  // Handle file upload for individual serial
  const handleUploadSerialDoc = (
    docType: IndividualSerialDoc['docType'],
    title: string,
    file: File
  ) => {
    if (!activeSerial) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = e.target?.result as string;
      const newDoc: IndividualSerialDoc = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        docType,
        title: title || file.name,
        fileName: file.name,
        fileSize: `${(file.size / 1024).toFixed(1)} KB`,
        fileType: file.type,
        fileData,
        uploadDate: new Date().toISOString(),
        dianDeclarationNumber: activeSerial.dianDeclarationNumber,
        dianDate: activeSerial.dianDate,
      };

      const updatedDocs = [...(activeSerial.documents || []), newDoc];
      handleUpdateActiveSerial('documents', updatedDocs);
    };
    reader.readAsDataURL(file);
  };

  // Save custom attachment modal
  const handleSaveCustomDoc = () => {
    if (!customDocModal || !activeSerial) return;
    const finalTitle = customDocModal.title.trim() || customDocModal.file.name;
    handleUploadSerialDoc('otro', finalTitle, customDocModal.file);
    setCustomDocModal(null);
  };

  // Inline rename document title
  const handleSaveDocTitleEdit = (docId: string) => {
    if (!activeSerial || !editingDocTitle.trim()) {
      setEditingDocId(null);
      return;
    }
    const updatedDocs = (activeSerial.documents || []).map((d) =>
      d.id === docId ? { ...d, title: editingDocTitle.trim() } : d
    );
    handleUpdateActiveSerial('documents', updatedDocs);
    setEditingDocId(null);
  };

  // Remove an attached document from serial
  const handleRemoveSerialDoc = (docId: string) => {
    if (!activeSerial) return;
    const updatedDocs = (activeSerial.documents || []).filter((d) => d.id !== docId);
    handleUpdateActiveSerial('documents', updatedDocs);
  };

  // Open Preview of Hoja de Vida
  const handlePreviewHojaDeVida = () => {
    if (!activeSerial) return;
    const html = generateHojaDeVidaHtml({
      contract,
      item,
      serialRecord: activeSerial,
      equipmentMaster,
      generalDocs,
    });
    setPreviewModalDoc({
      title: `Hoja de Vida MinSalud - ${activeSerial.identifierType === 'lote' ? 'Lote' : 'Serial'}: ${activeSerial.serialNumber || 'Sin Serial'}`,
      html,
    });
  };

  // Open Preview of Acta de Entrega
  const handlePreviewActaEntrega = () => {
    if (!activeSerial) return;
    const html = generateActaEntregaHtml({
      contract,
      item,
      serialRecord: activeSerial,
      equipmentMaster,
      generalDocs,
    });
    setPreviewModalDoc({
      title: `Acta de Entrega Técnica e Instalación - ${activeSerial.identifierType === 'lote' ? 'Lote' : 'Serial'}: ${activeSerial.serialNumber || 'Sin Serial'}`,
      html,
    });
  };

  // Open Consolidated Dossier
  const handlePreviewConsolidatedDossier = () => {
    if (!activeSerial) return;
    const html = generateConsolidatedDossierHtml({
      contract,
      item,
      serialRecord: activeSerial,
      equipmentMaster,
      generalDocs,
    });
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  // Save and finalize
  const handleSave = () => {
    onSaveSerials(contract.id, item.id, serials);
    onClose();
  };

  const activeIdType = activeSerial?.identifierType || 'serial';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
      <div className="bg-[#0e1726] border border-[#243c5a] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* MODAL HEADER */}
        <div className="p-4 bg-[#142338] border-b border-[#243c5a] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-black text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-400/40">
                  SERIALES & DOSSIER HOSPITALARIO
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {contract.clientName} • Proceso: {contract.contractNumber}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white leading-tight mt-0.5 flex items-center gap-2">
                <span>{item.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-500/40 font-mono font-normal">
                  {item.brand} {item.model}
                </span>
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1f334d] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STATUS & PROGRESS BAR */}
        <div className="px-4 py-2.5 bg-[#0f1b2b] border-b border-[#1f3450] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="text-slate-400">Total Solicitados:</span>
              <strong className="font-bold text-white bg-[#192a40] px-2 py-0.5 rounded border border-[#294266]">
                {item.quantity || 1} unidades
              </strong>
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold ${
                isComplete
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-950/60 text-amber-300 border-amber-500/40'
              }`}
            >
              {isComplete ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>
                {validSerialsCount} de {item.quantity || 1} Identificados
              </span>
            </div>

            {/* General docs indicator */}
            <div className="flex items-center gap-1.5 text-slate-300 bg-[#16273e] px-2.5 py-1 rounded-lg border border-[#2d4666]">
              <FileCheck className="w-3.5 h-3.5 text-sky-400" />
              <span>
                <strong>{generalDocs.length}</strong> Docs Generales
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGeneratorOpen(!isGeneratorOpen)}
              className="inline-flex items-center gap-1.5 bg-[#172b44] hover:bg-[#203c61] text-amber-300 px-3 py-1.5 rounded-lg border border-amber-500/40 font-bold transition cursor-pointer"
              title="Generar seriales consecutivos para todas las unidades"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Generar Consecutivos</span>
            </button>
          </div>
        </div>

        {/* QUICK CONSECUTIVE GENERATOR DRAWER */}
        {isGeneratorOpen && (
          <form
            onSubmit={handleGenerateConsecutives}
            className="p-4 bg-[#14263d] border-b border-[#28466d] animate-fadeIn grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs"
          >
            <div>
              <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                Prefijo del Serial:
              </label>
              <input
                type="text"
                value={genPrefix}
                onChange={(e) => setGenPrefix(e.target.value)}
                placeholder="Ej: MD-2026-"
                className="w-full bg-[#0d1827] border border-[#334d6e] rounded-lg px-2.5 py-1.5 text-white font-mono font-bold outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                Número Inicial:
              </label>
              <input
                type="text"
                value={genStartNum}
                onChange={(e) => setGenStartNum(e.target.value)}
                placeholder="Ej: 101 o 001"
                className="w-full bg-[#0d1827] border border-[#334d6e] rounded-lg px-2.5 py-1.5 text-white font-mono font-bold outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                Declaración DIAN (Opcional):
              </label>
              <input
                type="text"
                value={genDianNum}
                onChange={(e) => setGenDianNum(e.target.value)}
                placeholder="N° Declaración DIAN"
                className="w-full bg-[#0d1827] border border-[#334d6e] rounded-lg px-2.5 py-1.5 text-white font-mono outline-none focus:border-sky-400"
              />
            </div>

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold py-1.5 px-3 rounded-lg shadow transition cursor-pointer"
              >
                Aplicar a {item.quantity || 1} Unidades
              </button>
              <button
                type="button"
                onClick={() => setIsGeneratorOpen(false)}
                className="px-2.5 py-1.5 bg-[#1b2d46] hover:bg-[#253e61] text-slate-300 rounded-lg transition"
              >
                Cerrar
              </button>
            </div>
          </form>
        )}

        {/* MAIN MODAL BODY: SIDEBAR OF SERIALS + ACTIVE SERIAL DOSSIER */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 min-h-0 overflow-hidden">
          {/* LEFT LIST: SERIAL TABS */}
          <div className="md:col-span-4 bg-[#0a121c] border-r border-[#1e334d] p-3 overflow-y-auto space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-1">
              Unidades Físicas ({serials.length})
            </span>

            {serials.map((s, idx) => {
              const isActive = s.id === activeSerialId;
              const idType = s.identifierType || 'serial';
              const hasSn = s.serialNumber && s.serialNumber.trim().length > 0;
              const hasDianDoc = (s.documents || []).some((d) => d.docType === 'dian_import');
              const docsCount = (s.documents || []).length;

              return (
                <div
                  key={s.id}
                  onClick={() => setActiveSerialId(s.id)}
                  className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                    isActive
                      ? 'bg-[#182942] border-sky-500 shadow-md ring-1 ring-sky-500/40'
                      : 'bg-[#101b2b] border-[#1e3450] hover:border-[#33537a]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-slate-400">
                        #{idx + 1}
                      </span>
                      {idType === 'na' ? (
                        <span className="text-xs font-mono text-slate-400 italic">
                          No Aplica (N/A)
                        </span>
                      ) : idType === 'lote' ? (
                        <strong
                          className={`text-xs font-mono truncate ${
                            hasSn ? 'text-amber-300 font-bold' : 'text-amber-400/80 italic'
                          }`}
                        >
                          {hasSn ? `Lote: ${s.serialNumber}` : 'Sin Lote Asignado'}
                        </strong>
                      ) : (
                        <strong
                          className={`text-xs font-mono truncate ${
                            hasSn ? 'text-white font-bold' : 'text-amber-400/80 italic'
                          }`}
                        >
                          {hasSn ? s.serialNumber : 'Sin Serial Asignado'}
                        </strong>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400 flex-wrap">
                      {s.inventoryPlate ? (
                        <span className="text-cyan-300 font-mono truncate max-w-[120px]">
                          Placa: {s.inventoryPlate}
                        </span>
                      ) : (
                        <span className="truncate max-w-[110px]">
                          {s.status}
                        </span>
                      )}
                      {hasDianDoc && (
                        <span className="text-emerald-400 font-mono bg-emerald-950/60 px-1 rounded">
                          DIAN
                        </span>
                      )}
                      {docsCount > 0 && (
                        <span className="text-purple-300 font-bold bg-purple-950/60 px-1 rounded">
                          {docsCount} doc(s)
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSerial(s.id);
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded transition"
                    title="Eliminar este registro"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={handleAddSerial}
              className="w-full py-2 bg-[#122033] hover:bg-[#1a2f4c] text-sky-400 rounded-xl border border-dashed border-[#28466d] text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar otra unidad</span>
            </button>
          </div>

          {/* RIGHT VIEW: DOSSIER AND DOCUMENTATION FOR SELECTED SERIAL */}
          <div className="md:col-span-8 p-4 sm:p-5 overflow-y-auto space-y-5 bg-[#0e1726]">
            {activeSerial ? (
              <>
                {/* ACTIVE SERIAL HEADER & BASIC DATA (ONLY SERIAL / LOTE / NA & PLACA) */}
                <div className="bg-[#132238] border border-[#243c5a] p-4 rounded-xl space-y-3.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        EXPEDIENTE INDIVIDUAL DE ENTREGA
                      </span>
                      <h3 className="text-base font-black text-white flex items-center gap-2">
                        <span>
                          {activeIdType === 'lote' ? 'Lote:' : activeIdType === 'na' ? 'Identificador:' : 'Serial:'}
                        </span>
                        <span className="font-mono text-sky-300">
                          {activeIdType === 'na'
                            ? 'No Aplica'
                            : activeSerial.serialNumber || '(Por definir)'}
                        </span>
                      </h3>
                    </div>

                    {/* Status selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Estado:</span>
                      <select
                        value={activeSerial.status}
                        onChange={(e) =>
                          handleUpdateActiveSerial('status', e.target.value as SerialUnitStatus)
                        }
                        className="bg-[#0b1320] border border-[#334d6e] rounded-lg px-2.5 py-1 text-xs font-bold text-white outline-none focus:border-sky-400"
                      >
                        {SERIAL_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.status} value={opt.status}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* IDENTIFIER TYPE SELECTOR (SERIAL vs LOTE vs NO APLICA) */}
                  <div>
                    <span className="block text-[10.5px] font-bold text-slate-300 mb-1.5">
                      Tipo de Identificador:
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0b1320] border border-[#233a57] rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          handleUpdateActiveSerial('identifierType', 'serial');
                          if (activeSerial.serialNumber === 'N/A') {
                            handleUpdateActiveSerial('serialNumber', '');
                          }
                        }}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                          activeIdType === 'serial'
                            ? 'bg-purple-600 text-white shadow'
                            : 'text-slate-400 hover:text-white hover:bg-[#152338]'
                        }`}
                      >
                        <Tag className="w-3.5 h-3.5" />
                        <span>Número de Serie</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleUpdateActiveSerial('identifierType', 'lote');
                          if (activeSerial.serialNumber === 'N/A') {
                            handleUpdateActiveSerial('serialNumber', '');
                          }
                        }}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                          activeIdType === 'lote'
                            ? 'bg-amber-600 text-white shadow'
                            : 'text-slate-400 hover:text-white hover:bg-[#152338]'
                        }`}
                      >
                        <Box className="w-3.5 h-3.5" />
                        <span>Por Lote</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          handleUpdateActiveSerial('identifierType', 'na');
                          handleUpdateActiveSerial('serialNumber', 'N/A');
                        }}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                          activeIdType === 'na'
                            ? 'bg-slate-700 text-white shadow'
                            : 'text-slate-400 hover:text-white hover:bg-[#152338]'
                        }`}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>No Aplica</span>
                      </button>
                    </div>
                  </div>

                  {/* IDENTIFIER VALUE + INVENTORY PLATE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    {activeIdType === 'serial' && (
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                          Número de Serie (S/N): <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={activeSerial.serialNumber === 'N/A' ? '' : activeSerial.serialNumber}
                          onChange={(e) => handleUpdateActiveSerial('serialNumber', e.target.value)}
                          placeholder="Ej: MD-2026-98124"
                          className="w-full bg-[#0b1320] border border-[#334d6e] rounded-lg px-3 py-1.5 text-white font-mono font-bold outline-none focus:border-sky-400"
                        />
                      </div>
                    )}

                    {activeIdType === 'lote' && (
                      <div>
                        <label className="block text-[10.5px] font-bold text-amber-300 mb-1">
                          Número de Lote: <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="text"
                          value={activeSerial.serialNumber === 'N/A' ? '' : activeSerial.serialNumber}
                          onChange={(e) => handleUpdateActiveSerial('serialNumber', e.target.value)}
                          placeholder="Ej: LOTE-2026-09A"
                          className="w-full bg-[#0b1320] border border-amber-500/50 rounded-lg px-3 py-1.5 text-white font-mono font-bold outline-none focus:border-amber-400"
                        />
                      </div>
                    )}

                    {activeIdType === 'na' && (
                      <div className="p-2 bg-[#0b1320] rounded-lg border border-slate-700/60 flex items-center gap-2 text-slate-400 text-xs">
                        <Ban className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-[11px]">No aplica serialización física (Consumibles, Accesorios o Mobiliario).</span>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-300 mb-1">
                        Placa de Inventario IPS (Opcional):
                      </label>
                      <input
                        type="text"
                        value={activeSerial.inventoryPlate || ''}
                        onChange={(e) => handleUpdateActiveSerial('inventoryPlate', e.target.value)}
                        placeholder="Ej: AF-HOSP-2026-042"
                        className="w-full bg-[#0b1320] border border-[#334d6e] rounded-lg px-3 py-1.5 text-white font-mono outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>
                </div>

                {/* 1-CLICK OFFICIAL DOCUMENT GENERATORS & ACTIONS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Documentos Oficiales Individuales (1-Clic)</span>
                    </span>

                    <button
                      type="button"
                      onClick={handlePreviewConsolidatedDossier}
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-3 py-1 rounded-lg shadow transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir Dossier Completo</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* HOJA DE VIDA CARD */}
                    <div className="bg-[#122033] border border-[#243c5a] p-3 rounded-xl flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-sky-400" />
                            <span>Hoja de Vida MinSalud</span>
                          </span>
                          <span className="text-[10px] bg-sky-950 text-sky-300 border border-sky-400/30 px-1.5 py-0.5 rounded font-mono">
                            Res. 3100
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Expediente oficial con datos técnicos, riesgo clínico INVIMA, mantenimiento y firmas.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePreviewHojaDeVida}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#1b2f4c] hover:bg-[#25426b] text-sky-300 text-xs font-bold py-1.5 px-2 rounded-lg border border-sky-500/30 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Generar / Ver</span>
                        </button>
                      </div>
                    </div>

                    {/* ACTA DE ENTREGA CARD */}
                    <div className="bg-[#122033] border border-[#243c5a] p-3 rounded-xl flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <span>Acta de Entrega e Instalación</span>
                          </span>
                          <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.5 rounded font-mono">
                            Oficial
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Acta formal con lista de chequeo de accesorios, pruebas operativas y firmas del interventor.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handlePreviewActaEntrega}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#1b2f4c] hover:bg-[#25426b] text-emerald-300 text-xs font-bold py-1.5 px-2 rounded-lg border border-emerald-500/30 transition cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Generar / Ver</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ATTACHED INDIVIDUAL DOCUMENTS (DIAN + OTRO ANEXO PERSONALIZADO) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Upload className="w-4 h-4 text-purple-400" />
                      <span>Archivos Adjuntos de este Serial ({(activeSerial.documents || []).length})</span>
                    </span>
                  </div>

                  {/* 2 MAIN UPLOAD BUTTONS: DECLARACIÓN DIAN & OTRO ANEXO */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* DECLARACIÓN DIAN */}
                    <label className="flex items-center gap-3 p-3 bg-[#111e30] hover:bg-[#182942] border border-dashed border-emerald-500/40 hover:border-emerald-400 rounded-xl cursor-pointer transition group">
                      <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-300 group-hover:scale-105 transition shrink-0">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-emerald-300 block">Declaración DIAN</span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          Subir Manifiesto / Declaración aduanera (PDF/Img)
                        </span>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadSerialDoc('dian_import', `Declaración DIAN - ${file.name}`, file);
                          e.target.value = '';
                        }}
                      />
                    </label>

                    {/* OTRO ANEXO */}
                    <label className="flex items-center gap-3 p-3 bg-[#111e30] hover:bg-[#182942] border border-dashed border-purple-500/40 hover:border-purple-400 rounded-xl cursor-pointer transition group">
                      <div className="p-2.5 rounded-lg bg-purple-500/20 text-purple-300 group-hover:scale-105 transition shrink-0">
                        <Plus className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-purple-300 block">+ Otro Anexo</span>
                        <span className="text-[10px] text-slate-400 block truncate">
                          Actas, Garantía, Pruebas, Fotos... (Elegir nombre)
                        </span>
                      </div>
                      <input
                        type="file"
                        accept=".pdf,image/*,.doc,.docx"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setCustomDocModal({
                              file,
                              title: file.name.replace(/\.[^/.]+$/, ''),
                              preset: '',
                            });
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  {/* List of uploaded docs for active serial */}
                  {activeSerial.documents && activeSerial.documents.length > 0 ? (
                    <div className="space-y-1.5">
                      {activeSerial.documents.map((doc) => {
                        const isEditingThis = editingDocId === doc.id;
                        const isDian = doc.docType === 'dian_import';

                        return (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-2.5 bg-[#122033] border border-[#233a57] rounded-xl text-xs gap-2"
                          >
                            <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                              {isDian ? (
                                <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                              )}
                              <div className="truncate flex-1 min-w-0">
                                {isEditingThis ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={editingDocTitle}
                                      onChange={(e) => setEditingDocTitle(e.target.value)}
                                      className="bg-[#0b1320] border border-sky-400 rounded px-2 py-0.5 text-xs text-white outline-none w-full"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveDocTitleEdit(doc.id);
                                        if (e.key === 'Escape') setEditingDocId(null);
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveDocTitleEdit(doc.id)}
                                      className="p-1 text-emerald-400 hover:text-emerald-300"
                                      title="Guardar nombre"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white truncate block">
                                      {doc.title}
                                    </span>
                                    {isDian && (
                                      <span className="text-[9px] bg-emerald-950 text-emerald-300 border border-emerald-500/40 px-1 rounded font-mono shrink-0">
                                        DIAN
                                      </span>
                                    )}
                                  </div>
                                )}
                                <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                                  {doc.fileName} • {doc.fileSize} • {new Date(doc.uploadDate).toLocaleDateString('es-CO')}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {!isEditingThis && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingDocId(doc.id);
                                    setEditingDocTitle(doc.title);
                                  }}
                                  className="p-1 text-slate-400 hover:text-sky-300 rounded bg-[#182942] hover:bg-[#203657] transition"
                                  title="Renombrar anexo"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {doc.fileData && (
                                <a
                                  href={doc.fileData}
                                  download={doc.fileName || 'documento.pdf'}
                                  className="p-1 text-sky-400 hover:text-sky-300 rounded bg-[#182942] hover:bg-[#203657] transition"
                                  title="Descargar archivo"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemoveSerialDoc(doc.id)}
                                className="p-1 text-slate-400 hover:text-rose-400 rounded bg-[#182942] hover:bg-rose-950/40 transition"
                                title="Eliminar anexo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-3 bg-[#0a121c] rounded-xl border border-[#1a2c42] text-slate-500 text-xs">
                      No hay archivos escaneados adjuntos para esta unidad todavía. Puedes subir la Declaración DIAN o cualquier otro anexo arriba.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">
                Selecciona o agrega una unidad a la izquierda para ver su expediente.
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-[#142338] border-t border-[#243c5a] flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400 font-mono">
            {serials.length} unidades registradas en el contrato
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#1b2d46] hover:bg-[#253e61] text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 text-white text-xs font-black rounded-xl shadow-lg transition cursor-pointer"
            >
              Guardar Seriales & Expediente
            </button>
          </div>
        </div>
      </div>

      {/* CUSTOM ATTACHMENT MODAL (CHOOSE NAME & PRESET) */}
      {customDocModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#101b2b] border border-[#28466d] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#243c5a] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-purple-400" />
                <span>Adjuntar Nuevo Documento</span>
              </h3>
              <button
                type="button"
                onClick={() => setCustomDocModal(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs bg-[#0b1320] p-2.5 rounded-xl border border-[#1e3450] text-slate-300">
              <span className="text-slate-400 text-[10.5px] block">Archivo seleccionado:</span>
              <strong className="text-white block truncate">{customDocModal.file.name}</strong>
              <span className="text-[10px] text-slate-500 font-mono">
                {(customDocModal.file.size / 1024).toFixed(1)} KB
              </span>
            </div>

            {/* PRESETS */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                Nombres Sugeridos (Haz clic para aplicar):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_ANEXO_NAMES.map((presetName) => (
                  <button
                    key={presetName}
                    type="button"
                    onClick={() => setCustomDocModal({ ...customDocModal, title: presetName })}
                    className={`text-[11px] px-2 py-1 rounded-lg border transition cursor-pointer ${
                      customDocModal.title === presetName
                        ? 'bg-purple-900/70 text-purple-200 border-purple-400 font-bold'
                        : 'bg-[#152438] text-slate-300 border-[#264063] hover:border-purple-400/60'
                    }`}
                  >
                    {presetName}
                  </button>
                ))}
              </div>
            </div>

            {/* CUSTOM INPUT */}
            <div className="space-y-1">
              <label className="text-[10.5px] font-bold text-slate-300 block">
                Nombre / Título del Anexo: <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={customDocModal.title}
                onChange={(e) => setCustomDocModal({ ...customDocModal, title: e.target.value })}
                placeholder="Ej: Acta Firmada / Certificado de Calibración / Garantía"
                className="w-full bg-[#0b1320] border border-[#334d6e] rounded-lg px-3 py-2 text-white text-xs font-bold outline-none focus:border-purple-400"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#243c5a]">
              <button
                type="button"
                onClick={() => setCustomDocModal(null)}
                className="px-3 py-1.5 bg-[#182942] hover:bg-[#203657] text-slate-300 text-xs font-bold rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCustomDoc}
                className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black rounded-lg shadow transition cursor-pointer"
              >
                Guardar Anexo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW MODAL */}
      {previewModalDoc && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#101b2b] border border-[#28466d] rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-3.5 bg-[#142338] border-b border-[#28466d] flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <span>{previewModalDoc.title}</span>
              </h3>
              <button
                type="button"
                onClick={() => setPreviewModalDoc(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-white p-2 overflow-hidden">
              <iframe
                title="Preview"
                srcDoc={previewModalDoc.html}
                className="w-full h-[75vh] border-0 rounded"
              />
            </div>
            <div className="p-3 bg-[#142338] border-t border-[#28466d] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalDoc(null)}
                className="px-4 py-1.5 bg-[#1b2d46] hover:bg-[#253e61] text-white text-xs font-bold rounded-lg"
              >
                Cerrar Vista Previa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
