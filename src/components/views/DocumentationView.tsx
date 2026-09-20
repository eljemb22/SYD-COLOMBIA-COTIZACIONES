import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FolderArchive,
  Search,
  Plus,
  FileText,
  ShieldCheck,
  BookOpen,
  Wrench,
  Zap,
  Award,
  File,
  Download,
  Eye,
  Trash2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Lock,
  LayoutGrid,
  Check,
  X,
  Printer,
  Building2,
  Filter,
  CheckCircle,
  FileCheck,
  AlertCircle,
  Clock,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileType,
  Image as ImageIcon,
  ChevronRight,
  Layers,
  FolderPlus,
  Database,
  MinusCircle,
  PlusCircle,
  Tag,
  Sparkles,
  Boxes,
} from 'lucide-react';
import {
  TechnicalDocument,
  MedicalEquipment,
  AuthUser,
  OCTrackingContract,
} from '../../types';
import {
  getStoredOCTrackingContracts,
  saveStoredOCTrackingContracts,
} from '../../utils/ocTrackingStorage';
import { SerializedEquipmentsDossierTab } from './documentation/SerializedEquipmentsDossierTab';
import { QuickTechnicalSheetGenerator } from './documentation/QuickTechnicalSheetGenerator';

interface DocumentationViewProps {
  documents: TechnicalDocument[];
  equipments: MedicalEquipment[];
  ocContracts?: OCTrackingContract[];
  onUpdateContracts?: (contracts: OCTrackingContract[]) => void;
  onOpenNewDocumentModal: (equipmentId?: string, docType?: string) => void;
  onSaveDocument?: (newDoc: TechnicalDocument) => void;
  onDeleteDocument: (id: string) => void;
  currentUser?: AuthUser | null;
  onNavigateToOCTracking?: () => void;
}

// Convert base64 dataURI to Blob
function dataURItoBlob(dataURI: string): Blob | null {
  try {
    if (!dataURI.includes(',')) return null;
    const parts = dataURI.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const byteString = atob(parts[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mime });
  } catch (e) {
    console.error('Error converting dataURI to Blob:', e);
    return null;
  }
}

// Helper to get category icon and colors
function getCategoryMeta(categoryName: string) {
  const lower = categoryName.toLowerCase();
  if (lower.includes('ficha') || lower.includes('tecnica') || lower.includes('técnica')) {
    return {
      icon: FileText,
      color: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      label: 'Ficha Técnica',
    };
  }
  if (lower.includes('invima') || lower.includes('sanitario') || lower.includes('registro')) {
    return {
      icon: ShieldCheck,
      color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      label: 'Registro INVIMA',
    };
  }
  if (lower.includes('usuario') || lower.includes('operacion') || lower.includes('operación')) {
    return {
      icon: BookOpen,
      color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      label: 'Manual de Usuario',
    };
  }
  if (lower.includes('servicio') || lower.includes('tecnico') || lower.includes('técnico') || lower.includes('mantenimiento')) {
    return {
      icon: Wrench,
      color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
      badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      label: 'Manual de Servicio',
    };
  }
  if (lower.includes('rapida') || lower.includes('rápida') || lower.includes('guia') || lower.includes('guía')) {
    return {
      icon: Zap,
      color: 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10',
      badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
      label: 'Guía Rápida',
    };
  }
  if (lower.includes('calidad') || lower.includes('iso') || lower.includes('ce') || lower.includes('fda') || lower.includes('certificad')) {
    return {
      icon: Award,
      color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      label: 'Certificado de Calidad',
    };
  }
  return {
    icon: File,
    color: 'text-slate-300 border-slate-500/30 bg-slate-500/10',
    badgeBg: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    label: categoryName,
  };
}

