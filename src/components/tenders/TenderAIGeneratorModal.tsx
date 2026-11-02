import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Check,
  Loader2,
  Sliders,
  ShieldCheck,
  Cpu,
  Plug,
  Package,
  FileText,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  Info,
  CheckSquare,
  Square,
} from 'lucide-react';
import { TenderItem, TechnicalRequirement } from '../../types';
import {
  generateCompleteEquipmentSpecificationsWithAI,
  GeneratedEquipmentSpec,
} from '../../utils/specOptimizer';

interface TenderAIGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipment: TenderItem | null;
  onApplySpecifications: (
    specs: { requirement: string; isUnique?: boolean; workRange?: string }[],
    mode: 'append' | 'replace'
  ) => void;
}

type GenerationFocus = 'all' | 'ranges' | 'shielding' | 'connectivity' | 'accessories' | 'custom';

export const TenderAIGeneratorModal: React.FC<TenderAIGeneratorModalProps> = ({
  isOpen,
  onClose,
  equipment,
  onApplySpecifications,
}) => {
  const [focus, setFocus] = useState<GenerationFocus>('all');
  const [customPrompt, setCustomPrompt] = useState('');
  const [specCount, setSpecCount] = useState<number>(8);
  const [isLoading, setIsLoading] = useState(false);
  const [generatedSpecs, setGeneratedSpecs] = useState<
    (GeneratedEquipmentSpec & { selected: boolean; isEditing?: boolean })[]
  >([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    if (isOpen && equipment) {
      // Auto generate on open if empty
      if (generatedSpecs.length === 0 && !hasGenerated) {
        handleGenerate('all', '', 8);
      }
    } else if (!isOpen) {
      setHasGenerated(false);
      setGeneratedSpecs([]);
      setCustomPrompt('');
      setFocus('all');
    }
  }, [isOpen, equipment]);

  if (!isOpen || !equipment) return null;

  const handleGenerate = async (
    currentFocus: GenerationFocus = focus,
    promptText: string = customPrompt,
    count: number = specCount
  ) => {
    setIsLoading(true);
    try {
      const result = await generateCompleteEquipmentSpecificationsWithAI(
        equipment.name,
        equipment.brand,
        equipment.model,
        {
          categoryFocus: currentFocus,
          customPrompt: currentFocus === 'custom' ? promptText : undefined,
          count,
        }
      );

      const items = (result.specs || []).map((s) => ({
        ...s,
        requirement: (s.requirement || '').replace(/^[⭐★*]\s*/, '').replace(/[⭐★]/g, ''),
        selected: true,
      }));

      setGeneratedSpecs(items);
      setHasGenerated(true);
    } catch (err) {
      console.error('Error generating AI specs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelect = (index: number) => {
    setGeneratedSpecs((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setGeneratedSpecs((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const handleUpdateSpecText = (index: number, text: string) => {
    setGeneratedSpecs((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              requirement: text.replace(/^[⭐★*]\s*/, '').replace(/[⭐★]/g, ''),
            }
          : item
      )
    );
  };

  const handleToggleUnique = (index: number) => {
    setGeneratedSpecs((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, isUnique: !item.isUnique } : item))
    );
  };

  const handleDeleteGenerated = (index: number) => {
    setGeneratedSpecs((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddNewBlankSpec = () => {
    setGeneratedSpecs((prev) => [
      ...prev,
      {
        requirement: '',
        isUnique: false,
        selected: true,
        isEditing: true,
      },
    ]);
  };

  const handleApply = (mode: 'append' | 'replace') => {
    const selected = generatedSpecs
      .filter((s) => s.selected && s.requirement.trim())
      .map((s) => ({
        requirement: s.requirement.trim().replace(/^[⭐★*]\s*/, '').replace(/[⭐★]/g, ''),
        isUnique: !!s.isUnique,
        workRange: s.workRange,
      }));

    if (selected.length === 0) return;

    onApplySpecifications(selected, mode);
    onClose();
  };

  const selectedCount = generatedSpecs.filter((s) => s.selected && s.requirement.trim()).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#111c2e] border border-[#334d6e] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="p-3.5 sm:p-4 bg-[#192b45] border-b border-[#334d6e] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-purple-600/25 border border-purple-500/40 text-purple-300">
              <Sparkles className="w-5 h-5 text-purple-300" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate flex items-center gap-2">
                <span>Generador Inteligente de Especificaciones con IA</span>
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                Equipo:{' '}
                <strong className="text-white font-bold">{equipment.name}</strong>
                {equipment.brand && ` • Marca: ${equipment.brand}`}
                {equipment.model && ` • Modelo: ${equipment.model}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 scrollbar-thin">
          {/* Preset Focus Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <span>Seleccione el Enfoque de Generación Biomédica:</span>
              <span className="text-purple-300 font-mono text-[10px] lowercase">
                motor gemini 2.5 flash
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFocus('all');
                  handleGenerate('all', customPrompt, specCount);
                }}
                className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 text-xs font-bold ${
                  focus === 'all'
                    ? 'bg-purple-600/25 border-purple-400 text-purple-200 shadow-xs'
                    : 'bg-[#15253d] border-[#334d6e] text-slate-300 hover:bg-[#192b45] hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                <div className="truncate">
                  <div className="font-black">Completas / Pliego</div>
                  <div className="text-[9.5px] text-slate-400 truncate">Estándar SECOP II</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFocus('ranges');
                  handleGenerate('ranges', customPrompt, specCount);
                }}
                className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 text-xs font-bold ${
                  focus === 'ranges'
                    ? 'bg-purple-600/25 border-purple-400 text-purple-200 shadow-xs'
                    : 'bg-[#15253d] border-[#334d6e] text-slate-300 hover:bg-[#192b45] hover:text-white'
                }`}
              >
                <Sliders className="w-4 h-4 text-[var(--syd-accent)] shrink-0" />
                <div className="truncate">
                  <div className="font-black">Parámetros & Rangos</div>
                  <div className="text-[9.5px] text-slate-400 truncate">Rangos numéricos holgados</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFocus('shielding');
                  handleGenerate('shielding', customPrompt, specCount);
                }}
                className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 text-xs font-bold ${
                  focus === 'shielding'
                    ? 'bg-purple-600/25 border-purple-400 text-purple-200 shadow-xs'
                    : 'bg-[#15253d] border-[#334d6e] text-slate-300 hover:bg-[#192b45] hover:text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="truncate">
                  <div className="font-black">Blindaje & Exclusivas</div>
                  <div className="text-[9.5px] text-slate-400 truncate">Tecnología diferencial</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFocus('connectivity');
                  handleGenerate('connectivity', customPrompt, specCount);
                }}
                className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 text-xs font-bold ${
                  focus === 'connectivity'
                    ? 'bg-purple-600/25 border-purple-400 text-purple-200 shadow-xs'
                    : 'bg-[#15253d] border-[#334d6e] text-slate-300 hover:bg-[#192b45] hover:text-white'
                }`}
              >
                <Plug className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="truncate">
                  <div className="font-black">Conectividad & Normas</div>
                  <div className="text-[9.5px] text-slate-400 truncate">HL7, DICOM, INVIMA, IEC</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFocus('accessories');
                  handleGenerate('accessories', customPrompt, specCount);
                }}
                className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 text-xs font-bold ${
                  focus === 'accessories'
                    ? 'bg-purple-600/25 border-purple-400 text-purple-200 shadow-xs'
                    : 'bg-[#15253d] border-[#334d6e] text-slate-300 hover:bg-[#192b45] hover:text-white'
                }`}
              >
                <Package className="w-4 h-4 text-amber-300 shrink-0" />
                <div className="truncate">
                  <div className="font-black">Accesorios & Módulos</div>
                  <div className="text-[9.5px] text-slate-400 truncate">Suministros y soportes</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFocus('custom')}
                className={`p-2 rounded-xl border text-left transition cursor-pointer flex items-center gap-2 text-xs font-bold ${
                  focus === 'custom'
                    ? 'bg-purple-600/25 border-purple-400 text-purple-200 shadow-xs'
                    : 'bg-[#15253d] border-[#334d6e] text-slate-300 hover:bg-[#192b45] hover:text-white'
                }`}
              >
                <Cpu className="w-4 h-4 text-pink-400 shrink-0" />
                <div className="truncate">
                  <div className="font-black">Solicitud Personalizada</div>
                  <div className="text-[9.5px] text-slate-400 truncate">Escribir prompt libre</div>
                </div>
              </button>
            </div>
          </div>

          {/* Custom Prompt Box */}
          {focus === 'custom' && (
            <div className="p-3 bg-[#15253d] border border-purple-400/50 rounded-xl space-y-2 animate-fadeIn">
              <label className="text-[11px] font-black text-purple-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span>Instrucción o requerimiento específico para la IA:</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customPrompt.trim()) {
                      handleGenerate('custom', customPrompt, specCount);
                    }
                  }}
                  placeholder="Ej: Generar especificaciones técnicas para UCI Neonatal con capnografía microstream y sensor Masimo..."
                  className="flex-1 bg-[#0d1827] border border-[#334d6e] focus:border-purple-400 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-400 outline-none"
                />
                <button
                  type="button"
                  disabled={isLoading || !customPrompt.trim()}
                  onClick={() => handleGenerate('custom', customPrompt, specCount)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
                    customPrompt.trim() && !isLoading
                      ? 'bg-[var(--syd-accent)] hover:bg-[var(--syd-accent-light)] text-slate-950 shadow-xs'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Generar</span>
                </button>
              </div>
            </div>
          )}

          {/* Controls Bar: Selection count, Regenerate & Add Manual */}
          <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-[#334d6e]/60 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSelectAll(selectedCount < generatedSpecs.length)}
                className="inline-flex items-center gap-1.5 text-slate-300 hover:text-white font-bold cursor-pointer"
              >
                {selectedCount === generatedSpecs.length && generatedSpecs.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-purple-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>
                  Seleccionar Todo ({selectedCount}/{generatedSpecs.length})
                </span>
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleAddNewBlankSpec}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#15253d] hover:bg-[#192b45] text-slate-300 hover:text-white border border-[#334d6e] transition cursor-pointer"
              >
                <Plus className="w-3 h-3 text-[var(--syd-accent)]" />
                <span>Añadir Fila</span>
              </button>

              <button
                type="button"
                disabled={isLoading}
                onClick={() => handleGenerate(focus, customPrompt, specCount)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 transition cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 text-purple-300 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Regenerar</span>
              </button>
            </div>
          </div>

          {/* Generated Specifications List */}
          {isLoading ? (
            <div className="py-12 text-center space-y-3 bg-[#0d1827] rounded-xl border border-[#334d6e]/50">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto" />
              <p className="text-xs font-bold text-white">
                Generando especificaciones técnicas con Inteligencia Artificial...
              </p>
              <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                Analizando estándares biomédicos, rangos holgados aprobados para SECOP II y blindaje de pliego.
              </p>
            </div>
          ) : generatedSpecs.length === 0 ? (
            <div className="py-10 text-center space-y-2 bg-[#0d1827] rounded-xl border border-[#334d6e]/50 text-slate-400 text-xs">
              <Info className="w-6 h-6 text-slate-400 mx-auto" />
              <p>No hay especificaciones generadas en este momento.</p>
              <button
                type="button"
                onClick={() => handleGenerate('all', '', specCount)}
                className="inline-flex items-center gap-1 bg-[var(--syd-accent)] text-slate-950 font-black text-xs px-3 py-1 rounded-lg"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Iniciar Generación</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {generatedSpecs.map((spec, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border transition-all space-y-1.5 ${
                    spec.selected
                      ? 'bg-[#15253d] border-[#334d6e] hover:border-purple-400/60'
                      : 'bg-[#0d1827]/70 border-[#334d6e]/40 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleToggleSelect(idx)}
                      className="mt-0.5 text-purple-400 hover:text-purple-300 transition cursor-pointer shrink-0"
                    >
                      {spec.selected ? (
                        <CheckSquare className="w-4 h-4 text-purple-400" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500" />
                      )}
                    </button>

                    <span className="font-mono text-[10px] font-bold text-slate-400 shrink-0 mt-0.5">
                      #{idx + 1}
                    </span>

                    <div className="flex-1 min-w-0 space-y-1">
                      <textarea
                        rows={2}
                        value={spec.requirement}
                        onChange={(e) => handleUpdateSpecText(idx, e.target.value)}
                        placeholder="Escriba o ajuste el requerimiento técnico..."
                        className="w-full bg-[#0d1827] border border-[#334d6e] focus:border-purple-400 rounded-lg p-2 text-xs text-white placeholder-slate-400 outline-none resize-none font-medium leading-relaxed"
                      />

                      <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {spec.workRange && (
                            <span className="text-[10px] font-mono bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30 flex items-center gap-1">
                              <Sliders className="w-2.5 h-2.5 text-blue-400" />
                              <span>Rango: {spec.workRange}</span>
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleUnique(idx)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer ${
                              spec.isUnique
                                ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                                : 'bg-[#0d1827] border-[#334d6e] text-slate-400 hover:text-white'
                            }`}
                            title="Marca como característica diferencial / blindaje para pliego"
                          >
                            <ShieldCheck className="w-3 h-3 text-amber-400" />
                            <span>{spec.isUnique ? 'Diferencial Activo' : 'Marcar Diferencial'}</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteGenerated(idx)}
                          className="text-slate-500 hover:text-red-400 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                          title="Eliminar de la lista generada"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-[#192b45] border-t border-[#334d6e] flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs text-slate-300">
            <span className="font-bold text-white">{selectedCount}</span> especificaciones seleccionadas
            {equipment.requirements?.length ? ` (El equipo ya tiene ${equipment.requirements.length})` : ''}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>

            {equipment.requirements && equipment.requirements.length > 0 && (
              <button
                type="button"
                disabled={selectedCount === 0 || isLoading}
                onClick={() => handleApply('replace')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  selectedCount > 0 && !isLoading
                    ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/40 shadow-xs'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                }`}
                title="Reemplaza todas las especificaciones actuales por las nuevas seleccionadas"
              >
                Reemplazar Todo ({selectedCount})
              </button>
            )}

            <button
              type="button"
              disabled={selectedCount === 0 || isLoading}
              onClick={() => handleApply('append')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition cursor-pointer shadow-lg active:scale-95 ${
                selectedCount > 0 && !isLoading
                  ? 'bg-[var(--syd-accent)] hover:bg-[var(--syd-accent-light)] text-slate-950 shadow-sky-500/20'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Añadir Especificaciones ({selectedCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
