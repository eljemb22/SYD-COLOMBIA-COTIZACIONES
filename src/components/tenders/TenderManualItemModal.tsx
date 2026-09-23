import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  X,
  Save,
  Stethoscope,
  Sparkles,
  Wand2,
  Sliders,
  Star,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  PackageCheck,
  Lightbulb,
  Globe,
  CheckCircle2,
  ArrowRightLeft,
  ArrowDown,
  ArrowUp,
  Boxes,
} from 'lucide-react';
import { TenderItem, TechnicalRequirement, MedicalEquipment } from '../../types';
import { formatCOP } from '../../utils/formatters';
import { findCatalogDuplicate } from '../../utils/catalogSyncUtils';
import {
  STANDARD_BIOMEDICAL_WORK_RANGES,
  getLiveDraftingAdvice,
  optimizeTechnicalSpecification,
  generateCompleteEquipmentSpecificationsWithAI,
  getGenericSpecificationsForEquipment,
  detectNumericalValuesInSpec,
  convertSpecToRangeVariant,
  getOptionalAccessoriesSuggestions,
  getAvailableSuggestionsForSpec,
  DEFAULT_OPTIONAL_ACCESSORIES,
  BiomedicalRangePreset,
  RangeVariants,
} from '../../utils/specOptimizer';

interface SpecItemState {
  id: string;
  requirement: string;
  isUnique: boolean;
  workRange?: string;
  hasWorkRange?: boolean;
  rangeVariants?: RangeVariants;
  activeRangeStyle?: 'between' | 'min' | 'max' | 'fixed' | 'custom';
  isOptimizing?: boolean;
}

interface TenderManualItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItem: (item: TenderItem, createNewDuplicate?: boolean) => void;
  itemsCount: number;
  catalogEquipments?: MedicalEquipment[];
}

const COMMON_BRANDS = [
  'Mindray',
  'COMEN',
  'GE Healthcare',
  'Philips',
  'Welch Allyn',
  'Nihon Kohden',
  'SonoScape',
  'Edan',
  'Draeger',
  'Bovie',
  'Meditech',
  'Zoll',
];

