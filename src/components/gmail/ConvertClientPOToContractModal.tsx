import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Building2,
  FileCheck2,
  ShoppingCart,
  AlertTriangle,
  CheckCircle2,
  PlusCircle,
  ExternalLink,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
  Truck,
  ShieldCheck,
  FileText,
  Trash2,
  Sparkles,
  Edit3,
  Save,
  Plus,
  Send,
  AlertCircle,
  Info,
  Check,
} from 'lucide-react';
import {
  MedicalEquipment,
  TenderClientProject,
  OCTrackingContract,
} from '../../types';
import { DetectedPurchaseOrder } from '../../services/gmailIntegrationService';
import {
  analyzeClientPO,
  createMissingEquipmentsFromClientPO,
  registerClientPOInContracts,
  generateSupplierOCsFromClientPO,
  ClientPOEquipmentItem,
} from '../../utils/clientPOUtils';
import { extractClientPOFromAttachment } from '../../utils/pdfTableExtractor';
import {
  autoRegisterSupplierIfNotExists,
  getStoredSupplierProfiles,
  SupplierProfile,
} from '../../utils/ocTrackingStorage';

interface ConvertClientPOToContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  order?: DetectedPurchaseOrder;
  email?: DetectedPurchaseOrder;
  catalog?: MedicalEquipment[];
  equipments?: MedicalEquipment[];
  onAddEquipmentToCatalog?: (equipment: MedicalEquipment) => void;
  onBatchSaveEquipments?:
    | ((equipments: MedicalEquipment[]) => void)
    | ((catalog: MedicalEquipment[], count: number, mode: 'append_update') => void);
  existingTenders?: TenderClientProject[];
  onUpdateTenders?: (tenders: TenderClientProject[]) => void;
  existingOCContracts?: OCTrackingContract[];
  onUpdateOCContracts?: (contracts: OCTrackingContract[]) => void;
  onNavigateToContracts?: () => void;
  onNavigateToOCTracking?: () => void;
  onNavigateToCatalog?: () => void;
  onNavigateToTab?: (tab: string) => void;
  currentUser?: any;
  onSuccess?: () => void;
}

const COMMON_SUPPLIERS = [
  'TÉCNICA ELECTROMÉDICA',
  'GENERAL MEDICA DE COLOMBIA',
  'MINDRAY COLOMBIA',
  'ALLIANCE MEDICAL / IMÁGENES DIAGNÓSTICAS',
  'SIEMENS HEALTHCARE',
  'GE HEALTHCARE',
  'PHILIPS HEALTHCARE',
  'FUTURO ORTOPEDICOS',
];

