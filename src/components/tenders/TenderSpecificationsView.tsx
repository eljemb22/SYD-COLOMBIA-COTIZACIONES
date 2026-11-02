import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  Check,
  Sliders,
  ShieldCheck,
  FileSpreadsheet,
  FileDown,
  Filter,
  X,
  Loader2,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FoldVertical,
  UnfoldVertical,
  ArrowUp,
  ArrowDown,
  Wand2,
  AlertTriangle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  TenderClientProject,
  TenderItem,
  TechnicalRequirement,
  MedicalEquipment,
} from '../../types';
import {
  getLiveDraftingAdvice,
  optimizeTechnicalSpecification,
  detectNumericalValuesInSpec,
} from '../../utils/specOptimizer';
import { exportTenderToWord, exportTenderToExcel } from '../../utils/exportUtils';
import { TenderAIGeneratorModal } from './TenderAIGeneratorModal';

interface TenderSpecificationsViewProps {
  activeClient: TenderClientProject;
  equipments: MedicalEquipment[];
  selectedEquipmentId: string | null;
  onSelectEquipmentId: (id: string | null) => void;
  onUpdateTenderItem: (clientId: string, itemId: string, updates: Partial<TenderItem>) => void;
  onAddRequirement: (clientId: string, itemId: string, req: TechnicalRequirement) => void;
  onUpdateRequirement: (
    clientId: string,
    itemId: string,
    reqId: string,
    updates: Partial<TechnicalRequirement>
  ) => void;
  onDeleteRequirement: (clientId: string, itemId: string, reqId: string) => void;
  onSwitchToAwardedTab: () => void;
  isReadOnly?: boolean;
}