export const TenderManualItemModal: React.FC<TenderManualItemModalProps> = ({
  isOpen,
  onClose,
  onAddItem,
  itemsCount,
  catalogEquipments = [],
}) => {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [offeredUnitPrice, setOfferedUnitPrice] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0.19); // 19% IVA estándar en Colombia
  const [isPricingExpanded, setIsPricingExpanded] = useState<boolean>(true);
  const [createAsIndependentVariant, setCreateAsIndependentVariant] = useState<boolean>(false);

  // Individual Specifications List - Starts empty until user types or generates
  const [specs, setSpecs] = useState<SpecItemState[]>([]);

  const [newSpecText, setNewSpecText] = useState('');
  const [newSpecIsUnique, setNewSpecIsUnique] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [aiSuggestionsPool, setAiSuggestionsPool] = useState<SpecItemState[]>([]);

  // Optional/Additional Accessories (starts completely empty)
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [customAccessoryInput, setCustomAccessoryInput] = useState('');
  const [suggestedAccessories, setSuggestedAccessories] = useState<string[]>([]);

  // Debounce ref to avoid spamming Gemini while typing
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastGeneratedKeyRef = useRef<string>('');
  const [activeRangeDropdownSpecId, setActiveRangeDropdownSpecId] = useState<string | null>(null);
  const [activeSuggestionsSpecId, setActiveSuggestionsSpecId] = useState<string | null>(null);

  // When modal opens/closes, reset or initialize
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setBrand('');
      setModel('');
      setQuantity(1);
      setOfferedUnitPrice(0);
      setTaxRate(0.19);
      setCreateAsIndependentVariant(false);
      setSpecs([]);
      setSelectedAccessories([]);
      setCustomAccessoryInput('');
      setSuggestedAccessories([]);
      setAiSuggestionsPool([]);
      setActiveRangeDropdownSpecId(null);
      setActiveSuggestionsSpecId(null);
      lastGeneratedKeyRef.current = '';
    }
  }, [isOpen]);

  // Duplicate detection against Catalog (Window 3)
  const duplicateInfo = findCatalogDuplicate({ name, brand, model }, catalogEquipments);


  // Automatic online AI specs fetch when user enters equipment name, brand and model
  const handleAutoFetchSpecs = async (equipmentName: string, equipmentBrand?: string, equipmentModel?: string) => {
    const cleanName = equipmentName.trim();
    const cleanBrand = (equipmentBrand ?? brand).trim();
    const cleanModel = (equipmentModel ?? model).trim();

    if (!cleanName || cleanName.length < 3) {
      return;
    }

    const currentKey = `${cleanName.toLowerCase()}::${cleanBrand.toLowerCase()}::${cleanModel.toLowerCase()}`;
    if (currentKey === lastGeneratedKeyRef.current) {
      return;
    }

    setIsGeneratingAll(true);
    lastGeneratedKeyRef.current = currentKey;

    try {
      const result = await generateCompleteEquipmentSpecificationsWithAI(
        cleanName,
        cleanBrand,
        cleanModel
      );

      if (result && result.specs && result.specs.length > 0) {
        const formattedSpecs: SpecItemState[] = result.specs.map((g, idx) => {
          const numAnalysis = detectNumericalValuesInSpec(g.requirement);
          const hasNumeric = g.hasWorkRange !== undefined ? g.hasWorkRange : numAnalysis.hasNumeric;
          return {
            id: `spec-ai-${Date.now()}-${idx}`,
            requirement: g.requirement,
            // Per user request: specifications must NOT be marked as unique automatically.
            // The user marks unique/blindaje manually.
            isUnique: false,
            hasWorkRange: hasNumeric,
            workRange: g.workRange || numAnalysis.workRange,
            rangeVariants: g.rangeVariants || numAnalysis.variants,
            activeRangeStyle: 'between',
          };
        });

        // Set the primary specifications
        setSpecs(formattedSpecs);

        // Also populate suggestions pool
        const genericList = getGenericSpecificationsForEquipment(cleanName, cleanBrand, cleanModel);
        const poolItems: SpecItemState[] = genericList.map((g, idx) => {
          const numAnalysis = detectNumericalValuesInSpec(g.requirement);
          const hasNumeric = g.hasWorkRange !== undefined ? g.hasWorkRange : numAnalysis.hasNumeric;
          return {
            id: `sug-pool-${Date.now()}-${idx}`,
            requirement: g.requirement,
            isUnique: false,
            hasWorkRange: hasNumeric,
            workRange: g.workRange || numAnalysis.workRange,
            rangeVariants: g.rangeVariants || numAnalysis.variants,
            activeRangeStyle: 'between',
          };
        });
        setAiSuggestionsPool(poolItems);
      }

      // Update suggested optional accessories for this equipment
      if (result && result.optionalAccessories && result.optionalAccessories.length > 0) {
        setSuggestedAccessories(result.optionalAccessories);
      } else {
        setSuggestedAccessories(getOptionalAccessoriesSuggestions(cleanName));
      }
    } catch (err) {
      console.warn('Error fetching automatic specs:', err);
      const fallback = getGenericSpecificationsForEquipment(cleanName, cleanBrand, cleanModel);
      const formattedFallback: SpecItemState[] = fallback.map((g, idx) => {
        const numAnalysis = detectNumericalValuesInSpec(g.requirement);
        const hasNumeric = g.hasWorkRange !== undefined ? g.hasWorkRange : numAnalysis.hasNumeric;
        return {
          id: `spec-fb-${Date.now()}-${idx}`,
          requirement: g.requirement,
          isUnique: false,
          hasWorkRange: hasNumeric,
          workRange: g.workRange || numAnalysis.workRange,
          rangeVariants: g.rangeVariants || numAnalysis.variants,
          activeRangeStyle: 'between',
        };
      });
      setSpecs(formattedFallback);
      setSuggestedAccessories(getOptionalAccessoriesSuggestions(cleanName));
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // Helper to trigger automatic specs fetch when Name, Brand and Model are filled
  const checkAndTriggerAutoFetch = (curName: string, curBrand: string, curModel: string) => {
    const cName = curName.trim();
    const cBrand = curBrand.trim();
    const cModel = curModel.trim();

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (cName.length >= 3 && cBrand.length >= 2 && cModel.length >= 1) {
      const key = `${cName.toLowerCase()}::${cBrand.toLowerCase()}::${cModel.toLowerCase()}`;
      if (key !== lastGeneratedKeyRef.current) {
        debounceTimerRef.current = setTimeout(() => {
          handleAutoFetchSpecs(cName, cBrand, cModel);
        }, 750);
      }
    }
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    checkAndTriggerAutoFetch(newName, brand, model);
  };

  const handleBrandChange = (newBrand: string) => {
    setBrand(newBrand);
    checkAndTriggerAutoFetch(name, newBrand, model);
  };

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    checkAndTriggerAutoFetch(name, brand, newModel);
  };

  // Move specification up or down in the list
  const handleMoveSpec = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === specs.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    setSpecs((prev) => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[targetIndex];
      updated[targetIndex] = temp;
      return updated;
    });
  };

  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const liveAdvice = getLiveDraftingAdvice(newSpecText);
  const newSpecNumAnalysis = detectNumericalValuesInSpec(newSpecText);

  // Add individual new spec manually or from suggestion
  const handleAddNewSpec = (
    customText?: string,
    isUniqueCustom?: boolean,
    customRange?: string,
    variantsCustom?: RangeVariants
  ) => {
    const textToAdd = (customText ?? newSpecText).trim();
    if (!textToAdd) return;

    const numAnalysis = detectNumericalValuesInSpec(textToAdd);
    const hasNumeric = numAnalysis.hasNumeric;

    const item: SpecItemState = {
      id: `spec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      requirement: textToAdd,
      isUnique: isUniqueCustom ?? newSpecIsUnique,
      hasWorkRange: hasNumeric,
      workRange: customRange || numAnalysis.workRange,
      rangeVariants: variantsCustom || numAnalysis.variants,
      activeRangeStyle: 'between',
    };

    setSpecs((prev) => [...prev, item]);
    if (!customText) {
      setNewSpecText('');
      setNewSpecIsUnique(false);
    }
  };

  // Manually toggle range mode on or off for a specific spec
  const handleToggleSpecRange = (specId: string) => {
    setSpecs((prev) =>
      prev.map((s) => {
        if (s.id !== specId) return s;
        const numAnalysis = detectNumericalValuesInSpec(s.requirement);
        const currentActive = s.hasWorkRange !== undefined ? s.hasWorkRange : numAnalysis.hasNumeric;
        const nextActive = !currentActive;

        return {
          ...s,
          hasWorkRange: nextActive,
          workRange: nextActive ? (s.workRange || numAnalysis.workRange) : undefined,
          activeRangeStyle: nextActive ? (s.activeRangeStyle || 'between') : undefined,
        };
      })
    );
  };

  // Convert an existing specification to a specific range style
  const handleSwitchRangeStyle = (
    specId: string,
    style: 'between' | 'min' | 'max' | 'fixed'
  ) => {
    setSpecs((prev) =>
      prev.map((s) => {
        if (s.id !== specId) return s;

        // If range variants exist, use them
        if (s.rangeVariants && s.rangeVariants[style]) {
          return {
            ...s,
            requirement: s.rangeVariants[style]!,
            activeRangeStyle: style,
          };
        }

        // Programmatically convert with range converter
        const converted = convertSpecToRangeVariant(s.requirement, style);
        const analysis = detectNumericalValuesInSpec(converted);
        return {
          ...s,
          requirement: converted,
          rangeVariants: s.rangeVariants || analysis.variants,
          activeRangeStyle: style,
        };
      })
    );
  };

  // Optimize individual spec text with AI while strictly preserving ranges and formatting
  const handleOptimizeSingleSpec = async (specId: string) => {
    const current = specs.find((s) => s.id === specId);
    if (!current || !current.requirement.trim()) return;

    setSpecs((prev) =>
      prev.map((s) => (s.id === specId ? { ...s, isOptimizing: true } : s))
    );

    try {
      const result = await optimizeTechnicalSpecification(
        current.requirement,
        name,
        brand,
        model
      );

      const targetStyle: 'between' | 'min' | 'max' | 'fixed' =
        current.activeRangeStyle === 'min' ||
        current.activeRangeStyle === 'max' ||
        current.activeRangeStyle === 'fixed'
          ? current.activeRangeStyle
          : 'between';

      // Gather detected variants from result text
      const detectedAnalysis = detectNumericalValuesInSpec(
        result.rangeVersion || result.optimized || current.requirement
      );

      const combinedVariants: RangeVariants = {
        ...(detectedAnalysis.variants || {}),
        ...(result.rangeVariants || {}),
        ...(current.rangeVariants || {}),
      };

      // Select requirement text based on activeRangeStyle
      let chosenText = result.optimized || result.formal || current.requirement;
      if (combinedVariants && combinedVariants[targetStyle]) {
        chosenText = combinedVariants[targetStyle]!;
      } else if (result.rangeVersion && targetStyle === 'between') {
        chosenText = result.rangeVersion;
      } else {
        chosenText = convertSpecToRangeVariant(
          result.rangeVersion || result.optimized || current.requirement,
          targetStyle
        );
      }

      const numAnalysis = detectNumericalValuesInSpec(chosenText);
      const hasNumeric =
        result.isParametricSpec !== undefined
          ? Boolean(result.isParametricSpec)
          : (current.hasWorkRange !== undefined ? current.hasWorkRange : numAnalysis.hasNumeric);
      const uniqueFlag = current.isUnique; // Respect user manual choice for blindaje

      setSpecs((prev) =>
        prev.map((s) =>
          s.id === specId
            ? {
                ...s,
                requirement: chosenText,
                isUnique: uniqueFlag,
                hasWorkRange: hasNumeric,
                workRange:
                  result.detectedWorkRange ||
                  numAnalysis.workRange ||
                  current.workRange,
                rangeVariants: combinedVariants,
                activeRangeStyle: targetStyle,
                isOptimizing: false,
              }
            : s
        )
      );
    } catch (e) {
      console.error(e);
      setSpecs((prev) =>
        prev.map((s) => (s.id === specId ? { ...s, isOptimizing: false } : s))
      );
    }
  };

  // Apply a standard biomedical range preset directly to a specific spec
  const handleApplyPresetToSpec = (specId: string, preset: BiomedicalRangePreset) => {
    const numAnalysis = detectNumericalValuesInSpec(preset.exampleSpec);
    setSpecs((prev) =>
      prev.map((s) =>
        s.id === specId
          ? {
              ...s,
              requirement: preset.exampleSpec,
              hasWorkRange: true,
              workRange: `${preset.defaultMin} a ${preset.defaultMax} ${preset.unit}`,
              rangeVariants: numAnalysis.variants,
              activeRangeStyle: 'between',
            }
          : s
      )
    );
    setActiveRangeDropdownSpecId(null);
  };

  // Apply an alternative suggestion to a specific spec
  const handleApplySuggestionToSpec = (
    specId: string,
    suggestionText: string,
    workRange?: string,
    variants?: RangeVariants
  ) => {
    const numAnalysis = detectNumericalValuesInSpec(suggestionText);
    setSpecs((prev) =>
      prev.map((s) =>
        s.id === specId
          ? {
              ...s,
              requirement: suggestionText,
              hasWorkRange: Boolean(workRange || numAnalysis.hasNumeric),
              workRange: workRange || numAnalysis.workRange,
              rangeVariants: variants || numAnalysis.variants,
              activeRangeStyle: suggestionText.toLowerCase().includes('entre') ? 'between' : 'between',
            }
          : s
      )
    );
    setActiveSuggestionsSpecId(null);
  };

  // Manual & quick add for optional accessories
  const handleAddCustomAccessory = () => {
    const clean = customAccessoryInput.trim();
    if (!clean) return;
    if (!selectedAccessories.includes(clean)) {
      setSelectedAccessories((prev) => [...prev, clean]);
    }
    setCustomAccessoryInput('');
  };

  const handleToggleAccessory = (accText: string) => {
    const clean = accText.trim();
    if (!clean) return;
    setSelectedAccessories((prev) =>
      prev.includes(clean) ? prev.filter((a) => a !== clean) : [...prev, clean]
    );
  };

  // Handle Form Submission
  const handleSaveItem = (closeAfter: boolean) => {
    if (!name.trim()) return;

    // Convert specs state to TechnicalRequirement array
    const finalRequirements: TechnicalRequirement[] = specs
      .filter((s) => s.requirement.trim().length > 0)
      .map((s, idx) => {
        const numAnalysis = detectNumericalValuesInSpec(s.requirement);
        return {
          id: `req-man-${Date.now()}-${idx}`,
          requirement: s.requirement.trim(),
          isUnique: s.isUnique,
          hasWorkRange: Boolean(s.hasWorkRange || numAnalysis.hasNumeric),
          workRange: s.workRange || numAnalysis.workRange,
          complies: true,
          folioRef: `Folio ${10 + idx * 2}`,
        };
      });

    // If optional accessories were selected, append a formal technical requirement row
    if (selectedAccessories.length > 0) {
      finalRequirements.push({
        id: `req-acc-${Date.now()}`,
        requirement: `Accesorios y módulos adicionales incluidos: ${selectedAccessories.join('; ')}`,
        isUnique: false,
        complies: true,
        folioRef: `Folio ${10 + finalRequirements.length * 2}`,
      });
    }

    const newItem: TenderItem = {
      id: `tend-man-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      itemNumber: itemsCount + 1,
      equipmentId: `eq-man-${Date.now()}`,
      code: `EQ-MAN-${itemsCount + 1}`,
      name: name.trim(),
      brand: brand.trim() || 'Biomédico',
      model: model.trim() || 'Estándar',
      originCountry: 'Colombia',
      quantity: Number(quantity) || 1,
      unitEstimatedBudget: Math.round((Number(offeredUnitPrice) || 1000000) * 1.15),
      offeredUnitPrice: Number(offeredUnitPrice) || 1000000,
      invimaRecord: 'Vigente',
      warrantyMonths: 24,
      deliveryTimeDays: 15,
      selected: true,
      observations:
        selectedAccessories.length > 0
          ? `Accesorios adicionales: ${selectedAccessories.join(', ')}`
          : 'Cumple con los requerimientos técnicos del contrato.',
      requirements: finalRequirements,
    };

    onAddItem(newItem, createAsIndependentVariant);

    if (closeAfter) {
      onClose();
    } else {
      // Reset form to quickly add another item
      setName('');
      setBrand('');
      setModel('');
      setQuantity(1);
      setOfferedUnitPrice(0);
      setSpecs([]);
      setSelectedAccessories([]);
      setNewSpecText('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveItem(true);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-[#192b45] border border-purple-400/60 rounded-2xl max-w-5xl lg:max-w-6xl w-full shadow-2xl animate-scaleUp max-h-[90vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-4 py-3 border-b border-[#334d6e] flex items-center justify-between gap-3 bg-[#142338] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate">
                Crear Equipo Directo en el Contrato
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                Búsqueda automática de especificaciones con IA, rangos numéricos y módulos opcionales
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#334d6e] rounded-lg transition cursor-pointer flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">Cerrar</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 text-xs scrollbar-thin bg-[#15253d]">
            {/* Section 1: Datos Principales del Equipo */}
            <div className="bg-[#111c2e] p-3 rounded-xl border border-[#334d6e] space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                {/* Nombre del Equipo */}
                <div className="sm:col-span-12">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <label className="block text-slate-200 font-bold">
                      Nombre del Equipo Biomédico *
                    </label>
                    <span className="text-[10px] text-sky-400 flex items-center gap-1 font-medium">
                      <Globe className="w-3 h-3 text-sky-400" />
                      <span>Búsqueda automática en Internet al completar Nombre, Marca y Modelo</span>
                    </span>
                  </div>

                  <input
                    type="text"
                    required
                    placeholder="Ej: Monitor de Signos Vitales 5 Parámetros / Electrocardiógrafo Digital / Desfibrilador"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={() => {
                      if (name.trim().length >= 3 && brand.trim().length >= 2 && model.trim().length >= 1) {
                        handleAutoFetchSpecs(name, brand, model);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (name.trim().length >= 3) {
                          handleAutoFetchSpecs(name, brand, model);
                        }
                      }
                    }}
                    className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-purple-400 text-xs sm:text-sm"
                  />
                </div>

                {/* Marca / Fabricante */}
                <div className="sm:col-span-5">
                  <label className="block text-slate-300 font-bold mb-1">Marca / Fabricante</label>
                  <input
                    type="text"
                    list="brand-suggestions-list"
                    placeholder="Ej: Mindray, GE, Philips..."
                    value={brand}
                    onChange={(e) => handleBrandChange(e.target.value)}
                    onBlur={() => {
                      if (name.trim().length >= 3 && brand.trim().length >= 2 && model.trim().length >= 1) {
                        handleAutoFetchSpecs(name, brand, model);
                      }
                    }}
                    className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl px-2.5 py-1.5 text-white outline-none focus:border-purple-400 text-xs"
                  />
                  <datalist id="brand-suggestions-list">
                    {COMMON_BRANDS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                {/* Modelo */}
                <div className="sm:col-span-5">
                  <label className="block text-slate-300 font-bold mb-1">Modelo</label>
                  <input
                    type="text"
                    placeholder="Ej: iMEC12 / BeneHeart R12 / Platinum"
                    value={model}
                    onChange={(e) => handleModelChange(e.target.value)}
                    onBlur={() => {
                      if (name.trim().length >= 3 && brand.trim().length >= 2 && model.trim().length >= 1) {
                        handleAutoFetchSpecs(name, brand, model);
                      }
                    }}
                    className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl px-2.5 py-1.5 text-white outline-none focus:border-purple-400 text-xs"
                  />
                </div>

                {/* Cantidad */}
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-bold mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl px-2.5 py-1.5 text-white font-bold outline-none focus:border-purple-400 text-xs text-center"
                  />
                </div>
              </div>

              {/* Duplicate Detection Feedback Banner against Catalog (Window 3) */}
              {duplicateInfo.isDuplicate && duplicateInfo.matchedEquipment && (
                <div className="bg-amber-950/30 border border-amber-500/50 rounded-xl p-2.5 space-y-1.5 animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-400 text-sm mt-0.5">🔄</span>
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-amber-300">
                        Equipo coincidente detectado en Catálogo de Equipos:
                      </p>
                      <p className="text-[10.5px] text-slate-300">
                        <strong>{duplicateInfo.matchedEquipment.name}</strong> ({duplicateInfo.matchedEquipment.brand} - {duplicateInfo.matchedEquipment.model})
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Por defecto, al guardar se sincronizará y actualizarán sus especificaciones en el Catálogo.
                      </p>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 pt-1 border-t border-amber-500/20 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={createAsIndependentVariant}
                      onChange={(e) => setCreateAsIndependentVariant(e.target.checked)}
                      className="rounded accent-amber-400 w-3.5 h-3.5"
                    />
                    <span className="text-[10.5px] text-amber-200 font-medium">
                      Crear como nueva variante independiente (sin sobreescribir el equipo existente en Catálogo)
                    </span>
                  </label>
                </div>
              )}

              {/* Subpanel de Precios Desplegable y Compacto */}
              <div className="mt-2.5 border border-[#1e3453] bg-[#0c1626]/90 rounded-xl overflow-hidden transition-all">
                {/* Encabezado Desplegable (Clic para abrir / cerrar) */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsPricingExpanded((prev) => !prev)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setIsPricingExpanded((prev) => !prev);
                    }
                  }}
                  className="w-full px-3 py-2 flex items-center justify-between gap-2 hover:bg-[#13233a] cursor-pointer transition select-none"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <span className="text-emerald-400">💰</span>
                      Precios y Liquidación de Impuestos
                    </span>
                    {!isPricingExpanded && (
                      <div className="flex items-center gap-2 text-[10.5px]">
                        <span className="bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded font-mono font-semibold border border-emerald-500/30">
                          Unit: {formatCOP(offeredUnitPrice || 0)}
                        </span>
                        <span className="bg-sky-500/15 text-sky-300 px-2 py-0.5 rounded font-mono font-semibold border border-sky-500/30">
                          Total c/IVA: {formatCOP(Math.round((offeredUnitPrice || 0) * quantity * (1 + taxRate)))}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isPricingExpanded && (
                      <div
                        className="flex items-center gap-1 bg-[#15253d] p-0.5 rounded-lg border border-[#2d4363]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-[10px] text-slate-400 font-semibold px-1">IVA:</span>
                        {[
                          { label: '19%', val: 0.19 },
                          { label: '5%', val: 0.05 },
                          { label: '0%', val: 0 },
                        ].map((t) => (
                          <button
                            key={t.val}
                            type="button"
                            onClick={() => setTaxRate(t.val)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                              taxRate === t.val
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className="p-1 text-slate-400 hover:text-white transition rounded"
                      title={isPricingExpanded ? 'Plegar sección' : 'Expandir sección'}
                    >
                      {isPricingExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-300" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Contenido Expandido */}
                {isPricingExpanded && (
                  <div className="p-2.5 pt-1.5 border-t border-[#1e3453]/60 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      {/* Precio Unitario de Venta / Contrato (Sin IVA) */}
                      <div className="sm:col-span-6 bg-[#13233a] p-2 rounded-lg border border-emerald-500/30">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10.5px] font-bold text-emerald-300">
                            Precio Unit. Contrato (Sin IVA) *
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatCOP(offeredUnitPrice || 0)}
                          </span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Ej: 14500000"
                          value={offeredUnitPrice || ''}
                          onChange={(e) => setOfferedUnitPrice(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full bg-[#0a1322] border border-emerald-500/50 rounded-md px-2.5 py-1 text-emerald-300 font-mono font-bold outline-none focus:border-emerald-400 text-xs"
                        />
                      </div>

                      {/* Precio Unitario con IVA Incluido */}
                      <div className="sm:col-span-6 bg-[#13233a] p-2 rounded-lg border border-sky-500/30">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10.5px] font-bold text-sky-300 flex items-center gap-1">
                            <span>Precio Unit. con IVA Incluido</span>
                            <span className="bg-sky-500/20 text-sky-300 text-[8.5px] px-1 py-0.2 rounded border border-sky-400/30 font-semibold">
                              +{Math.round(taxRate * 100)}% IVA
                            </span>
                          </label>
                          <span className="text-[10px] text-slate-400 font-mono font-bold">
                            {formatCOP(Math.round((offeredUnitPrice || 0) * (1 + taxRate)))}
                          </span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Calculado automáticamente"
                          value={Math.round((offeredUnitPrice || 0) * (1 + taxRate)) || ''}
                          onChange={(e) => {
                            const withTax = Math.max(0, parseInt(e.target.value) || 0);
                            const base = taxRate > 0 ? Math.round(withTax / (1 + taxRate)) : withTax;
                            setOfferedUnitPrice(base);
                          }}
                          className="w-full bg-[#0a1322] border border-sky-500/50 rounded-md px-2.5 py-1 text-sky-300 font-mono font-bold outline-none focus:border-sky-400 text-xs"
                        />
                      </div>
                    </div>

                    {/* Resumen Totalizador Compacto */}
                    <div className="bg-[#101b2c] px-2.5 py-1.5 rounded-lg border border-[#213753] flex flex-wrap items-center justify-between gap-1.5 text-[10.5px]">
                      <span className="text-slate-300">
                        Total <strong className="text-white">{quantity}</strong> ud{quantity > 1 ? 's' : ''}:
                      </span>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 font-mono">
                        <span className="text-slate-300">
                          Subtotal: <strong className="text-emerald-400">{formatCOP((offeredUnitPrice || 0) * quantity)}</strong>
                        </span>
                        <span className="text-slate-500">|</span>
                        <span className="text-slate-300">
                          IVA ({Math.round(taxRate * 100)}%): <strong className="text-amber-400">{formatCOP(Math.round((offeredUnitPrice || 0) * quantity * taxRate))}</strong>
                        </span>
                        <span className="text-slate-500">|</span>
                        <span className="text-slate-300">
                          Total c/IVA: <strong className="text-sky-300 font-bold">{formatCOP(Math.round((offeredUnitPrice || 0) * quantity * (1 + taxRate)))}</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI Searching & Status Banner */}
            {isGeneratingAll && (
              <div className="bg-purple-950/40 border border-purple-500/50 rounded-xl p-3 flex items-center gap-3 animate-pulse">
                <Loader2 className="w-5 h-5 animate-spin text-purple-300 shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-purple-200">
                    Buscando ficha técnica en Internet y generando especificaciones con rangos...
                  </p>
                  <p className="text-[10.5px] text-purple-300">
                    Extrayendo parámetros biomédicos (SpO2, FC, NIBP, potencias, etc.) y módulos opcionales.
                  </p>
                </div>
              </div>
            )}

            {/* Section 2: Especificaciones Técnicas Individuales */}
            <div className="bg-[#111c2e] p-3 rounded-xl border border-purple-500/40 space-y-3">
              {/* Specs Header */}
              <div className="flex items-center justify-between gap-2 border-b border-[#334d6e] pb-2">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span className="text-white font-bold text-xs sm:text-sm">
                    Especificaciones Técnicas ({specs.length})
                  </span>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-bold border border-purple-500/30">
                    Cuadros Individuales
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Reordene, modifique rangos y mejore en cada cuadro
                </span>
              </div>

              {/* Quick Add Bar for New Specification */}
              <div className="bg-[#15253d] p-2.5 rounded-xl border border-[#334d6e] space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Escriba una nueva especificación (ej: Frecuencia cardíaca de 15 a 300 lpm, Pantalla táctil 12 pulgadas)..."
                    value={newSpecText}
                    onChange={(e) => setNewSpecText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddNewSpec();
                      }
                    }}
                    className="flex-1 bg-[#111c2e] border border-[#334d6e] focus:border-purple-400 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-400 outline-none"
                  />

                  <button
                    type="button"
                    onClick={() => setNewSpecIsUnique(!newSpecIsUnique)}
                    className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer shrink-0 ${
                      newSpecIsUnique
                        ? 'bg-amber-500/25 border-amber-400 text-amber-300'
                        : 'bg-[#111c2e] border-[#334d6e] text-slate-400 hover:text-white'
                    }`}
                    title="Marcar como característica única / blindaje de pliego (Manual)"
                  >
                    <Star className={`w-3 h-3 ${newSpecIsUnique ? 'fill-amber-400 text-amber-400' : ''}`} />
                    <span className="hidden sm:inline">Blindaje</span>
                  </button>

                  <button
                    type="button"
                    disabled={!newSpecText.trim()}
                    onClick={() => handleAddNewSpec()}
                    className="inline-flex items-center gap-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </div>

                {/* Range Format Selector for Specifications with Values while Typing */}
                {newSpecNumAnalysis.hasNumeric && (
                  <div className="flex items-center justify-between gap-2 bg-sky-950/30 border border-sky-500/30 rounded-lg px-2.5 py-1 text-[11px]">
                    <div className="flex items-center gap-1.5 text-sky-300">
                      <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>
                        Parámetro numérico detectado:{' '}
                        <strong className="text-white">{newSpecNumAnalysis.workRange || 'Valor medible'}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 mr-1 hidden sm:inline">Formato:</span>
                      <button
                        type="button"
                        onClick={() => setNewSpecText((prev) => convertSpecToRangeVariant(prev, 'between'))}
                        className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-[10px] font-medium border border-sky-500/30 cursor-pointer"
                        title="Formato de rango amplio: Entre X a Y"
                      >
                        ↔️ Entre
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewSpecText((prev) => convertSpecToRangeVariant(prev, 'min'))}
                        className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-[10px] font-medium border border-sky-500/30 cursor-pointer"
                        title="Formato de exigencia mínima: Mínimo X"
                      >
                        ⬇️ Mínimo
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewSpecText((prev) => convertSpecToRangeVariant(prev, 'max'))}
                        className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-[10px] font-medium border border-sky-500/30 cursor-pointer"
                        title="Formato de límite superior: Máximo hasta Y"
                      >
                        ⬆️ Máximo
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewSpecText((prev) => convertSpecToRangeVariant(prev, 'fixed'))}
                        className="px-1.5 py-0.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 text-[10px] font-medium border border-sky-500/30 cursor-pointer"
                        title="Formato de valor definido: Sin rangos"
                      >
                        🎯 Fijo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic List of Individual Specification Boxes */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 scrollbar-thin">
                {specs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400 bg-[#15253d] rounded-xl border border-dashed border-[#334d6e] space-y-1.5">
                    <p className="font-semibold text-slate-300">
                      No hay especificaciones técnicas añadidas aún.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Escriba el Nombre, Marca y Modelo arriba para buscarlas en Internet automáticamente o ingréselas manualmente.
                    </p>
                  </div>
                ) : (
                  (() => {
                    const availableSuggestions = getAvailableSuggestionsForSpec(
                      specs,
                      name,
                      brand,
                      model,
                      aiSuggestionsPool
                    );

                    return specs.map((spec, sIdx) => {
                      const numAnalysis = detectNumericalValuesInSpec(spec.requirement);
                      const hasValues = spec.hasWorkRange !== undefined ? spec.hasWorkRange : numAnalysis.hasNumeric;
                      const isRangeOpen = activeRangeDropdownSpecId === spec.id;
                      const isSugOpen = activeSuggestionsSpecId === spec.id;

                      return (
                        <div
                          key={spec.id}
                          className={`p-2.5 rounded-xl border transition space-y-2 relative ${
                            spec.isUnique
                              ? 'bg-amber-950/20 border-amber-500/40 shadow-xs'
                              : 'bg-[#15253d] border-[#334d6e]'
                          }`}
                        >
                          {/* Spec Card Toolbar */}
                          <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            {/* Left Side: Order & Unique & Range Toggle */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Position Index */}
                              <span className="w-5 h-5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                                {sIdx + 1}
                              </span>

                              {/* Reorder Buttons (Up / Down) */}
                              <div className="flex items-center bg-[#111c2e] rounded border border-[#334d6e] p-0.5">
                                <button
                                  type="button"
                                  disabled={sIdx === 0}
                                  onClick={() => handleMoveSpec(sIdx, 'up')}
                                  className="p-0.5 text-slate-400 hover:text-white disabled:opacity-20 hover:bg-[#1f3552] rounded transition cursor-pointer"
                                  title="Subir posición"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={sIdx === specs.length - 1}
                                  onClick={() => handleMoveSpec(sIdx, 'down')}
                                  className="p-0.5 text-slate-400 hover:text-white disabled:opacity-20 hover:bg-[#1f3552] rounded transition cursor-pointer"
                                  title="Bajar posición"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>

                              {/* Manual Star / Unique / Blindaje Toggle */}
                              <button
                                type="button"
                                onClick={() =>
                                  setSpecs((prev) =>
                                    prev.map((s) =>
                                      s.id === spec.id ? { ...s, isUnique: !s.isUnique } : s
                                    )
                                  )
                                }
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                                  spec.isUnique
                                    ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-xs'
                                    : 'bg-[#111c2e] border-[#334d6e] text-slate-400 hover:text-amber-300 hover:border-amber-500/30'
                                }`}
                                title="Marcar o desmarcar como característica exclusiva / blindaje de pliego (Manual)"
                              >
                                <Star className={`w-3 h-3 ${spec.isUnique ? 'fill-amber-400 text-amber-400' : ''}`} />
                                <span>{spec.isUnique ? 'BLINDAJE' : 'Blindaje'}</span>
                              </button>

                              {/* Interactive Range Toggle Button (Con Rango / Sin Rango) */}
                              <button
                                type="button"
                                onClick={() => handleToggleSpecRange(spec.id)}
                                className={`inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                                  hasValues
                                    ? 'bg-sky-500/25 border-sky-400/80 text-sky-200 shadow-xs hover:bg-sky-500/35'
                                    : 'bg-[#111c2e] border-[#334d6e] text-slate-400 hover:text-sky-300 hover:border-sky-500/40'
                                }`}
                                title={
                                  hasValues
                                    ? 'Rango paramétrico activo. Haga clic para desactivar el rango en esta especificación'
                                    : 'Sin rango. Haga clic para activar opciones de rango (Entre/Mín/Máx/Fijo)'
                                }
                              >
                                <Sliders className={`w-2.5 h-2.5 ${hasValues ? 'text-sky-300' : 'text-slate-400'}`} />
                                <span>{hasValues ? (spec.workRange || numAnalysis.workRange || 'Con Rango') : 'Sin Rango'}</span>
                              </button>
                            </div>

                            {/* Right Side: Range Format, Standard Ranges, Suggestions, Improve AI, Delete */}
                            <div className="flex items-center gap-1 flex-wrap shrink-0">
                              {/* Range Format Selector (Between / Min / Max / Fixed) - only if numeric */}
                              {hasValues && (
                                <div className="flex items-center gap-0.5 bg-[#111c2e] p-0.5 rounded border border-[#334d6e]">
                                  <button
                                    type="button"
                                    onClick={() => handleSwitchRangeStyle(spec.id, 'between')}
                                    className={`text-[9.5px] px-1.5 py-0.5 rounded font-medium transition cursor-pointer ${
                                      spec.activeRangeStyle === 'between'
                                        ? 'bg-sky-600 text-white font-bold'
                                        : 'text-sky-300 hover:bg-sky-500/20'
                                    }`}
                                    title="Rango amplio: Entre X a Y"
                                  >
                                    ↔️ Entre
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSwitchRangeStyle(spec.id, 'min')}
                                    className={`text-[9.5px] px-1.5 py-0.5 rounded font-medium transition cursor-pointer ${
                                      spec.activeRangeStyle === 'min'
                                        ? 'bg-sky-600 text-white font-bold'
                                        : 'text-sky-300 hover:bg-sky-500/20'
                                    }`}
                                    title="Exigencia mínima: Mínimo X"
                                  >
                                    ⬇️ Mín
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSwitchRangeStyle(spec.id, 'max')}
                                    className={`text-[9.5px] px-1.5 py-0.5 rounded font-medium transition cursor-pointer ${
                                      spec.activeRangeStyle === 'max'
                                        ? 'bg-sky-600 text-white font-bold'
                                        : 'text-sky-300 hover:bg-sky-500/20'
                                    }`}
                                    title="Límite superior: Máximo hasta Y"
                                  >
                                    ⬆️ Máx
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSwitchRangeStyle(spec.id, 'fixed')}
                                    className={`text-[9.5px] px-1.5 py-0.5 rounded font-medium transition cursor-pointer ${
                                      spec.activeRangeStyle === 'fixed'
                                        ? 'bg-sky-600 text-white font-bold'
                                        : 'text-sky-300 hover:bg-sky-500/20'
                                    }`}
                                    title="Valor definido: Sin rangos ni variaciones"
                                  >
                                    🎯 Fijo
                                  </button>
                                </div>
                              )}

                              {/* Compact Rangos Estándar Popover Button */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveRangeDropdownSpecId(isRangeOpen ? null : spec.id);
                                    setActiveSuggestionsSpecId(null);
                                  }}
                                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                                    isRangeOpen
                                      ? 'bg-sky-500/30 text-sky-200 border-sky-400'
                                      : 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border-sky-500/30'
                                  }`}
                                  title="Insertar o reemplazar con un rango estándar biomédico (SpO2, FC, etc.)"
                                >
                                  <Sliders className="w-2.5 h-2.5 text-sky-400" />
                                  <span>Rangos</span>
                                  <ChevronDown className="w-2.5 h-2.5" />
                                </button>

                                {/* Compact Dropdown Menu for Standard Ranges */}
                                {isRangeOpen && (
                                  <div className="absolute right-0 top-full mt-1 w-64 bg-[#142338] border border-sky-500/50 rounded-xl shadow-2xl z-40 p-1.5 space-y-1 animate-scaleUp max-h-52 overflow-y-auto scrollbar-thin">
                                    <div className="text-[10px] font-bold text-sky-300 px-1.5 py-0.5 border-b border-[#334d6e] flex items-center justify-between">
                                      <span>Seleccione rango estándar:</span>
                                      <button
                                        type="button"
                                        onClick={() => setActiveRangeDropdownSpecId(null)}
                                        className="text-slate-400 hover:text-white"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                    {STANDARD_BIOMEDICAL_WORK_RANGES.map((preset) => (
                                      <button
                                        key={preset.id}
                                        type="button"
                                        onClick={() => handleApplyPresetToSpec(spec.id, preset)}
                                        className="w-full text-left px-2 py-1 rounded-lg hover:bg-sky-500/20 text-[10.5px] text-slate-200 transition cursor-pointer flex flex-col"
                                      >
                                        <span className="font-bold text-white">{preset.name}</span>
                                        <span className="text-[9.5px] text-sky-300 font-mono">
                                          {preset.defaultMin} a {preset.defaultMax} {preset.unit}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Compact Sugerencias Dropdown Button (Filtered non-repeated) */}
                              {availableSuggestions.length > 0 && (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveSuggestionsSpecId(isSugOpen ? null : spec.id);
                                      setActiveRangeDropdownSpecId(null);
                                    }}
                                    className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border transition cursor-pointer ${
                                      isSugOpen
                                        ? 'bg-amber-500/30 text-amber-200 border-amber-400'
                                        : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    }`}
                                    title="Ver sugerencias no repetidas para esta especificación"
                                  >
                                    <Lightbulb className="w-2.5 h-2.5 text-amber-400" />
                                    <span>Sugerencias</span>
                                    <ChevronDown className="w-2.5 h-2.5" />
                                  </button>

                                  {/* Compact Suggestions Menu */}
                                  {isSugOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-72 sm:w-80 bg-[#142338] border border-amber-500/50 rounded-xl shadow-2xl z-40 p-1.5 space-y-1 animate-scaleUp max-h-56 overflow-y-auto scrollbar-thin">
                                      <div className="text-[10px] font-bold text-amber-300 px-1.5 py-0.5 border-b border-[#334d6e] flex items-center justify-between">
                                        <span>Sugerencias no repetidas ({availableSuggestions.length}):</span>
                                        <button
                                          type="button"
                                          onClick={() => setActiveSuggestionsSpecId(null)}
                                          className="text-slate-400 hover:text-white"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                      {availableSuggestions.map((sug, sugIdx) => (
                                        <button
                                          key={`sug-${sugIdx}`}
                                          type="button"
                                          onClick={() =>
                                            handleApplySuggestionToSpec(
                                              spec.id,
                                              sug.requirement,
                                              sug.workRange,
                                              sug.rangeVariants
                                            )
                                          }
                                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-amber-500/20 text-[10.5px] text-slate-200 transition cursor-pointer flex flex-col gap-0.5"
                                        >
                                          <span className="leading-snug">{sug.requirement}</span>
                                          {sug.workRange && (
                                            <span className="text-[9px] font-mono text-sky-300">
                                              ↔️ {sug.workRange}
                                            </span>
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* AI Redaction / Improve Button */}
                              <button
                                type="button"
                                disabled={spec.isOptimizing}
                                onClick={() => handleOptimizeSingleSpec(spec.id)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-200 bg-purple-500/15 hover:bg-purple-500/30 border border-purple-500/30 px-2 py-0.5 rounded transition cursor-pointer disabled:opacity-50"
                                title="Mejorar redacción técnica con IA"
                              >
                                {spec.isOptimizing ? (
                                  <Loader2 className="w-2.5 h-2.5 animate-spin text-purple-300" />
                                ) : (
                                  <Wand2 className="w-2.5 h-2.5 text-purple-300" />
                                )}
                                <span>{spec.isOptimizing ? '...' : 'Mejorar'}</span>
                              </button>

                              {/* Delete Spec Button */}
                              <button
                                type="button"
                                onClick={() => setSpecs((prev) => prev.filter((s) => s.id !== spec.id))}
                                className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition cursor-pointer"
                                title="Eliminar especificación"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Individual Specification Textarea */}
                          <textarea
                            rows={2}
                            value={spec.requirement}
                            onChange={(e) =>
                              setSpecs((prev) =>
                                prev.map((s) =>
                                  s.id === spec.id ? { ...s, requirement: e.target.value } : s
                                )
                              )
                            }
                            className="w-full bg-[#111c2e] border border-[#334d6e] rounded-lg px-2.5 py-1.5 text-slate-100 focus:border-purple-400 outline-none text-xs leading-relaxed resize-none"
                          />
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>

            {/* Section 3: Accesorios y Módulos Adicionales Opcionales (IMAGEN 2) */}
            <div className="bg-[#111c2e] p-3 rounded-xl border border-[#334d6e] space-y-2.5">
              <div className="flex items-center justify-between border-b border-[#334d6e] pb-1.5">
                <div className="flex items-center gap-1.5 text-white font-bold text-xs">
                  <PackageCheck className="w-4 h-4 text-emerald-400" />
                  <span>Accesorios y Módulos Adicionales Opcionales</span>
                </div>
                <span className="text-[10.5px] text-slate-400">
                  (Carrito de transporte, módulos extra, soportes no incluidos de fábrica)
                </span>
              </div>

              {/* Manual Accessory Entry Input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Escriba accesorio específico opcional (ej: Carrito de transporte rodable con frenos, Módulo de capnografía EtCO2)..."
                  value={customAccessoryInput}
                  onChange={(e) => setCustomAccessoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomAccessory();
                    }
                  }}
                  className="flex-1 bg-[#15253d] border border-[#334d6e] rounded-lg px-2.5 py-1.5 text-white placeholder-slate-400 outline-none focus:border-emerald-400 text-xs"
                />
                <button
                  type="button"
                  disabled={!customAccessoryInput.trim()}
                  onClick={handleAddCustomAccessory}
                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar</span>
                </button>
              </div>

              {/* Added Accessories List (Starts completely empty) */}
              <div className="space-y-1.5">
                {selectedAccessories.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400 bg-[#15253d] rounded-lg border border-dashed border-[#334d6e]">
                    No hay accesorios opcionales seleccionados. Ingréselos arriba o haga clic en los accesorios sugeridos abajo.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAccessories.map((acc, aIdx) => (
                      <div
                        key={aIdx}
                        className="inline-flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/50 text-emerald-200 text-xs px-2.5 py-1 rounded-lg shadow-xs"
                      >
                        <Boxes className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="font-medium">{acc}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleAccessory(acc)}
                          className="text-emerald-400 hover:text-rose-300 ml-1 p-0.5 rounded hover:bg-rose-500/20 transition cursor-pointer"
                          title="Quitar accesorio"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Specific Optional Accessory Chips (only if equipment has been specified) */}
              {(suggestedAccessories.length > 0 || name.trim().length >= 3) && (
                <div className="pt-1.5 border-t border-[#1f3552] space-y-1.5">
                  <div className="flex items-center justify-between text-[10.5px] text-slate-300">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1">
                      <Lightbulb className="w-3 h-3 text-emerald-400" />
                      <span>Accesorios opcionales sugeridos para este equipo:</span>
                    </span>
                    <span className="text-slate-400">Clic para agregar/quitar</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(suggestedAccessories.length > 0
                      ? suggestedAccessories
                      : DEFAULT_OPTIONAL_ACCESSORIES
                    ).map((sugAcc, sIdx) => {
                      const isAdded = selectedAccessories.includes(sugAcc);
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handleToggleAccessory(sugAcc)}
                          className={`text-[10.5px] px-2 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 font-medium ${
                            isAdded
                              ? 'bg-emerald-600 text-white border-emerald-400 font-bold shadow-xs'
                              : 'bg-[#15253d] hover:bg-[#1a2f4c] text-slate-300 hover:text-white border-[#334d6e]'
                          }`}
                        >
                          <span>{isAdded ? '✓' : '+'}</span>
                          <span>{sugAcc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3 bg-[#111c2e] border-t border-[#334d6e] flex items-center justify-between gap-2 shrink-0">
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Especificaciones: <strong className="text-white">{specs.length}</strong></span>
              <span>Blindaje: <strong className="text-amber-300 font-bold">⭐ {specs.filter((s) => s.isUnique).length}</strong></span>
              <span>Accesorios: <strong className="text-emerald-300 font-bold">{selectedAccessories.length}</strong></span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSaveItem(false)}
                className="inline-flex items-center gap-1.5 bg-[#1e3452] hover:bg-[#28456c] text-[#38bdf8] border border-[#38bdf8]/40 font-bold text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-sm active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Guardar y Agregar Otro</span>
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-black text-xs px-4 py-1.5 rounded-xl transition cursor-pointer shadow-md active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>Guardar y Cerrar</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
