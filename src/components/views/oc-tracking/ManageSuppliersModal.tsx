import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Building2,
  Phone,
  Mail,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Save,
  Truck,
  DollarSign,
  Tag,
  History,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Edit3,
  Calendar,
  Layers,
  MapPin,
  User,
  Package,
  Trash2,
  GitMerge,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Check,
  Info,
} from 'lucide-react';
import {
  SupplierProfile,
  OCTrackingContract,
  OCTrackingItem,
  OCLogisticsStatus,
  OCPaymentTerms,
  OCPaymentStatus,
  MedicalEquipment,
  AuthUser,
} from '../../../types';
import {
  getStoredSupplierProfiles,
  saveStoredSupplierProfiles,
  deleteSupplierProfile,
  clearAllSupplierProfiles,
  syncSupplierUpdatesToContracts,
} from '../../../utils/ocTrackingStorage';
import {
  detectDuplicateSupplierGroups,
  unifyAllDuplicateSuppliers,
  unifySingleDuplicateGroup,
  DuplicateSupplierGroup,
} from '../../../utils/supplierDeduplication';
import {
  deleteSupplierFromFirestore,
  saveSuppliersBatchToFirestore,
} from '../../../services/realtimeSync';

interface ManageSuppliersModalProps {
  contracts: OCTrackingContract[];
  equipments?: MedicalEquipment[];
  currentUser?: AuthUser | null;
  onClose: () => void;
  onUpdateContracts: (updatedContracts: OCTrackingContract[]) => void;
}

const DEFAULT_KNOWN_BRANDS = [
  'Mindray',
  'COMEN',
  'Draeger',
  'Edan',
  'GE Healthcare',
  'Philips',
  'Bionet',
  'Bovie',
  'Fresenius',
  'Getinge',
  'Nihon Kohden',
  'Medtronic',
  'Sysmex',
  'Zoll',
  'Stryker',
  'Siemens Healthineers',
  'Olympus',
  'SonoScape',
  'Hamilton Medical',
  'Weinmann',
  'Fisher & Paykel',
  'Terumo',
  'Karl Storz',
  'Welch Allyn',
  'Hill-Rom',
  'Baxter',
  'Masimo',
];