export const TenderSpecificationsView: React.FC<TenderSpecificationsViewProps> = ({
  activeClient,
  equipments,
  selectedEquipmentId,
  onSelectEquipmentId,
  onUpdateTenderItem,
  onAddRequirement,
  onUpdateRequirement,
  onDeleteRequirement,
  onSwitchToAwardedTab,
  isReadOnly,
}) => {
  const [quickInputMap, setQuickInputMap] = useState<Record<string, string>>({});
  const [quickUniqueMap, setQuickUniqueMap] = useState<Record<string, boolean>>({});
  const [optimizingReqId, setOptimizingReqId] = useState<string | null>(null);
  const [isOptimizingQuick, setIsOptimizingQuick] = useState<Record<string, boolean>>({});
  const [isOptimizingEdit, setIsOptimizingEdit] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // AI Spec Generator Modal State
  const [aiGeneratorEquipment, setAiGeneratorEquipment] = useState<TenderItem | null>(null);

  // Clear Specifications Confirmation Modals State
  const [clearEquipmentTarget, setClearEquipmentTarget] = useState<TenderItem | null>(null);
  const [isConfirmClearAllSpecsModalOpen, setIsConfirmClearAllSpecsModalOpen] = useState<boolean>(false);

  const handleConfirmClearEquipmentSpecs = () => {
    if (!clearEquipmentTarget) return;
    onUpdateTenderItem(activeClient.id, clearEquipmentTarget.id, { requirements: [] });
    setClearEquipmentTarget(null);
    showToast(`✓ Especificaciones de "${clearEquipmentTarget.name}" eliminadas. Tabla nueva.`);
  };

  const handleConfirmClearAllSpecs = () => {
    (activeClient.items || []).forEach((it) => {
      onUpdateTenderItem(activeClient.id, it.id, { requirements: [] });
    });
    setIsConfirmClearAllSpecsModalOpen(false);
    showToast('✓ Todas las especificaciones técnicas del proyecto han sido eliminadas. Tabla nueva.');
  };

  // Accordion collapsed/expanded state per equipment item (default all expanded)
  const [collapsedItemsMap, setCollapsedItemsMap] = useState<Record<string, boolean>>({});

  const toggleEquipmentAccordion = (itemId: string) => {
    setCollapsedItemsMap((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const expandAllAccordions = () => {
    setCollapsedItemsMap({});
  };

  const collapseAllAccordions = () => {
    const allCollapsed: Record<string, boolean> = {};
    (activeClient.items || []).forEach((it) => {
      allCollapsed[it.id] = true;
    });
    setCollapsedItemsMap(allCollapsed);
  };

  // Helper to strip any star emojis/symbols from text
  const cleanSpecText = (text: string) => {
    return (text || '').replace(/^[⭐★*]\s*/, '').replace(/[⭐★]/g, '').trim();
  };

  // Requirement editing state
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');
  const [editingIsUnique, setEditingIsUnique] = useState<boolean>(false);
  const [editingHasWorkRange, setEditingHasWorkRange] = useState<boolean>(false);
  const [editingWorkRange, setEditingWorkRange] = useState<string>('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleStartEditReq = (req: TechnicalRequirement) => {
    setEditingReqId(req.id);
    setEditingText(cleanSpecText(req.requirement));
    setEditingIsUnique(!!req.isUnique);
    setEditingHasWorkRange(!!req.hasWorkRange || !!req.workRange);
    setEditingWorkRange(req.workRange || '');
  };

  const handleSaveEditReq = (itemId: string, reqId: string) => {
    const cleaned = cleanSpecText(editingText);
    if (!cleaned) return;

    onUpdateRequirement(activeClient.id, itemId, reqId, {
      requirement: cleaned,
      isUnique: editingIsUnique,
      hasWorkRange: editingHasWorkRange,
      workRange: editingHasWorkRange ? editingWorkRange.trim() : undefined,
    });

    setEditingReqId(null);
    showToast('✓ Especificación modificada exitosamente');
  };

  const handleCancelEditReq = () => {
    setEditingReqId(null);
  };

  // Manual reordering of technical specifications
  const handleMoveRequirement = (item: TenderItem, index: number, direction: 'up' | 'down') => {
    const reqs = [...(item.requirements || [])];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= reqs.length) return;

    const [moved] = reqs.splice(index, 1);
    reqs.splice(targetIndex, 0, moved);

    onUpdateTenderItem(activeClient.id, item.id, { requirements: reqs });
    showToast(`✓ Posición actualizada (#${index + 1} ➔ #${targetIndex + 1})`);
  };

  // AI Spec wording correction on existing individual specification
  const handleCorrectSingleSpec = async (item: TenderItem, req: TechnicalRequirement) => {
    if (optimizingReqId) return;
    setOptimizingReqId(req.id);

    try {
      const result = await optimizeTechnicalSpecification(
        cleanSpecText(req.requirement),
        item.name,
        item.brand,
        item.model
      );

      const improvedText = cleanSpecText(result.optimized || result.formal || req.requirement);
      const numAnalysis = detectNumericalValuesInSpec(improvedText);
      const hasRange =
        result.isParametricSpec !== undefined
          ? Boolean(result.isParametricSpec)
          : req.hasWorkRange !== undefined
          ? req.hasWorkRange
          : numAnalysis.hasNumeric;

      onUpdateRequirement(activeClient.id, item.id, req.id, {
        requirement: improvedText,
        hasWorkRange: hasRange,
        workRange: result.detectedWorkRange || numAnalysis.workRange || req.workRange,
      });

      showToast('✨ Redacción corregida y optimizada con IA');
    } catch (err) {
      console.error(err);
      showToast('No se pudo optimizar la redacción en este momento');
    } finally {
      setOptimizingReqId(null);
    }
  };

  // AI Spec wording correction on editing text
  const handleCorrectEditTextWithAI = async (item: TenderItem) => {
    const textToOptimize = cleanSpecText(editingText);
    if (!textToOptimize || isOptimizingEdit) return;
    setIsOptimizingEdit(true);

    try {
      const result = await optimizeTechnicalSpecification(
        textToOptimize,
        item.name,
        item.brand,
        item.model
      );

      const improvedText = cleanSpecText(result.optimized || result.formal || textToOptimize);
      setEditingText(improvedText);

      const numAnalysis = detectNumericalValuesInSpec(improvedText);
      if (result.detectedWorkRange || numAnalysis.workRange) {
        setEditingHasWorkRange(true);
        setEditingWorkRange(result.detectedWorkRange || numAnalysis.workRange || '');
      }

      showToast('✨ Redacción corregida con IA');
    } catch (err) {
      console.error(err);
    } finally {
      setIsOptimizingEdit(false);
    }
  };

  // AI Spec wording correction on quick input
  const handleCorrectQuickInputWithAI = async (item: TenderItem) => {
    const rawText = cleanSpecText(quickInputMap[item.id] || '');
    if (!rawText || isOptimizingQuick[item.id]) return;

    setIsOptimizingQuick((prev) => ({ ...prev, [item.id]: true }));
    try {
      const result = await optimizeTechnicalSpecification(
        rawText,
        item.name,
        item.brand,
        item.model
      );
      const improvedText = cleanSpecText(result.optimized || result.formal || rawText);
      setQuickInputMap((prev) => ({ ...prev, [item.id]: improvedText }));
      showToast('✨ Redacción corregida');
    } catch (err) {
      console.error(err);
    } finally {
      setIsOptimizingQuick((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  // Apply specifications generated from TenderAIGeneratorModal
  const handleApplyAISpecifications = (
    newSpecs: { requirement: string; isUnique?: boolean; workRange?: string }[],
    mode: 'append' | 'replace'
  ) => {
    if (!aiGeneratorEquipment) return;

    const formattedNewReqs: TechnicalRequirement[] = newSpecs.map((s, idx) => ({
      id: `req-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      requirement: cleanSpecText(s.requirement),
      isUnique: !!s.isUnique,
      hasWorkRange: !!s.workRange,
      workRange: s.workRange,
      complies: true,
      folioRef: `Folio ${(idx + 1) * 2 + 10}`,
    }));

    const finalReqs =
      mode === 'replace'
        ? formattedNewReqs
        : [...(aiGeneratorEquipment.requirements || []), ...formattedNewReqs];

    onUpdateTenderItem(activeClient.id, aiGeneratorEquipment.id, { requirements: finalReqs });
    confetti({ particleCount: 45, spread: 65, origin: { y: 0.7 } });
    showToast(`✓ ${formattedNewReqs.length} especificaciones técnicas generadas con IA`);
  };

  const items = activeClient.items || [];
  const filteredItems = selectedEquipmentId
    ? items.filter((it) => it.id === selectedEquipmentId)
    : items;

  const totalSpecsCount = items.reduce((acc, it) => acc + (it.requirements?.length || 0), 0);
  const totalUniqueSpecs = items.reduce(
    (acc, it) => acc + (it.requirements?.filter((r) => r.isUnique)?.length || 0),
    0
  );

  const handleAddQuickReq = (item: TenderItem) => {
    const text = cleanSpecText(quickInputMap[item.id] || '');
    if (!text) return;

    const isUnique = !!quickUniqueMap[item.id];
    const liveAdvice = getLiveDraftingAdvice(text);

    const newReq: TechnicalRequirement = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      requirement: text,
      isUnique: isUnique,
      hasWorkRange: !!liveAdvice?.extractedRange,
      workRange: liveAdvice?.extractedRange?.formatted,
      complies: true,
      folioRef: `Folio ${(item.requirements?.length || 0) * 2 + 12}`,
    };

    onAddRequirement(activeClient.id, item.id, newReq);
    setQuickInputMap((prev) => ({ ...prev, [item.id]: '' }));
    setQuickUniqueMap((prev) => ({ ...prev, [item.id]: false }));
    showToast('✓ Requisito técnico agregado');
  };

  const handleExportWord = () => {
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    exportTenderToWord(activeClient.header, activeClient.items, activeClient);
  };

  const handleExportExcel = () => {
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    exportTenderToExcel(activeClient.header, activeClient.items, activeClient);
  };

  return (
    <div className="space-y-3 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--syd-accent)] text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-2xl animate-scaleUp flex items-center gap-2 border border-white/20">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* AI Specification Generator Modal */}
      <TenderAIGeneratorModal
        isOpen={!!aiGeneratorEquipment}
        onClose={() => setAiGeneratorEquipment(null)}
        equipment={aiGeneratorEquipment}
        onApplySpecifications={handleApplyAISpecifications}
      />

      {/* Compact Header & Export Actions */}
      <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-3 shadow-sm space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-[#334d6e]">
          <div className="space-y-0.5">
            <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span>Especificaciones Técnicas & Anexos ({activeClient.clientName})</span>
            </h3>
            <p className="text-[10.5px] text-slate-300">
              Gestione requisitos, reordene posiciones, corrija con IA y genere especificaciones técnicas completas.
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportWord}
              className="inline-flex items-center gap-1 text-[11px] text-slate-950 bg-[var(--syd-accent)] hover:bg-[var(--syd-accent-light)] px-2.5 py-1 rounded-lg font-black transition cursor-pointer shadow-xs active:scale-95"
              title="Descargar anexo en Microsoft Word (.docx)"
            >
              <FileDown className="w-3 h-3" />
              <span>Exportar Word</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1 text-[11px] text-slate-950 bg-emerald-400 hover:bg-emerald-300 px-2.5 py-1 rounded-lg font-black transition cursor-pointer shadow-xs active:scale-95"
              title="Descargar cuadro en Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3 h-3" />
              <span>Exportar Excel</span>
            </button>

            {!isReadOnly && totalSpecsCount > 0 && (
              <button
                type="button"
                onClick={() => setIsConfirmClearAllSpecsModalOpen(true)}
                className="inline-flex items-center gap-1 text-[11px] text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-600/80 border border-rose-500/30 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer shadow-xs"
                title="Eliminar todas las especificaciones de todos los equipos del proyecto"
              >
                <Trash2 className="w-3 h-3 text-rose-400" />
                <span>Vaciar Todas las Specs</span>
              </button>
            )}
          </div>
        </div>

        {/* Compact Equipment Selector Pills & Global Accordion Controls */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10.5px] text-slate-300 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold flex items-center gap-1">
                <Filter className="w-3 h-3 text-purple-400" />
                <span>Filtrar equipo ({items.length}):</span>
              </span>
              <div className="flex items-center gap-2 bg-[#111c2e] px-2 py-0.5 rounded border border-[#334d6e]">
                <span>Total: <strong className="text-white">{totalSpecsCount}</strong></span>
                <span>Diferencial: <strong className="text-amber-300 font-bold">{totalUniqueSpecs}</strong></span>
              </div>
            </div>

            {/* Global Accordion Toggle Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={expandAllAccordions}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#111c2e] hover:bg-[#15253d] text-slate-300 hover:text-white border border-[#334d6e] transition cursor-pointer"
                title="Desplegar todas las especificaciones de equipos"
              >
                <UnfoldVertical className="w-3 h-3 text-purple-400" />
                <span>Desplegar Todo</span>
              </button>
              <button
                type="button"
                onClick={collapseAllAccordions}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#111c2e] hover:bg-[#15253d] text-slate-300 hover:text-white border border-[#334d6e] transition cursor-pointer"
                title="Plegar todas las especificaciones para ahorrar espacio"
              >
                <FoldVertical className="w-3 h-3 text-purple-400" />
                <span>Plegar Todo</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
            <button
              type="button"
              onClick={() => onSelectEquipmentId(null)}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 ${
                selectedEquipmentId === null
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-[#111c2e] text-slate-300 hover:bg-[#15253d] border border-[#334d6e]'
              }`}
            >
              Todos ({items.length})
            </button>

            {items.map((it, idx) => {
              const count = it.requirements?.length || 0;
              const isSelected = selectedEquipmentId === it.id;

              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => onSelectEquipmentId(it.id)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0 flex items-center gap-1 ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-[#111c2e] text-slate-300 hover:bg-[#15253d] border border-[#334d6e]'
                  }`}
                >
                  <span className="font-mono text-[9.5px] text-[var(--syd-accent)]">#{idx + 1}</span>
                  <span className="truncate max-w-[120px]">{it.name}</span>
                  <span className="text-[9.5px] bg-slate-800 px-1 py-0.2 rounded font-mono text-purple-200">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {items.length === 0 ? (
        <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-6 text-center space-y-2.5">
          <p className="text-xs sm:text-sm font-bold text-white">Este contrato no tiene equipos adjudicados registrados</p>
          <p className="text-[11px] text-slate-400">
            Adjunte la lista de equipos en la pestaña de Contratos Adjudicados o impórtelos desde Excel.
          </p>
          <button
            type="button"
            onClick={onSwitchToAwardedTab}
            className="inline-flex items-center gap-1 bg-[var(--syd-accent)] hover:bg-[var(--syd-accent-light)] text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl transition cursor-pointer shadow-xs"
          >
            <span>Ir a Licitaciones & Contratos Adjudicados</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      ) : (
        /* Specifications List for Each Equipment (Compact & Space-Optimized) */
        <div className="space-y-2.5">
          {filteredItems.map((item) => {
            const reqs = item.requirements || [];
            const isCollapsed = !!collapsedItemsMap[item.id];
            const uniqueReqsCount = reqs.filter((r) => r.isUnique).length;
            const quickText = quickInputMap[item.id] || '';
            const quickIsUnique = !!quickUniqueMap[item.id];
            const liveAdvice = getLiveDraftingAdvice(quickText);
            const isQuickOptimizing = !!isOptimizingQuick[item.id];

            return (
              <div
                key={item.id}
                className="bg-[#192b45] border border-[#334d6e] rounded-xl overflow-hidden shadow-xs transition-all"
              >
                {/* Interactive Accordion Equipment Header */}
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 p-3 transition select-none ${
                    isCollapsed
                      ? 'bg-[#15253d] hover:bg-[#1c304d]'
                      : 'bg-[#192b45] hover:bg-[#1e3454] border-b border-[#334d6e]'
                  }`}
                >
                  <div
                    onClick={() => toggleEquipmentAccordion(item.id)}
                    className="flex items-center gap-2 flex-wrap min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="p-1 rounded-md bg-[#111c2e] border border-[#334d6e] text-purple-300">
                      {isCollapsed ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronUp className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <span className="font-mono text-[10px] font-bold text-[var(--syd-accent)] bg-[#111c2e] px-1.5 py-0.5 rounded border border-[#334d6e]">
                      {item.code}
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-white truncate max-w-sm">{item.name}</h4>
                    <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded border border-blue-500/30">
                      {item.brand}
                    </span>
                    <span className="text-[10px] text-purple-300 font-mono">Mod: {item.model}</span>
                    <span className="text-[10px] text-slate-400 font-bold bg-[#111c2e] px-1.5 py-0.5 rounded">
                      {item.quantity} {item.quantity === 1 ? 'Unidad' : 'Unidades'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[10.5px] font-medium flex-wrap">
                    <span className="bg-[#111c2e] text-slate-300 px-2 py-0.5 rounded border border-[#334d6e]">
                      {reqs.length} especificaciones
                    </span>
                    {uniqueReqsCount > 0 && (
                      <span className="bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded border border-amber-500/30">
                        {uniqueReqsCount} Blindaje
                      </span>
                    )}

                    {!isReadOnly && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAiGeneratorEquipment(item);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black bg-purple-600/30 hover:bg-purple-600/60 text-purple-200 border border-purple-500/50 transition cursor-pointer shadow-xs active:scale-95"
                          title="Generar nuevas especificaciones técnicas completas con IA para este equipo"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                          <span>Generar con IA</span>
                        </button>

                        {reqs.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClearEquipmentTarget(item);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-500/15 hover:bg-rose-600/80 text-rose-300 hover:text-white border border-rose-500/30 transition cursor-pointer shadow-xs"
                            title="Eliminar todas las especificaciones de este equipo para dejar la tabla limpia"
                          >
                            <Trash2 className="w-3 h-3 text-rose-400" />
                            <span>Vaciar</span>
                          </button>
                        )}
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleEquipmentAccordion(item.id)}
                      className="text-[10px] text-purple-400 font-bold hidden sm:inline cursor-pointer"
                    >
                      {isCollapsed ? 'Desplegar ▼' : 'Plegar ▲'}
                    </button>
                  </div>
                </div>

                {/* Collapsible Accordion Content */}
                {!isCollapsed && (
                  <div className="p-3 space-y-2.5 animate-fadeIn">
                    {/* Quick Add Specification Bar (Compact) & AI Action */}
                    {!isReadOnly && (
                      <div className="bg-[#111c2e] p-2 rounded-lg border border-[#334d6e] space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Escriba un nuevo requisito (ej: Frecuencia cardíaca de 15 a 300 lpm)..."
                            value={quickText}
                            onChange={(e) => setQuickInputMap({ ...quickInputMap, [item.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddQuickReq(item);
                            }}
                            className="flex-1 bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-slate-400 outline-none font-medium"
                          />

                          {/* Correct Wording button on quick input if text typed */}
                          {quickText.trim().length > 4 && (
                            <button
                              type="button"
                              disabled={isQuickOptimizing}
                              onClick={() => handleCorrectQuickInputWithAI(item)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 transition cursor-pointer shrink-0"
                              title="Corregir ortografía y redacción de este requisito antes de agregarlo"
                            >
                              {isQuickOptimizing ? (
                                <Loader2 className="w-3 h-3 animate-spin text-purple-300" />
                              ) : (
                                <Sparkles className="w-3 h-3 text-purple-300" />
                              )}
                              <span className="hidden sm:inline">Corregir con IA</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              setQuickUniqueMap({ ...quickUniqueMap, [item.id]: !quickIsUnique })
                            }
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-bold border transition cursor-pointer shrink-0 ${
                              quickIsUnique
                                ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-xs'
                                : 'bg-[#15253d] border-[#334d6e] text-slate-400 hover:text-white'
                            }`}
                            title="Marca este requisito como característica diferencial para blindaje de pliego"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                            <span className="hidden sm:inline">Blindaje</span>
                          </button>

                          <button
                            type="button"
                            disabled={!quickText.trim()}
                            onClick={() => handleAddQuickReq(item)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-black transition cursor-pointer shrink-0 active:scale-95 ${
                              quickText.trim()
                                ? 'bg-[var(--syd-accent)] hover:bg-[var(--syd-accent-light)] text-slate-950 shadow-xs'
                                : 'bg-[#15253d] text-slate-500 border border-[#334d6e] cursor-not-allowed'
                            }`}
                          >
                            <Plus className="w-3 h-3 stroke-[2.5]" />
                            <span>Agregar</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAiGeneratorEquipment(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 transition cursor-pointer shrink-0"
                            title="Abrir generador con IA para añadir más especificaciones"
                          >
                            <Wand2 className="w-3.5 h-3.5 text-purple-300" />
                            <span className="hidden md:inline">Generar con IA</span>
                          </button>
                        </div>

                        {/* Live Guidance Bar */}
                        {liveAdvice?.extractedRange && (
                          <div className="text-[10px] text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 flex items-center gap-1">
                            <Sliders className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                            <span>Rango detectado: <strong>{liveAdvice.extractedRange.formatted}</strong></span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Requirements List (Compact Rows with Manual Reordering) */}
                    {reqs.length === 0 ? (
                      <div className="p-4 text-center space-y-2 text-[11px] text-slate-400 bg-[#111c2e] rounded-lg border border-[#334d6e]/50">
                        <p>Sin especificaciones asignadas. Escriba un requisito arriba o genere automáticamente con IA.</p>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => setAiGeneratorEquipment(item)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-purple-600 hover:bg-purple-500 text-white transition cursor-pointer shadow-md"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Generar Especificaciones con IA</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {reqs.map((req, rIdx) => {
                          const isEditingThis = editingReqId === req.id;
                          const isThisOptimizing = optimizingReqId === req.id;

                          if (isEditingThis) {
                            return (
                              <div
                                key={req.id}
                                className="p-2.5 rounded-lg border border-purple-400/80 bg-[#162740] shadow-md space-y-2 animate-fadeIn"
                              >
                                <div className="flex items-center justify-between gap-2 border-b border-[#334d6e] pb-1.5">
                                  <span className="text-[11px] font-black text-purple-300 flex items-center gap-1">
                                    <Edit3 className="w-3 h-3 text-[var(--syd-accent)]" />
                                    <span>Modificar Especificación #{rIdx + 1}</span>
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      disabled={isOptimizingEdit}
                                      onClick={() => handleCorrectEditTextWithAI(item)}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 transition cursor-pointer"
                                      title="Mejorar y corregir redacción con IA"
                                    >
                                      {isOptimizingEdit ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-purple-300" />
                                      ) : (
                                        <Sparkles className="w-3 h-3 text-purple-300" />
                                      )}
                                      <span>Corregir Redacción con IA</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelEditReq}
                                      className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <textarea
                                    rows={2}
                                    value={editingText}
                                    onChange={(e) => setEditingText(e.target.value)}
                                    placeholder="Describa el requerimiento técnico o rango..."
                                    className="w-full bg-[#0d1827] border border-[#334d6e] focus:border-purple-400 rounded-lg p-2 text-[11px] text-white placeholder-slate-400 outline-none resize-none font-medium leading-relaxed"
                                  />
                                </div>

                                {/* Range and Unique Options in Edit Mode */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                                  {/* Unique Shielding Toggle */}
                                  <div className="flex items-center justify-between bg-[#0d1827] p-1.5 rounded-lg border border-[#334d6e]">
                                    <span className="text-[11px] text-slate-300 font-bold flex items-center gap-1">
                                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                                      <span>Blindaje / Diferencial</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEditingIsUnique(!editingIsUnique)}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                        editingIsUnique
                                          ? 'bg-amber-500/25 text-amber-300 border border-amber-400'
                                          : 'bg-[#192b45] text-slate-400 border border-[#334d6e]'
                                      }`}
                                    >
                                      {editingIsUnique ? 'Activo' : 'Inactivo'}
                                    </button>
                                  </div>

                                  {/* Work Range Toggle */}
                                  <div className="flex items-center justify-between bg-[#0d1827] p-1.5 rounded-lg border border-[#334d6e]">
                                    <span className="text-[11px] text-slate-300 font-bold flex items-center gap-1">
                                      <Sliders className={`w-3 h-3 ${editingHasWorkRange ? 'text-blue-400' : 'text-slate-400'}`} />
                                      <span>Rango Numérico</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = !editingHasWorkRange;
                                        setEditingHasWorkRange(next);
                                        if (next && !editingWorkRange) {
                                          const advice = getLiveDraftingAdvice(editingText);
                                          if (advice?.extractedRange) {
                                            setEditingWorkRange(advice.extractedRange.formatted);
                                          }
                                        }
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                        editingHasWorkRange
                                          ? 'bg-blue-500/25 text-blue-300 border border-blue-400'
                                          : 'bg-[#192b45] text-slate-400 border border-[#334d6e]'
                                      }`}
                                    >
                                      {editingHasWorkRange ? 'Con Rango' : 'Sin Rango'}
                                    </button>
                                  </div>
                                </div>

                                {/* Range Text Input (if enabled) */}
                                {editingHasWorkRange && (
                                  <div className="space-y-1 bg-[#0a1322] p-1.5 rounded-lg border border-blue-500/30 animate-fadeIn">
                                    <div className="flex items-center justify-between">
                                      <label className="text-[10px] text-blue-300 font-bold flex items-center gap-1">
                                        <Sliders className="w-2.5 h-2.5" />
                                        <span>Valor o Intervalo del Rango:</span>
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const advice = getLiveDraftingAdvice(editingText);
                                          if (advice?.extractedRange) {
                                            setEditingWorkRange(advice.extractedRange.formatted);
                                            showToast('✓ Rango extraído');
                                          }
                                        }}
                                        className="text-[9.5px] text-[var(--syd-accent)] hover:underline font-mono"
                                      >
                                        Auto-detectar
                                      </button>
                                    </div>
                                    <input
                                      type="text"
                                      placeholder="Ej: 15 a 300 lpm, 0 a 100%..."
                                      value={editingWorkRange}
                                      onChange={(e) => setEditingWorkRange(e.target.value)}
                                      className="w-full bg-[#111c2e] border border-blue-500/40 rounded p-1.5 text-[11px] text-blue-200 font-mono outline-none focus:border-blue-400"
                                    />
                                  </div>
                                )}

                                {/* Save and Cancel Buttons */}
                                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-[#334d6e]">
                                  <button
                                    type="button"
                                    onClick={handleCancelEditReq}
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-[#111c2e] transition cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditReq(item.id, req.id)}
                                    className="inline-flex items-center gap-1 bg-[var(--syd-accent)] hover:bg-[var(--syd-accent-light)] text-slate-950 font-black text-[11px] px-3 py-1 rounded-lg transition cursor-pointer shadow-xs active:scale-95"
                                  >
                                    <Check className="w-3 h-3 stroke-[3]" />
                                    <span>Guardar</span>
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={req.id}
                              className={`p-2 rounded-lg border transition flex items-start justify-between gap-2 text-[11px] ${
                                req.isUnique
                                  ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400'
                                  : 'bg-[#111c2e] border-[#334d6e] hover:border-purple-400/60'
                              }`}
                            >
                              <div className="flex items-start gap-2 flex-1 min-w-0">
                                {/* Position Reordering Controls */}
                                {!isReadOnly && (
                                  <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
                                    <button
                                      type="button"
                                      disabled={rIdx === 0}
                                      onClick={() => handleMoveRequirement(item, rIdx, 'up')}
                                      className={`p-0.5 rounded transition cursor-pointer ${
                                        rIdx === 0
                                          ? 'text-slate-600 cursor-not-allowed'
                                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                      }`}
                                      title="Subir posición de la especificación"
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <span className="font-mono text-slate-400 font-bold text-[9.5px]">
                                      #{rIdx + 1}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={rIdx === reqs.length - 1}
                                      onClick={() => handleMoveRequirement(item, rIdx, 'down')}
                                      className={`p-0.5 rounded transition cursor-pointer ${
                                        rIdx === reqs.length - 1
                                          ? 'text-slate-600 cursor-not-allowed'
                                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                      }`}
                                      title="Bajar posición de la especificación"
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}

                                {isReadOnly && (
                                  <span className="font-mono text-slate-400 font-bold text-[10px] mt-0.5 shrink-0">
                                    {rIdx + 1}.
                                  </span>
                                )}

                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {req.isUnique && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded">
                                        <ShieldCheck className="w-2.5 h-2.5 text-amber-400" />
                                        <span>BLINDAJE</span>
                                      </span>
                                    )}
                                    {req.workRange && (
                                      <span className="inline-flex items-center gap-0.5 text-[9.5px] font-mono text-blue-300 bg-blue-500/20 px-1 py-0.2 rounded border border-blue-500/30">
                                        <Sliders className="w-2 h-2 text-blue-400" />
                                        <span>Rango: {req.workRange}</span>
                                      </span>
                                    )}
                                    <span className="text-[9.5px] text-emerald-400 font-bold bg-emerald-500/10 px-1 py-0.2 rounded">
                                      ✓ Cumple
                                    </span>
                                  </div>

                                  <p className="text-slate-100 font-medium leading-relaxed text-[11.5px]">
                                    {cleanSpecText(req.requirement)}
                                  </p>
                                </div>
                              </div>

                              {!isReadOnly && (
                                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                  {/* Dedicated AI Wording Correction Button on each specification */}
                                  <button
                                    type="button"
                                    disabled={isThisOptimizing}
                                    onClick={() => handleCorrectSingleSpec(item, req)}
                                    className={`p-1 rounded-md transition cursor-pointer border flex items-center gap-1 ${
                                      isThisOptimizing
                                        ? 'bg-purple-600 text-white border-purple-400 animate-pulse'
                                        : 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border-purple-500/30'
                                    }`}
                                    title="Corregir redacción, sintaxis y formato técnico con IA"
                                  >
                                    {isThisOptimizing ? (
                                      <Loader2 className="w-3 h-3 animate-spin text-white" />
                                    ) : (
                                      <Sparkles className="w-3 h-3 text-purple-300" />
                                    )}
                                    <span className="text-[9.5px] font-bold hidden sm:inline">Corregir IA</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleStartEditReq(req)}
                                    className="p-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 transition cursor-pointer"
                                    title="Modificar texto manualmente"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      onUpdateRequirement(activeClient.id, item.id, req.id, {
                                        isUnique: !req.isUnique,
                                      })
                                    }
                                    className={`p-1 rounded-md border transition cursor-pointer ${
                                      req.isUnique
                                        ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                                        : 'bg-[#15253d] border-[#334d6e] text-slate-400 hover:text-amber-300'
                                    }`}
                                    title="Alternar blindaje técnico"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => onDeleteRequirement(activeClient.id, item.id, req.id)}
                                    className="p-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                                    title="Eliminar requisito"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Confirmación para Vaciar Especificaciones de un Equipo Específico */}
      {clearEquipmentTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#192b45] border border-rose-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <h3 className="text-base font-black text-white">¿Vaciar especificaciones del equipo?</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Se eliminarán todos los <strong className="text-rose-300">{(clearEquipmentTarget.requirements || []).length} requisitos técnicos</strong> de <strong className="text-white">"{clearEquipmentTarget.name}"</strong> para dejar su tabla de especificaciones completamente vacía y nueva.
                </p>
              </div>
            </div>

            <div className="bg-[#111c2e] p-3 rounded-xl border border-[#334d6e] text-[11px] text-slate-300">
              <p>✓ Podrá redactar nuevos requisitos manualmente o utilizar el botón "Generar con IA".</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#334d6e]">
              <button
                type="button"
                onClick={() => setClearEquipmentTarget(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClearEquipmentSpecs}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer shadow-lg active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Vaciar Especificaciones</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Vaciar Todas las Especificaciones del Proyecto */}
      {isConfirmClearAllSpecsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#192b45] border border-rose-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1 flex-1 min-w-0">
                <h3 className="text-base font-black text-white">¿Vaciar todas las especificaciones del proyecto?</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Se eliminarán los <strong className="text-rose-300">{totalSpecsCount} requisitos técnicos</strong> de los <strong className="text-white">{items.length} equipos</strong> de este contrato para dejar todas las tablas completamente limpias y nuevas.
                </p>
              </div>
            </div>

            <div className="bg-[#111c2e] p-3 rounded-xl border border-[#334d6e] text-[11px] text-slate-300">
              <p>✓ Esta acción dejará la tabla de especificaciones en blanco para todos los equipos.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#334d6e]">
              <button
                type="button"
                onClick={() => setIsConfirmClearAllSpecsModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAllSpecs}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer shadow-lg active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Vaciar Todo y Dejar Nuevo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