export const ConvertClientPOToContractModal: React.FC<ConvertClientPOToContractModalProps> = ({
  isOpen,
  onClose,
  order,
  email,
  catalog,
  equipments,
  onBatchSaveEquipments,
  existingTenders = [],
  onUpdateTenders,
  existingOCContracts = [],
  onUpdateOCContracts,
  onNavigateToContracts,
  onNavigateToOCTracking,
  onNavigateToCatalog,
  onNavigateToTab,
  currentUser,
  onSuccess,
}) => {
  const effectiveOrder = order || email;
  const initialCatalog = catalog || equipments || [];

  if (!isOpen || !effectiveOrder) return null;

  // Local state for catalog items
  const [currentCatalog, setCurrentCatalog] = useState<MedicalEquipment[]>(initialCatalog);

  // Analysis of the customer PO against catalog
  const initialAnalysis = useMemo(() => {
    return analyzeClientPO(effectiveOrder, currentCatalog);
  }, [effectiveOrder, currentCatalog]);

  const [customerName, setCustomerName] = useState<string>(initialAnalysis.customerName);
  const [clientOCNumber, setClientOCNumber] = useState<string>(initialAnalysis.clientOCNumber);
  const [items, setItems] = useState<ClientPOEquipmentItem[]>(initialAnalysis.items);
  const [quoteNumber, setQuoteNumber] = useState<string>('310826-9');

  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [extractPdfMsg, setExtractPdfMsg] = useState<string | null>(null);

  const [isCreatingMissingParts, setIsCreatingMissingParts] = useState(false);
  const [partsCreatedSuccessMsg, setPartsCreatedSuccessMsg] = useState<string | null>(null);

  const [isRegisteringContract, setIsRegisteringContract] = useState(false);
  const [contractCreatedSuccess, setContractCreatedSuccess] = useState<TenderClientProject | null>(null);

  const [isGeneratingSupplierPOs, setIsGeneratingSupplierPOs] = useState(false);
  const [supplierPOsSuccess, setSupplierPOsSuccess] = useState<OCTrackingContract | null>(null);

  // Supplier directory state
  const [supplierProfiles, setSupplierProfiles] = useState<SupplierProfile[]>(() => {
    try {
      return getStoredSupplierProfiles();
    } catch {
      return [];
    }
  });

  // Listen to external supplier directory updates
  useEffect(() => {
    const handleSuppliersUpdated = (e: any) => {
      try {
        if (e?.detail && Array.isArray(e.detail)) {
          setSupplierProfiles(e.detail);
        } else {
          setSupplierProfiles(getStoredSupplierProfiles());
        }
      } catch {}
    };
    window.addEventListener('syd_suppliers_updated', handleSuppliersUpdated);
    return () => window.removeEventListener('syd_suppliers_updated', handleSuppliersUpdated);
  }, []);

  const [supplierToastMsg, setSupplierToastMsg] = useState<string | null>(null);

  // Modal to register a brand new supplier manually
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [activeItemIndexForSupplier, setActiveItemIndexForSupplier] = useState<number | null>(null);
  const [newSupplierForm, setNewSupplierForm] = useState({
    name: '',
    nit: '',
    contactPerson: '',
    phone: '',
    email: '',
    city: 'Colombia',
  });

  // Interactive review modal for creating parts without inventing data
  const [isReviewPartsModalOpen, setIsReviewPartsModalOpen] = useState(false);

  // Identify uncreated items in catalog
  const uncreatedItems = useMemo(() => {
    return items.filter((it) => !it.isCreatedInCatalog);
  }, [items]);

  const hasUncreatedParts = uncreatedItems.length > 0;

  // Combined list of suppliers
  const allSupplierNames = useMemo(() => {
    const names = new Set<string>();
    supplierProfiles.forEach((p) => {
      if (p.name && p.name.trim()) names.add(p.name.trim());
    });
    COMMON_SUPPLIERS.forEach((s) => names.add(s));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [supplierProfiles]);

  const isSupplierInDirectory = (name?: string): boolean => {
    if (!name || !name.trim()) return false;
    const clean = name.trim().toLowerCase();
    return supplierProfiles.some((p) => p.name.trim().toLowerCase() === clean);
  };

  const handleSaveSupplierToDirectory = (rawSupplierName: string, brand?: string) => {
    const clean = (rawSupplierName || '').trim();
    if (!clean) return;
    try {
      const updated = autoRegisterSupplierIfNotExists(clean, brand);
      setSupplierProfiles(updated);
      setSupplierToastMsg(`✓ Proveedor "${clean}" guardado exitosamente en el Directorio de Proveedores`);
      setTimeout(() => setSupplierToastMsg(null), 4500);
    } catch (err) {
      console.error('Error saving supplier to directory:', err);
    }
  };

  const handleCreateNewSupplierInDirectory = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newSupplierForm.name.trim();
    if (!cleanName) return;

    try {
      const updated = autoRegisterSupplierIfNotExists(cleanName, undefined, {
        nit: newSupplierForm.nit.trim(),
        contactPerson: newSupplierForm.contactPerson.trim(),
        phone: newSupplierForm.phone.trim(),
        email: newSupplierForm.email.trim(),
        city: newSupplierForm.city.trim() || 'Colombia',
      });
      setSupplierProfiles(updated);

      if (activeItemIndexForSupplier !== null) {
        handleUpdateItem(activeItemIndexForSupplier, { suggestedSupplier: cleanName });
      }

      setSupplierToastMsg(`✓ Proveedor "${cleanName}" registrado exitosamente en el Directorio de Proveedores`);
      setTimeout(() => setSupplierToastMsg(null), 4500);
      setIsNewSupplierModalOpen(false);
      setNewSupplierForm({
        name: '',
        nit: '',
        contactPerson: '',
        phone: '',
        email: '',
        city: 'Colombia',
      });
    } catch (err) {
      console.error('Error creating supplier:', err);
    }
  };

  const getItemMissingFields = (it: ClientPOEquipmentItem) => {
    const missing: string[] = [];
    if (!it.code || !it.code.trim()) missing.push('Parte');
    if (!it.brand || !it.brand.trim()) missing.push('Marca');
    if (!it.model || !it.model.trim()) missing.push('Modelo');
    if (!it.suggestedSupplier || !it.suggestedSupplier.trim()) missing.push('Proveedor');
    if (!it.unitPriceCOP || it.unitPriceCOP <= 0) missing.push('Valor Unitario');
    return missing;
  };

  // Update item field
  const handleUpdateItem = (index: number, updates: Partial<ClientPOEquipmentItem>) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], ...updates };

      const qty = item.quantity || 1;
      const unitPrice = item.unitPriceCOP || 0;
      item.totalPriceCOP = qty * unitPrice;
      item.hasDetectedPrice = unitPrice > 0;
      item.hasDetectedBrand = Boolean(item.brand && item.brand.trim().length > 0);
      item.hasDetectedModel = Boolean(item.model && item.model.trim().length > 0);
      item.hasDetectedSupplier = Boolean(item.suggestedSupplier && item.suggestedSupplier.trim().length > 0 && item.suggestedSupplier !== 'Por asignar');

      next[index] = item;
      return next;
    });
  };

  // Add new row
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `cpo-man-${Date.now()}`,
        name: '',
        code: '',
        brand: '',
        model: '',
        quantity: 1,
        unitPriceCOP: 0,
        totalPriceCOP: 0,
        isCreatedInCatalog: false,
        suggestedSupplier: '',
        hasDetectedPrice: false,
        hasDetectedBrand: false,
        hasDetectedModel: false,
        hasDetectedSupplier: false,
      },
    ]);
  };

  // Remove row
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Extract from attached PDF
  const handleExtractFromPdf = async () => {
    if (!effectiveOrder.attachments || effectiveOrder.attachments.length === 0) {
      setExtractPdfMsg('Este correo no contiene archivos PDF adjuntos.');
      setTimeout(() => setExtractPdfMsg(null), 4000);
      return;
    }

    const pdfAtt = effectiveOrder.attachments.find(
      (a) => a.filename.toLowerCase().endsWith('.pdf') || a.mimeType.includes('pdf')
    ) || effectiveOrder.attachments[0];

    setIsExtractingPdf(true);
    try {
      const extracted = await extractClientPOFromAttachment(pdfAtt, effectiveOrder);
      if (extracted && extracted.items.length > 0) {
        if (extracted.customerName) setCustomerName(extracted.customerName);
        if (extracted.clientOCNumber) setClientOCNumber(extracted.clientOCNumber);
        if (extracted.quoteNumber) setQuoteNumber(extracted.quoteNumber);

        // Convert extracted items
        const newItems: ClientPOEquipmentItem[] = extracted.items.map((it, idx) => {
          const matched = currentCatalog.find(
            (c) => (it.partCode && c.code && c.code.toLowerCase() === it.partCode.toLowerCase()) ||
                   (it.model && c.model && c.model.toLowerCase() === it.model.toLowerCase())
          );

          const unitPrice = it.unitPrice || 0;
          const qty = it.quantity || 1;
          const brand = it.brand || matched?.brand || '';
          const model = it.model || matched?.model || '';
          const supplier = matched?.supplier || '';

          return {
            id: `cpo-ext-${idx + 1}-${Date.now()}`,
            name: it.description,
            code: it.partCode || matched?.code || '',
            brand,
            model,
            quantity: qty,
            unitPriceCOP: unitPrice,
            totalPriceCOP: unitPrice * qty,
            isCreatedInCatalog: Boolean(matched),
            catalogEquipmentId: matched?.id,
            suggestedSupplier: supplier,
            hasDetectedPrice: unitPrice > 0,
            hasDetectedBrand: Boolean(brand),
            hasDetectedModel: Boolean(model),
            hasDetectedSupplier: Boolean(supplier),
          };
        });

        setItems(newItems);
        setExtractPdfMsg(
          `¡Extracción exitosa desde ${pdfAtt.filename}! Se detectaron ${newItems.length} equipos con sus códigos, modelos y valores reales.`
        );
      } else {
        setExtractPdfMsg('No se pudo extraer tabla estructurada del PDF. Puede editar los valores manualmente.');
      }
    } catch (e) {
      console.error('Error extracting PDF:', e);
      setExtractPdfMsg('Error al procesar el archivo PDF.');
    } finally {
      setIsExtractingPdf(false);
      setTimeout(() => setExtractPdfMsg(null), 6000);
    }
  };

  // Create missing equipments in catalog
  const handleCreateMissingEquipments = async () => {
    if (uncreatedItems.length === 0) return;
    setIsCreatingMissingParts(true);

    try {
      const { updatedCatalog, createdEquipments } = createMissingEquipmentsFromClientPO(
        uncreatedItems,
        currentCatalog
      );

      setCurrentCatalog(updatedCatalog);

      // Update in-modal items state to mark them created
      setItems((prev) =>
        prev.map((it) => {
          const created = createdEquipments.find(
            (c) => (it.code && c.code === it.code) || c.name === it.name
          );
          if (created) {
            return {
              ...it,
              isCreatedInCatalog: true,
              catalogEquipmentId: created.id,
              code: created.code,
            };
          }
          return it;
        })
      );

      if (onBatchSaveEquipments) {
        try {
          (onBatchSaveEquipments as any)(createdEquipments, createdEquipments.length, 'append_update');
        } catch {
          (onBatchSaveEquipments as any)(createdEquipments);
        }
      }

      setPartsCreatedSuccessMsg(
        `Se crearon exitosamente ${createdEquipments.length} equipos en el Catálogo Maestro (Ventana 3) con sus marcas, modelos y códigos reales.`
      );

      setTimeout(() => {
        setPartsCreatedSuccessMsg(null);
      }, 5000);
    } catch (err) {
      console.error('Error creating equipments from client PO:', err);
    } finally {
      setIsCreatingMissingParts(false);
    }
  };

  // Register in Ventana 4 (Licitaciones y Contratos)
  const handleRegisterInContracts = async () => {
    setIsRegisteringContract(true);
    try {
      const currentAnalysis = {
        customerName,
        clientOCNumber,
        items,
        uncreatedCount: uncreatedItems.length,
        uncreatedNames: uncreatedItems.map((i) => i.name),
        estimatedTotalCOP: items.reduce((sum, i) => sum + i.totalPriceCOP, 0),
      };

      const storedTendersRaw = localStorage.getItem('syd_tender_clients_v2');
      const loadedTenders: TenderClientProject[] =
        existingTenders.length > 0
          ? existingTenders
          : storedTendersRaw
          ? JSON.parse(storedTendersRaw)
          : [];

      const { newTender, updatedTenders } = registerClientPOInContracts(
        effectiveOrder,
        currentAnalysis,
        loadedTenders,
        currentCatalog
      );

      if (onUpdateTenders) {
        onUpdateTenders(updatedTenders);
      }

      setContractCreatedSuccess(newTender);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error registering client contract:', err);
    } finally {
      setIsRegisteringContract(false);
    }
  };

  // Generate Supplier Purchase Orders in Ventana 5 (Seguimiento de OC a Proveedores)
  const handleGenerateSupplierPOs = async () => {
    setIsGeneratingSupplierPOs(true);
    try {
      const currentAnalysis = {
        customerName,
        clientOCNumber,
        items,
        uncreatedCount: uncreatedItems.length,
        uncreatedNames: uncreatedItems.map((i) => i.name),
        estimatedTotalCOP: items.reduce((sum, i) => sum + i.totalPriceCOP, 0),
      };

      const storedContractsRaw = localStorage.getItem('syd_oc_tracking_contracts_v2');
      const loadedContracts: OCTrackingContract[] =
        existingOCContracts.length > 0
          ? existingOCContracts
          : storedContractsRaw
          ? JSON.parse(storedContractsRaw)
          : [];

      const { newContract, updatedContracts } = generateSupplierOCsFromClientPO(
        effectiveOrder,
        currentAnalysis,
        contractCreatedSuccess?.id,
        loadedContracts,
        currentCatalog
      );

      if (onUpdateOCContracts) {
        onUpdateOCContracts(updatedContracts);
      }

      setSupplierPOsSuccess(newContract);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error generating supplier POs:', err);
    } finally {
      setIsGeneratingSupplierPOs(false);
    }
  };

  const totalCalculatedCOP = items.reduce((sum, i) => sum + i.totalPriceCOP, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-blue-500/40 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-blue-950/80 via-slate-900 to-indigo-950/70 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 mt-0.5">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-500/30 text-blue-300 font-black text-[10px] tracking-wider uppercase">
                  Cliente ➔ SYD Colombia
                </span>
                <span className="text-slate-400 text-xs font-medium">
                  Orden de Compra de Cliente (Contratos & Suministro)
                </span>
              </div>
              <h2 className="text-lg font-black text-white mt-1">
                Registrar Orden de Compra de Cliente
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Verifica los equipos solicitados por el cliente, asigna los proveedores correctos y radica en Catálogo, Contratos y Compras sin datos inventados.
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

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-200">
          
          {/* Extract PDF Banner / Action */}
          {effectiveOrder.attachments && effectiveOrder.attachments.some(a => a.filename.toLowerCase().endsWith('.pdf')) && (
            <div className="bg-slate-950/80 border border-blue-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-inner">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <span className="font-bold text-white">
                    Documento PDF adjunto detectado:
                  </span>
                  <span className="text-blue-300 ml-1.5 font-mono">
                    {effectiveOrder.attachments.find(a => a.filename.toLowerCase().endsWith('.pdf'))?.filename}
                  </span>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Extrae directamente la tabla oficial con códigos, modelos (DigiEye 350, MobiEye 700, V5), cantidades y valores unitarios.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleExtractFromPdf}
                disabled={isExtractingPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50 whitespace-nowrap self-end sm:self-auto"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isExtractingPdf ? 'Extrayendo datos del PDF...' : '📄 Extraer Datos del PDF Oficial'}</span>
              </button>
            </div>
          )}

          {extractPdfMsg && (
            <div className="bg-blue-950/80 border border-blue-500/60 rounded-xl p-3 text-xs text-blue-200 animate-in fade-in">
              {extractPdfMsg}
            </div>
          )}

          {/* Success messages */}
          {partsCreatedSuccessMsg && (
            <div className="bg-emerald-950/70 border border-emerald-500/60 rounded-xl p-3.5 flex items-center gap-3 text-xs text-emerald-200 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{partsCreatedSuccessMsg}</span>
            </div>
          )}

          {contractCreatedSuccess && (
            <div className="bg-blue-950/70 border border-blue-500/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-200 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white text-sm">
                    ¡Contrato registrado exitosamente en Ventana 4!
                  </span>
                  <p className="text-blue-300/90 mt-0.5">
                    Proceso/Contrato: <strong>{contractCreatedSuccess.header.processNumber}</strong> | Cliente:{' '}
                    <strong>{contractCreatedSuccess.clientName}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigateToContracts) onNavigateToContracts();
                  else if (onNavigateToTab) onNavigateToTab('licitaciones');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs shadow-md transition cursor-pointer whitespace-nowrap"
              >
                <span>Ver en Ventana 4 (Contratos)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {supplierPOsSuccess && (
            <div className="bg-emerald-950/70 border border-emerald-500/60 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-200 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <Truck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-white text-sm">
                    ¡Necesidad de OCs a Proveedores generada en Ventana 5!
                  </span>
                  <p className="text-emerald-300/90 mt-0.5">
                    Se estructuraron las órdenes de compra para los proveedores que fabrican los equipos solicitados por el cliente.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onNavigateToOCTracking) onNavigateToOCTracking();
                  else if (onNavigateToTab) onNavigateToTab('seguimiento_oc');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-md transition cursor-pointer whitespace-nowrap"
              >
                <span>Ver en Ventana 5 (Seguimiento OC)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Section 1: Customer & PO Details */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>1. Identificación del Cliente y Pedido</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Cliente / Institución Solicitante:
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-white font-bold"
                  placeholder="Ej: CLÍNICA DE ESPECIALIDADES"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Número de Orden de Compra Cliente:
                </label>
                <input
                  type="text"
                  value={clientOCNumber}
                  onChange={(e) => setClientOCNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-amber-300 font-mono font-bold"
                  placeholder="Ej: HBOC0000000640"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Cotización de Referencia:
                </label>
                <input
                  type="text"
                  value={quoteNumber}
                  onChange={(e) => setQuoteNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono"
                  placeholder="Ej: 310826-9"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1 border-t border-slate-800/60">
              <span className="font-semibold text-slate-300">Asunto del correo:</span>
              <span className="truncate italic text-slate-300">{effectiveOrder?.subject || 'Sin asunto'}</span>
            </div>
          </div>

          {/* Toast for supplier/part notifications */}
          {supplierToastMsg && (
            <div className="bg-emerald-950/90 border border-emerald-500/80 rounded-xl p-3 text-xs text-emerald-200 flex items-center justify-between gap-2 shadow-xl animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{supplierToastMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setSupplierToastMsg(null)}
                className="text-emerald-400 hover:text-emerald-200 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Section 2: Catalog Verification & Missing Parts Alert */}
          {hasUncreatedParts ? (
            <div className="bg-amber-950/60 border-2 border-amber-500/70 rounded-xl p-4 text-xs text-amber-200 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="font-black text-amber-300 text-sm">
                      ⚠️ {uncreatedItems.length} equipo(s) no existen en el Catálogo Maestro
                    </h4>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-900/60 border border-amber-600/60 rounded text-amber-200">
                      Sin partes asignadas en la app
                    </span>
                  </div>

                  <p className="text-amber-200/90 mt-1 leading-relaxed">
                    La orden de compra del cliente solicita <strong>{uncreatedItems.length} equipo(s)</strong> que aún no están creados en el catálogo:
                  </p>

                  <div className="mt-2 space-y-1.5 bg-slate-950/60 p-2.5 rounded-lg border border-amber-900/60">
                    {uncreatedItems.map((i, idx) => {
                      const missingFields = getItemMissingFields(i);
                      return (
                        <div key={idx} className="flex items-center justify-between gap-2 text-[11px] flex-wrap">
                          <span className="font-bold text-amber-100">
                            #{idx + 1}. {i.name} {i.brand ? `(${i.brand} ${i.model || ''})` : ''}
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {missingFields.length > 0 ? (
                              missingFields.map((f) => (
                                <span key={f} className="px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-800/80 text-rose-300 text-[9px] font-semibold">
                                  Falta {f}
                                </span>
                              ))
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80 text-emerald-300 text-[9px] font-semibold">
                                Datos completos
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-2 flex items-start gap-2 bg-slate-900/80 p-2 rounded-lg border border-slate-700/60 text-[11px] text-slate-300">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Regla de integridad SYD:</strong> Si un dato no está claro en la orden, se deja en blanco para que compras o el área técnica lo defina. Nunca se inventan códigos ni registros sanitarios ficticios.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-amber-500/30">
                <button
                  type="button"
                  onClick={() => setIsReviewPartsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/60 rounded-lg font-bold text-xs shadow-md transition cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span>Mandar a Crear las Partes (Revisar Datos)</span>
                </button>

                <button
                  type="button"
                  onClick={handleCreateMissingEquipments}
                  disabled={isCreatingMissingParts}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-black text-xs shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>
                    {isCreatingMissingParts
                      ? 'Creando en Catálogo...'
                      : `Crear las ${uncreatedItems.length} Partes en Catálogo Ahora`}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-950/50 border border-emerald-500/50 rounded-xl p-3 text-xs text-emerald-200 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Todos los {items.length} equipos solicitados por el cliente están verificados y creados en el Catálogo Maestro con sus números de parte.
                </span>
              </div>
            </div>
          )}

          {/* Section 3: Equipment Breakdown & Supplier Assignment */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <span>2. Detalle de Equipos, Partes y Proveedores</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveItemIndexForSupplier(null);
                    setIsNewSupplierModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded bg-slate-900 border border-emerald-800/80 hover:border-emerald-500 transition cursor-pointer"
                  title="Registrar un nuevo proveedor manualmente en el Directorio"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Registrar Nuevo Proveedor</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-200 px-2 py-1 rounded bg-slate-900 border border-slate-700 hover:border-cyan-500 transition cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Agregar Ítem</span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const isItemSupplierInDir = isSupplierInDirectory(item.suggestedSupplier);
                const hasMissingPart = !item.code || !item.code.trim();

                return (
                  <div
                    key={item.id || idx}
                    className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition space-y-3"
                  >
                    {/* Top line: Status, Part, Name, Delete */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap flex-1">
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-bold rounded">
                          #{idx + 1}
                        </span>
                        {item.isCreatedInCatalog ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>En Catálogo {item.code ? `(Parte: ${item.code})` : ''}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Sin parte creada en la app</span>
                          </span>
                        )}

                        {/* Warning badges for missing data */}
                        {hasMissingPart && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-medium">
                            ⚠️ Falta parte
                          </span>
                        )}
                        {!item.unitPriceCOP && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-medium">
                            ⚠️ Sin valor detectado
                          </span>
                        )}
                        {!item.suggestedSupplier && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-medium">
                            ⚠️ Proveedor por asignar
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                        title="Eliminar ítem"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Grid of editable fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                      {/* Parte / No. de Parte */}
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-400 mb-1 flex items-center justify-between">
                          <span>Parte / No. de Parte:</span>
                          {item.isCreatedInCatalog ? (
                            <span className="text-[9px] text-emerald-400 font-bold">Oficial SYD</span>
                          ) : (
                            <span className="text-[9px] text-amber-400 font-semibold">Pendiente</span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={item.code || ''}
                          onChange={(e) => handleUpdateItem(idx, { code: e.target.value })}
                          placeholder={item.isCreatedInCatalog ? 'Ej: 70796' : 'Sin parte asignada (debe crearse)'}
                          className={`w-full bg-slate-950 border rounded-lg px-2.5 py-1.5 font-mono text-xs font-bold ${
                            item.isCreatedInCatalog
                              ? 'border-emerald-600/70 text-emerald-300'
                              : 'border-slate-700 text-amber-300'
                          }`}
                        />
                      </div>

                      {/* Descripción / Nombre */}
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Nombre / Descripción del Equipo:
                        </label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateItem(idx, { name: e.target.value })}
                          placeholder="Ej: RAYOS X DIGIEYE 350"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium text-xs"
                        />
                      </div>

                      {/* Marca */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Marca:
                        </label>
                        <input
                          type="text"
                          value={item.brand || ''}
                          onChange={(e) => handleUpdateItem(idx, { brand: e.target.value })}
                          placeholder="Ej: MINDRAY"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs uppercase"
                        />
                      </div>

                      {/* Modelo */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Modelo:
                        </label>
                        <input
                          type="text"
                          value={item.model || ''}
                          onChange={(e) => handleUpdateItem(idx, { model: e.target.value })}
                          placeholder="Ej: DIGIEYE 350"
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs uppercase"
                        />
                      </div>
                    </div>

                    {/* Quantity, Unit Price, Total, Supplier */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs pt-1 border-t border-slate-800/80 items-start">
                      {/* Cantidad */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Cantidad:
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold text-xs"
                        />
                      </div>

                      {/* Valor Unitario */}
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Valor Unitario COP:
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono">$</span>
                          <input
                            type="number"
                            value={item.unitPriceCOP || ''}
                            onChange={(e) => handleUpdateItem(idx, { unitPriceCOP: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-6 pr-2.5 py-1.5 font-mono text-emerald-400 font-bold text-xs"
                          />
                        </div>
                      </div>

                      {/* Subtotal */}
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 mb-1">
                          Subtotal:
                        </label>
                        <div className="bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 font-mono font-bold text-emerald-400 text-xs">
                          {item.totalPriceCOP > 0 ? `$${item.totalPriceCOP.toLocaleString('es-CO')}` : '$0'}
                        </div>
                      </div>

                      {/* Proveedor Sugerido / Asignado */}
                      <div className="sm:col-span-5">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-400">
                            Proveedor para Compra (OC):
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveItemIndexForSupplier(idx);
                              setNewSupplierForm((prev) => ({
                                ...prev,
                                name: item.suggestedSupplier || '',
                              }));
                              setIsNewSupplierModalOpen(true);
                            }}
                            className="text-[9px] font-bold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                          >
                            + Manual / Directorio
                          </button>
                        </div>

                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={item.suggestedSupplier || ''}
                            onChange={(e) => handleUpdateItem(idx, { suggestedSupplier: e.target.value })}
                            placeholder="Escriba o elija proveedor..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium text-xs"
                          />
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) handleUpdateItem(idx, { suggestedSupplier: e.target.value });
                            }}
                            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 text-xs cursor-pointer shrink-0"
                            title="Seleccionar proveedor registrado"
                          >
                            <option value="">Elegir...</option>
                            {allSupplierNames.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* If typed supplier is NOT in directory, give option to save directly */}
                        {item.suggestedSupplier && item.suggestedSupplier.trim() && !isItemSupplierInDir && (
                          <div className="mt-1.5 flex items-center justify-between gap-1">
                            <span className="text-[9px] text-amber-400">
                              ⚠️ No registrado en directorio
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSaveSupplierToDirectory(item.suggestedSupplier, item.brand)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 text-[10px] font-bold transition cursor-pointer shadow-sm"
                              title="Guardar este proveedor en el Directorio de Proveedores"
                            >
                              <Save className="w-3 h-3 text-emerald-400" />
                              <span>Guardar en Directorio</span>
                            </button>
                          </div>
                        )}
                        {item.suggestedSupplier && isItemSupplierInDir && (
                          <span className="text-[9px] text-emerald-400 mt-1 inline-flex items-center gap-1">
                            ✓ Registrado en Directorio de Proveedores
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-3 px-2 border-t border-slate-800">
              <span className="text-xs font-bold text-slate-400">
                Valor Total de la Orden de Compra:
              </span>
              <span className="text-base font-black text-emerald-400 font-mono">
                ${totalCalculatedCOP.toLocaleString('es-CO')} COP
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Cerrar
          </button>

          <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2.5">
            {/* Action 1: Register in Contracts (Ventana 4) */}
            <button
              type="button"
              onClick={handleRegisterInContracts}
              disabled={isRegisteringContract}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-lg transition cursor-pointer disabled:opacity-50"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>
                {isRegisteringContract
                  ? 'Registrando en Contratos...'
                  : '1. Radicar Pedido en Contratos (Ventana 4)'}
              </span>
            </button>

            {/* Action 2: Generate Supplier Purchase Orders (Ventana 5) */}
            <button
              type="button"
              onClick={handleGenerateSupplierPOs}
              disabled={isGeneratingSupplierPOs}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg transition cursor-pointer disabled:opacity-50"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>
                {isGeneratingSupplierPOs
                  ? 'Generando OCs a Proveedores...'
                  : '2. Generar Necesidad de OC a Proveedores (Ventana 5)'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal: Registrar Nuevo Proveedor Manualmente en Directorio */}
      {isNewSupplierModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-emerald-500/60 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  Registrar Nuevo Proveedor en Directorio
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewSupplierModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Ingrese los datos del proveedor. Quedará guardado permanentemente en el <strong>Directorio de Proveedores</strong> de SYD Colombia para futuras órdenes de compra.
            </p>

            <form onSubmit={handleCreateNewSupplierInDirectory} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Nombre o Razón Social *:
                </label>
                <input
                  type="text"
                  required
                  value={newSupplierForm.name}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
                  placeholder="Ej: TÉCNICA ELECTROMÉDICA S.A."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-bold uppercase focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    NIT / Identificación:
                  </label>
                  <input
                    type="text"
                    value={newSupplierForm.nit}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, nit: e.target.value })}
                    placeholder="Ej: 900.123.456-7"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Ciudad / Sede:
                  </label>
                  <input
                    type="text"
                    value={newSupplierForm.city}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, city: e.target.value })}
                    placeholder="Ej: Medellín / Bogotá"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Contacto / Asesor:
                  </label>
                  <input
                    type="text"
                    value={newSupplierForm.contactPerson}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, contactPerson: e.target.value })}
                    placeholder="Ej: Ing. Carlos Pérez"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">
                    Teléfono / Celular:
                  </label>
                  <input
                    type="text"
                    value={newSupplierForm.phone}
                    onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                    placeholder="Ej: 310 123 4567"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Correo Electrónico de Pedidos:
                </label>
                <input
                  type="email"
                  value={newSupplierForm.email}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, email: e.target.value })}
                  placeholder="Ej: pedidos@proveedor.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewSupplierModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md transition"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar en Directorio</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-modal: Mandar a Crear las Partes (Revisar y Completar Datos Faltantes) */}
      {isReviewPartsModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/60 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Mandar a Crear Partes en Catálogo Maestro
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Verifique los datos detectados. Si desconoce algún dato, déjelo en blanco; el sistema no inventará información ficticia.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsReviewPartsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="bg-blue-950/40 border border-blue-800/60 rounded-xl p-3 text-blue-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                <div className="text-[11px] space-y-1">
                  <p className="font-bold">Política de Precisión e Integridad SYD Colombia:</p>
                  <p className="text-blue-200/90 leading-relaxed">
                    Los campos en blanco se guardarán sin datos inventados (por ejemplo sin registros INVIMA falsos). Podrá completarlos más adelante desde la Ventana 3 (Catálogo de Equipos).
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {items
                  .map((it, originalIdx) => ({ it, originalIdx }))
                  .filter(({ it }) => !it.isCreatedInCatalog)
                  .map(({ it, originalIdx }, subIdx) => {
                    const missingFields = getItemMissingFields(it);

                    return (
                      <div
                        key={it.id || subIdx}
                        className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3"
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-bold text-white text-xs">
                            Equipo #{subIdx + 1}: {it.name}
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {missingFields.length > 0 ? (
                              missingFields.map((f) => (
                                <span
                                  key={f}
                                  className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 text-[10px] font-semibold"
                                >
                                  ⚠️ Falta {f}
                                </span>
                              ))
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] font-semibold">
                                ✓ Completo
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                          {/* No. Parte */}
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Parte / No. de Parte:
                            </label>
                            <input
                              type="text"
                              value={it.code || ''}
                              onChange={(e) => handleUpdateItem(originalIdx, { code: e.target.value })}
                              placeholder="En blanco si no se conoce"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-cyan-300 text-xs font-bold"
                            />
                          </div>

                          {/* Nombre */}
                          <div className="sm:col-span-5">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Nombre del Equipo:
                            </label>
                            <input
                              type="text"
                              value={it.name}
                              onChange={(e) => handleUpdateItem(originalIdx, { name: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs font-medium"
                            />
                          </div>

                          {/* Marca */}
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Marca:
                            </label>
                            <input
                              type="text"
                              value={it.brand || ''}
                              onChange={(e) => handleUpdateItem(originalIdx, { brand: e.target.value })}
                              placeholder="En blanco si no se conoce"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs uppercase"
                            />
                          </div>

                          {/* Modelo */}
                          <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Modelo:
                            </label>
                            <input
                              type="text"
                              value={it.model || ''}
                              onChange={(e) => handleUpdateItem(originalIdx, { model: e.target.value })}
                              placeholder="En blanco si no se conoce"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs uppercase"
                            />
                          </div>

                          {/* Proveedor */}
                          <div className="sm:col-span-6">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Proveedor Recomendado:
                            </label>
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={it.suggestedSupplier || ''}
                                onChange={(e) => handleUpdateItem(originalIdx, { suggestedSupplier: e.target.value })}
                                placeholder="Escriba o elija de lista..."
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white text-xs"
                              />
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) handleUpdateItem(originalIdx, { suggestedSupplier: e.target.value });
                                }}
                                className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-2 text-xs"
                              >
                                <option value="">Elegir...</option>
                                {allSupplierNames.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Valor COP */}
                          <div className="sm:col-span-6">
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">
                              Valor Unitario COP:
                            </label>
                            <input
                              type="number"
                              value={it.unitPriceCOP || ''}
                              onChange={(e) => handleUpdateItem(originalIdx, { unitPriceCOP: parseFloat(e.target.value) || 0 })}
                              placeholder="0 (dejar en 0 si no se conoce)"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-emerald-400 text-xs font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsReviewPartsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
              >
                Volver a la Orden
              </button>

              <button
                type="button"
                onClick={async () => {
                  setIsReviewPartsModalOpen(false);
                  await handleCreateMissingEquipments();
                }}
                disabled={isCreatingMissingParts}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-lg transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Confirmar y Crear las Partes en Catálogo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
