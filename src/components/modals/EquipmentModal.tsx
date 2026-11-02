import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  ShieldCheck,
  DollarSign,
  Edit3,
  Building2,
  Package,
  Tag,
  Check,
  Plus,
  ArrowLeftRight,
  ShieldAlert,
  ShieldOff,
  RefreshCw,
  Globe,
  X,
  Trash2,
  Sparkles,
  Loader2,
  Layers,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { MedicalEquipment, MarginListKey, SupplierProfile, ProductGroup, StandardAccessory } from '../../types';
import { fetchLiveTRM, getCachedTRM, getRecommendedTRMRate, TrmData } from '../../utils/trmService';
import {
  getStoredSupplierProfiles,
  matchSupplierInDirectory,
  autoRegisterSuppliersFromEquipments,
} from '../../utils/ocTrackingStorage';
import { detectProductGroup } from '../../utils/productGroupUtils';
import { isRateLimitError, notifyRateLimit } from '../../utils/rateLimitHandler';
import { markPendingAsCreated } from '../../utils/pendingEquipmentsStorage';
import { DetectedSheetPart } from '../../services/googleWorkspaceService';

interface EquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (equipment: MedicalEquipment) => void;
  equipmentToEdit?: MedicalEquipment | null;
}

export const EquipmentModal: React.FC<EquipmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
  equipmentToEdit,
}) => {
  const isEditing = Boolean(equipmentToEdit);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [brand, setBrand] = useState('MINDRAY');
  const [customBrand, setCustomBrand] = useState('');
  const effectiveBrand = brand === 'OTRA' ? (customBrand.trim() || 'GENÉRICO') : brand;
  const [supplier, setSupplier] = useState('');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState<MedicalEquipment['category']>('Monitoreo');
  const [productGroup, setProductGroup] = useState<ProductGroup>('Equipos Médicos');

  // Supplier directory state
  const [availableSuppliers, setAvailableSuppliers] = useState<SupplierProfile[]>(() =>
    getStoredSupplierProfiles()
  );
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const supplierContainerRef = useRef<HTMLDivElement>(null);
  const [supplierCreatedFeedback, setSupplierCreatedFeedback] = useState<string | null>(null);

  // Function to instantly create and register a new supplier into Directory (Ventana 5)
  const handleRegisterNewSupplier = (nameToRegister: string) => {
    const cleanName = nameToRegister.trim();
    if (!cleanName) return;
    const brandToAssign = effectiveBrand && effectiveBrand !== 'OTRA' ? effectiveBrand : undefined;
    autoRegisterSuppliersFromEquipments([
      {
        name: cleanName,
        brand: brandToAssign || 'General',
        supplier: cleanName,
        category: category || 'Monitoreo',
        baseCostCOP: baseCostCOP || 0,
        invimaRecordNumber: 'No Aplica',
        warrantyMonths: 12,
        originCountry: originCountry || '',
        taxExempt: false,
      } as any,
    ]);
    const updated = getStoredSupplierProfiles();
    setAvailableSuppliers(updated);
    setSupplier(cleanName);
    setShowSupplierDropdown(false);
    setSupplierCreatedFeedback(`¡Proveedor "${cleanName}" creado y registrado en el Directorio!`);
    setTimeout(() => setSupplierCreatedFeedback(null), 4000);
  };

  // TRM (Tasa Representativa del Mercado) - Live exchange rate from internet
  const [trmData, setTrmData] = useState<TrmData>(() => getCachedTRM());
  const [trm, setTrm] = useState<number>(() => {
    const cached = getCachedTRM();
    return cached.analysis?.recommendedRoundRate || getRecommendedTRMRate(cached.rate);
  });
  const [isFetchingTrm, setIsFetchingTrm] = useState(false);
  const [trmFeedback, setTrmFeedback] = useState<string | null>(null);

  // Costs & Currency Exchange
  const [baseCostCOP, setBaseCostCOP] = useState<number>(15000000);
  const [baseCostUSD, setBaseCostUSD] = useState<number>(3600);
  const [defaultMarginList, setDefaultMarginList] = useState<MarginListKey>('L4');

  // INVIMA logic: toggle between requires INVIMA and doesn't apply
  const [requiresInvima, setRequiresInvima] = useState<boolean>(true);
  const [invimaRecordNumber, setInvimaRecordNumber] = useState('INVIMA 2026EBC-00');
  const [invimaExpiryDate, setInvimaExpiryDate] = useState('2029-12-31');
  const [invimaStatus, setInvimaStatus] = useState<MedicalEquipment['invimaStatus']>('Vigente');

  const [warrantyMonths, setWarrantyMonths] = useState(24);
  const [originCountry, setOriginCountry] = useState('China / Alemania');
  const [taxExempt, setTaxExempt] = useState(false);

  // Commercial Description & AI Auto-fetch from Internet
  const [description, setDescription] = useState('');
  const [isFetchingDescription, setIsFetchingDescription] = useState(false);
  const [descriptionSource, setDescriptionSource] = useState<'ai' | 'manual' | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const descriptionAbortControllerRef = useRef<AbortController | null>(null);

  // Technical specs
  const [specs, setSpecs] = useState<string[]>([]);

  // Standard Accessories management (EMPTY by default - NEVER automatically populated)
  const [accessories, setAccessories] = useState<StandardAccessory[]>([]);
  const [newAccName, setNewAccName] = useState('');
  const [newAccCost, setNewAccCost] = useState<number>(0);
  const [newAccIncluded, setNewAccIncluded] = useState<boolean>(true);
  const [partCodeError, setPartCodeError] = useState<string | null>(null);

  const isFromPending = Boolean(equipmentToEdit?.sourceOrigin?.startsWith('pending-id:'));

  // Drive Parts cache from N-FCO-03
  const [driveParts] = useState<DetectedSheetPart[]>(() => {
    try {
      const raw = localStorage.getItem('syd_detected_sheet_parts_v1');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return [];
  });

  // Candidate matching part from Drive N-FCO-03
  const driveCandidate = useMemo(() => {
    if (!driveParts || driveParts.length === 0) return null;
    const cleanModel = (model || '').toLowerCase().trim();
    const cleanBrand = (effectiveBrand || '').toLowerCase().trim();
    const cleanName = (name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    return driveParts.find((dp) => {
      const dpModel = (dp.model || '').toLowerCase();
      const dpBrand = (dp.brand || '').toLowerCase();
      const dpName = (dp.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      if (cleanModel && cleanModel.length >= 2 && (dpModel.includes(cleanModel) || dpName.includes(cleanModel))) return true;
      if (cleanBrand && dpBrand.includes(cleanBrand) && cleanName && dpName.includes(cleanName.slice(0, 5))) return true;
      return false;
    }) || null;
  }, [driveParts, model, effectiveBrand, name]);

  const handleApplyDriveCandidate = (dp: DetectedSheetPart) => {
    if (dp.code) setCode(dp.code);
    if (dp.supplier) setSupplier(dp.supplier);
    if (dp.invimaRegister && dp.invimaRegister.toLowerCase() !== 'no aplica') {
      setRequiresInvima(true);
      setInvimaRecordNumber(dp.invimaRegister);
    }
    if (dp.costCOP && dp.costCOP > 0) {
      setBaseCostCOP(dp.costCOP);
      const validTrm = trm > 0 ? trm : (trmData.analysis?.recommendedRoundRate || getRecommendedTRMRate(trmData.rate));
      setBaseCostUSD(Math.round(dp.costCOP / validTrm));
    }
    if (dp.name) {
      setDescription(`Equipo biomédico oficial ${dp.name} (${dp.brand || effectiveBrand} ${dp.model || model}), creado con datos de parte oficial N-FCO-03.`);
    }
  };

  // Refresh live TRM from internet
  const handleFetchLiveTRM = async (recalculateFrom: 'cop' | 'usd' | null = null) => {
    setIsFetchingTrm(true);
    setTrmFeedback(null);
    try {
      const data = await fetchLiveTRM();
      setTrmData(data);
      const recommendedRate = data.analysis?.recommendedRoundRate || getRecommendedTRMRate(data.rate);
      setTrm(recommendedRate);

      if (recalculateFrom === 'cop' && baseCostCOP > 0) {
        setBaseCostUSD(Math.round(baseCostCOP / recommendedRate));
      } else if (recalculateFrom === 'usd' && baseCostUSD > 0) {
        setBaseCostCOP(Math.round(baseCostUSD * recommendedRate));
      }

      setTrmFeedback(`TRM oficial: $${data.rate.toLocaleString()} COP | TRM recomendada aplicada: $${recommendedRate.toLocaleString()} COP`);
      setTimeout(() => setTrmFeedback(null), 4500);
    } catch (e) {
      console.error('Error refreshing TRM:', e);
      setTrmFeedback('No se pudo conectar a internet para TRM en vivo.');
      setTimeout(() => setTrmFeedback(null), 4000);
    } finally {
      setIsFetchingTrm(false);
    }
  };

  // Function to search/generate brief description with Gemini / Internet
  const fetchDescriptionFromInternet = async (eqName: string, eqBrand: string, eqModel: string) => {
    if (!eqName || eqName.trim().length < 3) {
      return;
    }

    if (descriptionAbortControllerRef.current) {
      descriptionAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    descriptionAbortControllerRef.current = controller;

    setIsFetchingDescription(true);
    try {
      const res = await fetch('/api/gemini/equipment-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          equipmentName: eqName.trim(),
          brand: eqBrand,
          model: eqModel,
        }),
      });

      if (res.status === 429) {
        notifyRateLimit(
          'Descripción con IA',
          'Límite de consultas temporal (Rate Limit). Puedes redactar la descripción manualmente o esperar un momento.'
        );
        return;
      }

      if (res.ok) {
        const json = await res.json();
        if (json.found && json.description && json.description.trim() !== '') {
          setDescription(json.description.trim());
          setDescriptionSource('ai');
        } else {
          // If not recognized as a real medical device (e.g. "ajjaja"), do not put generic text, leave empty
          if (descriptionSource === 'ai' || !description) {
            setDescription('');
            setDescriptionSource(null);
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      if (isRateLimitError(err)) {
        notifyRateLimit('Descripción con IA');
      } else {
        console.warn('Error fetching description from internet:', err);
      }
    } finally {
      if (descriptionAbortControllerRef.current === controller) {
        setIsFetchingDescription(false);
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      // Auto-fetch latest TRM when opening modal
      handleFetchLiveTRM();

      const recRate = trmData.analysis?.recommendedRoundRate || getRecommendedTRMRate(trmData.rate);

      if (equipmentToEdit) {
        setName(equipmentToEdit.name || '');
        setCode(equipmentToEdit.code || '');
        const brandUpper = (equipmentToEdit.brand || '').trim().toUpperCase();
        // If brand was mistakenly set to ALLERS (distributor), map it to SECA for balanzas/tallímetros
        let normalizedBrandUpper = brandUpper;
        if (brandUpper === 'ALLERS') {
          normalizedBrandUpper = 'SECA';
        }
        const isKnownBrand = [
          'SECA',
          'MINDRAY',
          'WELCH ALLYN',
          'BOVIE',
          'EDAN',
          'MEDITECH',
          'PHILIPS',
          'ZOLL',
          'GENERAL ELECTRIC',
          'DRÄGER',
          'CA-MI',
          'COMEN',
          'B. BRAUN',
          'MEDTRONIC',
          'TUTTNAUER',
          'STRYKER',
          'KARL STORZ',
          'NIHON KOHDEN',
          'STERIS',
          'GETINGE',
          'SIEMENS HEALTHINEERS',
          'COVIDIEN',
          'RIESTER',
          'KAWE',
          'HEINE',
          '3M LITTMANN',
          'SONOSCAPE',
          'BIONET',
        ].includes(normalizedBrandUpper);
        if (isKnownBrand) {
          setBrand(normalizedBrandUpper);
          setCustomBrand('');
        } else if (brandUpper) {
          setBrand('OTRA');
          setCustomBrand(equipmentToEdit.brand || '');
        } else {
          setBrand('SECA');
          setCustomBrand('');
        }
        setSupplier(equipmentToEdit.supplier || '');
        setModel(equipmentToEdit.model || '');
        setCategory(equipmentToEdit.category || 'Monitoreo');
        setProductGroup((equipmentToEdit.productGroup || 'Equipos Médicos') as ProductGroup);

        const cop = equipmentToEdit.baseCostCOP ?? 0;
        setBaseCostCOP(cop);
        setBaseCostUSD(equipmentToEdit.baseCostUSD ?? (cop > 0 ? Math.round(cop / (trm > 0 ? trm : recRate)) : 0));

        setDefaultMarginList((equipmentToEdit.defaultMarginList || 'L4') as MarginListKey);

        const hasInvima = Boolean(
          equipmentToEdit.invimaRecordNumber &&
          equipmentToEdit.invimaRecordNumber.trim() !== '' &&
          equipmentToEdit.invimaRecordNumber.toLowerCase() !== 'no aplica' &&
          equipmentToEdit.invimaRecordNumber.toLowerCase() !== 'no requiere'
        );
        setRequiresInvima(hasInvima);
        setInvimaRecordNumber(hasInvima ? (equipmentToEdit.invimaRecordNumber || '') : '');
        setInvimaExpiryDate(equipmentToEdit.invimaExpiryDate || '');
        setInvimaStatus(equipmentToEdit.invimaStatus || 'Vigente');

        setWarrantyMonths(equipmentToEdit.warrantyMonths ?? 24);
        setOriginCountry(equipmentToEdit.originCountry || '');
        setTaxExempt(equipmentToEdit.taxExempt ?? false);
        setDescription(equipmentToEdit.description || '');
        setDescriptionSource(equipmentToEdit.description ? 'manual' : null);
        setSpecs(equipmentToEdit.technicalSpecs ? [...equipmentToEdit.technicalSpecs] : []);
        setAccessories(
          equipmentToEdit.standardAccessories
            ? equipmentToEdit.standardAccessories.map((a) => ({ ...a }))
            : []
        );
      } else {
        // Reset defaults for new equipment - NO DEFAULT ACCESSORIES!
        setName('');
        setCode(`EQ-${Date.now().toString().slice(-4)}`);
        setBrand('MINDRAY');
        setCustomBrand('');
        setSupplier('MINDRAY MEDICAL COLOMBIA S.A.S.');
        setModel('');
        setCategory('Monitoreo');
        setProductGroup('Equipos Médicos');
        const currentRate = trm > 0 ? trm : recRate;
        setBaseCostCOP(15000000);
        setBaseCostUSD(Math.round(15000000 / currentRate));
        setDefaultMarginList('L4');
        setRequiresInvima(true);
        setInvimaRecordNumber('INVIMA 2026EBC-00');
        setInvimaExpiryDate('2029-12-31');
        setInvimaStatus('Vigente');
        setWarrantyMonths(24);
        setOriginCountry('China / Alemania');
        setTaxExempt(false);
        setDescription('');
        setDescriptionSource(null);
        setSpecs([
          'Tecnología biomédica certificada para uso clínico',
          'Compatibilidad con estándares hospitalarios vigentes',
        ]);
        // Do NOT put accessories automatically - start clean and empty
        setAccessories([]);
      }
      setNewAccName('');
      setNewAccCost(0);
      setNewAccIncluded(true);
      setShowSupplierDropdown(false);
    }
  }, [equipmentToEdit, isOpen]);

  // Listen for background updates to suppliers directory
  useEffect(() => {
    const handleSuppliersUpdated = (e: any) => {
      const detail = e.detail;
      setTimeout(() => {
        if (detail) {
          setAvailableSuppliers(detail);
        } else {
          setAvailableSuppliers(getStoredSupplierProfiles());
        }
      }, 0);
    };
    window.addEventListener('syd_suppliers_updated', handleSuppliersUpdated);
    return () => window.removeEventListener('syd_suppliers_updated', handleSuppliersUpdated);
  }, []);

  // Handle ESC key press and Click-Outside to close supplier dropdown
  useEffect(() => {
    if (!isOpen) return;

    // Refresh suppliers list whenever modal opens
    setAvailableSuppliers(getStoredSupplierProfiles());

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSupplierDropdown) {
          setShowSupplierDropdown(false);
        } else {
          onClose();
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (supplierContainerRef.current && !supplierContainerRef.current.contains(e.target as Node)) {
        setShowSupplierDropdown(false);
      }
    };

    const handleTrmUpdated = (e: any) => {
      if (e.detail) {
        setTimeout(() => {
          setTrmData(e.detail);
        }, 0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('syd_trm_updated', handleTrmUpdated);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('syd_trm_updated', handleTrmUpdated);
    };
  }, [isOpen, onClose, showSupplierDropdown]);

  // Debounced auto-fetch of medical description when typing the equipment name
  const handleNameChange = (val: string) => {
    setName(val);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Only auto-fetch if user is creating a new equipment or current description is empty / was AI generated
    if (!equipmentToEdit) {
      const detected = detectProductGroup(val, category, effectiveBrand, model);
      setProductGroup(detected);
    }

    if (!equipmentToEdit || !description || descriptionSource === 'ai') {
      if (val.trim().length >= 3) {
        debounceTimerRef.current = setTimeout(() => {
          fetchDescriptionFromInternet(val, effectiveBrand, model);
        }, 900);
      } else if (descriptionSource === 'ai') {
        setDescription('');
        setDescriptionSource(null);
      }
    }
  };

  // Add accessory handler
  const handleAddAccessory = () => {
    if (!newAccName.trim()) return;
    setAccessories((prev) => [
      ...prev,
      {
        name: newAccName.trim(),
        costCOP: Number(newAccCost) || 0,
        included: newAccIncluded,
      },
    ]);
    setNewAccName('');
    setNewAccCost(0);
    setNewAccIncluded(true);
  };

  // Remove accessory handler
  const handleRemoveAccessory = (index: number) => {
    setAccessories((prev) => prev.filter((_, i) => i !== index));
  };

  // Toggle accessory included status
  const handleToggleAccessoryIncluded = (index: number) => {
    setAccessories((prev) =>
      prev.map((acc, i) => (i === index ? { ...acc, included: !acc.included } : acc))
    );
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

  if (!isOpen) return null;

  // Handler for COP changes: calculates USD
  const handleCOPChange = (value: number) => {
    setBaseCostCOP(value);
    const validTrm = trm > 0 ? trm : (trmData.analysis?.recommendedRoundRate || getRecommendedTRMRate(trmData.rate));
    setBaseCostUSD(value > 0 ? Math.round(value / validTrm) : 0);
  };

  // Handler for USD changes: calculates COP multiplying by Recommended TRM
  const handleUSDChange = (value: number) => {
    setBaseCostUSD(value);
    const validTrm = trm > 0 ? trm : (trmData.analysis?.recommendedRoundRate || getRecommendedTRMRate(trmData.rate));
    setBaseCostCOP(value > 0 ? Math.round(value * validTrm) : 0);
  };

  // Handler for TRM change
  const handleTrmChange = (newTrm: number) => {
    setTrm(newTrm);
    if (newTrm > 0 && baseCostUSD > 0) {
      setBaseCostCOP(Math.round(baseCostUSD * newTrm));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Auto-generate code if empty and not editing
    const finalCode =
      code && code.trim() !== ''
        ? code.trim()
        : equipmentToEdit?.code ||
          (model && model.trim() !== ''
            ? `${effectiveBrand.substring(0, 3).toUpperCase()}-${model.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8)}`
            : `EQ-${Date.now().toString().slice(-4)}`);

    // Prevent duplicate part numbers
    const cleanFinalCode = finalCode.trim().toLowerCase();
    const stored = localStorage.getItem('syd_equipments_catalog');
    if (stored) {
      try {
        const catalogList: MedicalEquipment[] = JSON.parse(stored);
        const duplicate = catalogList.find(
          (eq) =>
            (eq.code || '').trim().toLowerCase() === cleanFinalCode &&
            eq.id !== equipmentToEdit?.id
        );
        if (duplicate) {
          setPartCodeError(
            `⚠️ Error: El código de parte "${finalCode}" ya está registrado en el Catálogo para el equipo "${duplicate.name}". No se permiten códigos de parte duplicados.`
          );
          return;
        }
      } catch (_) {}
    }
    setPartCodeError(null);

    const savedEq: MedicalEquipment = {
      ...(equipmentToEdit || {}),
      id: equipmentToEdit?.id || `eq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      code: finalCode,
      name: name.trim(),
      brand: effectiveBrand,
      supplier: supplier.trim() || undefined,
      model: model.trim() || 'Estándar',
      category,
      productGroup: productGroup || 'Equipos Médicos',
      baseCostCOP,
      baseCostUSD: baseCostUSD > 0 ? baseCostUSD : undefined,
      defaultMarginList,
      invimaRecordNumber: requiresInvima ? (invimaRecordNumber.trim() || 'En Trámite') : 'No Aplica',
      invimaExpiryDate: requiresInvima ? (invimaExpiryDate ? invimaExpiryDate.trim() : undefined) : undefined,
      invimaStatus: requiresInvima ? invimaStatus : 'Vigente',
      warrantyMonths,
      originCountry: originCountry.trim(),
      taxExempt,
      description: description.trim(),
      technicalSpecs: specs,
      standardAccessories: accessories,
      imageUrl: equipmentToEdit?.imageUrl,
      hasDocSheet: equipmentToEdit?.hasDocSheet ?? false,
      hasInvimaDoc: requiresInvima ? (equipmentToEdit?.hasInvimaDoc ?? false) : false,
      hasManual: equipmentToEdit?.hasManual ?? false,
      hasQualityCert: equipmentToEdit?.hasQualityCert ?? false,
      allSuppliers: equipmentToEdit?.allSuppliers,
      alternateSuppliers: equipmentToEdit?.alternateSuppliers,
      supplierPrices: (() => {
        const existingPrices = equipmentToEdit?.supplierPrices ? [...equipmentToEdit.supplierPrices] : [];
        if (supplier.trim() && baseCostCOP > 0) {
          const sName = supplier.trim();
          const idx = existingPrices.findIndex((sp) => sp.supplier.trim().toLowerCase() === sName.toLowerCase());
          if (idx >= 0) {
            existingPrices[idx] = { ...existingPrices[idx], costCOP: baseCostCOP, costUSD: baseCostUSD > 0 ? baseCostUSD : undefined };
          } else {
            existingPrices.push({
              supplier: sName,
              costCOP: baseCostCOP,
              costUSD: baseCostUSD > 0 ? baseCostUSD : undefined,
              date: new Date().toISOString().split('T')[0],
            });
          }
        }
        return existingPrices.length > 0 ? existingPrices : undefined;
      })(),
    };

    // Auto-register supplier in Directory (Ventana 5) immediately
    if (savedEq.supplier && savedEq.supplier.trim()) {
      autoRegisterSuppliersFromEquipments([savedEq]);
    }

    // If equipment was created from a pending emergency quote equipment, mark it as created
    if (savedEq.sourceOrigin && savedEq.sourceOrigin.startsWith('pending-id:')) {
      const pendingId = savedEq.sourceOrigin.replace('pending-id:', '').trim();
      markPendingAsCreated(pendingId, savedEq.id, savedEq.code);
    }

    onSave(savedEq);
    onClose();
  };

  const calculatedCostWithIva = taxExempt ? baseCostCOP : Math.round(baseCostCOP * 1.19);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#192b45] border border-[var(--syd-accent)]/50 rounded-2xl max-w-5xl lg:max-w-6xl w-full p-4 sm:p-5 shadow-2xl animate-scaleUp max-h-[82vh] h-[80vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-[#334d6e] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                isEditing
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              }`}
            >
              {isEditing ? <Edit3 className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2 truncate">
                <span>{isEditing ? 'Editar Equipo Médico' : 'Registrar Nuevo Equipo'}</span>
                {code && (
                  <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 font-mono px-2 py-0.5 rounded-full font-bold">
                    {code}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {isEditing
                  ? 'Actualice marca, modelo, proveedor, costos, accesorios y descripción'
                  : 'Complete los datos para agregarlo al catálogo institucional'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#334d6e] rounded-lg transition cursor-pointer flex items-center gap-1"
              title="Cerrar ventana"
            >
              <X className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Cerrar</span>
            </button>
          </div>
        </div>

        {/* Unified Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs pt-3 scrollbar-thin flex flex-col justify-between">
          <div className="space-y-4">
            {partCodeError && (
              <div className="p-3 bg-rose-950/90 border border-rose-500 rounded-xl text-rose-200 text-xs font-bold flex items-center justify-between gap-2 shadow-lg animate-fadeIn">
                <span className="flex-1">{partCodeError}</span>
                <button
                  type="button"
                  onClick={() => setPartCodeError(null)}
                  className="p-1 hover:bg-rose-900 rounded text-rose-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {isFromPending && (
              <div className="p-3 bg-amber-500/15 border border-amber-500/50 rounded-xl text-amber-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-md animate-fadeIn">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Formalizando requerimiento urgente: Ingrese <strong>Parte / Código</strong>, <strong>Proveedor</strong> y <strong>Registro INVIMA</strong> para archivar en el Catálogo Maestro.
                  </span>
                </div>
                {driveCandidate && (
                  <button
                    type="button"
                    onClick={() => handleApplyDriveCandidate(driveCandidate)}
                    className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-[11px] transition cursor-pointer flex items-center gap-1 active:scale-95 shadow"
                    title={`Cargar automáticamente Parte #${driveCandidate.code}, Proveedor: ${driveCandidate.supplier || 'TECNICA'} e INVIMA desde Drive`}
                  >
                    <Zap className="w-3 h-3 fill-current" />
                    <span>Cargar datos desde Drive N-FCO-03 (Parte #{driveCandidate.code})</span>
                  </button>
                )}
              </div>
            )}

            {/* SECTION 1: Datos Básicos, Marca, Modelo, Proveedor */}
            <div className="bg-[#15253d] p-4 rounded-xl border border-[#334d6e] space-y-3">
              <div className="flex items-center gap-2 text-white font-bold text-xs border-b border-[#334d6e]/60 pb-2">
                <Tag className="w-4 h-4 text-[var(--syd-accent)]" />
                <span>1. Identificación, Marca, Modelo &amp; Proveedor</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-bold block">Nombre Completo del Equipo Médico *</label>
                    {isFetchingDescription && (
                      <span className="text-[10.5px] text-cyan-300 flex items-center gap-1 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Buscando descripción médica en internet...</span>
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Monitor de Signos Vitales Multiparámetro ePM 12M"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onBlur={() => {
                      if (name.trim().length >= 3 && (!description || descriptionSource === 'ai')) {
                        fetchDescriptionFromInternet(name, effectiveBrand, model);
                      }
                    }}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2.5 text-white font-semibold focus:border-[var(--syd-accent)] outline-none"
                  />
                </div>

                {/* Columna Parte / Código de Referencia */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-bold flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[var(--syd-accent)]" />
                      <span>Parte / Código de Referencia *</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const brandPrefix = (brand === 'OTRA' ? customBrand || 'GEN' : brand).substring(0, 3).toUpperCase();
                        const modelClean = model ? model.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) : '';
                        const genCode = modelClean ? `${brandPrefix}-${modelClean}` : `EQ-${Date.now().toString().slice(-4)}`;
                        setCode(genCode);
                      }}
                      className="text-[10.5px] text-[var(--syd-accent)] hover:text-white transition cursor-pointer font-bold underline"
                      title="Generar código sugerido basado en marca y modelo"
                    >
                      Auto-generar
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Ej: EQ-2960 / PACE-101 / REF-001"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-[#111c2e] border border-[var(--syd-accent)]/70 focus:border-[var(--syd-accent)] rounded-xl p-2.5 text-cyan-300 font-mono font-bold outline-none text-xs focus:ring-1 focus:ring-[var(--syd-accent)]"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Define o modifica el valor visible en la columna <strong>"Parte"</strong> del catálogo y cotizaciones.
                  </span>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Modelo del Fabricante *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: ePM 12M Pro / Aaron 2250 / PACE 101"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2.5 text-white font-medium focus:border-[var(--syd-accent)] outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Marca / Fabricante *</label>
                  <div className="space-y-1.5">
                    <select
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2.5 text-white font-bold focus:border-[var(--syd-accent)] outline-none cursor-pointer"
                    >
                      <option value="SECA">SECA (Pesas, Balanzas, Tallímetros)</option>
                      <option value="MINDRAY">MINDRAY (Monitoreo, Anestesia, UCI)</option>
                      <option value="WELCH ALLYN">WELCH ALLYN (Diagnóstico, Signos Vitales)</option>
                      <option value="BOVIE">BOVIE (Electrocirugía)</option>
                      <option value="EDAN">EDAN (Monitoreo, ECG)</option>
                      <option value="PHILIPS">PHILIPS (Diagnóstico, UCI)</option>
                      <option value="ZOLL">ZOLL (Desfibrilación, Reanimación)</option>
                      <option value="GENERAL ELECTRIC">GENERAL ELECTRIC (GE Healthcare)</option>
                      <option value="DRÄGER">DRÄGER (Ventilación, Quirófano)</option>
                      <option value="CA-MI">CA-MI (Aspiradores Quirúrgicos)</option>
                      <option value="COMEN">COMEN (Monitores Multiparámetros)</option>
                      <option value="B. BRAUN">B. BRAUN / AESCULAP (Infusión, Instrumental)</option>
                      <option value="MEDTRONIC">MEDTRONIC / VALLEYLAB</option>
                      <option value="TUTTNAUER">TUTTNAUER (Autoclaves y Esterilización)</option>
                      <option value="STRYKER">STRYKER (Camas UCI, Quirófano)</option>
                      <option value="KARL STORZ">KARL STORZ (Endoscopia, Laparoscopia)</option>
                      <option value="NIHON KOHDEN">NIHON KOHDEN (Monitoreo, Desfibriladores)</option>
                      <option value="STERIS">STERIS (Mesas Quirúrgicas, Lámparas)</option>
                      <option value="MEDITECH">MEDITECH</option>
                      <option value="3M LITTMANN">3M LITTMANN (Fonendoscopios)</option>
                      <option value="OTRA">Otra Marca (Personalizada)...</option>
                    </select>
                    {brand === 'OTRA' && (
                      <input
                        type="text"
                        placeholder="Escriba el nombre de la marca..."
                        value={customBrand}
                        onChange={(e) => setCustomBrand(e.target.value)}
                        className="w-full bg-[#111c2e] border border-[var(--syd-accent)] rounded-xl p-2 text-white font-bold outline-none"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">Categoría Clínica</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as MedicalEquipment['category'])}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2.5 text-white font-medium focus:border-[var(--syd-accent)] outline-none cursor-pointer"
                  >
                    <option value="Monitoreo">Monitoreo</option>
                    <option value="Cirugía">Cirugía</option>
                    <option value="Diagnóstico">Diagnóstico</option>
                    <option value="Quirófano">Quirófano</option>
                    <option value="Cuidados Críticos">Cuidados Críticos</option>
                    <option value="Urgencias">Urgencias</option>
                    <option value="Ginecología">Ginecología</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1 flex items-center justify-between">
                    <span>Tipo / Grupo de Producto *</span>
                    <span className="text-[10px] text-cyan-300 font-normal">Clasificación</span>
                  </label>
                  <select
                    value={productGroup}
                    onChange={(e) => setProductGroup(e.target.value as ProductGroup)}
                    className={`w-full bg-[#111c2e] border rounded-xl p-2.5 font-bold outline-none cursor-pointer ${
                      productGroup === 'Instrumental Quirúrgico'
                        ? 'text-purple-300 border-purple-500/50'
                        : productGroup === 'Muebles Hospitalarios'
                        ? 'text-emerald-300 border-emerald-500/50'
                        : productGroup === 'Dispositivos Médicos'
                        ? 'text-amber-300 border-amber-500/50'
                        : 'text-sky-300 border-sky-500/50'
                    }`}
                  >
                    <option value="Equipos Médicos">⚡ Equipos Médicos</option>
                    <option value="Instrumental Quirúrgico">✂️ Instrumental Quirúrgico</option>
                    <option value="Muebles Hospitalarios">🛏️ Muebles Hospitalarios</option>
                    <option value="Dispositivos Médicos">🩺 Dispositivos Médicos</option>
                  </select>
                </div>

                <div className="relative" ref={supplierContainerRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-bold flex items-center gap-1.5 text-xs">
                      <Building2 className="w-4 h-4 text-[var(--syd-accent)]" />
                      <span>Proveedor / Distribuidor Oficial *</span>
                    </label>
                    {supplier.trim() ? (
                      matchSupplierInDirectory(supplier, effectiveBrand).status === 'exact' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>En Directorio (Ventana 5)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-sky-950/80 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded-full font-bold">
                          <Sparkles className="w-3 h-3 text-amber-300" />
                          <span>Se creará automáticamente</span>
                        </span>
                      )
                    ) : null}
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Escriba o elija (Ej: TECNICA / BOVIE / MINDRAY)..."
                      value={supplier}
                      onFocus={() => setShowSupplierDropdown(true)}
                      onChange={(e) => {
                        setSupplier(e.target.value);
                        setShowSupplierDropdown(true);
                      }}
                      className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2.5 text-white font-medium focus:border-[var(--syd-accent)] outline-none text-xs"
                    />

                    {/* Autocomplete Dropdown List */}
                    {showSupplierDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-[#101b2b] border border-[var(--syd-accent)]/40 rounded-xl shadow-2xl z-50 max-h-64 overflow-y-auto divide-y divide-[#334d6e]/40">
                        {/* Fuzzy Match Suggestion / Correction Banner */}
                        {(() => {
                          const matchRes = matchSupplierInDirectory(supplier, effectiveBrand);
                          if (matchRes.status === 'suggested' && matchRes.bestSuggestion) {
                            return (
                              <div className="p-2.5 bg-amber-950/40 border-b border-amber-500/30 flex items-center justify-between gap-2">
                                <div className="text-[11px] text-amber-200">
                                  <span>¿Quiso decir: </span>
                                  <strong className="text-white font-bold">{matchRes.bestSuggestion.name}</strong>?
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSupplier(matchRes.bestSuggestion!.name);
                                    setShowSupplierDropdown(false);
                                  }}
                                  className="text-[10px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2 py-1 rounded-md transition cursor-pointer"
                                >
                                  Corregir
                                </button>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Filtered Directory Suppliers */}
                        {(() => {
                          const q = supplier.trim().toLowerCase();
                          const filtered = availableSuppliers.filter((s) => {
                            if (!q) return true;
                            return (
                              s.name.toLowerCase().includes(q) ||
                              (s.brands && s.brands.some((b) => b.toLowerCase().includes(q))) ||
                              (s.nit && s.nit.toLowerCase().includes(q))
                            );
                          });

                          return (
                            <>
                              {filtered.length > 0 ? (
                                <div className="p-1">
                                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Proveedores en Directorio ({filtered.length})
                                  </div>
                                  {filtered.slice(0, 8).map((s) => {
                                    const isSelected = supplier.trim().toLowerCase() === s.name.toLowerCase();
                                    return (
                                      <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => {
                                          setSupplier(s.name);
                                          if (s.brands && s.brands.length > 0 && brand === 'OTRA' && !customBrand) {
                                            setCustomBrand(s.brands[0]);
                                          }
                                          setShowSupplierDropdown(false);
                                        }}
                                        className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition flex items-center justify-between gap-2 cursor-pointer ${
                                          isSelected
                                            ? 'bg-sky-600/30 text-sky-200 border border-sky-500/40 font-bold'
                                            : 'hover:bg-[#1e314b] text-slate-200'
                                        }`}
                                      >
                                        <div className="min-w-0 flex-1">
                                          <div className="font-bold text-white truncate flex items-center gap-1.5">
                                            <span>{s.name}</span>
                                            {s.nit && (
                                              <span className="text-[10px] text-slate-400 font-normal">NIT: {s.nit}</span>
                                            )}
                                          </div>
                                          {s.brands && s.brands.length > 0 && (
                                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                              Marcas: {s.brands.join(', ')}
                                            </div>
                                          )}
                                        </div>
                                        <span className="shrink-0 text-[10px] text-sky-400 font-semibold">Seleccionar</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : null}

                              {/* Action to create new supplier on the fly */}
                              {supplier.trim() && !availableSuppliers.some((s) => s.name.toLowerCase() === supplier.trim().toLowerCase()) && (
                                <div className="p-2 bg-[#172a44] border-t border-[#334d6e]/60">
                                  <button
                                    type="button"
                                    onClick={() => handleRegisterNewSupplier(supplier)}
                                    className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-md transition cursor-pointer active:scale-95"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                    <span>Crear &amp; Guardar "{supplier.trim()}" en el Directorio</span>
                                  </button>
                                  <p className="text-[10px] text-slate-400 text-center mt-1">
                                    Se registrará automáticamente en el Directorio de Proveedores (Ventana 5).
                                  </p>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Feedback when new supplier is registered */}
                  {supplierCreatedFeedback && (
                    <div className="mt-1 text-[11px] text-emerald-300 font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>{supplierCreatedFeedback}</span>
                    </div>
                  )}

                  {/* Interactive Quick-Pick Chips for Suppliers */}
                  <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400 font-medium">Sugeridos:</span>
                    {availableSuppliers
                      .filter((s) => {
                        if (!supplier.trim()) {
                          // Show suppliers that handle the selected brand or default popular ones
                          if (effectiveBrand && s.brands?.some((b) => b.toLowerCase() === effectiveBrand.toLowerCase())) {
                            return true;
                          }
                          return ['MINDRAY', 'BOVIE', 'TECNICA', 'EDAN', 'SONOSCAPE'].some((k) =>
                            s.name.toUpperCase().includes(k)
                          );
                        }
                        const q = supplier.toLowerCase();
                        return (
                          s.name.toLowerCase().includes(q) ||
                          (s.brands && s.brands.some((b) => b.toLowerCase().includes(q)))
                        );
                      })
                      .slice(0, 4)
                      .map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSupplier(s.name);
                            if (s.brands && s.brands.length > 0 && brand === 'OTRA' && !customBrand) {
                              setCustomBrand(s.brands[0]);
                            }
                            setShowSupplierDropdown(false);
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition cursor-pointer font-bold ${
                            supplier.trim().toLowerCase() === s.name.toLowerCase()
                              ? 'bg-sky-500 text-slate-950 border-sky-400'
                              : 'bg-[#192b45] text-slate-300 hover:text-white border-[#334d6e] hover:border-sky-400'
                          }`}
                        >
                          {s.name}
                        </button>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: Costos con Cálculo Bidireccional COP ⇄ USD & TRM */}
            <div className="bg-[#15253d] p-4 rounded-xl border border-[#334d6e] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#334d6e]/60 pb-2">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>2. Estructura de Costos &amp; Conversión COP ⇄ USD</span>
                </div>

                {/* TRM Controller with Live Fetch from Internet */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[11px] bg-[#111c2e] px-2.5 py-1 rounded-lg border border-[#334d6e]">
                    <Globe className="w-3.5 h-3.5 text-[var(--syd-accent)]" />
                    <span className="text-slate-400">TRM Aplicada:</span>
                    <input
                      type="number"
                      value={trm}
                      onChange={(e) => handleTrmChange(Number(e.target.value) || 0)}
                      className="w-16 bg-transparent text-emerald-400 font-mono font-bold text-right outline-none"
                      title="Editar manualmente la TRM o seleccionar una recomendada"
                    />
                    <span className="text-slate-400 text-[10px]">COP/USD</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFetchLiveTRM('usd')}
                    disabled={isFetchingTrm}
                    className="inline-flex items-center gap-1 bg-[#192b45] hover:bg-[#253f68] text-[var(--syd-accent)] border border-[#334d6e] px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer active:scale-95 disabled:opacity-50"
                    title="Consultar y actualizar la TRM oficial en vivo de internet"
                  >
                    <RefreshCw className={`w-3 h-3 ${isFetchingTrm ? 'animate-spin text-amber-300' : ''}`} />
                    <span>{isFetchingTrm ? 'Consultando...' : 'Actualizar TRM'}</span>
                  </button>
                </div>
              </div>

              {/* Smart Volatility & Recommended Round Exchange Rate Box */}
              <div className="bg-[#111c2e] border border-amber-500/40 rounded-xl p-2.5 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-amber-300 flex items-center gap-1">
                      <span>🛡️ TRM Recomendada de Seguridad (Valor Redondo):</span>
                    </span>
                    <span className="font-mono font-black text-white text-sm bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-lg border border-amber-400/40">
                      ${(trmData.analysis?.recommendedRoundRate || Math.ceil(trmData.rate * 1.05 / 50) * 50).toLocaleString()} COP
                    </span>
                    <span className="text-[10px] text-amber-400/90 font-medium">
                      (+{trmData.analysis?.bufferPercent || '5.1'}% margen de cobertura)
                    </span>
                  </div>

                  {/* Quick 1-click apply buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-400">Aplicar tasa:</span>
                    <button
                      type="button"
                      onClick={() => handleTrmChange(trmData.rate)}
                      className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold border transition cursor-pointer ${
                        trm === trmData.rate
                          ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400'
                          : 'bg-[#15253d] text-slate-300 border-[#334d6e] hover:border-emerald-400/60'
                      }`}
                      title="Usar la TRM oficial del día sin margen de protección"
                    >
                      Oficial: ${trmData.rate.toLocaleString()}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleTrmChange(
                          trmData.analysis?.recommendedRoundRate || Math.ceil(trmData.rate * 1.05 / 50) * 50
                        )
                      }
                      className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-black border transition cursor-pointer ${
                        trm === (trmData.analysis?.recommendedRoundRate || Math.ceil(trmData.rate * 1.05 / 50) * 50)
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                          : 'bg-amber-500/20 text-amber-300 border-amber-400/60 hover:bg-amber-500/30'
                      }`}
                      title="Recomendado: Incluye margen contra alzas del dólar (+5% redondeado)"
                    >
                      ⭐ Segura: ${(trmData.analysis?.recommendedRoundRate || Math.ceil(trmData.rate * 1.05 / 50) * 50).toLocaleString()}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleTrmChange(
                          trmData.analysis?.highProtectionRoundRate || Math.ceil(trmData.rate * 1.075 / 100) * 100
                        )
                      }
                      className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-bold border transition cursor-pointer ${
                        trm === (trmData.analysis?.highProtectionRoundRate || Math.ceil(trmData.rate * 1.075 / 100) * 100)
                          ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400'
                          : 'bg-[#15253d] text-slate-300 border-[#334d6e] hover:border-cyan-400/60'
                      }`}
                      title="Cobertura alta para ofertas de largo plazo (+7.5%)"
                    >
                      Alta Seg.: ${(trmData.analysis?.highProtectionRoundRate || Math.ceil(trmData.rate * 1.075 / 100) * 100).toLocaleString()}
                    </button>
                  </div>
                </div>

                <p className="text-[10.5px] text-slate-300 leading-snug">
                  💡 <strong className="text-amber-200">Conversión Automática:</strong> Al ingresar el costo en dólares (USD), el sistema multiplica automáticamente por la <strong>TRM Recomendada</strong> para obtener el costo base en pesos (COP), el cual se usará en las cotizaciones.
                </p>
              </div>

              {trmFeedback && (
                <div className="p-2 bg-blue-500/15 border border-blue-500/30 rounded-lg text-blue-300 text-[11px] font-medium flex items-center gap-1.5 animate-fadeIn">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  <span>{trmFeedback}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Costo en COP */}
                <div className="bg-[#111c2e] p-3 rounded-xl border border-emerald-500/30 space-y-1">
                  <label className="text-slate-300 font-bold block flex items-center justify-between">
                    <span>Costo Base (COP) *</span>
                    <span className="text-[10px] text-slate-400">Sin IVA</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 font-mono font-bold text-slate-400 text-xs">$</span>
                    <input
                      type="number"
                      required
                      min={0}
                      value={baseCostCOP === 0 ? '' : baseCostCOP}
                      onChange={(e) => handleCOPChange(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-[#15253d] border border-emerald-500/40 rounded-lg pl-6 pr-2 py-1.5 text-emerald-400 font-mono font-black text-sm focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 block pt-0.5">
                    Costo c/ IVA: <strong className="text-cyan-300 font-mono">${calculatedCostWithIva.toLocaleString()}</strong>
                  </span>
                </div>

                {/* Costo en USD */}
                <div className="bg-[#111c2e] p-3 rounded-xl border border-amber-500/30 space-y-1">
                  <label className="text-slate-300 font-bold block flex items-center justify-between">
                    <span>Costo en Dólares (USD)</span>
                    <span className="text-amber-400 font-bold">USD $</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 font-mono font-bold text-amber-400/70 text-xs">$</span>
                    <input
                      type="number"
                      min={0}
                      value={baseCostUSD === 0 ? '' : baseCostUSD}
                      onChange={(e) => handleUSDChange(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full bg-[#15253d] border border-amber-500/40 rounded-lg pl-6 pr-2 py-1.5 text-amber-300 font-mono font-bold text-sm focus:border-amber-400 outline-none"
                    />
                  </div>
                  <span className="text-[10.5px] text-slate-400 block pt-0.5">
                    Calculado a TRM ${trm.toLocaleString()} COP
                  </span>
                </div>

                {/* Exención de IVA */}
                <div className="bg-[#111c2e] p-3 rounded-xl border border-[#334d6e] flex flex-col justify-between">
                  <div>
                    <span className="text-white font-bold block text-xs">Exención de IVA (0%)</span>
                    <span className="text-slate-400 text-[10px] block mt-0.5">
                      Marque si este equipo no causa IVA.
                    </span>
                  </div>
                  <div className="pt-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={taxExempt}
                        onChange={(e) => setTaxExempt(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                      <span className="ml-2 text-xs font-semibold text-slate-300">
                        {taxExempt ? 'Exento (0% IVA)' : 'Aplica 19% IVA'}
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Garantía de Fábrica (Meses)</label>
                  <input
                    type="number"
                    min={0}
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(Number(e.target.value) || 0)}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2.5 text-white font-bold focus:border-[var(--syd-accent)] outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-bold block mb-1">País de Fabricación / Origen</label>
                  <input
                    type="text"
                    value={originCountry}
                    onChange={(e) => setOriginCountry(e.target.value)}
                    placeholder="Ej: Alemania / China / EE.UU."
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2.5 text-white focus:border-[var(--syd-accent)] outline-none"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: Registro Sanitario INVIMA */}
            <div className={`p-4 rounded-xl border transition-all ${
              requiresInvima
                ? 'bg-[#15253d] border-emerald-500/40'
                : 'bg-[#15253d]/70 border-slate-700'
            } space-y-3`}>
              <div className="flex items-center justify-between border-b border-[#334d6e]/60 pb-2">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  {requiresInvima ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ShieldOff className="w-4 h-4 text-slate-400" />
                  )}
                  <span>3. Registro Sanitario INVIMA</span>
                </div>

                {/* Toggle: Aplica / No Requiere INVIMA */}
                <div className="flex items-center gap-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requiresInvima}
                      onChange={(e) => setRequiresInvima(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    <span className={`ml-2 text-xs font-bold ${requiresInvima ? 'text-emerald-300' : 'text-slate-400'}`}>
                      {requiresInvima ? 'Aplica Registro INVIMA' : 'No Requiere INVIMA (No Aplica)'}
                    </span>
                  </label>
                </div>
              </div>

              {requiresInvima ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadeIn">
                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">
                      Número de Registro Sanitario <span className="text-slate-500 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={invimaRecordNumber}
                      onChange={(e) => setInvimaRecordNumber(e.target.value)}
                      placeholder="Ej: INVIMA 2021EBC-0021489"
                      className="w-full bg-[#111c2e] border border-[#334d6e] rounded-lg p-2 text-emerald-300 font-mono font-bold focus:border-emerald-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">
                      Fecha de Vencimiento <span className="text-slate-500 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="date"
                      value={invimaExpiryDate}
                      onChange={(e) => setInvimaExpiryDate(e.target.value)}
                      className="w-full bg-[#111c2e] border border-[#334d6e] rounded-lg p-2 text-white font-medium focus:border-[var(--syd-accent)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 block mb-1 font-semibold">Estado Regulatorio</label>
                    <select
                      value={invimaStatus}
                      onChange={(e) => setInvimaStatus(e.target.value as MedicalEquipment['invimaStatus'])}
                      className="w-full bg-[#111c2e] border border-[#334d6e] rounded-lg p-2 text-white font-semibold focus:border-[var(--syd-accent)] outline-none cursor-pointer"
                    >
                      <option value="Vigente">Vigente</option>
                      <option value="En Renovación">En Renovación</option>
                      <option value="Vencido">Vencido</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="bg-[#111c2e] p-3 rounded-xl border border-slate-700 text-slate-400 text-xs flex items-center gap-2">
                  <ShieldOff className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>Este equipo ha sido marcado como <strong>No Aplica / No Requiere</strong> registro sanitario INVIMA.</span>
                </div>
              )}
            </div>

            {/* SECTION 4: Accesorios y Componentes (MANUAL, SIN RELLENO AUTOMÁTICO) */}
            <div className="bg-[#15253d] p-4 rounded-xl border border-[#334d6e] space-y-3">
              <div className="flex items-center justify-between border-b border-[#334d6e]/60 pb-2">
                <div className="flex items-center gap-2 text-white font-bold text-xs">
                  <Layers className="w-4 h-4 text-purple-400" />
                  <span>4. Accesorios &amp; Componentes del Equipo</span>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 font-mono px-2 py-0.5 rounded-full font-bold">
                    {accessories.length} {accessories.length === 1 ? 'accesorio' : 'accesorios'}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">Personalizable por equipo</span>
              </div>

              {/* Add Accessory Form Bar */}
              <div className="bg-[#111c2e] p-3 rounded-xl border border-[#334d6e] space-y-2">
                <span className="text-[11px] font-bold text-slate-300 block">
                  Agregar nuevo accesorio o elemento:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      placeholder="Nombre del accesorio (ej: Cable ECG 3 derivaciones, Sensor SpO2, Manguera NIBP)..."
                      value={newAccName}
                      onChange={(e) => setNewAccName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddAccessory();
                        }
                      }}
                      className="w-full bg-[#15253d] border border-[#334d6e] rounded-lg px-2.5 py-1.5 text-white font-medium focus:border-purple-400 outline-none text-xs"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-slate-400 font-mono text-[11px]">$</span>
                      <input
                        type="number"
                        min={0}
                        placeholder="Costo COP"
                        value={newAccCost === 0 ? '' : newAccCost}
                        onChange={(e) => setNewAccCost(Number(e.target.value) || 0)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddAccessory();
                          }
                        }}
                        className="w-full bg-[#15253d] border border-[#334d6e] rounded-lg pl-5 pr-2 py-1.5 text-emerald-400 font-mono font-bold focus:border-purple-400 outline-none text-xs"
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-3 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNewAccIncluded(!newAccIncluded)}
                      className={`flex-1 py-1.5 px-2 rounded-lg border text-[10.5px] font-bold transition cursor-pointer text-center truncate ${
                        newAccIncluded
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                      title={newAccIncluded ? 'Incluido en el precio base del equipo' : 'Opcional con costo adicional'}
                    >
                      {newAccIncluded ? '✓ Incluido en Base' : '+ Opcional'}
                    </button>

                    <button
                      type="button"
                      onClick={handleAddAccessory}
                      disabled={!newAccName.trim()}
                      className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 shrink-0 text-xs"
                      title="Agregar accesorio a la lista"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Agregar</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Accessories List */}
              {accessories.length > 0 ? (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {accessories.map((acc, idx) => (
                    <div
                      key={idx}
                      className="bg-[#111c2e] hover:bg-[#132238] border border-[#334d6e] rounded-xl p-2 flex items-center justify-between gap-2 text-xs transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-white truncate">{acc.name}</span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-emerald-400 text-xs font-bold">
                          {acc.costCOP > 0 ? `$${acc.costCOP.toLocaleString()} COP` : 'Sin costo adicional'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleAccessoryIncluded(idx)}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition cursor-pointer ${
                            acc.included
                              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/50 hover:bg-emerald-900/60'
                              : 'bg-amber-950/60 text-amber-300 border-amber-500/50 hover:bg-amber-900/60'
                          }`}
                          title="Clic para alternar entre incluido en base u opcional"
                        >
                          {acc.included ? '✓ Incluido' : '+ Opcional'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAccessory(idx)}
                          className="text-slate-400 hover:text-red-400 p-1 transition cursor-pointer rounded hover:bg-red-500/10"
                          title="Eliminar este accesorio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#111c2e] p-3 rounded-xl border border-slate-700 text-slate-400 text-[11px] text-center">
                  Sin accesorios configurados. Puede agregar los accesorios requeridos arriba o guardar el equipo sin accesorios.
                </div>
              )}
            </div>

            {/* SECTION 5: Descripción Comercial Oficial con Auto-Búsqueda de Internet */}
            <div className="bg-[#15253d] p-4 rounded-xl border border-[#334d6e] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-bold block flex items-center gap-1.5">
                  <span>5. Descripción Comercial Oficial</span>
                  <span className="text-[10.5px] text-slate-400 font-normal">(Para cotizaciones y propuestas)</span>
                </label>

                <div className="flex items-center gap-2">
                  {isFetchingDescription ? (
                    <span className="text-[10px] text-cyan-300 font-medium flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                      <span>Consultando en internet...</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fetchDescriptionFromInternet(name, effectiveBrand, model)}
                      disabled={!name.trim() || isFetchingDescription}
                      className="text-[10px] font-bold text-cyan-300 hover:text-white bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1 disabled:opacity-40"
                      title="Buscar y generar descripción breve oficial de internet según el nombre y modelo del equipo"
                    >
                      <Sparkles className="w-3 h-3 text-cyan-400" />
                      <span>Buscar en Internet con IA</span>
                    </button>
                  )}
                </div>
              </div>

              <textarea
                rows={3}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDescriptionSource('manual');
                }}
                placeholder="Escriba la descripción comercial o ingrese el nombre del equipo arriba para obtener una descripción automática desde internet..."
                className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2.5 text-white focus:border-[var(--syd-accent)] outline-none resize-none leading-relaxed"
              />

              {descriptionSource === 'ai' && description && (
                <div className="flex items-center justify-between text-[10px] text-cyan-300/90 pt-0.5">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Descripción técnica obtenida automáticamente desde internet / fabricante.</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setDescription('');
                      setDescriptionSource(null);
                    }}
                    className="text-slate-400 hover:text-red-400 underline cursor-pointer"
                  >
                    Borrar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-[#334d6e] shrink-0">
            <div className="text-xs text-slate-400">
              Campos con <strong className="text-amber-400">*</strong> son obligatorios
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#15253d] transition cursor-pointer font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={`font-black text-xs px-5 py-2.5 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5 ${
                  isEditing
                    ? 'bg-amber-400 hover:bg-amber-500 text-slate-950'
                    : 'bg-[var(--syd-accent)] hover:bg-[var(--syd-accent-light)] text-slate-950'
                }`}
              >
                {isEditing ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                <span>{isEditing ? 'Guardar Cambios del Equipo' : 'Crear y Guardar Equipo'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
