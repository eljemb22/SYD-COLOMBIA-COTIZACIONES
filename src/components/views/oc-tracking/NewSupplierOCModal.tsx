import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, X, Trash2, Building2, CreditCard, Activity, Boxes, DollarSign, Tag, CheckCircle2, ShieldCheck, FileText, Filter, AlertCircle } from 'lucide-react';
import {
  OCTrackingContract,
  OCTrackingItem,
  OCStatus,
  OCPaymentTerms,
  OCPaymentStatus,
  MedicalEquipment,
  SupplierProfile,
  AuthUser,
} from '../../../types';
import {
  COMMON_SUPPLIERS,
  KNOWN_MANUFACTURERS,
  PAYMENT_TERMS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  OC_STATUS_OPTIONS,
  isEquipmentComplete,
  isCreditPaymentTerms,
  getMatchingEquipmentsForSupplier,
  extractBrandFromSupplier,
  getStoredSupplierProfiles,
  saveStoredSupplierProfiles,
  autoRegisterSupplierIfNotExists,
} from '../../../utils/ocTrackingStorage';
import { cleanNumericString, formatExactCOP, formatCOP } from '../../../utils/formatters';

interface NewSupplierOCModalProps {
  existingContracts?: OCTrackingContract[];
  preselectedContractId?: string;
  equipments: MedicalEquipment[];
  distinctSuppliers: string[];
  currentUser?: AuthUser | null;
  onClose: () => void;
  onSave: (contract: OCTrackingContract) => void;
}

interface TempEquipmentRow {
  tempId: string;
  name: string;
  brand: string;
  model: string;
  quantity: number;
  costPriceCOP: number;
  taxRate?: number;
  code?: string;
  equipmentId?: string;
}