export const ManageSuppliersModal: React.FC<ManageSuppliersModalProps> = ({
  contracts,
  equipments = [],
  currentUser,
  onClose,
  onUpdateContracts,
}) => {
  // Load suppliers from storage (auto-discovering from both contracts and equipment catalog)
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>(() =>
    getStoredSupplierProfiles(contracts, equipments)
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'info' | 'equipments' | 'orders' | 'traceability'>('info');
  const [isEditingNew, setIsEditingNew] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<{ id: string; name: string } | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [showDeduplicationModal, setShowDeduplicationModal] = useState(false);
  const [isUnifying, setIsUnifying] = useState(false);
  const [dismissedGroupIds, setDismissedGroupIds] = useState<Set<string>>(new Set());
  const [customCanonicalIds, setCustomCanonicalIds] = useState<Map<string, string>>(new Map());

  // Detect duplicate groups using canonical normalization, Levenshtein, and NIT matching
  const detectedDuplicateGroups = useMemo(() => {
    const allGroups = detectDuplicateSupplierGroups(suppliers);
    return allGroups.filter((g) => !dismissedGroupIds.has(g.groupId));
  }, [suppliers, dismissedGroupIds]);

  const totalDuplicatesCount = useMemo(() => {
    return detectedDuplicateGroups.reduce((acc, g) => acc + g.duplicateProfiles.length, 0);
  }, [detectedDuplicateGroups]);

  // Unify all detected duplicate groups
  const handleUnifyAll = () => {
    setIsUnifying(true);
    try {
      const res = unifyAllDuplicateSuppliers(suppliers, contracts);
      setSuppliers(res.unifiedSuppliers);
      saveStoredSupplierProfiles(res.unifiedSuppliers);

      if (res.updatedContracts && res.updatedContracts !== contracts) {
        onUpdateContracts(res.updatedContracts);
      }

      // Cleanup deleted profiles from Firestore
      res.deletedIds.forEach((delId) => {
        deleteSupplierFromFirestore(delId).catch(() => {});
      });
      saveSuppliersBatchToFirestore(res.unifiedSuppliers).catch(() => {});

      if (selectedSupplierId && res.deletedIds.includes(selectedSupplierId)) {
        setSelectedSupplierId('');
      }

      setSaveSuccessMsg(`✓ Se unificaron con éxito ${res.mergedCount} proveedores duplicados en ${res.mergedGroupsSummary.length} perfiles oficiales.`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
      setShowDeduplicationModal(false);
    } catch (err) {
      console.error('Error unifying suppliers:', err);
    } finally {
      setIsUnifying(false);
    }
  };

  // Unify a single selected duplicate group
  const handleUnifySingleGroup = (group: DuplicateSupplierGroup) => {
    setIsUnifying(true);
    try {
      const preferredId = customCanonicalIds.get(group.groupId);
      const res = unifySingleDuplicateGroup(group, suppliers, contracts, preferredId);
      setSuppliers(res.unifiedSuppliers);
      saveStoredSupplierProfiles(res.unifiedSuppliers);

      if (res.updatedContracts && res.updatedContracts !== contracts) {
        onUpdateContracts(res.updatedContracts);
      }

      res.deletedIds.forEach((delId) => {
        deleteSupplierFromFirestore(delId).catch(() => {});
      });
      saveSuppliersBatchToFirestore(res.unifiedSuppliers).catch(() => {});

      if (selectedSupplierId && res.deletedIds.includes(selectedSupplierId)) {
        setSelectedSupplierId(res.mergedCanonical.id);
      }

      setSaveSuccessMsg(`✓ Grupo unificado bajo el perfil oficial "${res.mergedCanonical.name}".`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Error unifying single group:', err);
    } finally {
      setIsUnifying(false);
    }
  };

  const handleDismissGroup = (groupId: string) => {
    setDismissedGroupIds((prev) => {
      const next = new Set(prev);
      next.add(groupId);
      return next;
    });
  };

  const handleSelectCanonicalForGroup = (groupId: string, canonicalId: string) => {
    setCustomCanonicalIds((prev) => {
      const next = new Map(prev);
      next.set(groupId, canonicalId);
      return next;
    });
  };

  // Form State for editing / creating supplier
  const [formSupplier, setFormSupplier] = useState<Partial<SupplierProfile>>({
    name: '',
    nit: '',
    contactName: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    defaultPaymentTerms: 'Crédito 30 días',
    brands: [],
    leadTimeDays: 15,
    notes: '',
  });

  const [brandInput, setBrandInput] = useState('');

  // Listen to background supplier updates
  useEffect(() => {
    const handleUpdated = (e: any) => {
      if (e.detail) {
        setSuppliers(e.detail);
      } else {
        setSuppliers(getStoredSupplierProfiles(contracts, equipments));
      }
    };
    window.addEventListener('syd_suppliers_updated', handleUpdated);
    return () => window.removeEventListener('syd_suppliers_updated', handleUpdated);
  }, [contracts, equipments]);

  // Find currently active supplier
  const currentSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === selectedSupplierId);
  }, [suppliers, selectedSupplierId]);

  // Load selected supplier into form whenever selection changes (unless in new creation mode)
  useEffect(() => {
    if (currentSupplier && !isEditingNew) {
      setFormSupplier({ ...currentSupplier });
    }
  }, [currentSupplier, isEditingNew]);

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

  // Compute all unique known brands in the system
  const allKnownBrands = useMemo(() => {
    const brandMap = new Map<string, string>(); // lower -> displayName

    DEFAULT_KNOWN_BRANDS.forEach((b) => {
      brandMap.set(b.toLowerCase(), b);
    });

    if (equipments && equipments.length > 0) {
      equipments.forEach((e) => {
        if (e.brand && e.brand.trim()) {
          const clean = e.brand.trim();
          if (!brandMap.has(clean.toLowerCase())) {
            brandMap.set(clean.toLowerCase(), clean);
          }
        }
      });
    }

    suppliers.forEach((s) => {
      if (s.brands && s.brands.length > 0) {
        s.brands.forEach((b) => {
          if (b && b.trim()) {
            const clean = b.trim();
            if (!brandMap.has(clean.toLowerCase())) {
              brandMap.set(clean.toLowerCase(), clean);
            }
          }
        });
      }
    });

    contracts.forEach((c) => {
      c.items.forEach((it) => {
        if (it.brand && it.brand.trim()) {
          const clean = it.brand.trim();
          if (!brandMap.has(clean.toLowerCase())) {
            brandMap.set(clean.toLowerCase(), clean);
          }
        }
      });
    });

    return Array.from(brandMap.values()).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  }, [equipments, suppliers, contracts]);

  // Available brands that are NOT yet added to the current supplier
  const availableUnselectedBrands = useMemo(() => {
    const currentBrandsLower = new Set(
      (formSupplier.brands || []).map((b) => b.trim().toLowerCase())
    );
    return allKnownBrands.filter((b) => !currentBrandsLower.has(b.toLowerCase()));
  }, [allKnownBrands, formSupplier.brands]);

  // Helper to compute stats for all suppliers in list view
  const supplierStatsMap = useMemo(() => {
    const map = new Map<string, { ocCount: number; itemCount: number; totalCost: number; catalogEqCount: number }>();

    suppliers.forEach((s) => {
      const sNameLower = s.name.trim().toLowerCase();
      const sBrandsLower = new Set((s.brands || []).map((b) => b.trim().toLowerCase()));
      const ocSet = new Set<string>();
      let itemCount = 0;
      let totalCost = 0;

      // Count OCs & items
      contracts.forEach((c) => {
        c.items.forEach((it) => {
          const itSuppLower = (it.supplier || '').trim().toLowerCase();
          const itBrandLower = (it.brand || '').trim().toLowerCase();
          const matches =
            itSuppLower === sNameLower ||
            itSuppLower.includes(sNameLower) ||
            sNameLower.includes(itSuppLower) ||
            sBrandsLower.has(itBrandLower);

          if (matches) {
            ocSet.add(it.ocNumber || `${c.id}_item_${it.id}`);
            itemCount += it.quantity || 1;
            totalCost += it.totalCostCOP || ((it.costPriceCOP || 0) * (it.quantity || 1));
          }
        });
      });

      // Count Catalog equipments
      let catalogEqCount = 0;
      equipments.forEach((eq) => {
        const eqBrandLower = (eq.brand || '').trim().toLowerCase();
        const eqAllSupps: string[] = [];
        if (eq.supplier) {
          eq.supplier.split(/[\/\;\n\,\|]+/).forEach((s) => s.trim() && eqAllSupps.push(s.trim().toLowerCase()));
        }
        if (eq.allSuppliers && Array.isArray(eq.allSuppliers)) {
          eq.allSuppliers.forEach((s) => s.trim() && eqAllSupps.push(s.trim().toLowerCase()));
        }
        if (eq.alternateSuppliers && Array.isArray(eq.alternateSuppliers)) {
          eq.alternateSuppliers.forEach((s) => s.trim() && eqAllSupps.push(s.trim().toLowerCase()));
        }
        if (eq.supplierPrices && Array.isArray(eq.supplierPrices)) {
          eq.supplierPrices.forEach((sp) => sp.supplier && eqAllSupps.push(sp.supplier.trim().toLowerCase()));
        }

        const isSupplierMatch = eqAllSupps.some(
          (supp) => supp === sNameLower || supp.includes(sNameLower) || sNameLower.includes(supp)
        );

        if (isSupplierMatch || sBrandsLower.has(eqBrandLower) || (eqBrandLower && sNameLower.includes(eqBrandLower))) {
          catalogEqCount++;
        }
      });

      map.set(s.id, {
        ocCount: ocSet.size,
        itemCount,
        totalCost,
        catalogEqCount,
      });
    });

    return map;
  }, [suppliers, contracts, equipments]);

  // Aggregate all items / OCs linked to the currently selected supplier
  const linkedSupplierData = useMemo(() => {
    if (!currentSupplier) return { ocs: [], items: [], totalAmount: 0, timeline: [] };

    const supplierNameLower = currentSupplier.name.trim().toLowerCase();
    const ocsMap = new Map<string, {
      ocNumber: string;
      contractNumber: string;
      clientName: string;
      contractId: string;
      status: OCLogisticsStatus;
      paymentTerms: OCPaymentTerms | string;
      paymentStatus: OCPaymentStatus | string;
      items: OCTrackingItem[];
      totalCost: number;
      createdAt: string;
    }>();

    const allItems: OCTrackingItem[] = [];
    const allHistoryLogs: {
      timestamp: string;
      ocNumber: string;
      clientName: string;
      user: string;
      newStatus: string;
      note: string;
      itemName?: string;
    }[] = [];

    contracts.forEach((c) => {
      c.items.forEach((item) => {
        const itemSupplierLower = (item.supplier || '').trim().toLowerCase();
        const itemBrandLower = (item.brand || '').trim().toLowerCase();
        const matchesSupplier =
          itemSupplierLower === supplierNameLower ||
          itemSupplierLower.includes(supplierNameLower) ||
          supplierNameLower.includes(itemSupplierLower) ||
          (currentSupplier.brands && currentSupplier.brands.some((b) => b.toLowerCase() === itemBrandLower));

        if (matchesSupplier) {
          allItems.push(item);
          const ocNum = item.ocNumber || 'SIN-OC';
          const existing = ocsMap.get(ocNum);
          const itemCost = item.totalCostCOP || (item.costPriceCOP * item.quantity);

          if (!existing) {
            ocsMap.set(ocNum, {
              ocNumber: ocNum,
              contractNumber: c.contractNumber,
              clientName: c.clientName,
              contractId: c.id,
              status: item.status,
              paymentTerms: item.paymentTerms || 'Crédito 30 días',
              paymentStatus: item.paymentStatus || 'Pendiente',
              items: [item],
              totalCost: itemCost,
              createdAt: item.createdAt,
            });
          } else {
            existing.items.push(item);
            existing.totalCost += itemCost;
          }

          if (item.history && item.history.length > 0) {
            item.history.forEach((h) => {
              allHistoryLogs.push({
                timestamp: h.timestamp,
                ocNumber: ocNum,
                clientName: c.clientName,
                user: h.user || 'Sistema',
                newStatus: h.newStatus || item.status,
                note: h.note || '',
                itemName: item.name,
              });
            });
          }
        }
      });
    });

    const ocsList = Array.from(ocsMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const totalAmount = ocsList.reduce((acc, oc) => acc + oc.totalCost, 0);

    const timeline = allHistoryLogs.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return {
      ocs: ocsList,
      items: allItems,
      totalAmount,
      timeline,
    };
  }, [currentSupplier, contracts]);

  // Compute all catalog equipments associated with this supplier or its brands
  const linkedEquipments = useMemo(() => {
    if (!currentSupplier) return [];
    const sNameLower = currentSupplier.name.trim().toLowerCase();
    const sBrandsLower = new Set((currentSupplier.brands || []).map((b) => b.trim().toLowerCase()));

    return equipments.filter((e) => {
      const eqBrandLower = (e.brand || '').trim().toLowerCase();
      const eqAllSupps: string[] = [];
      if (e.supplier) {
        e.supplier.split(/[\/\;\n\,\|]+/).forEach((s) => s.trim() && eqAllSupps.push(s.trim().toLowerCase()));
      }
      if (e.allSuppliers && Array.isArray(e.allSuppliers)) {
        e.allSuppliers.forEach((s) => s.trim() && eqAllSupps.push(s.trim().toLowerCase()));
      }
      if (e.alternateSuppliers && Array.isArray(e.alternateSuppliers)) {
        e.alternateSuppliers.forEach((s) => s.trim() && eqAllSupps.push(s.trim().toLowerCase()));
      }
      if (e.supplierPrices && Array.isArray(e.supplierPrices)) {
        e.supplierPrices.forEach((sp) => sp.supplier && eqAllSupps.push(sp.supplier.trim().toLowerCase()));
      }

      const isSupplierMatch = eqAllSupps.some(
        (supp) => supp === sNameLower || supp.includes(sNameLower) || sNameLower.includes(supp)
      );

      return (
        isSupplierMatch ||
        sBrandsLower.has(eqBrandLower) ||
        (eqBrandLower && sNameLower.includes(eqBrandLower))
      );
    });
  }, [currentSupplier, equipments]);

  // Filtered suppliers list
  const filteredSuppliers = useMemo(() => {
    if (!searchQuery.trim()) return suppliers;
    const q = searchQuery.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.nit && s.nit.toLowerCase().includes(q)) ||
        (s.contactName && s.contactName.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)) ||
        (s.phone && s.phone.toLowerCase().includes(q)) ||
        (s.brands && s.brands.some((b) => b.toLowerCase().includes(q)))
    );
  }, [suppliers, searchQuery]);

  // Add brand from dropdown
  const handleAddExistingBrand = (brandName: string) => {
    const clean = brandName.trim();
    if (!clean) return;
    if (!formSupplier.brands?.some((b) => b.toLowerCase() === clean.toLowerCase())) {
      setFormSupplier((prev) => ({
        ...prev,
        brands: [...(prev.brands || []), clean],
      }));
    }
  };

  // Handle Add Brand from manual text input
  const handleAddBrand = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    if (!brandInput.trim()) return;
    const clean = brandInput.trim();
    if (!formSupplier.brands?.some((b) => b.toLowerCase() === clean.toLowerCase())) {
      setFormSupplier((prev) => ({
        ...prev,
        brands: [...(prev.brands || []), clean],
      }));
    }
    setBrandInput('');
  };

  const handleRemoveBrand = (brandToRemove: string) => {
    setFormSupplier((prev) => ({
      ...prev,
      brands: (prev.brands || []).filter((b) => b.toLowerCase() !== brandToRemove.toLowerCase()),
    }));
  };

  // Start new supplier mode (opens creation form on the right panel, keeps list on the left)
  const handleStartNewSupplier = () => {
    setIsEditingNew(true);
    setFormSupplier({
      id: `supp-${Date.now()}`,
      name: '',
      nit: '',
      contactName: '',
      phone: '',
      email: '',
      city: 'Bogotá, D.C.',
      address: '',
      defaultPaymentTerms: 'Crédito 30 días',
      brands: [],
      leadTimeDays: 15,
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setActiveTab('info');
  };

  // Select or deselect an existing supplier from the list
  const handleSelectSupplier = (supplierId: string) => {
    setIsEditingNew(false);
    if (selectedSupplierId === supplierId) {
      // Clicking the already selected supplier deselects it
      setSelectedSupplierId('');
    } else {
      setSelectedSupplierId(supplierId);
      const supp = suppliers.find((s) => s.id === supplierId);
      if (supp) {
        setFormSupplier({ ...supp });
      }
    }
  };

  // Cancel new creation and return to viewing current supplier
  const handleCancelNew = () => {
    setIsEditingNew(false);
    if (currentSupplier) {
      setFormSupplier({ ...currentSupplier });
    }
  };

  // Save supplier changes (and synchronize with existing contracts)
  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSupplier.name?.trim()) {
      alert('El nombre del proveedor es obligatorio');
      return;
    }

    const supplierId = formSupplier.id || `supp-${Date.now()}`;
    const updatedProfile: SupplierProfile = {
      id: supplierId,
      name: formSupplier.name.trim(),
      nit: formSupplier.nit?.trim() || '',
      contactName: formSupplier.contactName?.trim() || '',
      phone: formSupplier.phone?.trim() || '',
      email: formSupplier.email?.trim() || '',
      city: formSupplier.city?.trim() || '',
      address: formSupplier.address?.trim() || '',
      defaultPaymentTerms: formSupplier.defaultPaymentTerms || 'Crédito 30 días',
      brands: formSupplier.brands || [],
      leadTimeDays: Number(formSupplier.leadTimeDays) || 15,
      notes: formSupplier.notes?.trim() || '',
      createdAt: formSupplier.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let updatedList: SupplierProfile[];
    if (isEditingNew) {
      updatedList = [updatedProfile, ...suppliers.filter((s) => s.id !== supplierId)];
    } else {
      updatedList = suppliers.map((s) => (s.id === supplierId ? updatedProfile : s));
    }

    setSuppliers(updatedList);
    saveStoredSupplierProfiles(updatedList);
    setSelectedSupplierId(supplierId);
    setIsEditingNew(false);

    // Sync updates to contracts
    const syncedContracts = syncSupplierUpdatesToContracts(contracts, updatedProfile);
    onUpdateContracts(syncedContracts);

    setSaveSuccessMsg(`Proveedor "${updatedProfile.name}" guardado y sincronizado con éxito.`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleDeleteSupplier = (supplierId: string) => {
    const updated = deleteSupplierProfile(supplierId);
    setSuppliers(updated);
    if (selectedSupplierId === supplierId) {
      setSelectedSupplierId('');
      setIsEditingNew(false);
    }
    setSupplierToDelete(null);
    setSaveSuccessMsg('Proveedor eliminado del directorio.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleClearAllSuppliers = () => {
    clearAllSupplierProfiles();
    setSuppliers([]);
    setSelectedSupplierId('');
    setIsEditingNew(false);
    setShowClearAllConfirm(false);
    setSaveSuccessMsg('Directorio de proveedores vaciado por completo.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/85 flex items-center justify-center p-2.5 sm:p-4 md:p-6 backdrop-blur-xs animate-fadeIn overflow-y-auto"
    >
      <div className="bg-[#15253d] border border-[#334d6e] rounded-2xl w-full max-w-6xl max-h-[86vh] h-[82vh] min-h-[500px] flex flex-col shadow-2xl overflow-hidden text-xs my-auto">
        {/* Modal Header */}
        <div className="px-4 py-2.5 bg-[#0f1b2b] border-b border-[#334d6e] flex items-center justify-between flex-wrap gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-sky-500 text-white flex items-center justify-center font-black shadow-md shadow-purple-500/20 shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-black text-white truncate">
                  Directorio de Proveedores y Fabricantes
                </h3>
                <span className="bg-purple-950/80 text-purple-300 font-bold border border-purple-400/40 text-[9px] px-1.5 py-0.2 rounded-full shrink-0">
                  {suppliers.length} Registrados
                </span>
              </div>
              <p className="text-[9.5px] text-slate-400 truncate">
                Gestión centralizada de fabricantes, condiciones comerciales, marcas vinculadas y trazabilidad de OCs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Deduplication Button */}
            <button
              type="button"
              id="open-deduplication-modal-btn"
              onClick={() => setShowDeduplicationModal(true)}
              className={`inline-flex items-center gap-1.5 font-bold px-2.5 py-1 rounded-lg transition text-xs cursor-pointer shadow-sm ${
                detectedDuplicateGroups.length > 0
                  ? 'bg-amber-950/90 hover:bg-amber-900 text-amber-300 border border-amber-500/60 animate-pulse'
                  : 'bg-[#1a2f4c] hover:bg-[#25426b] text-slate-300 hover:text-white border border-slate-600/60'
              }`}
              title={
                detectedDuplicateGroups.length > 0
                  ? `Detectados ${detectedDuplicateGroups.length} grupos de proveedores repetidos (${totalDuplicatesCount} a fusionar)`
                  : 'Escanear proveedores duplicados o muy parecidos'
              }
            >
              {detectedDuplicateGroups.length > 0 ? (
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <GitMerge className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span>
                {detectedDuplicateGroups.length > 0
                  ? `Unificar Duplicados (${detectedDuplicateGroups.length})`
                  : 'Buscar Duplicados'}
              </span>
            </button>

            {suppliers.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(true)}
                className="inline-flex items-center gap-1 font-bold text-rose-300 hover:text-rose-100 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 px-2.5 py-1 rounded-lg transition shadow-sm cursor-pointer text-xs"
                title="Eliminar todos los proveedores del directorio"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Vaciar Directorio</span>
              </button>
            )}

            <button
              type="button"
              id="open-new-supplier-btn"
              onClick={handleStartNewSupplier}
              className={`inline-flex items-center gap-1 font-black px-2.5 py-1 rounded-lg transition shadow-md cursor-pointer text-xs ${
                isEditingNew
                  ? 'bg-sky-400 text-slate-950 ring-2 ring-sky-300'
                  : 'bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 text-slate-950'
              }`}
              title="Registrar nuevo proveedor al lado de la lista"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Nuevo Proveedor</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#1f3554] transition cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Success alert banner */}
        {saveSuccessMsg && (
          <div className="bg-emerald-950/90 border-b border-emerald-500/40 text-emerald-300 px-3 py-1.5 flex items-center gap-2 font-bold text-xs animate-fadeIn shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* =========================================================================
            SPLIT TWO-PANEL LAYOUT (Side-by-Side: Left List | Right Detail/Create)
            ========================================================================= */}
        <div className="flex flex-1 overflow-hidden">
          {/* ==================== LEFT PANEL: SUPPLIERS DIRECTORY LIST ==================== */}
          <div className="w-72 sm:w-80 md:w-96 border-r border-[#243c5a] bg-[#111f33] flex flex-col shrink-0 overflow-hidden">
            {/* Search and Action Bar */}
            <div className="p-2 bg-[#0f1b2b] border-b border-[#243c5a] space-y-1.5">
              <div className="relative">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar proveedor, NIT, marca..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#091320] border border-[#334d6e] rounded-lg pl-7 pr-2.5 py-1 text-white placeholder-slate-500 focus:border-sky-400 outline-none text-xs"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5">
                <span>
                  {filteredSuppliers.length} de {suppliers.length} proveedores
                </span>
                {selectedSupplierId && (
                  <button
                    type="button"
                    onClick={() => setSelectedSupplierId('')}
                    className="text-slate-400 hover:text-sky-300 font-semibold hover:underline cursor-pointer"
                    title="Deseleccionar proveedor"
                  >
                    Deseleccionar
                  </button>
                )}
              </div>
            </div>

            {/* Smart Duplicates Alert Banner */}
            {detectedDuplicateGroups.length > 0 && (
              <div className="mx-2 my-1.5 p-2 bg-gradient-to-br from-amber-950/80 to-slate-900 border border-amber-500/50 rounded-xl space-y-1.5 shadow-md shrink-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{detectedDuplicateGroups.length} {detectedDuplicateGroups.length === 1 ? 'grupo duplicado' : 'grupos duplicados'}</span>
                  </div>
                  <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded-full font-bold">
                    {totalDuplicatesCount} a fusionar
                  </span>
                </div>
                <p className="text-[10px] text-amber-200/80 leading-tight">
                  Proveedores repetidos o con nombres parecidos detectados en el directorio.
                </p>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={handleUnifyAll}
                    disabled={isUnifying}
                    className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-[10px] py-1 px-2 rounded-lg transition shadow flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3 h-3 stroke-[2.5]" />
                    <span>{isUnifying ? 'Unificando...' : 'Unificar Todo'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeduplicationModal(true)}
                    className="bg-[#1a2f4c] hover:bg-[#25426b] text-slate-200 hover:text-white font-bold text-[10px] py-1 px-2 rounded-lg transition border border-slate-600/70 cursor-pointer"
                  >
                    Revisar
                  </button>
                </div>
              </div>
            )}

            {/* Scrollable Suppliers List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#1b2d45] p-1.5 space-y-1">
              {filteredSuppliers.length === 0 ? (
                <div className="p-6 text-center text-slate-400 my-4">
                  <Building2 className="w-8 h-8 mx-auto text-slate-600 mb-1.5" />
                  <p className="font-bold text-white text-xs">No hay resultados</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {searchQuery ? 'Sin coincidencias para la búsqueda.' : 'No hay proveedores registrados.'}
                  </p>
                </div>
              ) : (
                filteredSuppliers.map((s) => {
                  const isSelected = s.id === selectedSupplierId && !isEditingNew;
                  const stats = supplierStatsMap.get(s.id) || { ocCount: 0, itemCount: 0, totalCost: 0, catalogEqCount: 0 };

                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSupplier(s.id)}
                      className={`w-full text-left p-2 rounded-xl transition cursor-pointer flex flex-col gap-1.5 group relative ${
                        isSelected
                          ? 'bg-[#1a314f] border border-sky-400/60 shadow-md ring-1 ring-sky-400/30'
                          : 'hover:bg-[#162740] border border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                          <span className={`font-bold truncate text-xs block ${isSelected ? 'text-sky-300' : 'text-white'}`}>
                            {s.name}
                          </span>
                          <span className="text-[9.5px] text-slate-400 block truncate">
                            NIT: {s.nit || 'S/N'} • {s.city || 'Colombia'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {stats.catalogEqCount > 0 && (
                            <span
                              className="text-[9px] bg-sky-950/80 text-sky-300 border border-sky-500/30 px-1.5 py-0.2 rounded font-mono font-bold"
                              title={`${stats.catalogEqCount} equipos en Catálogo Biomédico`}
                            >
                              {stats.catalogEqCount} Eq
                            </span>
                          )}
                          <span className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono font-bold border border-slate-700">
                            {stats.ocCount} OCs
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSupplierToDelete({ id: s.id, name: s.name });
                            }}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 rounded transition"
                            title="Eliminar este proveedor"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Brand tags preview */}
                      {s.brands && s.brands.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {Array.from(new Set(s.brands)).slice(0, 3).map((b, bIdx) => (
                            <span
                              key={`sup_${s.id}_b_${b}_${bIdx}`}
                              className="text-[9px] bg-purple-950/80 text-purple-300 border border-purple-500/30 px-1 py-0.2 rounded font-semibold truncate max-w-[80px]"
                            >
                              {b}
                            </span>
                          ))}
                          {s.brands.length > 3 && (
                            <span className="text-[8.5px] text-slate-400 self-center">
                              +{s.brands.length - 3} más
                            </span>
                          )}
                        </div>
                      )}

                      {/* Contact / Phone / Value */}
                      <div className="flex items-center justify-between text-[9.5px] text-slate-400 pt-0.5 border-t border-[#1e3450]">
                        <span className="truncate max-w-[130px]">{s.contactName || s.phone || 'Sin asesor'}</span>
                        {stats.totalCost > 0 && (
                          <span className="text-emerald-400 font-mono font-bold">
                            ${stats.totalCost.toLocaleString('es-CO')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ==================== RIGHT PANEL: DETAIL OR NEW CREATION FORM ==================== */}
          <div className="flex-1 flex flex-col bg-[#15253d] overflow-hidden">
            {/* Header of Right Panel */}
            <div className="px-3.5 py-2 bg-[#122137] border-b border-[#243c5a] flex items-center justify-between flex-wrap gap-2 shrink-0">
              <div>
                <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                  <span>{isEditingNew ? 'Registrar Nuevo Proveedor' : currentSupplier?.name || 'Ficha Técnica y Datos de Proveedor'}</span>
                  {!isEditingNew && currentSupplier?.nit && (
                    <span className="text-[10px] text-sky-400 font-mono bg-sky-950/70 px-1.5 py-0.2 rounded border border-sky-400/30">
                      NIT {currentSupplier.nit}
                    </span>
                  )}
                  {isEditingNew && (
                    <span className="text-[9.5px] text-amber-300 font-bold bg-amber-950/70 px-1.5 py-0.2 rounded border border-amber-400/30">
                      Nuevo Registro
                    </span>
                  )}
                </h4>
                <p className="text-[10px] text-slate-400">
                  {isEditingNew
                    ? 'Complete los datos del fabricante o distribuidor y haga clic en "Guardar y Registrar Proveedor".'
                    : currentSupplier
                    ? `Contacto: ${currentSupplier.contactName || 'No asignado'} • Tel: ${currentSupplier.phone || 'Sin registrar'} • Sede: ${currentSupplier.city || 'Colombia'}`
                    : 'Seleccione un proveedor del listado de la izquierda para ver o editar sus datos comerciales.'}
                </p>
              </div>

              {/* Action Buttons / Tabs */}
              {isEditingNew ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCancelNew}
                    className="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white bg-[#1a2d47] hover:bg-[#223b5c] border border-[#2b4465] font-bold text-xs cursor-pointer transition"
                  >
                    Cancelar
                  </button>
                </div>
              ) : currentSupplier ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-[#0d1828] p-0.5 rounded-lg border border-[#2d4666]">
                    <button
                      type="button"
                      onClick={() => setActiveTab('info')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition cursor-pointer text-xs ${
                        activeTab === 'info'
                          ? 'bg-sky-500 text-slate-950 shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Datos Comerciales</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('equipments')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition cursor-pointer text-xs ${
                        activeTab === 'equipments'
                          ? 'bg-sky-500 text-slate-950 shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Package className="w-3 h-3" />
                      <span>Equipos Catálogo ({linkedEquipments.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition cursor-pointer text-xs ${
                        activeTab === 'orders'
                          ? 'bg-sky-500 text-slate-950 shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      <span>Órdenes ({linkedSupplierData.ocs.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('traceability')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition cursor-pointer text-xs ${
                        activeTab === 'traceability'
                          ? 'bg-sky-500 text-slate-950 shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <History className="w-3 h-3" />
                      <span>Trazabilidad ({linkedSupplierData.timeline.length})</span>
                    </button>
                  </div>

                  {/* Button to delete selected supplier */}
                  <button
                    type="button"
                    onClick={() => setSupplierToDelete({ id: currentSupplier.id, name: currentSupplier.name })}
                    className="inline-flex items-center gap-1 text-rose-300 hover:text-rose-100 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/40 px-2 py-1 rounded-lg transition cursor-pointer text-xs font-bold"
                    title="Eliminar este proveedor del directorio"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden sm:inline">Eliminar</span>
                  </button>

                  {/* Button to quit/close selected supplier data view */}
                  <button
                    type="button"
                    onClick={() => setSelectedSupplierId('')}
                    className="inline-flex items-center gap-1 text-slate-400 hover:text-white hover:bg-[#1f3554] px-2 py-1 rounded-lg border border-[#2b4465] transition cursor-pointer text-xs font-bold"
                    title="Quitar ventana de datos del proveedor seleccionado"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                    <span className="hidden sm:inline">Cerrar Ficha</span>
                  </button>
                </div>
              ) : null}
            </div>

            {/* Content Area */}
            {isEditingNew || activeTab === 'info' ? (
              currentSupplier || isEditingNew ? (
                <form onSubmit={handleSaveSupplier} className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {/* Nombre */}
                      <div>
                        <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">
                          Nombre / Razón Social *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Ej: Mindray Medical Colombia S.A.S"
                          value={formSupplier.name || ''}
                          onChange={(e) => setFormSupplier({ ...formSupplier, name: e.target.value })}
                          className="w-full bg-[#0d1828] border border-[#334d6e] rounded-md px-2.5 py-1.5 text-white font-bold focus:border-sky-400 outline-none text-xs"
                        />
                      </div>

                      {/* NIT */}
                      <div>
                        <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">
                          NIT / Identificación Tributaria
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: 900.123.456-7"
                          value={formSupplier.nit || ''}
                          onChange={(e) => setFormSupplier({ ...formSupplier, nit: e.target.value })}
                          className="w-full bg-[#0d1828] border border-[#334d6e] rounded-md px-2.5 py-1.5 text-white font-mono focus:border-sky-400 outline-none text-xs"
                        />
                      </div>

                      {/* Contact Name */}
                      <div>
                        <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">
                          Persona de Contacto / Asesor Comercial
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Ing. Carlos Pérez"
                          value={formSupplier.contactName || ''}
                          onChange={(e) => setFormSupplier({ ...formSupplier, contactName: e.target.value })}
                          className="w-full bg-[#0d1828] border border-[#334d6e] rounded-md px-2.5 py-1.5 text-white focus:border-sky-400 outline-none text-xs"
                        />
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">
                          Teléfono / WhatsApp
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: +57 310 9876543"
                          value={formSupplier.phone || ''}
                          onChange={(e) => setFormSupplier({ ...formSupplier, phone: e.target.value })}
                          className="w-full bg-[#0d1828] border border-[#334d6e] rounded-md px-2.5 py-1.5 text-white focus:border-sky-400 outline-none text-xs"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">
                          Correo Electrónico
                        </label>
                        <input
                          type="email"
                          placeholder="Ej: ventas@proveedor.com"
                          value={formSupplier.email || ''}
                          onChange={(e) => setFormSupplier({ ...formSupplier, email: e.target.value })}
                          className="w-full bg-[#0d1828] border border-[#334d6e] rounded-md px-2.5 py-1.5 text-white focus:border-sky-400 outline-none text-xs"
                        />
                      </div>

                      {/* City */}
                      <div>
                        <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">
                          Ciudad / Sede Principal
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Bogotá, D.C."
                          value={formSupplier.city || ''}
                          onChange={(e) => setFormSupplier({ ...formSupplier, city: e.target.value })}
                          className="w-full bg-[#0d1828] border border-[#334d6e] rounded-md px-2.5 py-1.5 text-white focus:border-sky-400 outline-none text-xs"
                        />
                      </div>

                      {/* Default Payment Terms */}
                      <div>
                        <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">
                          Condición de Pago Habitual
                        </label>
                        <select
                          value={formSupplier.defaultPaymentTerms || 'Crédito 30 días'}
                          onChange={(e) => setFormSupplier({ ...formSupplier, defaultPaymentTerms: e.target.value as OCPaymentTerms })}
                          className="w-full bg-[#0d1828] border border-[#334d6e] rounded-md px-2.5 py-1.5 text-sky-300 font-bold focus:border-sky-400 outline-none cursor-pointer text-xs"
                        >
                          <option value="Contado Contra Entrega">Contado Contra Entrega</option>
                          <option value="Anticipo 50% / Saldo Entrega">Anticipo 50% / Saldo Entrega</option>
                          <option value="Crédito 15 días">Crédito 15 días</option>
                          <option value="Crédito 30 días">Crédito 30 días</option>
                          <option value="Crédito 45 días">Crédito 45 días</option>
                          <option value="Crédito 60 días">Crédito 60 días</option>
                          <option value="Crédito 90 días">Crédito 90 días</option>
                        </select>
                      </div>

                      {/* Lead Time */}
                      <div>
                        <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">
                          Tiempo de Entrega Estimado (Días)
                        </label>
                        <input
                          type="number"
                          min="1"
                          placeholder="15"
                          value={formSupplier.leadTimeDays || 15}
                          onChange={(e) => setFormSupplier({ ...formSupplier, leadTimeDays: parseInt(e.target.value) || 15 })}
                          className="w-full bg-[#0d1828] border border-[#334d6e] rounded-md px-2.5 py-1.5 text-white font-bold focus:border-sky-400 outline-none text-xs"
                        />
                      </div>
                    </div>

                    {/* Brands Tag Input & Existing Brands Selector */}
                    <div className="bg-[#0f1b2c] p-2.5 rounded-xl border border-[#2b4465] space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <label className="block text-slate-200 font-bold text-[11px]">
                          Marcas que Fabrica o Distribuye Exclusivamente
                        </label>
                        <span className="text-[9px] text-purple-300 bg-purple-950/70 border border-purple-500/30 px-1.5 py-0.2 rounded font-semibold">
                          {formSupplier.brands?.length || 0} marcas vinculadas
                        </span>
                      </div>

                      {/* Currently Linked Brands Pills */}
                      <div className="flex flex-wrap gap-1.5 min-h-[30px] p-2 bg-[#09121d] rounded-lg border border-[#1e3450]">
                        {formSupplier.brands && formSupplier.brands.length > 0 ? (
                          Array.from(new Set(formSupplier.brands)).map((b, bIdx) => (
                            <span
                              key={`form_b_${b}_${bIdx}`}
                              className="inline-flex items-center gap-1 bg-purple-950/90 text-purple-200 border border-purple-400/50 px-2 py-0.5 rounded-md text-[10.5px] font-bold shadow-xs animate-fadeIn"
                            >
                              <Tag className="w-2.5 h-2.5 text-purple-400 shrink-0" />
                              <span>{b}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveBrand(b)}
                                className="text-purple-400 hover:text-rose-400 hover:bg-rose-950/40 p-0.5 rounded ml-0.5 cursor-pointer transition"
                                title={`Desvincular ${b}`}
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 italic text-[10.5px] self-center">
                            No hay marcas vinculadas. Elija una existente del desplegable o escriba una nueva abajo.
                          </span>
                        )}
                      </div>

                      {/* Unified Controls */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                        {/* Existing Brands Dropdown */}
                        <div className="flex items-center gap-1">
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAddExistingBrand(e.target.value);
                                e.target.value = '';
                              }
                            }}
                            className="w-full bg-[#0d1828] border border-purple-500/40 text-purple-200 rounded-md px-2.5 py-1 text-[11px] font-semibold outline-none focus:border-purple-400 cursor-pointer"
                          >
                            <option value="">
                              {availableUnselectedBrands.length === 0
                                ? 'Todas las marcas están vinculadas'
                                : `+ Vincular marca existente (${availableUnselectedBrands.length} disp)...`}
                            </option>
                            {Array.from(new Set(availableUnselectedBrands)).map((b, bIdx) => (
                              <option key={`avail_b_${b}_${bIdx}`} value={b}>
                                + {b}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Manual Brand Input */}
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="O escribir marca nueva..."
                            value={brandInput}
                            onChange={(e) => setBrandInput(e.target.value)}
                            onKeyDown={handleAddBrand}
                            className="flex-1 bg-[#0d1828] border border-[#334d6e] rounded-md px-2.5 py-1 text-white placeholder-slate-500 focus:border-purple-400 outline-none text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={handleAddBrand}
                            disabled={!brandInput.trim()}
                            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-3 py-1 rounded-md transition cursor-pointer text-[11px] shrink-0"
                          >
                            Agregar
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">
                        Notas y Observaciones Comerciales
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Condiciones de garantía, acuerdos comerciales, descuentos por volumen..."
                        value={formSupplier.notes || ''}
                        onChange={(e) => setFormSupplier({ ...formSupplier, notes: e.target.value })}
                        className="w-full bg-[#0d1828] border border-[#334d6e] rounded-md p-2 text-white focus:border-sky-400 outline-none text-xs"
                      />
                    </div>
                  </div>

                  {/* Form Footer */}
                  <div className="p-2.5 px-4 bg-[#0e1929] border-t border-[#243c5a] flex items-center justify-between gap-2 shrink-0">
                    {isEditingNew ? (
                      <button
                        type="button"
                        onClick={handleCancelNew}
                        className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white font-bold transition cursor-pointer text-xs"
                      >
                        Cancelar
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500">
                        Última actualización: {formSupplier.updatedAt ? new Date(formSupplier.updatedAt).toLocaleDateString('es-CO') : 'Reciente'}
                      </span>
                    )}

                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black px-4 py-1.5 rounded-lg transition shadow-lg cursor-pointer text-xs"
                    >
                      <Save className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>{isEditingNew ? 'Guardar y Registrar Proveedor' : 'Guardar y Sincronizar Cambios'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400">
                  <div className="max-w-sm space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-[#0e1929] border border-[#233a57] text-slate-500 flex items-center justify-center mx-auto mb-3">
                      <Building2 className="w-6 h-6 text-slate-400" />
                    </div>
                    <h4 className="text-sm font-bold text-white">Ningún Proveedor Seleccionado</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Haga clic en cualquiera de los proveedores del listado de la izquierda para consultar sus datos comerciales, marcas y órdenes asociadas.
                    </p>
                  </div>
                </div>
              )
            ) : null}

            {/* Tab 2: Equipos Biomédicos Asociados del Catálogo (Ventana 3) */}
            {activeTab === 'equipments' && !isEditingNew && currentSupplier && (
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between bg-[#0f1b2c] p-2.5 rounded-xl border border-[#2b4465]">
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Equipos en Catálogo Biomédico:</span>
                    <span className="text-xs sm:text-sm font-black text-sky-400">
                      {linkedEquipments.length} {linkedEquipments.length === 1 ? 'Equipo Registrado' : 'Equipos Registrados'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10.5px]">Marcas del Proveedor:</span>
                    <span className="text-xs font-bold text-purple-300">
                      {currentSupplier.brands && currentSupplier.brands.length > 0
                        ? currentSupplier.brands.join(', ')
                        : 'Sin marcas asociadas'}
                    </span>
                  </div>
                </div>

                {linkedEquipments.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-[#0e1929] rounded-xl border border-[#233a57]">
                    <Package className="w-7 h-7 mx-auto text-slate-600 mb-1.5" />
                    <p className="font-bold text-white text-xs">No hay equipos vinculados a este proveedor en el catálogo</p>
                    <p className="text-[10.5px] text-slate-400 mt-0.5 max-w-md mx-auto">
                      Al importar un archivo Excel en el Catálogo Biomédico o registrar equipos con este proveedor/marca, se vincularán automáticamente aquí.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {linkedEquipments.map((eq) => {
                      const sNameLower = currentSupplier.name.trim().toLowerCase();
                      const specificQuote = (eq.supplierPrices || []).find((sp) => {
                        const spLower = sp.supplier.trim().toLowerCase();
                        return spLower === sNameLower || sNameLower.includes(spLower) || spLower.includes(sNameLower);
                      });

                      const supplierPriceCOP = specificQuote ? specificQuote.costCOP : eq.baseCostCOP;
                      const isLowestMarketPrice = supplierPriceCOP <= eq.baseCostCOP;
                      const otherQuotes = (eq.supplierPrices || []).filter((sp) => {
                        const spLower = sp.supplier.trim().toLowerCase();
                        return !(spLower === sNameLower || sNameLower.includes(spLower) || spLower.includes(sNameLower));
                      });

                      return (
                        <div
                          key={eq.id}
                          className="bg-[#0f1b2c] border border-[#243c5a] hover:border-sky-500/50 rounded-xl p-3 transition flex flex-col justify-between gap-2.5 shadow-sm"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-[10px] font-bold text-sky-300 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-400/30">
                                {eq.code || 'EQ'}
                              </span>
                              <span className="text-[9.5px] font-bold text-purple-300 bg-purple-950/70 px-1.5 py-0.5 rounded border border-purple-500/30 truncate max-w-[170px]">
                                {eq.brand} • {eq.category}
                              </span>
                            </div>

                            <h5 className="font-bold text-white text-xs leading-snug line-clamp-2">
                              {eq.name}
                            </h5>

                            <div className="flex items-center justify-between text-[11px]">
                              <p className="text-slate-300 flex items-center gap-1">
                                <span className="text-slate-400">Modelo:</span>
                                <strong className="text-white">{eq.model || 'Estándar'}</strong>
                              </p>
                              <span className="text-[10px] font-medium text-slate-300">
                                INVIMA: <strong className="text-slate-200">{eq.invimaRecordNumber || 'No Aplica'}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Pricing details section */}
                          <div className="pt-2 border-t border-[#1e3450] space-y-1.5">
                            <div className="flex items-center justify-between bg-[#14233a] p-2 rounded-lg border border-[#233d62]">
                              <div>
                                <span className="text-[10px] text-slate-300 font-medium block">
                                  Precio de {currentSupplier.name}:
                                </span>
                                <span className={`text-xs sm:text-sm font-black ${isLowestMarketPrice ? 'text-emerald-400' : 'text-amber-300'}`}>
                                  ${supplierPriceCOP.toLocaleString('es-CO')} COP
                                </span>
                              </div>

                              <div className="text-right">
                                {isLowestMarketPrice ? (
                                  <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded border border-emerald-500/40">
                                    ★ Mejor Precio (Activo)
                                  </span>
                                ) : (
                                  <div className="text-right">
                                    <span className="text-[9.5px] text-slate-400 block">Menor en mercado:</span>
                                    <span className="text-[11px] font-black text-emerald-400">
                                      ${eq.baseCostCOP.toLocaleString('es-CO')} COP
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* If there are quotes from other suppliers, list them comparably */}
                            {otherQuotes.length > 0 && (
                              <div className="bg-[#0b1424] p-1.5 rounded-lg border border-[#1b2f4a] space-y-1">
                                <span className="text-[9.5px] font-semibold text-slate-400 flex items-center justify-between">
                                  <span>Otras cotizaciones ({otherQuotes.length}):</span>
                                  <span className="text-[8.5px] text-slate-500 font-normal">Cotizador usa el menor</span>
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {otherQuotes.map((oq, oqIdx) => (
                                    <span
                                      key={oqIdx}
                                      className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                                        oq.costCOP === eq.baseCostCOP
                                          ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300 font-bold'
                                          : 'bg-[#121f35] border-[#203657] text-slate-300'
                                      }`}
                                    >
                                      <span className="truncate max-w-[90px]">{oq.supplier}:</span>
                                      <span>${oq.costCOP.toLocaleString('es-CO')}</span>
                                      {oq.costCOP === eq.baseCostCOP && <span className="text-emerald-400">★</span>}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Linked Purchase Orders */}
            {activeTab === 'orders' && !isEditingNew && currentSupplier && (
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
                <div className="flex items-center justify-between bg-[#0f1b2c] p-2.5 rounded-xl border border-[#2b4465]">
                  <div>
                    <span className="text-slate-400 block text-[10.5px]">Total Comprado a {currentSupplier.name}:</span>
                    <span className="text-sm sm:text-base font-black text-emerald-400">
                      ${linkedSupplierData.totalAmount.toLocaleString('es-CO')} COP
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[10.5px]">Órdenes Registradas:</span>
                    <span className="text-xs sm:text-sm font-bold text-sky-300">
                      {linkedSupplierData.ocs.length} OCs ({linkedSupplierData.items.length} equipos médicos)
                    </span>
                  </div>
                </div>

                {linkedSupplierData.ocs.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-[#0e1929] rounded-xl border border-[#233a57]">
                    <FileText className="w-7 h-7 mx-auto text-slate-600 mb-1.5" />
                    <p className="font-bold text-white text-xs">No hay Órdenes de Compra vinculadas a este proveedor</p>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">
                      Cree una orden de compra rápida o asigne equipos de este proveedor en Seguimiento de Órdenes.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedSupplierData.ocs.map((oc, ocIdx) => (
                      <div
                        key={`sup_oc_${oc.contractNumber}_${oc.ocNumber}_${ocIdx}`}
                        className="bg-[#0f1b2c] border border-[#243c5a] rounded-xl p-2.5 hover:border-sky-500/40 transition flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-[11px] text-sky-300 bg-sky-950/80 px-1.5 py-0.2 rounded border border-sky-400/40">
                              {oc.ocNumber}
                            </span>
                            <span className="font-bold text-white text-xs">{oc.clientName}</span>
                            <span className="text-[10px] text-slate-400">
                              (Contrato: <strong className="font-mono text-purple-300">{oc.contractNumber}</strong>)
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded-full bg-blue-950/80 text-sky-300 border border-sky-400/30">
                              {oc.status}
                            </span>
                            <span className="text-xs font-black text-emerald-400">
                              ${oc.totalCost.toLocaleString('es-CO')} COP
                            </span>
                          </div>
                        </div>

                        {/* Items in this OC */}
                        <div className="bg-[#09121d] rounded-lg p-2 border border-[#1e3450] space-y-1">
                          <span className="text-[9.5px] font-bold text-slate-400 block uppercase">
                            Equipos en la Orden:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {oc.items.map((it, itIdx) => (
                              <div
                                key={`sup_oc_item_${it.id}_${itIdx}`}
                                className="flex items-center justify-between bg-[#111f33] px-2 py-0.5 rounded text-[10.5px]"
                              >
                                <div className="truncate pr-2">
                                  <strong className="text-white">{it.quantity}x</strong>{' '}
                                  <span className="text-slate-200">{it.name}</span>{' '}
                                  <span className="text-purple-300 text-[9.5px]">({it.brand} {it.model})</span>
                                </div>
                                <span className="text-emerald-400 font-bold shrink-0">
                                  ${(it.totalCostCOP || (it.costPriceCOP * it.quantity)).toLocaleString('es-CO')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Payment & Logistics condition */}
                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 border-t border-[#1e3450]">
                          <span>
                            Condición: <strong className="text-slate-200">{oc.paymentTerms}</strong>
                          </span>
                          <span>
                            Estado de Pago: <strong className="text-amber-300">{oc.paymentStatus}</strong>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Traceability Log */}
            {activeTab === 'traceability' && !isEditingNew && currentSupplier && (
              <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
                <h5 className="font-bold text-white text-xs flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-purple-400" />
                  <span>Bitácora de Trazabilidad y Eventos Registrados</span>
                </h5>

                {linkedSupplierData.timeline.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-[#0e1929] rounded-xl border border-[#233a57]">
                    <Clock className="w-7 h-7 mx-auto text-slate-600 mb-1.5" />
                    <p className="font-bold text-white text-xs">Sin historial de eventos registrado</p>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">
                      Los cambios de estado, entregas y notas de este proveedor se registrarán aquí.
                    </p>
                  </div>
                ) : (
                  <div className="relative pl-5 space-y-2.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#253d5e]">
                    {linkedSupplierData.timeline.map((log, idx) => (
                      <div key={idx} className="relative bg-[#0f1b2c] p-2.5 rounded-xl border border-[#243c5a] text-xs">
                        <div className="absolute -left-[19px] top-3 w-2.5 h-2.5 rounded-full bg-sky-400 ring-4 ring-[#15253d]" />
                        <div className="flex items-center justify-between flex-wrap gap-1 mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[10px] font-bold text-sky-300 bg-sky-950/80 px-1 py-0.2 rounded border border-sky-400/30">
                              {log.ocNumber}
                            </span>
                            <span className="font-bold text-slate-200">{log.clientName}</span>
                          </div>
                          <span className="text-[9.5px] text-slate-400">
                            {new Date(log.timestamp).toLocaleString('es-CO')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[9.5px] bg-purple-950/80 text-purple-300 px-1.5 py-0.2 rounded font-bold border border-purple-500/30">
                            {log.newStatus}
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            Registrado por: <strong className="text-slate-300">{log.user}</strong>
                          </span>
                        </div>

                        {log.itemName && (
                          <p className="text-[10.5px] text-slate-400">
                            Equipo: <strong className="text-slate-300">{log.itemName}</strong>
                          </p>
                        )}

                        {log.note && (
                          <p className="text-[11px] text-slate-200 bg-[#09121d] p-1.5 rounded border border-[#1e3450] mt-1">
                            "{log.note}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Confirmation for deleting single supplier */}
      {supplierToDelete && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#122137] border border-rose-500/40 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">¿Eliminar este proveedor?</h4>
                <p className="text-xs text-slate-400 mt-0.5">Esta acción no se puede deshacer.</p>
              </div>
            </div>

            <div className="bg-[#0b1624] p-3 rounded-xl border border-[#233a57] text-xs text-slate-300">
              Se eliminará del directorio de proveedores a: <strong className="text-white block mt-1">{supplierToDelete.name}</strong>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSupplierToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white font-bold text-xs hover:bg-[#1a2d47] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDeleteSupplier(supplierToDelete.id)}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg transition cursor-pointer"
              >
                Sí, Eliminar Proveedor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation for clearing all suppliers */}
      {showClearAllConfirm && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#122137] border border-rose-500/50 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/90 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">¿Vaciar Directorio de Proveedores?</h4>
                <p className="text-xs text-rose-300/80 mt-0.5">Se eliminarán todos los {suppliers.length} proveedores registrados.</p>
              </div>
            </div>

            <div className="bg-[#0b1624] p-3 rounded-xl border border-rose-900/40 text-xs text-slate-300">
              Esta acción borrará todo el catálogo de proveedores y fabricantes guardados en la base de datos local.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearAllConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white font-bold text-xs hover:bg-[#1a2d47] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleClearAllSuppliers}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs shadow-lg transition cursor-pointer"
              >
                Sí, Vaciar Todo el Directorio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: DUPLICATE SUPPLIERS DEDUPLICATION & MERGE REVIEW
          ========================================================================= */}
      {showDeduplicationModal && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#101e30] border border-sky-500/40 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-[#0a1524] border-b border-[#223955] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <GitMerge className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base">Unificación Inteligente de Proveedores</h3>
                    <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/40 px-2 py-0.5 rounded-full font-bold">
                      Fuzzy Matching & NIT
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Detecta razones sociales parecidas (tildes, mayúsculas, sufijos SAS/LTDA/país) y las fusiona sin perder órdenes de compra ni equipos vinculados.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeduplicationModal(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-[#1a2e48] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {detectedDuplicateGroups.length === 0 ? (
                <div className="p-8 text-center bg-[#0d1a2c] rounded-2xl border border-[#243c5a] space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-white text-base">¡Directorio de Proveedores 100% Unificado!</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    No se encontraron proveedores repetidos o con nombres parecidos en el directorio. Todos los perfiles registrados tienen nombres canónicos únicos.
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDeduplicationModal(false)}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition cursor-pointer"
                    >
                      Aceptar y Continuar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Summary Bar */}
                  <div className="bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-white text-sm">
                          {detectedDuplicateGroups.length} {detectedDuplicateGroups.length === 1 ? 'grupo detectado' : 'grupos detectados'}
                        </span>
                        <span className="text-xs text-amber-300 font-semibold bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded-full">
                          {totalDuplicatesCount} {totalDuplicatesCount === 1 ? 'proveedor a fusionar' : 'proveedores a fusionar'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Al unificar, se actualizarán automáticamente los contratos, órdenes de compra y equipos vinculados al nombre oficial.
                      </p>
                    </div>

                    <button
                      type="button"
                      id="unify-all-suppliers-btn"
                      onClick={handleUnifyAll}
                      disabled={isUnifying}
                      className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg transition cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4 stroke-[2.5]" />
                      <span>{isUnifying ? 'Unificando...' : 'Unificar Todos los Duplicados Ahora'}</span>
                    </button>
                  </div>

                  {/* Duplicate Groups List */}
                  <div className="space-y-3">
                    {detectedDuplicateGroups.map((group, gIdx) => {
                      const selectedCanonId = customCanonicalIds.get(group.groupId) || group.canonicalProfile.id;
                      const activeCanonical = group.allProfiles.find((p) => p.id === selectedCanonId) || group.canonicalProfile;
                      const activeDuplicates = group.allProfiles.filter((p) => p.id !== activeCanonical.id);

                      const canonStats = supplierStatsMap.get(activeCanonical.id) || { ocCount: 0, catalogEqCount: 0 };

                      return (
                        <div
                          key={group.groupId}
                          className="bg-[#0e1b2c] border border-[#254164] hover:border-sky-500/40 rounded-xl p-3.5 transition space-y-3 shadow-md"
                        >
                          {/* Group header */}
                          <div className="flex items-center justify-between gap-2 border-b border-[#1f3755] pb-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-black text-sky-400 bg-sky-950/70 border border-sky-500/30 px-2 py-0.5 rounded-md">
                                Grupo #{gIdx + 1}
                              </span>
                              <span className="text-[11px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md">
                                {group.matchReason}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Confianza: <strong className="text-emerald-400">{group.confidenceScore}%</strong>
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleDismissGroup(group.groupId)}
                                className="text-[11px] text-slate-400 hover:text-slate-200 hover:bg-[#1a2d46] px-2 py-1 rounded-lg transition cursor-pointer"
                                title="Omitir este grupo (no unificar)"
                              >
                                Omitir
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUnifySingleGroup(group)}
                                disabled={isUnifying}
                                className="inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] px-3 py-1 rounded-lg transition shadow cursor-pointer disabled:opacity-50"
                              >
                                <GitMerge className="w-3 h-3" />
                                <span>Unificar este grupo</span>
                              </button>
                            </div>
                          </div>

                          {/* Comparison Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Canonical / Official Profile */}
                            <div className="bg-[#0b1625] border border-emerald-500/30 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                                  <Check className="w-3 h-3 stroke-[3]" /> Perfil Oficial Conservado
                                </span>
                                {group.allProfiles.length > 2 && (
                                  <span className="text-[9px] text-slate-400">
                                    {group.allProfiles.length} perfiles en total
                                  </span>
                                )}
                              </div>

                              <div>
                                <h5 className="font-bold text-white text-sm leading-snug">{activeCanonical.name}</h5>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-slate-300">
                                  {activeCanonical.nit && (
                                    <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                      NIT: <strong className="text-white">{activeCanonical.nit}</strong>
                                    </span>
                                  )}
                                  {activeCanonical.city && (
                                    <span className="text-slate-400">{activeCanonical.city}</span>
                                  )}
                                  {activeCanonical.phone && (
                                    <span className="text-slate-400">{activeCanonical.phone}</span>
                                  )}
                                </div>
                              </div>

                              {activeCanonical.brands && activeCanonical.brands.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {activeCanonical.brands.map((b, i) => (
                                    <span key={i} className="text-[9px] bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                                      {b}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="text-[10px] text-slate-400 flex items-center gap-2 pt-1 border-t border-[#18293d]">
                                <span>Equipos catálogo: <strong className="text-white">{canonStats.catalogEqCount}</strong></span>
                                <span>•</span>
                                <span>Órdenes compra: <strong className="text-white">{canonStats.ocCount}</strong></span>
                              </div>
                            </div>

                            {/* Duplicates to merge */}
                            <div className="bg-[#0b1625] border border-amber-500/30 rounded-lg p-3 space-y-2">
                              <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1">
                                <ArrowRight className="w-3 h-3" /> Se fusionarán en el perfil oficial
                              </span>

                              <div className="space-y-2">
                                {activeDuplicates.map((dup) => {
                                  const dupStats = supplierStatsMap.get(dup.id) || { ocCount: 0, catalogEqCount: 0 };
                                  return (
                                    <div
                                      key={dup.id}
                                      className="bg-[#122238] border border-[#203754] rounded-lg p-2 flex items-center justify-between gap-2"
                                    >
                                      <div>
                                        <p className="font-bold text-slate-200 text-xs">{dup.name}</p>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                                          {dup.nit && <span>NIT: {dup.nit}</span>}
                                          <span>{dupStats.catalogEqCount} Eq</span>
                                          <span>{dupStats.ocCount} OCs</span>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleSelectCanonicalForGroup(group.groupId, dup.id)}
                                        className="text-[10px] text-sky-400 hover:text-sky-200 hover:bg-sky-950/60 border border-sky-500/30 px-2 py-1 rounded transition cursor-pointer shrink-0"
                                        title="Usar este nombre como el oficial/principal"
                                      >
                                        Usar este nombre
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#0a1524] border-t border-[#223955] flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1 text-[11px]">
                <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                La unificación combina marcas, teléfonos y NITs sin duplicar ni perder información histórica de órdenes o equipos.
              </span>
              <button
                type="button"
                onClick={() => setShowDeduplicationModal(false)}
                className="px-4 py-1.5 rounded-lg bg-[#1a2d48] hover:bg-[#253f63] text-slate-200 hover:text-white font-bold transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