export const DocumentationView: React.FC<DocumentationViewProps> = ({
  documents,
  equipments,
  ocContracts,
  onUpdateContracts,
  onOpenNewDocumentModal,
  onSaveDocument,
  onDeleteDocument,
  currentUser,
  onNavigateToOCTracking,
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canEditDocuments;

  // Primary view tabs: 'matrix' (Por Equipos), 'repository' (Listado Completo), 'serials' (Expedientes y Seriales), or 'technical_sheet' (Generador Rápido)
  const [viewTab, setViewTab] = useState<'matrix' | 'repository' | 'serials' | 'technical_sheet'>('matrix');

  // Internal contracts sync with fallback to localStorage
  const [contractsInternal, setContractsInternal] = useState<OCTrackingContract[]>(() => {
    return ocContracts || getStoredOCTrackingContracts();
  });

  useEffect(() => {
    if (ocContracts) {
      setContractsInternal(ocContracts);
    }
  }, [ocContracts]);

  const handleUpdateContracts = (newContracts: OCTrackingContract[]) => {
    setContractsInternal(newContracts);
    saveStoredOCTrackingContracts(newContracts);
    if (onUpdateContracts) {
      onUpdateContracts(newContracts);
    }
  };

  // Count total units across all contracts
  const totalSerializedUnits = useMemo(() => {
    let count = 0;
    contractsInternal.forEach((c) => {
      c.items.forEach((it) => {
        count += Math.max(1, it.quantity || 1);
      });
    });
    return count;
  }, [contractsInternal]);

  // Explicit list of equipment IDs manually added to Ventana 5 (starts empty until user manually selects)
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('syd_doc_selected_equipments_v3');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading selected doc equipments:', e);
    }
    return [];
  });

  // Save selected equipment IDs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('syd_doc_selected_equipments_v3', JSON.stringify(selectedEquipmentIds));
    } catch (e) {
      console.error('Error saving selected doc equipments:', e);
    }
  }, [selectedEquipmentIds]);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('Todos');

  // Modal to add equipment from Ventana 3 (Catálogo de Equipos)
  const [isAddEquipmentModalOpen, setIsAddEquipmentModalOpen] = useState(false);
  const [equipmentSearchModal, setEquipmentSearchModal] = useState('');

  // Modals & previews
  const [previewDoc, setPreviewDoc] = useState<TechnicalDocument | null>(null);
  const [docToDelete, setDocToDelete] = useState<TechnicalDocument | null>(null);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imageRotation, setImageRotation] = useState<number>(0);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);

  // Generate object URL whenever previewDoc changes
  useEffect(() => {
    if (previewDoc?.fileData && previewDoc.fileData.startsWith('data:')) {
      const blob = dataURItoBlob(previewDoc.fileData);
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreviewBlobUrl(url);
        return () => {
          URL.revokeObjectURL(url);
        };
      }
    }
    setPreviewBlobUrl(previewDoc?.fileData || null);
    setImageZoom(1);
    setImageRotation(0);
  }, [previewDoc]);

  // Handle ESC key press to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (docToDelete) {
          setDocToDelete(null);
        } else if (previewDoc) {
          setPreviewDoc(null);
        } else if (isAddEquipmentModalOpen) {
          setIsAddEquipmentModalOpen(false);
          setEquipmentSearchModal('');
        }
      }
    };

    if (isAddEquipmentModalOpen || previewDoc || docToDelete) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isAddEquipmentModalOpen, previewDoc, docToDelete]);

  // Categories list for equipment filter
  const equipmentCategories = [
    'Todos',
    'Monitoreo',
    'Cirugía',
    'Diagnóstico',
    'Quirófano',
    'Cuidados Críticos',
    'Urgencias',
    'Ginecología',
  ];

  // Distinct document types across all uploaded documents
  const availableDocTypes = useMemo(() => {
    const types = new Set<string>();
    documents.forEach((d) => {
      if (d.docType) types.add(d.docType);
    });
    return Array.from(types);
  }, [documents]);

  // Determine file category of a document
  const getDocFileCategory = (doc: TechnicalDocument): 'pdf' | 'image' | 'word' | 'other' => {
    const fn = (doc.fileName || '').toLowerCase();
    const ft = (doc.fileType || '').toLowerCase();
    const fd = (doc.fileData || '').toLowerCase();

    if (fn.endsWith('.pdf') || ft.includes('pdf') || fd.startsWith('data:application/pdf')) {
      return 'pdf';
    }
    if (
      fn.endsWith('.jpg') ||
      fn.endsWith('.jpeg') ||
      fn.endsWith('.png') ||
      ft.startsWith('image/') ||
      fd.startsWith('data:image/')
    ) {
      return 'image';
    }
    if (
      fn.endsWith('.doc') ||
      fn.endsWith('.docx') ||
      ft.includes('word') ||
      ft.includes('officedocument')
    ) {
      return 'word';
    }
    return 'other';
  };

  // Download real file
  const handleDownloadDoc = (doc: TechnicalDocument) => {
    if (doc.fileData && doc.fileData.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = doc.fileData;
      link.download = doc.fileName || `${doc.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (previewBlobUrl) {
      const link = document.createElement('a');
      link.href = previewBlobUrl;
      link.download = doc.fileName || `${doc.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const blob = new Blob([doc.notes || doc.title], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.fileName || `${doc.title}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Open in full tab / window
  const handleOpenInNewTab = (doc: TechnicalDocument) => {
    if (previewBlobUrl) {
      window.open(previewBlobUrl, '_blank');
    } else if (doc.fileData) {
      const blob = dataURItoBlob(doc.fileData);
      if (blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        window.open(doc.fileData, '_blank');
      }
    }
  };

  const confirmDelete = () => {
    if (docToDelete) {
      onDeleteDocument(docToDelete.id);
      if (previewDoc && previewDoc.id === docToDelete.id) {
        setPreviewDoc(null);
      }
      setDocToDelete(null);
    }
  };

  // Handle adding an equipment from Ventana 3 to this Documentation View
  const handleAddEquipmentToView = (eqId: string, andAttachDoc = false) => {
    if (!selectedEquipmentIds.includes(eqId)) {
      setSelectedEquipmentIds((prev) => [...prev, eqId]);
    }
    if (andAttachDoc) {
      setIsAddEquipmentModalOpen(false);
      onOpenNewDocumentModal(eqId);
    }
  };

  // Handle adding all equipments from Ventana 3
  const handleAddAllEquipmentsToView = () => {
    const allIds = equipments.map((eq) => eq.id);
    setSelectedEquipmentIds(allIds);
    setIsAddEquipmentModalOpen(false);
  };

  // Handle removing an equipment from this Documentation View
  const handleRemoveEquipmentFromView = (eqId: string) => {
    setSelectedEquipmentIds((prev) => prev.filter((id) => id !== eqId));
  };

  // Equipments that are manually chosen for Ventana 5
  const activeEquipmentsInDoc = useMemo(() => {
    return equipments.filter((eq) => selectedEquipmentIds.includes(eq.id));
  }, [equipments, selectedEquipmentIds]);

  // Filter chosen equipments and calculate their grouped documents
  const equipmentsWithDocs = useMemo(() => {
    return activeEquipmentsInDoc
      .map((eq) => {
        const eqDocs = documents.filter(
          (d) => d.equipmentId === eq.id || d.equipmentCode === eq.code
        );

        // Group documents by docType
        const groupedMap = new Map<string, TechnicalDocument[]>();
        eqDocs.forEach((doc) => {
          const type = doc.docType || 'Otro Anexo';
          if (!groupedMap.has(type)) {
            groupedMap.set(type, []);
          }
          groupedMap.get(type)!.push(doc);
        });

        const groups = Array.from(groupedMap.entries()).map(([type, docs]) => ({
          type,
          docs,
          meta: getCategoryMeta(type),
        }));

        return {
          equipment: eq,
          docs: eqDocs,
          groups,
          totalDocs: eqDocs.length,
        };
      })
      .filter((item) => {
        const eq = item.equipment;
        const query = searchQuery.toLowerCase();

        const matchesSearch =
          eq.name.toLowerCase().includes(query) ||
          eq.code.toLowerCase().includes(query) ||
          eq.brand.toLowerCase().includes(query) ||
          eq.model.toLowerCase().includes(query) ||
          (eq.invimaRecordNumber && eq.invimaRecordNumber.toLowerCase().includes(query)) ||
          item.docs.some(
            (d) =>
              d.title.toLowerCase().includes(query) ||
              d.fileName.toLowerCase().includes(query) ||
              d.docType.toLowerCase().includes(query) ||
              (d.invimaNumber && d.invimaNumber.toLowerCase().includes(query))
          );

        const matchesCategory =
          selectedCategory === 'Todos' || eq.category === selectedCategory;

        const matchesDocType =
          docTypeFilter === 'Todos' ||
          (docTypeFilter === 'con_docs' && item.totalDocs > 0) ||
          (docTypeFilter === 'sin_docs' && item.totalDocs === 0) ||
          item.docs.some((d) => d.docType === docTypeFilter);

        return matchesSearch && matchesCategory && matchesDocType;
      });
  }, [activeEquipmentsInDoc, documents, searchQuery, selectedCategory, docTypeFilter]);

  // Filter flat list of documents for repository view
  const filteredFlatDocs = useMemo(() => {
    return documents.filter((doc) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        doc.title.toLowerCase().includes(query) ||
        doc.equipmentName.toLowerCase().includes(query) ||
        doc.fileName.toLowerCase().includes(query) ||
        doc.docType.toLowerCase().includes(query) ||
        (doc.invimaNumber && doc.invimaNumber.toLowerCase().includes(query)) ||
        (doc.equipmentCode && doc.equipmentCode.toLowerCase().includes(query));

      const matchesType =
        docTypeFilter === 'Todos' ||
        docTypeFilter === 'con_docs' ||
        docTypeFilter === 'sin_docs' ||
        doc.docType === docTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [documents, searchQuery, docTypeFilter]);

  // Filter modal equipment list from Ventana 3 (Catálogo)
  const filteredModalEquipments = useMemo(() => {
    const q = equipmentSearchModal.toLowerCase();
    return equipments.filter(
      (eq) =>
        eq.name.toLowerCase().includes(q) ||
        eq.code.toLowerCase().includes(q) ||
        eq.brand.toLowerCase().includes(q) ||
        eq.model.toLowerCase().includes(q) ||
        eq.category.toLowerCase().includes(q)
    );
  }, [equipments, equipmentSearchModal]);

  return (
    <div id="documentation-view-container" className="space-y-4 animate-fadeIn">
      {/* Unified Top Header & Search Controls Bar */}
      <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-3.5 shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main View Mode Selector */}
          <div className="bg-[#15253d] p-1 rounded-xl border border-[#334d6e] flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setViewTab('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewTab === 'matrix'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Por Equipos ({activeEquipmentsInDoc.length})</span>
            </button>
            <button
              onClick={() => setViewTab('repository')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewTab === 'repository'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Todos los Archivos ({documents.length})</span>
            </button>
            <button
              onClick={() => setViewTab('serials')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewTab === 'serials'
                  ? 'bg-purple-500 text-slate-950 shadow-md font-black'
                  : 'text-purple-300 hover:text-white bg-purple-950/40 border border-purple-500/30'
              }`}
            >
              <Tag className="w-3.5 h-3.5" />
              <span>🏷️ Equipos Serializados & Despachos ({totalSerializedUnits})</span>
            </button>
            <button
              id="tab-technical-sheets-quick"
              onClick={() => setViewTab('technical_sheet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewTab === 'technical_sheet'
                  ? 'bg-cyan-400 text-slate-950 shadow-md font-black'
                  : 'text-cyan-300 hover:text-white bg-cyan-950/40 border border-cyan-500/30'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>✨ Crear Ficha Técnica (PDF)</span>
            </button>
          </div>

          {/* Action Buttons: Ficha Técnica Rápida & Agregar Equipo */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-quick-create-ft"
              onClick={() => setViewTab('technical_sheet')}
              className={`inline-flex items-center gap-1.5 font-black text-xs px-3.5 py-2 rounded-xl shadow-lg transition cursor-pointer active:scale-95 ${
                viewTab === 'technical_sheet'
                  ? 'bg-cyan-400 text-slate-950 ring-2 ring-cyan-300 shadow-cyan-500/30'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950'
              }`}
              title="Crear Ficha Técnica rápida en PDF"
            >
              <Sparkles className="w-4 h-4" />
              <span>+ Ficha Técnica Rápida</span>
            </button>

            {!isReadOnly && viewTab !== 'serials' && viewTab !== 'technical_sheet' && (
              <button
                id="btn-add-equipment-from-v3"
                onClick={() => setIsAddEquipmentModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-lg transition cursor-pointer active:scale-95"
                title="Agregar equipos a la documentación"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Equipo</span>
              </button>
            )}
          </div>
        </div>

        {/* Integrated Filter and Search Controls (for Matrix & Repository) */}
        {viewTab !== 'serials' && viewTab !== 'technical_sheet' && (
          <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-[#334d6e]/70">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="search-docs-input"
                type="text"
                placeholder="Buscar por equipo, parte, ficha técnica, manual, INVIMA o nombre de archivo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:border-[#38bdf8] outline-none font-medium"
              />
            </div>

            {/* Filter by equipment status or document type */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={docTypeFilter}
                onChange={(e) => setDocTypeFilter(e.target.value)}
                className="bg-[#15253d] border border-[#334d6e] rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 focus:border-[#38bdf8] outline-none cursor-pointer"
              >
                <option value="Todos">Filtro: Todos los Documentos</option>
                <option value="con_docs">✅ Solo Equipos con Archivos Adjuntos</option>
                <option value="sin_docs">⚠️ Solo Equipos sin Archivos Aún</option>
                <option value="Ficha Técnica">📋 Fichas Técnicas</option>
                <option value="Registro INVIMA">🏛️ Registros INVIMA</option>
                <option value="Manual de Usuario">📖 Manuales de Usuario</option>
                <option value="Manual de Servicio">🔧 Manuales de Servicio</option>
                <option value="Guía Rápida">⚡ Guías Rápidas</option>
                <option value="Certificado Calidad">🏅 Certificados de Calidad</option>
                {availableDocTypes
                  .filter(
                    (t) =>
                      ![
                        'Ficha Técnica',
                        'Registro INVIMA',
                        'Manual de Usuario',
                        'Manual de Servicio',
                        'Guía Rápida',
                        'Certificado Calidad',
                      ].includes(t)
                  )
                  .map((t) => (
                    <option key={t} value={t}>
                      📁 {t}
                    </option>
                  ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-[#15253d] border border-[#334d6e] rounded-xl px-3 py-1.5 text-xs font-bold text-slate-200 focus:border-[#38bdf8] outline-none cursor-pointer"
              >
                {equipmentCategories.map((c) => (
                  <option key={c} value={c}>
                    Categoría: {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* VISTA 1: POR EQUIPOS CONECTADOS DE VENTANA 3                              */}
      {/* ========================================================================= */}
      {viewTab === 'matrix' && (
        <div className="space-y-4">
          {activeEquipmentsInDoc.length === 0 ? (
            <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-8 sm:p-10 text-center space-y-3 shadow-md flex flex-col items-center justify-center min-h-[220px]">
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-[#38bdf8]">
                <FolderArchive className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-sm font-bold text-white">No hay equipos agregados en Documentación todavía</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Utilice el botón superior <strong>"Agregar Equipo"</strong> para incorporar equipos del catálogo y adjuntarles Fichas Técnicas, INVIMA y Manuales.
                </p>
              </div>
            </div>
          ) : equipmentsWithDocs.length === 0 ? (
            <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-8 text-center text-slate-400 space-y-2 shadow-md flex flex-col items-center justify-center min-h-[180px]">
              <BookOpen className="w-8 h-8 text-slate-500" />
              <div>
                <p className="text-xs font-bold text-white mb-0.5">
                  No se encontraron equipos con los filtros seleccionados
                </p>
                <p className="text-[11px] text-slate-500">
                  Ajuste los filtros de búsqueda o agregue más equipos desde el botón superior.
                </p>
              </div>
            </div>
          ) : (
            equipmentsWithDocs.map(({ equipment: eq, docs, groups, totalDocs }, idx) => {
              return (
                <div
                  key={`doc-eq-${eq.id || eq.code || 'item'}-${idx}`}
                  id={`eq-card-${eq.id}`}
                  className="bg-[#1e314b] border border-[#334d6e] hover:border-[#38bdf8]/60 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4 transition"
                >
                  {/* Equipment Header Bar - Data directly connected to Ventana 3 */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#334d6e]">
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-md">
                        {eq.brand.substring(0, 3)}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[#38bdf8] bg-[#15253d] px-2 py-0.5 rounded-md border border-[#334d6e]">
                            {eq.code}
                          </span>
                          <span className="text-xs font-black text-white bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-md border border-blue-500/30">
                            {eq.brand}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Modelo: <strong className="text-white">{eq.model}</strong>
                          </span>
                          <span className="text-[10.5px] bg-[#15253d] text-cyan-300 font-bold px-2 py-0.5 rounded-full border border-[#334d6e]">
                            {eq.category}
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-white mt-1">
                          {eq.name}
                        </h3>

                        {eq.supplier && (
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Proveedor: <strong className="text-slate-300">{eq.supplier}</strong> • Reg. INVIMA Base: <strong className="text-emerald-400 font-mono">{eq.invimaRecordNumber || 'Sin registrar'}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Document Status Badge & Remove button */}
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-black px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                          totalDocs > 0
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                            : 'bg-[#15253d] text-slate-400 border-[#334d6e]'
                        }`}
                      >
                        <FolderArchive className="w-3.5 h-3.5" />
                        <span>
                          {totalDocs === 0
                            ? 'Sin documentos'
                            : `${totalDocs} archivo${totalDocs > 1 ? 's' : ''} adjunto${totalDocs > 1 ? 's' : ''}`}
                        </span>
                      </span>

                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEquipmentFromView(eq.id)}
                          className="text-[11px] text-slate-400 hover:text-rose-300 bg-[#15253d] hover:bg-rose-500/20 px-2.5 py-1.5 rounded-xl border border-[#334d6e] hover:border-rose-500/30 transition cursor-pointer flex items-center gap-1"
                          title="Quitar este equipo de la vista de Documentación (sigue existiendo en Ventana 3 Catálogo)"
                        >
                          <MinusCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Quitar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* DYNAMIC DOCUMENT SECTIONS OR CLEAN EMPTY STATE */}
                  {totalDocs === 0 ? (
                    // CLEAN EMPTY STATE
                    <div className="bg-[#15253d]/60 border border-dashed border-[#334d6e] rounded-xl p-5 text-center space-y-3">
                      <p className="text-xs text-slate-300 font-medium">
                        No se ha adjuntado ningún documento todavía para <strong className="text-white">{eq.name}</strong>.
                      </p>

                      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => onOpenNewDocumentModal(eq.id, 'Ficha Técnica')}
                          className="inline-flex items-center gap-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Ficha Técnica</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenNewDocumentModal(eq.id, 'Registro INVIMA')}
                          className="inline-flex items-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Registro INVIMA</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenNewDocumentModal(eq.id, 'Manual de Usuario')}
                          className="inline-flex items-center gap-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Manual de Usuario</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenNewDocumentModal(eq.id, 'Manual de Servicio')}
                          className="inline-flex items-center gap-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Manual de Servicio</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenNewDocumentModal(eq.id, 'Otro Anexo')}
                          className="inline-flex items-center gap-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Personalizado</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    // DYNAMIC CATEGORY BOXES
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {groups.map((group) => {
                          const Icon = group.meta.icon;
                          const categoryCount = group.docs.length;

                          return (
                            <div
                              key={group.type}
                              className="bg-[#15253d] border border-[#334d6e] hover:border-[#38bdf8]/50 rounded-xl p-3.5 flex flex-col justify-between space-y-3 transition shadow-sm"
                            >
                              {/* Category Header */}
                              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#334d6e]/60">
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-lg ${group.meta.badgeBg} shrink-0`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                                      <span>{group.type}</span>
                                      <span className="text-[10px] font-black bg-[#111c2e] text-[#38bdf8] px-1.5 py-0.2 rounded border border-[#334d6e]">
                                        {categoryCount} {categoryCount === 1 ? 'archivo' : 'archivos'}
                                      </span>
                                    </h4>
                                  </div>
                                </div>

                                {/* Button to add another document of this exact same category */}
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenNewDocumentModal(eq.id, group.type)}
                                    className="text-[11px] font-bold text-[#38bdf8] hover:text-white bg-[#192b45] hover:bg-[#22395a] px-2.5 py-1 rounded-lg border border-[#334d6e] transition cursor-pointer flex items-center gap-1 shrink-0"
                                    title={`Agregar otra ${group.type}`}
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Agregar otra</span>
                                  </button>
                                )}
                              </div>

                              {/* Files List inside this category */}
                              <div className="space-y-2">
                                {group.docs.map((doc, docIdx) => {
                                  const cat = getDocFileCategory(doc);
                                  const isInvima = doc.docType === 'Registro INVIMA';

                                  return (
                                    <div
                                      key={`grp-doc-${doc.id || doc.fileName || 'file'}-${docIdx}`}
                                      className="bg-[#111c2e] border border-[#334d6e]/70 hover:border-emerald-500/50 rounded-xl p-2.5 space-y-2 transition group/item"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="text-[9.5px] font-black uppercase px-1.5 py-0.2 rounded bg-[#15253d] text-[#38bdf8] border border-[#334d6e]">
                                              {cat.toUpperCase()}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                              {doc.fileSize}
                                            </span>
                                            <span className="text-[10px] text-emerald-400 font-semibold">
                                              • {doc.uploadDate}
                                            </span>
                                          </div>

                                          <h5 className="text-xs font-bold text-white group-hover/item:text-emerald-300 transition mt-1 truncate">
                                            {doc.title}
                                          </h5>

                                          <span className="text-[10.5px] text-slate-400 font-mono truncate block mt-0.5">
                                            {doc.fileName}
                                          </span>

                                          {isInvima && doc.invimaNumber && (
                                            <div className="mt-1 text-[10.5px] text-emerald-300 font-mono font-bold bg-[#15253d] px-2 py-0.5 rounded border border-emerald-500/30 inline-block">
                                              INVIMA: {doc.invimaNumber} {doc.validUntil ? `(Vence: ${doc.validUntil})` : ''}
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      {/* Actions for this specific file */}
                                      <div className="pt-1.5 border-t border-[#334d6e]/40 flex items-center justify-between gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setPreviewDoc(doc)}
                                          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-200 hover:text-white bg-[#192b45] hover:bg-[#27426a] px-2.5 py-1 rounded-lg border border-[#334d6e] transition cursor-pointer"
                                        >
                                          <Eye className="w-3 h-3 text-[#38bdf8]" />
                                          <span>Visualizar</span>
                                        </button>

                                        <div className="flex items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleDownloadDoc(doc)}
                                            className="inline-flex items-center gap-1 text-[11px] font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 px-2 py-1 rounded-lg transition cursor-pointer"
                                            title="Descargar archivo original"
                                          >
                                            <Download className="w-3 h-3" />
                                            <span>Descargar</span>
                                          </button>

                                          {!isReadOnly && (
                                            <button
                                              type="button"
                                              onClick={() => setDocToDelete(doc)}
                                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                                              title={`Eliminar ${doc.title}`}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Quick Add Another Document Section */}
                      {!isReadOnly && (
                        <div className="pt-2 border-t border-[#334d6e]/60 flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                            <FolderPlus className="w-3.5 h-3.5 text-[#38bdf8]" />
                            <span>Adjuntar otra sección a este equipo:</span>
                          </span>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => onOpenNewDocumentModal(eq.id, 'Ficha Técnica')}
                              className="text-[10.5px] font-bold bg-[#15253d] hover:bg-[#20375a] text-blue-300 border border-[#334d6e] px-2.5 py-1 rounded-lg transition cursor-pointer"
                            >
                              + Ficha Técnica
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenNewDocumentModal(eq.id, 'Registro INVIMA')}
                              className="text-[10.5px] font-bold bg-[#15253d] hover:bg-[#20375a] text-emerald-300 border border-[#334d6e] px-2.5 py-1 rounded-lg transition cursor-pointer"
                            >
                              + Registro INVIMA
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenNewDocumentModal(eq.id, 'Manual de Usuario')}
                              className="text-[10.5px] font-bold bg-[#15253d] hover:bg-[#20375a] text-amber-300 border border-[#334d6e] px-2.5 py-1 rounded-lg transition cursor-pointer"
                            >
                              + Manual Usuario
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenNewDocumentModal(eq.id, 'Manual de Servicio')}
                              className="text-[10.5px] font-bold bg-[#15253d] hover:bg-[#20375a] text-purple-300 border border-[#334d6e] px-2.5 py-1 rounded-lg transition cursor-pointer"
                            >
                              + Manual Servicio
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenNewDocumentModal(eq.id, 'Otro Anexo')}
                              className="text-[10.5px] font-bold bg-[#15253d] hover:bg-[#20375a] text-[#38bdf8] border border-[#334d6e] px-2.5 py-1 rounded-lg transition cursor-pointer"
                            >
                              + Personalizado
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 2: REPOSITORIO GENERAL DE ARCHIVOS (LISTADO COMPLETO)               */}
      {/* ========================================================================= */}
      {viewTab === 'repository' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFlatDocs.length === 0 ? (
            <div className="col-span-full bg-[#15253d] border border-[#334d6e] rounded-xl p-10 text-center text-slate-400">
              <p className="text-sm font-bold text-white mb-1">No se encontraron documentos</p>
              <p className="text-xs text-slate-500">
                Pruebe cambiando los filtros o adjunte un nuevo archivo desde los cuadros de los equipos.
              </p>
            </div>
          ) : (
            filteredFlatDocs.map((doc, docIdx) => {
              const isInvima = doc.docType === 'Registro INVIMA';
              const cat = getDocFileCategory(doc);

              return (
                <div
                  key={`flat-doc-${doc.id || doc.fileName || 'file'}-${docIdx}`}
                  className="bg-[#1e314b] border border-[#334d6e] hover:border-emerald-400/60 rounded-xl p-4 flex flex-col justify-between transition-all duration-200 shadow-md group"
                >
                  <div>
                    {/* Top line with DocType Badge & Status */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-md bg-[#15253d] text-emerald-300 border border-[#334d6e]">
                        {doc.docType}
                      </span>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-[#15253d] text-[#38bdf8] border border-[#334d6e]">
                          {cat.toUpperCase()}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            doc.status === 'Vigente'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {doc.status}
                        </span>
                      </div>
                    </div>

                    {/* Title & Associated Equipment */}
                    <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-emerald-300 transition line-clamp-2">
                      {doc.title}
                    </h3>

                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                      <span className="text-[#38bdf8] font-semibold">Equipo:</span>
                      <span className="text-slate-200 truncate">{doc.equipmentName}</span>
                    </div>

                    {/* INVIMA info if applicable */}
                    {isInvima && doc.invimaNumber && (
                      <div className="mt-2.5 bg-[#15253d] p-2 rounded-lg border border-[#334d6e] text-xs space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-400">N° Sanitario:</span>
                          <strong className="text-emerald-400 font-mono">{doc.invimaNumber}</strong>
                        </div>
                        {doc.validUntil && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-400">Vigencia hasta:</span>
                            <span className="text-slate-200 font-medium">{doc.validUntil}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* File Metadata */}
                    <div className="mt-3 pt-2 border-t border-[#334d6e]/50 flex items-center justify-between text-[11px] text-slate-400">
                      <span className="font-mono text-slate-300 truncate max-w-[170px]">{doc.fileName}</span>
                      <span>{doc.fileSize}</span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-4 pt-3 border-t border-[#334d6e] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-[#15253d] hover:bg-[#1f375b] px-2.5 py-1.5 rounded-lg border border-[#334d6e] transition cursor-pointer font-bold"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#38bdf8]" />
                      <span>Visualizar</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleDownloadDoc(doc)}
                        className="inline-flex items-center gap-1 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-3 py-1.5 rounded-lg shadow-xs transition cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Descargar</span>
                      </button>

                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => setDocToDelete(doc)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-[#15253d] transition cursor-pointer"
                          title="Eliminar documento"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VISTA 3: EQUIPOS SERIALIZADOS & EXPEDIENTES DE DESPACHO A CLIENTES        */}
      {/* ========================================================================= */}
      {viewTab === 'serials' && (
        <SerializedEquipmentsDossierTab
          contracts={contractsInternal}
          onUpdateContracts={handleUpdateContracts}
          documents={documents}
          equipments={equipments}
          currentUser={currentUser}
          onNavigateToOCTracking={onNavigateToOCTracking}
        />
      )}

      {/* ========================================================================= */}
      {/* VISTA 4: GENERADOR RÁPIDO DE FICHAS TÉCNICAS (PDF OFICIAL)                */}
      {/* ========================================================================= */}
      {viewTab === 'technical_sheet' && (
        <QuickTechnicalSheetGenerator
          equipments={equipments}
          onSaveToDocuments={onSaveDocument}
          onNavigateToRepository={() => setViewTab('repository')}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: AGREGAR EQUIPO DE LA VENTANA 3 (CATÁLOGO DE EQUIPOS)               */}
      {/* ========================================================================= */}
      {isAddEquipmentModalOpen && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsAddEquipmentModalOpen(false);
              setEquipmentSearchModal('');
            }
          }}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-fadeIn"
        >
          <div className="bg-[#192b45] border border-[#38bdf8]/60 rounded-2xl max-w-4xl w-full shadow-2xl animate-scaleUp max-h-[90vh] h-[86vh] flex flex-col overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-[#334d6e] flex items-center justify-between gap-3 bg-[#15253d] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-white truncate">
                    Agregar Equipos del Catálogo
                  </h3>
                  <p className="text-[11px] text-slate-300 truncate">
                    Seleccione equipos para adjuntarles fichas técnicas, INVIMA o manuales
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddEquipmentModalOpen(false);
                    setEquipmentSearchModal('');
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#334d6e] rounded-lg transition cursor-pointer flex items-center gap-1"
                  title="Cerrar ventana"
                >
                  <X className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">Cerrar</span>
                </button>
              </div>
            </div>

            {/* Direct Search Input and Quick Actions */}
            <div className="px-3.5 py-2.5 bg-[#111c2e] border-b border-[#334d6e] flex flex-col sm:flex-row gap-2 items-center shrink-0">
              <div className="relative flex-1 w-full">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, parte, marca, modelo o categoría..."
                  value={equipmentSearchModal}
                  onChange={(e) => setEquipmentSearchModal(e.target.value)}
                  className="w-full bg-[#15253d] border border-[#334d6e] focus:border-[#38bdf8] rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-400 outline-none font-medium"
                  autoFocus
                />
                {equipmentSearchModal && (
                  <button
                    onClick={() => setEquipmentSearchModal('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handleAddAllEquipmentsToView}
                className="w-full sm:w-auto bg-[#15253d] hover:bg-[#20375a] text-[#38bdf8] border border-[#334d6e] hover:border-[#38bdf8]/60 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap shadow-sm"
              >
                + Agregar Todos ({equipments.length})
              </button>
            </div>

            {/* Equipments list directly connected to Ventana 3 */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin bg-[#15253d]">
              {filteredModalEquipments.length === 0 ? (
                <div className="p-6 text-center text-slate-400 bg-[#111c2e] rounded-xl border border-dashed border-[#334d6e] space-y-1">
                  <p className="text-xs font-bold text-white">No se encontraron equipos coincidentes en el catálogo</p>
                  <p className="text-[11px] text-slate-400">
                    Verifique el texto de búsqueda o consulte los equipos registrados en el Catálogo.
                  </p>
                </div>
              ) : (
                filteredModalEquipments.map((eq, eqIdx) => {
                  const countDocs = documents.filter((d) => d.equipmentId === eq.id || d.equipmentCode === eq.code).length;
                  const isAlreadyInView = selectedEquipmentIds.includes(eq.id);

                  return (
                    <div
                      key={`modal-eq-${eq.id || eq.code || 'item'}-${eqIdx}`}
                      className={`border rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-3 transition shadow-sm ${
                        isAlreadyInView
                          ? 'bg-[#192b45] border-emerald-500/50'
                          : 'bg-[#111c2e] border-[#334d6e] hover:border-[#38bdf8]'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10.5px] font-bold text-[#38bdf8] bg-[#15253d] px-1.5 py-0.5 rounded border border-[#334d6e]">
                            {eq.code}
                          </span>
                          <span className="text-[10.5px] font-bold text-blue-300 bg-blue-500/20 border border-blue-500/30 px-1.5 py-0.5 rounded">
                            {eq.brand}
                          </span>
                          <span className="text-[10.5px] text-cyan-300 font-medium bg-[#15253d] px-1.5 py-0.5 rounded border border-[#334d6e]">
                            {eq.category}
                          </span>
                          {isAlreadyInView && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                              ✓ En Lista
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                          {eq.name}
                        </h4>
                        <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span>Mod: <strong className="text-slate-200">{eq.model}</strong></span>
                          <span>• INVIMA: <strong className="text-emerald-400 font-mono">{eq.invimaRecordNumber || 'Sin registro'}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-[10.5px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 ${
                            countDocs > 0
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-[#15253d] text-slate-400 border-[#334d6e]'
                          }`}
                        >
                          <FolderArchive className="w-3 h-3" />
                          <span>{countDocs}</span>
                        </span>

                        {isAlreadyInView ? (
                          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Agregado</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddEquipmentToView(eq.id, false)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-md active:scale-95 whitespace-nowrap"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agregar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 bg-[#111c2e] border-t border-[#334d6e] flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span className="text-[11px]">
                Equipos en Catálogo: <strong className="text-white">{equipments.length}</strong> • En Documentación: <strong className="text-emerald-400">{selectedEquipmentIds.length}</strong>
              </span>
              <span className="text-[11px] text-slate-400">
                Presione <kbd className="px-1.5 py-0.5 rounded bg-[#15253d] border border-[#334d6e] text-slate-300 font-mono text-[10px]">ESC</kbd> o use el botón superior para cerrar
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL: REAL DOCUMENT VISUALIZER (PDF, IMAGES, WORD DOCUMENTS)             */}
      {/* ========================================================================= */}
      {previewDoc && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewDoc(null);
          }}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn"
        >
          <div className="bg-[#192b45] border border-[#38bdf8]/60 rounded-2xl max-w-5xl w-full p-4 sm:p-5 space-y-3.5 shadow-2xl animate-scaleUp max-h-[92vh] h-[88vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-2.5 border-b border-[#334d6e] shrink-0 gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                  {getDocFileCategory(previewDoc) === 'pdf' ? (
                    <FileType className="w-5 h-5 text-rose-400" />
                  ) : getDocFileCategory(previewDoc) === 'image' ? (
                    <ImageIcon className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <FileText className="w-5 h-5 text-blue-400" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider bg-[#15253d] px-2 py-0.5 rounded border border-[#334d6e]">
                      {previewDoc.docType}
                    </span>
                    <span className="text-[10px] font-mono text-slate-300 font-bold bg-[#111c2e] px-2 py-0.5 rounded border border-[#334d6e]">
                      {previewDoc.fileName} ({previewDoc.fileSize})
                    </span>
                    <span className="text-[10.5px] text-[#38bdf8] font-bold truncate">
                      • {previewDoc.equipmentName}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white mt-0.5 truncate">
                    {previewDoc.title}
                  </h3>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenInNewTab(previewDoc)}
                  className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-[#38bdf8] hover:text-white bg-[#15253d] hover:bg-[#22395a] px-2.5 py-1.5 rounded-lg border border-[#334d6e] transition cursor-pointer"
                  title="Abrir archivo en nueva pestaña"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Pantalla Completa</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadDoc(previewDoc)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-2.5 py-1.5 rounded-lg shadow-md transition cursor-pointer flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#334d6e] rounded-lg transition cursor-pointer flex items-center gap-1"
                  title="Cerrar visor"
                >
                  <X className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">Cerrar</span>
                </button>
              </div>
            </div>

            {/* VISUALIZER BODY: RENDERS THE ATTACHED FILE */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 scrollbar-thin">
              {/* PDF VIEWER */}
              {getDocFileCategory(previewDoc) === 'pdf' && (
                <div className="bg-[#111c2e] rounded-xl border border-[#334d6e] p-2 space-y-2">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#15253d] rounded-lg border border-[#334d6e] text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <FileType className="w-4 h-4 text-rose-400" />
                      <span>Visor Integrado de PDF ({previewDoc.fileName})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenInNewTab(previewDoc)}
                        className="text-[#38bdf8] hover:text-white flex items-center gap-1 font-bold text-xs cursor-pointer bg-[#1e314b] px-2.5 py-1 rounded border border-[#334d6e]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Abrir en Pantalla Completa</span>
                      </button>
                    </div>
                  </div>

                  {/* High compatibility embed for PDF */}
                  <div className="w-full h-[520px] sm:h-[600px] rounded-lg overflow-hidden border border-[#334d6e] bg-slate-900 flex flex-col">
                    {previewBlobUrl ? (
                      <object
                        data={previewBlobUrl}
                        type="application/pdf"
                        className="w-full h-full"
                      >
                        <iframe
                          src={previewBlobUrl}
                          title={previewDoc.fileName}
                          className="w-full h-full"
                        >
                          <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-[#15253d] text-slate-300 space-y-3">
                            <FileType className="w-12 h-12 text-rose-400" />
                            <p className="text-sm font-bold text-white">
                              Vista previa del archivo PDF: {previewDoc.fileName}
                            </p>
                            <p className="text-xs text-slate-400 max-w-md">
                              El navegador no soporta visualización interna de PDF en este marco. Puede abrirlo en pantalla completa o descargarlo directamente.
                            </p>
                            <div className="flex items-center gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => handleOpenInNewTab(previewDoc)}
                                className="bg-[#38bdf8] text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
                              >
                                <ExternalLink className="w-4 h-4" />
                                <span>Abrir en Nueva Pestaña</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadDoc(previewDoc)}
                                className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
                              >
                                <Download className="w-4 h-4" />
                                <span>Descargar PDF</span>
                              </button>
                            </div>
                          </div>
                        </iframe>
                      </object>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
                        <FileType className="w-10 h-10 text-rose-400 mb-2" />
                        <p className="font-bold text-white text-sm">Cargando visor de documento...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* IMAGE VIEWER (JPG / PNG) */}
              {getDocFileCategory(previewDoc) === 'image' && (
                <div className="bg-[#111c2e] rounded-xl border border-[#334d6e] p-3 space-y-2">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#15253d] rounded-lg border border-[#334d6e] text-xs flex-wrap gap-2">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-emerald-400" />
                      <span>Visor de Imagen ({previewDoc.fileName})</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setImageRotation((prev) => (prev + 90) % 360)}
                        className="p-1.5 bg-[#192b45] hover:bg-[#253f68] text-slate-300 rounded-lg border border-[#334d6e] cursor-pointer"
                        title="Rotar imagen"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageZoom((prev) => Math.max(0.5, prev - 0.25))}
                        className="p-1.5 bg-[#192b45] hover:bg-[#253f68] text-slate-300 rounded-lg border border-[#334d6e] cursor-pointer"
                        title="Reducir zoom"
                      >
                        <ZoomOut className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[11px] font-mono font-bold text-slate-300">
                        {Math.round(imageZoom * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setImageZoom((prev) => Math.min(3, prev + 0.25))}
                        className="p-1.5 bg-[#192b45] hover:bg-[#253f68] text-slate-300 rounded-lg border border-[#334d6e] cursor-pointer"
                        title="Aumentar zoom"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImageZoom(1);
                          setImageRotation(0);
                        }}
                        className="px-2 py-1 text-[10px] font-bold bg-[#192b45] text-slate-400 hover:text-white rounded-lg border border-[#334d6e] cursor-pointer"
                      >
                        Restablecer
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[520px] overflow-auto flex items-center justify-center p-4 bg-slate-950/80 rounded-lg border border-[#334d6e]">
                    <img
                      src={previewBlobUrl || previewDoc.fileData}
                      alt={previewDoc.title}
                      style={{
                        transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
                        transformOrigin: 'center center',
                      }}
                      className="max-h-[480px] max-w-full rounded-lg object-contain transition-transform duration-200 shadow-2xl"
                    />
                  </div>
                </div>
              )}

              {/* WORD DOCUMENT VIEWER (DOC / DOCX) */}
              {getDocFileCategory(previewDoc) === 'word' && (
                <div className="bg-[#111c2e] rounded-xl border border-blue-500/40 p-6 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="p-4 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/40 shrink-0">
                      <FileText className="w-12 h-12" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10.5px] font-black uppercase text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
                        DOCUMENTO MICROSOFT WORD (.DOC / .DOCX)
                      </span>
                      <h4 className="text-lg font-bold text-white">{previewDoc.fileName}</h4>
                      <p className="text-xs text-slate-300">
                        Tamaño del archivo: <strong className="text-white">{previewDoc.fileSize}</strong> • Archivo nativo Word listo para descarga y edición.
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#15253d] p-4 rounded-xl border border-[#334d6e] text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Equipo biomédico:</span>
                      <strong className="text-white">{previewDoc.equipmentName}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Apartado / Tipo:</span>
                      <strong className="text-[#38bdf8]">{previewDoc.docType}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Fecha de registro:</span>
                      <strong className="text-emerald-400">{previewDoc.uploadDate}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => handleDownloadDoc(previewDoc)}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-6 py-3 rounded-xl shadow-lg transition cursor-pointer active:scale-95"
                    >
                      <Download className="w-4 h-4" />
                      <span>Descargar y Abrir en Microsoft Word</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Equipment and Verification Metadata Card */}
              <div className="bg-[#15253d] p-4 rounded-xl border border-[#334d6e] space-y-3">
                <div className="flex items-center justify-between border-b border-[#334d6e]/50 pb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#38bdf8]" />
                    <span className="font-bold text-white text-xs">SYD COLOMBIA S.A.</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    DOCUMENTO ADJUNTO REGISTRADO
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Equipo Biomédico Vinculado:</span>
                    <strong className="text-white text-xs block mt-0.5">{previewDoc.equipmentName}</strong>
                    {previewDoc.equipmentCode && (
                      <span className="text-[#38bdf8] font-mono text-[11px]">{previewDoc.equipmentCode}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Archivo Custodiado:</span>
                    <p className="text-[#38bdf8] font-mono mt-0.5 truncate">{previewDoc.fileName}</p>
                    <span className="text-slate-400 text-[10.5px]">Tamaño: {previewDoc.fileSize}</span>
                  </div>
                </div>

                {previewDoc.invimaNumber && (
                  <div className="bg-[#111c2e] p-3 rounded-lg border border-emerald-500/30 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Registro Sanitario INVIMA:</span>
                      <strong className="text-emerald-400 font-mono text-xs">{previewDoc.invimaNumber}</strong>
                    </div>
                    {previewDoc.validUntil && (
                      <div>
                        <span className="text-slate-400 text-[11px] block">Fecha de Vencimiento:</span>
                        <span className="text-slate-200 font-bold text-xs">{previewDoc.validUntil}</span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <span className="text-slate-400 block text-[11px] mb-1">Observaciones / Notas:</span>
                  <p className="bg-[#111c2e] p-2.5 rounded-lg border border-[#334d6e] text-slate-200 text-xs leading-relaxed">
                    {previewDoc.notes || 'Documento archivado conforme a los estándares de SYD Colombia S.A.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#334d6e] shrink-0">
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setDocToDelete(previewDoc)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-rose-400 hover:text-rose-200 bg-rose-500/15 hover:bg-rose-500/25 px-3 py-2 rounded-xl transition cursor-pointer border border-rose-500/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Archivo</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[11px] text-slate-500 hidden sm:inline mr-2">Presione <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">ESC</kbd> para cerrar</span>
                <button
                  type="button"
                  onClick={() => handleDownloadDoc(previewDoc)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Archivo Real</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMATION TO DELETE DOCUMENT                                    */}
      {/* ========================================================================= */}
      {docToDelete && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setDocToDelete(null);
          }}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-fadeIn"
        >
          <div className="bg-[#192b45] border border-rose-500/50 rounded-2xl max-w-md w-full p-4 sm:p-5 space-y-3.5 shadow-2xl animate-scaleUp my-auto">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-black text-white">¿Eliminar este archivo adjunto?</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Está a punto de eliminar <strong className="text-white font-bold">{docToDelete.title}</strong> ({docToDelete.docType}).
                </p>
                <p className="text-[11px] text-slate-400 pt-0.5">
                  Equipo asociado: <strong className="text-slate-200">{docToDelete.equipmentName}</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#334d6e]">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-lg active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Eliminar Archivo</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