export const NewSupplierOCModal: React.FC<NewSupplierOCModalProps> = ({
  existingContracts = [],
  preselectedContractId,
  equipments,
  distinctSuppliers,
  currentUser,
  onClose,
  onSave,
}) => {
  // Determine initial selected contract ID: prefer preselected, otherwise default to 'new' for direct quick order
  const initialContractId = useMemo(() => {
    if (preselectedContractId) return preselectedContractId;
    return 'new';
  }, [preselectedContractId]);

  // Mode: attach to existing contract or create new contract
  const [selectedContractId, setSelectedContractId] = useState<string>(initialContractId);

  // Active existing contract object if attached
  const activeContract = useMemo(() => {
    if (selectedContractId === 'new') return null;
    return existingContracts.find((c) => c.id === selectedContractId) || null;
  }, [selectedContractId, existingContracts]);
  
  // Direct Client fields (only used when creating a standalone / direct client order)
  const [newClientName, setNewClientName] = useState('');
  const [newContractNumber, setNewContractNumber] = useState('');
  const [newNit, setNewNit] = useState('');
  const [newCity, setNewCity] = useState('Colombia');
  const [newContractBudgetCOP, setNewContractBudgetCOP] = useState<number>(0);

  // Supplier OC fields
  const [supplier, setSupplier] = useState('');
  const [supplierNit, setSupplierNit] = useState('');
  const [supplierContact, setSupplierContact] = useState('');
  const [ocNumber, setOcNumber] = useState(
    `OC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
  );
  const [paymentTerms, setPaymentTerms] = useState<OCPaymentTerms | string>('Crédito 30 días');
  const [paymentStatus, setPaymentStatus] = useState<OCPaymentStatus | string>('Pendiente');
  const [status, setStatus] = useState<OCStatus | string>('Emitida / Enviada al Proveedor');
  const [notes, setNotes] = useState('');

  // Option to see all catalog items if supplier is an authorized multibrand distributor
  const [showAllBrandsOverride, setShowAllBrandsOverride] = useState(false);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Equipments List (Supports 1 to 100 items)
  const [itemsList, setItemsList] = useState<TempEquipmentRow[]>([
    {
      tempId: `row-${Date.now()}-1`,
      name: '',
      brand: '',
      model: '',
      quantity: 1,
      costPriceCOP: 0,
      taxRate: 0.19,
    },
  ]);

  // Dynamic matching of complete equipments based on selected supplier/brand
  const supplierEquipmentMatch = useMemo(() => {
    return getMatchingEquipmentsForSupplier(equipments, supplier, !showAllBrandsOverride);
  }, [equipments, supplier, showAllBrandsOverride]);

  const isCredit = useMemo(() => isCreditPaymentTerms(paymentTerms), [paymentTerms]);

  // Supplier Autocomplete state
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const supplierInputContainerRef = useRef<HTMLDivElement | null>(null);

  // Close supplier dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        supplierInputContainerRef.current &&
        !supplierInputContainerRef.current.contains(e.target as Node)
      ) {
        setShowSupplierDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const storedProfiles = useMemo(() => getStoredSupplierProfiles(), []);

  const allAvailableSuppliers = useMemo(() => {
    const set = new Set<string>();
    storedProfiles.forEach((p) => {
      if (p.name && p.name.trim()) set.add(p.name.trim());
      if (p.brands) p.brands.forEach((b) => b && b.trim() && set.add(b.trim()));
    });
    KNOWN_MANUFACTURERS.forEach((m) => set.add(m));
    COMMON_SUPPLIERS.forEach((s) => set.add(s));
    distinctSuppliers.forEach((s) => set.add(s));
    equipments.forEach((e) => {
      if (e.brand && e.brand.trim()) set.add(e.brand.trim());
      if (e.supplier && e.supplier.trim()) set.add(e.supplier.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [storedProfiles, distinctSuppliers, equipments]);

  const matchingSuppliers = useMemo(() => {
    const q = (supplier || '').trim().toLowerCase();
    if (!q) return allAvailableSuppliers.slice(0, 10);
    return allAvailableSuppliers.filter((s) => s.toLowerCase().includes(q));
  }, [supplier, allAvailableSuppliers]);

  // Primary Biomedical Manufacturers for quick selection
  const quickManufacturersList = useMemo(() => {
    const list: string[] = [];
    const pushIfNew = (name: string) => {
      if (name && !list.some((x) => x.toLowerCase() === name.toLowerCase())) {
        list.push(name);
      }
    };
    // Include known manufacturers and directory items
    ['Mindray', 'COMEN', 'Draeger', 'Sysmex', 'EDAN', 'GE Healthcare', 'Philips', 'Welch Allyn', 'SonoScape', 'Siemens', 'Zoll', 'Maquet', 'Fresenius'].forEach(pushIfNew);
    storedProfiles.forEach((p) => {
      if (p.brands && p.brands.length > 0) p.brands.forEach(pushIfNew);
      else pushIfNew(p.name);
    });
    return list.slice(0, 9);
  }, [storedProfiles]);

  const handleSelectSupplier = (name: string) => {
    setSupplier(name);
    setShowSupplierDropdown(false);
    const detected = extractBrandFromSupplier(name);
    if (detected) {
      setItemsList((prev) =>
        prev.map((row) => (row.brand.trim() === '' ? { ...row, brand: detected } : row))
      );
    }
  };

  const handleContractSelectionChange = (contractId: string) => {
    setSelectedContractId(contractId);
  };

  const handleSelectSupplierPill = (name: string) => {
    setSupplier(name);
    // If blank rows exist with no brand, autofill brand with detected manufacturer
    const detected = extractBrandFromSupplier(name);
    if (detected) {
      setItemsList((prev) =>
        prev.map((row) => (row.brand.trim() === '' ? { ...row, brand: detected } : row))
      );
    }
  };

  const handleAddBlankRow = () => {
    const detected = extractBrandFromSupplier(supplier);
    setItemsList((prev) => [
      ...prev,
      {
        tempId: `row-${Date.now()}-${prev.length + 1}`,
        name: '',
        brand: detected || '',
        model: '',
        quantity: 1,
        costPriceCOP: 0,
        taxRate: 0.19,
      },
    ]);
  };

  const handleAddFromCatalog = (eqId: string) => {
    const eq = equipments.find((e) => e.id === eqId);
    if (!eq) return;

    // Strict validation: must be complete
    if (!isEquipmentComplete(eq)) {
      alert(`El equipo "${eq.name}" tiene información incompleta o costo de $0 COP. Complete su información en el Catálogo antes de agregarlo a la OC.`);
      return;
    }

    if (!supplier) {
      if (eq.supplier) {
        setSupplier(eq.supplier);
      } else if (eq.brand) {
        setSupplier(eq.brand);
      }
    }

    setItemsList((prev) => [
      ...prev.filter((r) => r.name.trim() !== ''),
      {
        tempId: `row-${Date.now()}-${prev.length + 1}`,
        equipmentId: eq.id,
        code: eq.code,
        name: eq.name,
        brand: eq.brand,
        model: eq.model,
        quantity: 1,
        costPriceCOP: eq.baseCostCOP || 0,
        taxRate: eq.taxExempt ? 0 : (eq.taxRate !== undefined ? eq.taxRate : 0.19),
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof TempEquipmentRow, val: any) => {
    setItemsList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleRemoveRow = (index: number) => {
    if (itemsList.length <= 1) return;
    setItemsList((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotalBeforeTax = itemsList.reduce((sum, it) => sum + (it.costPriceCOP || 0) * (it.quantity || 1), 0);
  const totalTax = itemsList.reduce((sum, it) => sum + ((it.costPriceCOP || 0) * (it.quantity || 1) * (it.taxRate !== undefined ? it.taxRate : 0.19)), 0);
  const totalCost = subtotalBeforeTax + totalTax;
  const totalUnits = itemsList.reduce((sum, it) => sum + (it.quantity || 1), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier.trim()) {
      alert('Por favor ingrese o seleccione el Proveedor / Fabricante');
      return;
    }
    if (!ocNumber.trim()) {
      alert('Por favor ingrese el N° de Orden de Compra (OC)');
      return;
    }

    if (selectedContractId === 'new' && !newClientName.trim()) {
      alert('Por favor ingrese el nombre del Cliente / Hospital para esta nueva Orden de Compra');
      return;
    }

    const validItems = itemsList.filter((it) => it.name.trim().length > 0);
    if (validItems.length === 0) {
      alert('Por favor agregue al menos un equipo médico en la Orden de Compra');
      return;
    }

    // Verify all items have complete data
    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      if (!it.brand.trim() || !it.model.trim()) {
        alert(`El equipo #${i + 1} (${it.name}) debe tener Marca y Modelo definidos.`);
        return;
      }
      if (!it.costPriceCOP || it.costPriceCOP <= 0) {
        alert(`El equipo #${i + 1} (${it.name}) no puede tener costo de $0 COP. Ingrese el costo de compra.`);
        return;
      }
    }

    // Set payment status based on credit terms
    const finalPaymentStatus: OCPaymentStatus = isCredit
      ? 'Crédito Vigente (Por Vencer)'
      : (paymentStatus as OCPaymentStatus) || 'Pendiente';

    const finalItems: OCTrackingItem[] = validItems.map((v, idx) => {
      const rowRate = v.taxRate !== undefined ? v.taxRate : 0.19;
      const rowSubtotal = (Number(v.costPriceCOP) || 0) * (Number(v.quantity) || 1);
      const rowTotal = rowSubtotal * (1 + rowRate);

      return {
        id: `oc-item-${Date.now()}-${idx}`,
        equipmentId: v.equipmentId,
        code: v.code || `EQ-OC-${idx + 1}`,
        name: v.name,
        brand: v.brand || 'SYD Biomedical',
        model: v.model || 'Standard',
        quantity: Number(v.quantity) || 1,
        costPriceCOP: Number(v.costPriceCOP) || 0,
        totalCostCOP: rowTotal,
        supplier: supplier.trim(),
        supplierNit: supplierNit.trim(),
        supplierContact: supplierContact.trim(),
        ocNumber: ocNumber.trim(),
        status: status,
        paymentTerms: paymentTerms,
        paymentStatus: finalPaymentStatus,
        notes: notes,
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        history: [
          {
            id: `log-init-${Date.now()}-${idx}`,
            timestamp: new Date().toISOString(),
            newStatus: status,
            user: currentUser ? `${currentUser.name}` : 'Usuario SYD',
            note: `Creación inicial de la Orden de Compra ${ocNumber.trim()} para ${supplier.trim()} (Subtotal: ${formatCOP(rowSubtotal)}, Total con IVA: ${formatCOP(rowTotal)}).`,
          },
        ],
      };
    });

    // Auto-register the supplier/manufacturer in the global directory if it's new
    try {
      autoRegisterSupplierIfNotExists(supplier.trim(), undefined, {
        nit: supplierNit.trim(),
        contactPerson: supplierContact.trim(),
        defaultPaymentTerms: paymentTerms,
      });
    } catch (e) {
      console.warn('Auto-register supplier warning:', e);
    }

    if (activeContract) {
      const mergedItems = [...activeContract.items, ...finalItems];
      const updatedContract: OCTrackingContract = {
        ...activeContract,
        items: mergedItems,
        totalCostCOP: mergedItems.reduce((s, it) => s + it.totalCostCOP, 0),
        lastUpdatedAt: new Date().toISOString(),
      };
      onSave(updatedContract);
      return;
    }

    const newContract: OCTrackingContract = {
      id: `oc-contract-${Date.now()}`,
      sourceType: 'manual',
      contractNumber: newContractNumber.trim() || `PED-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
      ocNumber: ocNumber.trim(),
      supplier: supplier.trim(),
      supplierNit: supplierNit.trim(),
      supplierContact: supplierContact.trim(),
      clientName: newClientName.trim() || 'Cliente Directo SYD',
      nit: newNit.trim() || 'N/A',
      city: newCity.trim() || 'Colombia',
      totalCostCOP: totalCost,
      totalBudgetCOP: Number(newContractBudgetCOP) || 0,
      globalStatus: status,
      paymentTerms: paymentTerms,
      paymentStatus: finalPaymentStatus,
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      notes: notes,
      items: finalItems,
    };

    onSave(newContract);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-2.5 sm:p-4 md:p-6 backdrop-blur-xs animate-fadeIn overflow-y-auto"
    >
      <div className="bg-[#192b45] border border-[#334d6e] rounded-2xl w-full max-w-5xl lg:max-w-6xl max-h-[82vh] h-[80vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-4 py-2.5 bg-[#142338] border-b border-[#334d6e] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <Plus className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">
                {activeContract ? (
                  <span>Nueva OC — <span className="text-sky-300">{activeContract.clientName}</span></span>
                ) : (
                  <span>Nueva Orden de Compra Rápida / Pedido Directo</span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                {activeContract ? (
                  <span>Asociada al proceso <strong className="text-purple-300 font-mono">{activeContract.contractNumber}</strong>. Ingrese proveedor y equipos.</span>
                ) : (
                  <span>Registre una orden de compra para un cliente directo o venta rápida sin licitación previa.</span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2.5 text-xs">
          {/* Section 1: Vincular a Contrato / Destino */}
          <div className="bg-[#15253d] p-2.5 rounded-xl border border-[#334d6e] space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-400" />
                <span>Destino / Contrato del Cliente</span>
              </h4>
              
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-semibold">Vincular a:</span>
                <select
                  value={selectedContractId}
                  onChange={(e) => handleContractSelectionChange(e.target.value)}
                  className="bg-[#101b2b] border border-purple-500/50 rounded-lg px-2.5 py-0.5 text-sky-300 font-bold outline-none cursor-pointer focus:border-sky-400 text-xs"
                >
                  {existingContracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.sourceType === 'licitacion_adjudicada' ? '🏛️' : '📄'} {c.contractNumber} — {c.clientName} ({c.items.length} equipos)
                    </option>
                  ))}
                  <option value="new">+ Crear Nueva Orden Directa (Nuevo Cliente)</option>
                </select>
              </div>
            </div>

            {/* If linked to an existing / awarded contract: Display automatic clean summary card */}
            {activeContract ? (
              <div className="bg-[#101b2b] border border-[#2b415f] rounded-lg p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-inner">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-white">{activeContract.clientName}</span>
                      <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[9.5px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-purple-400" />
                        {activeContract.sourceType === 'licitacion_adjudicada' ? 'Licitación Adjudicada' : 'Contrato / Pedido'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap font-mono">
                      <span>Proceso: <strong className="text-purple-300 font-sans">{activeContract.contractNumber}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>NIT: <strong className="text-slate-300 font-sans">{activeContract.nit || 'Sin NIT'}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span>Ciudad: <strong className="text-slate-300 font-sans">{activeContract.city || 'Colombia'}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-emerald-300 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Datos vinculados</span>
                </div>
              </div>
            ) : (
              /* If creating a standalone direct purchase order: Prompt only for client name and basic reference */
              <div className="space-y-2 pt-0.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">Cliente / Hospital / Entidad *:</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Hospital San Ignacio"
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2.5 py-1 text-white outline-none focus:border-[#38bdf8] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">N° Pedido / Referencia:</label>
                    <input
                      type="text"
                      placeholder="Ej: PED-2026-001 o Venta Directa"
                      value={newContractNumber}
                      onChange={(e) => setNewContractNumber(e.target.value)}
                      className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2.5 py-1 text-purple-300 font-mono outline-none focus:border-[#38bdf8] text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">NIT / Ciudad:</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        placeholder="NIT: 860.012.345-1"
                        value={newNit}
                        onChange={(e) => setNewNit(e.target.value)}
                        className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2 py-1 text-slate-300 font-mono outline-none focus:border-[#38bdf8] text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Ciudad"
                        value={newCity}
                        onChange={(e) => setNewCity(e.target.value)}
                        className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2 py-1 text-white outline-none focus:border-[#38bdf8] text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Valor Total / Presupuesto del Contrato o Venta */}
                <div className="bg-[#101b2b] p-2 rounded-lg border border-emerald-500/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-emerald-300 font-bold text-[11px] flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Valor / Presupuesto Total del Contrato o Venta ($ COP):</span>
                    </label>
                    {newContractBudgetCOP > 0 && (
                      <span className="text-[11px] font-black text-emerald-300 font-mono">
                        $ {newContractBudgetCOP.toLocaleString('es-CO')} COP
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="Ej: 180000000"
                    value={newContractBudgetCOP === 0 ? '' : newContractBudgetCOP}
                    onChange={(e) =>
                      setNewContractBudgetCOP(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))
                    }
                    className="w-full bg-[#0a1322] border border-[#334d6e] rounded-lg px-2.5 py-1 text-white font-mono font-bold outline-none focus:border-emerald-400 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Datos del Proveedor & Orden de Compra & Condiciones (Grid compacto) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {/* Box 1: Proveedor & N° OC */}
            <div className="bg-[#15253d] p-2.5 rounded-xl border border-[#334d6e] space-y-2">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Proveedor / Fabricante & N° de OC</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-start">
                <div ref={supplierInputContainerRef} className="relative">
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-slate-300 font-bold text-[11px]">Proveedor / Fabricante *:</label>
                    {supplierEquipmentMatch.detectedBrand && (
                      <span className="text-[9px] font-black text-amber-300 bg-amber-950/60 px-1 rounded border border-amber-500/40">
                        Marca: {supplierEquipmentMatch.detectedBrand}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Ej: Mindray, Draeger, Sysmex, COMEN..."
                      value={supplier}
                      onFocus={() => setShowSupplierDropdown(true)}
                      onChange={(e) => {
                        setSupplier(e.target.value);
                        setShowSupplierDropdown(true);
                      }}
                      className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2.5 py-1 text-white font-bold outline-none focus:border-[#38bdf8] text-xs"
                    />

                    {/* Floating Autocomplete Dropdown */}
                    {showSupplierDropdown && matchingSuppliers.length > 0 && (
                      <div className="absolute top-full left-0 z-50 mt-1 w-full bg-[#0d1624] border border-[#334d6e] rounded-xl shadow-2xl p-1 overflow-hidden animate-fadeIn">
                        <div className="px-2 py-0.5 text-[9px] font-bold text-sky-400 uppercase tracking-wider bg-[#15253d] rounded mb-1 flex items-center justify-between">
                          <span>Directorio de Fabricantes / Proveedores</span>
                          <span className="text-[8.5px] text-slate-400 font-normal">Clic para seleccionar</span>
                        </div>
                        <div className="max-h-40 overflow-y-auto space-y-0.5 scrollbar-thin">
                          {matchingSuppliers.map((sName) => (
                            <button
                              key={`sup_sugg_${sName}`}
                              type="button"
                              onClick={() => handleSelectSupplier(sName)}
                              className="w-full text-left px-2 py-1 rounded-md hover:bg-sky-500/20 text-slate-200 hover:text-white transition flex items-center justify-between cursor-pointer text-xs"
                            >
                              <span className="font-bold">{sName}</span>
                              <span className="text-[9.5px] text-sky-300/80 bg-sky-950/50 px-1.5 py-0.2 rounded border border-sky-800/40">
                                Fabricante
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Fabricantes Pills from Directory */}
                  <div className="flex items-center gap-1 flex-wrap pt-1">
                    <span className="text-[9.5px] text-slate-400 font-bold mr-0.5">Fabricantes:</span>
                    {quickManufacturersList.map((brand) => (
                      <button
                        key={brand}
                        type="button"
                        onClick={() => handleSelectSupplierPill(brand)}
                        className={`text-[9.5px] px-1.5 py-0.2 rounded border transition cursor-pointer ${
                          supplier.toLowerCase().includes(brand.toLowerCase())
                            ? 'bg-sky-500 text-slate-950 font-black border-sky-400 shadow-sm'
                            : 'bg-[#101b2b] text-slate-300 border-[#334d6e] hover:border-sky-400 hover:text-white'
                        }`}
                      >
                        {brand}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">N° Orden de Compra (OC) *:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: OC-2026-0089"
                    value={ocNumber}
                    onChange={(e) => setOcNumber(e.target.value)}
                    className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2.5 py-1 text-sky-300 font-mono font-bold outline-none focus:border-[#38bdf8] text-xs"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Identificador de compra formal para trazabilidad y recepción.
                  </p>
                </div>
              </div>
            </div>

            {/* Box 2: Condiciones Comerciales & Pago */}
            <div className="bg-[#15253d] p-2.5 rounded-xl border border-[#334d6e] space-y-2">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                <span>Condiciones de Pago & Estado Logístico</span>
              </h4>

              <div className={`grid gap-2 ${isCredit ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
                <div>
                  <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">Forma de Pago:</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2 py-1 text-sky-300 font-bold outline-none text-xs cursor-pointer"
                  >
                    {PAYMENT_TERMS_OPTIONS.map((opt) => (
                      <option key={opt.terms} value={opt.terms}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {isCredit && (
                    <span className="inline-block text-[9.5px] text-sky-300/90 mt-1 font-semibold">
                      💳 Pago diferido según plazo comercial
                    </span>
                  )}
                </div>

                {/* Show Estado Pago only if it's not credit (e.g. Contado / Anticipo / Contra entrega) */}
                {!isCredit && (
                  <div>
                    <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">Estado Pago:</label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value as any)}
                      className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2 py-1 text-emerald-300 font-bold outline-none text-xs cursor-pointer"
                    >
                      {PAYMENT_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.status} value={opt.status}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">Estado Operativo:</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as OCStatus)}
                    className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2 py-1 text-white font-bold outline-none text-xs cursor-pointer"
                  >
                    {OC_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.status} value={opt.status}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Observaciones de compra / promesa de entrega de fábrica (opcional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2.5 py-1 text-white text-[11px] outline-none focus:border-[#38bdf8]"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Equipos Médicos */}
          <div className="bg-[#15253d] p-2.5 rounded-xl border border-[#334d6e] space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Boxes className="w-3.5 h-3.5 text-amber-400" />
                  <span>Equipos Médicos en la OC ({itemsList.length})</span>
                </h4>
                {supplierEquipmentMatch.detectedBrand && !showAllBrandsOverride && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                    <Filter className="w-3 h-3" />
                    <span>Filtrando catálogo por: <strong>{supplierEquipmentMatch.detectedBrand}</strong> ({supplierEquipmentMatch.matching.length} equipos con costo)</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {supplierEquipmentMatch.detectedBrand && (
                  <button
                    type="button"
                    onClick={() => setShowAllBrandsOverride(!showAllBrandsOverride)}
                    className="text-[10px] text-slate-400 hover:text-sky-300 underline font-semibold cursor-pointer"
                  >
                    {showAllBrandsOverride ? 'Restringir a marca ' + supplierEquipmentMatch.detectedBrand : 'Distribuidor multimarca (Ver todas)'}
                  </button>
                )}

                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddFromCatalog(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="bg-[#101b2b] border border-[#334d6e] rounded-lg px-2 py-0.5 text-[11px] text-amber-300 outline-none cursor-pointer max-w-[280px]"
                >
                  <option value="" disabled>+ Agregar desde Catálogo...</option>
                  {supplierEquipmentMatch.matching.length === 0 ? (
                    <option value="" disabled>No hay equipos con costo completo para este proveedor</option>
                  ) : (
                    supplierEquipmentMatch.matching.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} — {eq.brand} ({eq.model}) • ${(eq.baseCostCOP || 0).toLocaleString('es-CO')}
                      </option>
                    ))
                  )}
                </select>

                <button
                  type="button"
                  onClick={handleAddBlankRow}
                  className="inline-flex items-center gap-1 bg-[#38bdf8]/20 hover:bg-[#38bdf8]/30 text-sky-300 border border-sky-400/40 text-[11px] font-bold px-2 py-0.5 rounded-lg transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Agregar Fila</span>
                </button>
              </div>
            </div>

            {/* Rows Table */}
            <div className="overflow-x-auto max-h-48 overflow-y-auto rounded-lg border border-[#223854]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-[#101b2b] z-10">
                  <tr className="text-slate-400 border-b border-[#334d6e] text-[10px] sm:text-[10.5px] font-bold">
                    <th className="py-1 px-1.5 w-6 text-center">#</th>
                    <th className="py-1 px-2 min-w-[140px]">Equipo Médico *</th>
                    <th className="py-1 px-1.5 w-24">Marca *</th>
                    <th className="py-1 px-1.5 w-24">Modelo *</th>
                    <th className="py-1 px-1 w-10 text-center">Cant *</th>
                    <th className="py-1 px-1.5 w-28 text-right">Costo Antes IVA *</th>
                    <th className="py-1 px-1.5 w-28 text-right">Subtotal Antes IVA</th>
                    <th className="py-1 px-1 w-14 text-center">IVA</th>
                    <th className="py-1 px-2 w-28 text-right">Total</th>
                    <th className="py-1 px-1 w-6 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#223854] bg-[#101b2b]/60">
                  {itemsList.map((row, idx) => {
                    const rowRate = row.taxRate !== undefined ? row.taxRate : 0.19;
                    const rowSubtotalBeforeTax = (row.costPriceCOP || 0) * (row.quantity || 1);
                    const rowTax = rowSubtotalBeforeTax * rowRate;
                    const rowTotal = rowSubtotalBeforeTax + rowTax;
                    const isRowIncomplete = !row.name.trim() || !row.brand.trim() || !row.model.trim() || (row.costPriceCOP || 0) <= 0;

                    return (
                      <tr key={row.tempId} className={`hover:bg-[#182a44] ${isRowIncomplete ? 'bg-amber-950/10' : ''}`}>
                        <td className="py-1 px-1.5 text-center text-slate-400 font-mono text-[10.5px]">
                          {idx + 1}
                        </td>
                        <td className="py-1 px-1.5">
                          <input
                            type="text"
                            required
                            placeholder="Nombre del equipo..."
                            value={row.name}
                            onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                            className="w-full bg-[#101b2b] border border-[#334d6e] rounded px-1.5 py-0.5 text-white outline-none focus:border-[#38bdf8] text-xs"
                          />
                        </td>
                        <td className="py-1 px-1.5">
                          <input
                            type="text"
                            required
                            placeholder="Marca..."
                            value={row.brand}
                            onChange={(e) => handleUpdateItem(idx, 'brand', e.target.value)}
                            className="w-full bg-[#101b2b] border border-[#334d6e] rounded px-1.5 py-0.5 text-white outline-none focus:border-[#38bdf8] text-xs font-semibold"
                          />
                        </td>
                        <td className="py-1 px-1.5">
                          <input
                            type="text"
                            required
                            placeholder="Modelo..."
                            value={row.model}
                            onChange={(e) => handleUpdateItem(idx, 'model', e.target.value)}
                            className="w-full bg-[#101b2b] border border-[#334d6e] rounded px-1.5 py-0.5 text-white outline-none focus:border-[#38bdf8] text-xs"
                          />
                        </td>
                        <td className="py-1 px-1 text-center">
                          <input
                            type="number"
                            min="1"
                            required
                            value={row.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-10 text-center bg-[#101b2b] border border-[#334d6e] rounded py-0.5 text-white font-black outline-none focus:border-[#38bdf8] text-xs"
                          />
                        </td>
                        <td className="py-1 px-1.5 text-right">
                          <input
                            type="number"
                            min="1"
                            required
                            placeholder="Costo Antes IVA..."
                            value={row.costPriceCOP || ''}
                            onChange={(e) => handleUpdateItem(idx, 'costPriceCOP', parseFloat(e.target.value) || 0)}
                            className={`w-full text-right bg-[#101b2b] border rounded px-1.5 py-0.5 font-bold outline-none text-xs ${
                              (row.costPriceCOP || 0) <= 0
                                ? 'border-rose-500/70 text-rose-300 focus:border-rose-400'
                                : 'border-[#334d6e] text-emerald-400 focus:border-[#38bdf8]'
                            }`}
                          />
                        </td>
                        <td className="py-1 px-1.5 text-right font-bold text-sky-300 text-xs">
                          ${rowSubtotalBeforeTax.toLocaleString('es-CO')}
                        </td>
                        <td className="py-1 px-1 text-center">
                          <select
                            value={rowRate}
                            onChange={(e) => handleUpdateItem(idx, 'taxRate', parseFloat(e.target.value))}
                            className="bg-[#101b2b] border border-[#334d6e] text-[10px] text-amber-300 rounded px-1 py-0.5 font-bold outline-none cursor-pointer"
                            title="Tasa de IVA para este equipo"
                          >
                            <option value={0.19}>19%</option>
                            <option value={0.05}>5%</option>
                            <option value={0}>0%</option>
                          </select>
                        </td>
                        <td className="py-1 px-2 text-right font-black text-emerald-400 text-xs">
                          ${rowTotal.toLocaleString('es-CO')}
                        </td>
                        <td className="py-1 px-1 text-center">
                          {itemsList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-400 rounded transition cursor-pointer"
                              title="Eliminar fila"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals Summary & Incomplete Notice */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-1.5 border-t border-[#334d6e] text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">
                  Total Equipos: <strong className="text-white">{totalUnits}</strong> uds
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-[10.5px] text-slate-400">
                  Costo antes de IVA, subtotal y total calculados.
                </span>
              </div>
              <div className="flex items-center gap-3 text-right">
                <div>
                  <span className="text-slate-400 text-[11px] block">Subtotal Antes IVA:</span>
                  <span className="text-xs sm:text-sm font-bold text-sky-300">
                    ${subtotalBeforeTax.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="border-l border-[#334d6e] pl-3">
                  <span className="text-slate-400 text-[11px] block">IVA Liquidado:</span>
                  <span className="text-xs sm:text-sm font-bold text-amber-300">
                    ${totalTax.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="border-l border-[#334d6e] pl-3">
                  <span className="text-slate-300 text-[11px] font-bold block">Total OC (con IVA):</span>
                  <span className="text-sm sm:text-base font-black text-emerald-400">
                    ${totalCost.toLocaleString('es-CO')} COP
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#334d6e]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-slate-300 hover:bg-[#15253d] transition font-bold cursor-pointer text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 text-slate-950 font-black hover:from-sky-300 hover:to-blue-400 transition shadow-md cursor-pointer text-xs"
            >
              Guardar y Registrar Orden de Compra
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

