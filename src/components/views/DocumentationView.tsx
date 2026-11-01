import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Eye,
  Download,
  Trash2,
  AlertTriangle,
  Building2,
  Database,
  Sparkles,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileType,
  Image as ImageIcon,
  FileText,
  X,
  Calendar,
  ClipboardList,
  HardDrive,
  RefreshCw,
  Maximize2,
  Minimize2,
  LayoutGrid,
} from 'lucide-react';
import { WarrantyAlertsWidget } from '../modals/WarrantyAlertsWidget';
import {
  TechnicalDocument,
  MedicalEquipment,
  AuthUser,
  OCTrackingContract,
  TenderClientProject,
  SalesOrderRecord,
} from '../../types';
import {
  getStoredOCTrackingContracts,
  saveStoredOCTrackingContracts,
} from '../../utils/ocTrackingStorage';
import { QuickTechnicalSheetGenerator } from './documentation/QuickTechnicalSheetGenerator';
import { ContractsDocumentationTab } from './documentation/ContractsDocumentationTab';
import { MasterCatalogDocumentationTab } from './documentation/MasterCatalogDocumentationTab';
import { EquipmentLifeSheetGenerator } from './documentation/EquipmentLifeSheetGenerator';
import { MaintenanceScheduleManager } from './documentation/MaintenanceScheduleManager';
import { analyzeCloudUrl, isHttpUrl, extractGoogleDriveId } from '../../utils/cloudLinkUtils';
import { googleWorkspaceService } from '../../services/googleWorkspaceService';
import { PdfCanvasViewer } from '../gmail/PdfCanvasViewer';

export type DocumentationViewTab =
  | 'contracts'
  | 'catalog_master'
  | 'technical_sheet'
  | 'life_sheet'
  | 'maintenance_schedule';

interface DocumentationViewProps {
  documents: TechnicalDocument[];
  equipments: MedicalEquipment[];
  tenderClients?: TenderClientProject[];
  ocContracts?: OCTrackingContract[];
  salesOrders?: SalesOrderRecord[];
  onUpdateContracts?: (contracts: OCTrackingContract[]) => void;
  onOpenNewDocumentModal: (
    equipmentId?: string,
    docType?: string,
    equipmentData?: any,
    contractContext?: any
  ) => void;
  onSaveDocument?: (newDoc: TechnicalDocument) => void;
  onDeleteDocument: (id: string) => void;
  currentUser?: AuthUser | null;
  onNavigateToOCTracking?: () => void;
  onNavigateToInvoicing?: () => void;
}

// Convert base64 dataURI to Blob
// Convert base64 dataURI to Blob
function dataURItoBlob(dataURI: string, targetMime?: string): Blob | null {
  try {
    if (!dataURI.includes(',')) return null;
    const parts = dataURI.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    let mime = mimeMatch ? mimeMatch[1] : (targetMime || 'application/pdf');
    if ((mime === 'application/octet-stream' || !mime) && targetMime) {
      mime = targetMime;
    }
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

export const DocumentationView: React.FC<DocumentationViewProps> = ({
  documents,
  equipments,
  tenderClients = [],
  ocContracts,
  salesOrders = [],
  onUpdateContracts,
  onOpenNewDocumentModal,
  onSaveDocument,
  onDeleteDocument,
  currentUser,
  onNavigateToOCTracking,
  onNavigateToInvoicing,
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canEditDocuments;

  // Primary view tabs:
  // 1. 'contracts': Contratos & OCs Directas (unificado con seriales y despachos adentro)
  // 2. 'catalog_master': Base Maestra / Catálogo General (almacén central con cuadro automático por cada equipo)
  // 3. 'technical_sheet': Ficha Técnica Rápida Oficial (PDF)
  // 4. 'life_sheet': Hoja de Vida de Equipos Biomédicos (Resolución 3100)
  // 5. 'maintenance_schedule': Cronograma Anual de Mantenimiento Preventivo & Metrología
  const [viewTab, setViewTab] = useState<DocumentationViewTab>('contracts');

  // Internal contracts sync with fallback to localStorage
  const [contractsInternal, setContractsInternal] = useState<OCTrackingContract[]>(() => {
    return ocContracts && ocContracts.length > 0 ? ocContracts : getStoredOCTrackingContracts();
  });

  useEffect(() => {
    if (ocContracts && ocContracts.length > 0) {
      setContractsInternal(ocContracts);
    }
  }, [ocContracts]);

  useEffect(() => {
    const handleStorageUpdate = () => {
      setContractsInternal(getStoredOCTrackingContracts());
    };
    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('syd-oc-tracking-updated', handleStorageUpdate);
    window.addEventListener('syd-sales-orders-updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('syd-oc-tracking-updated', handleStorageUpdate);
      window.removeEventListener('syd-sales-orders-updated', handleStorageUpdate);
    };
  }, []);

  const handleUpdateContracts = (newContracts: OCTrackingContract[]) => {
    setContractsInternal(newContracts);
    saveStoredOCTrackingContracts(newContracts);
    if (onUpdateContracts) {
      onUpdateContracts(newContracts);
    }
  };

  // Search filter query
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & previews
  const [previewDoc, setPreviewDoc] = useState<TechnicalDocument | null>(null);
  const [docToDelete, setDocToDelete] = useState<TechnicalDocument | null>(null);
  const [imageZoom, setImageZoom] = useState<number>(1);
  const [imageRotation, setImageRotation] = useState<number>(0);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [isLoadingDrivePreview, setIsLoadingDrivePreview] = useState<boolean>(false);
  const [drivePreviewError, setDrivePreviewError] = useState<string | null>(null);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState<boolean>(false);
  const [previewSourceMode, setPreviewSourceMode] = useState<'canvas' | 'drive_iframe'>('canvas');
  const [isWarrantyAlertsModalOpen, setIsWarrantyAlertsModalOpen] = useState(false);

  // Generate object URL and binary Blob whenever previewDoc changes
  useEffect(() => {
    let active = true;
    let createdUrlToRevoke: string | null = null;
    setDrivePreviewError(null);

    const resolvePreview = async () => {
      if (!previewDoc) {
        setPreviewBlob(null);
        setPreviewBlobUrl(null);
        setIsLoadingDrivePreview(false);
        return;
      }

      // Case 1: Local base64 data URI
      if (previewDoc.fileData && previewDoc.fileData.startsWith('data:')) {
        const isPdf =
          previewDoc.fileName?.toLowerCase().endsWith('.pdf') ||
          getDocFileCategory(previewDoc) === 'pdf';
        const blob = dataURItoBlob(
          previewDoc.fileData,
          isPdf ? 'application/pdf' : undefined
        );
        if (blob) {
          const url = URL.createObjectURL(blob);
          createdUrlToRevoke = url;
          if (active) {
            setPreviewBlob(blob);
            setPreviewBlobUrl(url);
            setIsLoadingDrivePreview(false);
          }
          return;
        }
      }

      // Case 2: Blob URL already
      if (previewDoc.fileData && previewDoc.fileData.startsWith('blob:')) {
        if (active) {
          setPreviewBlobUrl(previewDoc.fileData);
          fetch(previewDoc.fileData)
            .then((r) => r.blob())
            .then((b) => {
              if (active) setPreviewBlob(b);
            })
            .catch(() => {});
          setIsLoadingDrivePreview(false);
        }
        return;
      }

      // Case 3: Google Drive file
      const rawUrl = previewDoc.fileUrl || previewDoc.fileData || '';
      const driveId = previewDoc.driveFileId || extractGoogleDriveId(rawUrl);

      if (driveId) {
        setIsLoadingDrivePreview(true);

        // Real-time check: Verify if the file is still present and not deleted in Google Drive
        if (googleWorkspaceService.isConnected()) {
          try {
            const exists = await googleWorkspaceService.checkFileOrFolderExists(driveId);
            if (!exists) {
              if (active) {
                setDrivePreviewError(`⚠️ El archivo "${previewDoc.title || previewDoc.fileName}" fue eliminado en Google Drive y ha sido desvinculado.`);
                setIsLoadingDrivePreview(false);
                onDeleteDocument(previewDoc.id);
              }
              return;
            }
          } catch (_) {}
        }

        // Check local disk cache on server first (/api/documents/cached/:driveId)
        try {
          const cachedRes = await fetch(`/api/documents/cached/${driveId}`);
          if (cachedRes.ok) {
            const rawB = await cachedRes.blob();
            const blob = new Blob([rawB], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            createdUrlToRevoke = url;
            if (active) {
              setPreviewBlob(blob);
              setPreviewBlobUrl(url);
              setIsLoadingDrivePreview(false);
            }
            return;
          }
        } catch (_) {}

        // Backend proxy (/api/drive/proxy-file/:driveId)
        try {
          const token = googleWorkspaceService.getAccessToken() || '';
          const proxyRes = await fetch(`/api/drive/proxy-file/${driveId}${token ? `?token=${token}` : ''}`);
          if (proxyRes.ok) {
            const rawB = await proxyRes.blob();
            const blob = new Blob([rawB], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            createdUrlToRevoke = url;
            if (active) {
              setPreviewBlob(blob);
              setPreviewBlobUrl(url);
              setIsLoadingDrivePreview(false);
            }
            return;
          }
        } catch (_) {}

        // Attempt: fetch binary blob using active Google Workspace OAuth session
        try {
          const rawB = await googleWorkspaceService.fetchDriveFileBlob(driveId);
          if (rawB && rawB.size > 0) {
            const blob = new Blob([rawB], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            createdUrlToRevoke = url;

            // Cache on server for next time
            try {
              const reader = new FileReader();
              reader.onload = () => {
                if (reader.result) {
                  fetch('/api/documents/cache', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: driveId, base64: reader.result as string }),
                  }).catch(() => {});
                }
              };
              reader.readAsDataURL(blob);
            } catch (_) {}

            if (active) {
              setPreviewBlob(blob);
              setPreviewBlobUrl(url);
              setIsLoadingDrivePreview(false);
            }
            return;
          }
        } catch (fetchErr: any) {
          console.warn('Could not fetch Drive file directly as blob:', fetchErr);
        }

        if (active) {
          setPreviewBlob(null);
          setPreviewBlobUrl(null);
          setIsLoadingDrivePreview(false);
        }
        return;
      }

      // Case 4: Other HTTP URL
      if (isHttpUrl(rawUrl)) {
        if (active) {
          setPreviewBlobUrl(rawUrl);
          setIsLoadingDrivePreview(false);
        }
        return;
      }

      if (active) {
        setPreviewBlobUrl(previewDoc.fileData || null);
        setIsLoadingDrivePreview(false);
      }
    };

    resolvePreview();
    setImageZoom(1);
    setImageRotation(0);

    return () => {
      active = false;
      if (createdUrlToRevoke) {
        URL.revokeObjectURL(createdUrlToRevoke);
      }
    };
  }, [previewDoc]);

  // Handle ESC key press to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (docToDelete) {
          setDocToDelete(null);
        } else if (previewDoc) {
          setPreviewDoc(null);
        }
      }
    };

    if (previewDoc || docToDelete) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [previewDoc, docToDelete]);

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
  const handleDownloadDoc = async (doc: TechnicalDocument) => {
    const rawUrl = doc.fileUrl || doc.fileData;
    const driveId = doc.driveFileId || (rawUrl ? extractGoogleDriveId(rawUrl) : null);

    // Try downloading blob if Drive file
    if (driveId && googleWorkspaceService.getAccessToken()) {
      try {
        const blob = await googleWorkspaceService.fetchDriveFileBlob(driveId);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.fileName || `${doc.title}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      } catch (err) {
        console.warn('Fallback to standard URL download:', err);
      }
    }

    if (rawUrl && isHttpUrl(rawUrl)) {
      const info = analyzeCloudUrl(rawUrl);
      window.open(info.downloadUrl || info.previewUrl, '_blank');
      return;
    }

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
    const rawUrl = doc.fileUrl || doc.fileData;
    const driveId = doc.driveFileId || (rawUrl ? extractGoogleDriveId(rawUrl) : null);

    if (driveId) {
      window.open(`https://drive.google.com/file/d/${driveId}/view`, '_blank');
      return;
    }

    if (rawUrl && isHttpUrl(rawUrl)) {
      window.open(rawUrl, '_blank');
      return;
    }
    if (previewBlobUrl) {
      window.open(previewBlobUrl, '_blank');
      const blob = dataURItoBlob(doc.fileData);
      if (blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        window.open(doc.fileData, '_blank');
      }
    }
  };

  // Connect and load Google Drive document directly into blob viewer
  const handleConnectAndLoadDriveFile = async () => {
    if (!previewDoc) return;
    const rawUrl = previewDoc.fileUrl || previewDoc.fileData || '';
    const driveId = previewDoc.driveFileId || extractGoogleDriveId(rawUrl);
    if (!driveId) return;

    try {
      setIsLoadingDrivePreview(true);
      await googleWorkspaceService.connectGoogleWorkspace();
      const blob = await googleWorkspaceService.fetchDriveFileBlob(driveId);
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      setPreviewBlobUrl(url);

      // Cache on server for instant zero-auth preview on next visit
      try {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) {
            fetch('/api/documents/cache', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: driveId, base64: reader.result as string }),
            }).catch(() => {});
          }
        };
        reader.readAsDataURL(pdfBlob);
      } catch (_) {}
    } catch (err: any) {
      console.warn('Error connecting and loading Drive file:', err);
    } finally {
      setIsLoadingDrivePreview(false);
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

  const deduplicatedContractsCount = React.useMemo(() => {
    const listIds = new Set<string>();
    const procNumbers = new Set<string>();
    let count = 0;

    (tenderClients || []).forEach((t) => {
      if (!t) return;
      count++;
      listIds.add(t.id);
      const proc = (t.header?.processNumber || '').trim().toLowerCase();
      if (proc) procNumbers.add(proc);
    });

    (contractsInternal || []).forEach((c) => {
      if (!c) return;
      if (listIds.has(c.id) || (c.tenderClientId && listIds.has(c.tenderClientId))) return;
      const cProc = (c.contractNumber || c.ocNumber || '').trim().toLowerCase();
      if (cProc && procNumbers.has(cProc)) return;
      count++;
    });

    return count;
  }, [tenderClients, contractsInternal]);

  const totalContractsCount = deduplicatedContractsCount;

  return (
    <div id="documentation-view-container" className="space-y-3 animate-fadeIn">
      {/* Unified Top Header & Search Controls Bar - Compact & High-Density */}
      <div className="bg-[#192b45]/95 backdrop-blur-md border border-[#334d6e] rounded-xl p-2.5 shadow-xl space-y-2.5 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Main 5 Unified Tabs: 1. Contratos | 2. Base Maestra | 3. Ficha Técnica | 4. Hojas de Vida | 5. Cronograma */}
          <div className="bg-[#15253d] p-1 rounded-xl border border-[#334d6e] flex items-center gap-1 flex-wrap">
            <button
              id="tab-contracts-unified"
              onClick={() => setViewTab('contracts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewTab === 'contracts'
                  ? 'bg-cyan-400 text-slate-950 shadow-md font-black'
                  : 'text-cyan-300 hover:text-white bg-cyan-950/40 border border-cyan-500/30'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>🏛️ Contratos & OCs Directas ({totalContractsCount})</span>
            </button>

            <button
              id="tab-catalog-master"
              onClick={() => setViewTab('catalog_master')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewTab === 'catalog_master'
                  ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                  : 'text-emerald-300 hover:text-white bg-emerald-950/40 border border-emerald-500/30'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>📚 Base Maestra / Catálogo General ({equipments.length})</span>
            </button>

            <button
              id="tab-technical-sheets-quick"
              onClick={() => setViewTab('technical_sheet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewTab === 'technical_sheet'
                  ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                  : 'text-amber-300 hover:text-white bg-amber-950/40 border border-amber-500/30'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>✨ Crear Ficha Técnica (PDF)</span>
            </button>

            <button
              id="tab-equipment-life-sheets"
              onClick={() => setViewTab('life_sheet')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewTab === 'life_sheet'
                  ? 'bg-purple-500 text-slate-950 shadow-md font-black'
                  : 'text-purple-300 hover:text-white bg-purple-950/40 border border-purple-500/30'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5 text-purple-400" />
              <span>📋 Crear Hojas de Vida</span>
            </button>

            <button
              id="tab-maintenance-schedule"
              onClick={() => setViewTab('maintenance_schedule')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                viewTab === 'maintenance_schedule'
                  ? 'bg-indigo-400 text-slate-950 shadow-md font-black'
                  : 'text-indigo-300 hover:text-white bg-indigo-950/40 border border-indigo-500/30'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>📅 Cronograma de Mantenimiento</span>
            </button>
          </div>

          {/* Quick Context Summary Tag */}
          <div className="text-[11px] text-slate-400 hidden md:flex items-center gap-2">
            <span className="text-emerald-400 font-bold">● {equipments.length} equipos en catálogo</span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-400 font-bold">● {documents.length} documentos adjuntos</span>
          </div>
        </div>

        {/* Search Bar (Ultra compact - hidden when inside specialized generators) */}
        {viewTab !== 'technical_sheet' && viewTab !== 'life_sheet' && viewTab !== 'maintenance_schedule' && (
          <div className="pt-1.5 border-t border-[#334d6e]/60">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                id="search-docs-input"
                type="text"
                placeholder={
                  viewTab === 'contracts'
                    ? 'Buscar en Contratos y OCs: cliente, proceso, número de OC, equipo, marca o serial...'
                    : 'Buscar en Catálogo General: nombre del equipo, código, registro INVIMA, ficha técnica o manual...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#15253d] border border-[#334d6e] rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none font-medium"
              />
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. UNIFIED VIEW: CONTRATOS & OCS DIRECTAS (With Serials & Dossiers inside)  */}
      {/* ========================================================================= */}
      {viewTab === 'contracts' && (
        <ContractsDocumentationTab
          mode="all"
          tenderClients={tenderClients}
          ocContracts={contractsInternal}
          equipments={equipments}
          documents={documents}
          isReadOnly={isReadOnly}
          onOpenNewDocumentModal={onOpenNewDocumentModal}
          onPreviewDoc={(doc) => setPreviewDoc(doc)}
          onDownloadDoc={handleDownloadDoc}
          onDeleteDocument={onDeleteDocument}
          onSaveDocument={onSaveDocument}
          onUpdateContracts={handleUpdateContracts}
          searchQuery={searchQuery}
          onNavigateToOCTracking={onNavigateToOCTracking}
        />
      )}

      {/* ========================================================================= */}
      {/* 2. UNIFIED VIEW: BASE MAESTRA / CATÁLOGO GENERAL                           */}
      {/* (Automated card generated for every single equipment in catalog)          */}
      {/* ========================================================================= */}
      {viewTab === 'catalog_master' && (
        <MasterCatalogDocumentationTab
          equipments={equipments}
          documents={documents}
          isReadOnly={isReadOnly}
          onOpenNewDocumentModal={onOpenNewDocumentModal}
          onPreviewDoc={(doc) => setPreviewDoc(doc)}
          onDownloadDoc={handleDownloadDoc}
          onDeleteDocument={onDeleteDocument}
          onOpenQuickTechSheet={() => setViewTab('technical_sheet')}
          onOpenLifeSheet={() => setViewTab('life_sheet')}
          searchQuery={searchQuery}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. GENERADOR OFICIAL DE FICHAS TÉCNICAS EN PDF                            */}
      {/* ========================================================================= */}
      {viewTab === 'technical_sheet' && (
        <QuickTechnicalSheetGenerator
          equipments={equipments}
          onSaveToDocuments={onSaveDocument}
          onNavigateToRepository={() => setViewTab('catalog_master')}
        />
      )}

      {/* ========================================================================= */}
      {/* 4. GENERADOR OFICIAL DE HOJAS DE VIDA DE EQUIPOS (Resolución 3100)        */}
      {/* ========================================================================= */}
      {viewTab === 'life_sheet' && (
        <EquipmentLifeSheetGenerator
          equipments={equipments}
          onSaveToDocuments={onSaveDocument}
          onNavigateToRepository={() => setViewTab('catalog_master')}
        />
      )}

      {/* ========================================================================= */}
      {/* 5. CRONOGRAMA DE MANTENIMIENTO PREVENTIVO, CORRECTIVO Y CAPACITACIÓN       */}
      {/* ========================================================================= */}
      {viewTab === 'maintenance_schedule' && (
        <MaintenanceScheduleManager
          equipments={equipments}
          tenderClients={tenderClients}
          ocContracts={contractsInternal}
          salesOrders={salesOrders}
          onNavigateToInvoicing={onNavigateToInvoicing}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: DOCUMENT PREVIEW (PDF, IMAGES, WORD)                               */}
      {/* ========================================================================= */}
      {previewDoc && typeof document !== 'undefined' && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewDoc(null);
          }}
          className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn"
        >
          <div
            className={`transition-all duration-200 flex flex-col ${
              isFullscreenPreview
                ? 'fixed inset-0 z-[110] bg-[#14233c] w-screen h-screen max-w-none max-h-none rounded-none p-3 sm:p-5'
                : 'bg-[#14233c] border border-cyan-500/40 rounded-2xl max-w-5xl w-full p-4 sm:p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] animate-scaleUp max-h-[94vh] my-auto'
            }`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#334d6e] pb-3 gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-white truncate">
                    {previewDoc.title}
                  </h3>
                  <p className="text-xs text-slate-400 truncate">
                    {previewDoc.equipmentName} • <span className="text-cyan-400 font-bold">{previewDoc.docType}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFullscreenPreview(!isFullscreenPreview)}
                  className="p-2 text-slate-400 hover:text-cyan-300 rounded-lg hover:bg-[#15253d] transition cursor-pointer"
                  title={isFullscreenPreview ? 'Restaurar ventana' : 'Pantalla completa'}
                >
                  {isFullscreenPreview ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenInNewTab(previewDoc)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#15253d] transition cursor-pointer"
                  title="Abrir en pestaña nueva"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewDoc(null);
                    setIsFullscreenPreview(false);
                  }}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#15253d] transition cursor-pointer"
                  title="Cerrar (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="py-3 space-y-3 overflow-y-auto flex-1 pr-1">
              {/* PDF VIEWER */}
              {getDocFileCategory(previewDoc) === 'pdf' && (
                <div className="bg-[#111c2e] rounded-xl border border-[#334d6e] p-2 sm:p-3 space-y-2.5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#15253d] rounded-lg border border-[#334d6e] text-xs flex-wrap gap-2">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <FileType className="w-4 h-4 text-rose-400" />
                      <span>Visor de PDF ({previewDoc.fileName})</span>
                    </span>

                    {/* Mode switcher if it's a Drive file */}
                    {(previewDoc.driveFileId || (previewDoc.fileUrl && previewDoc.fileUrl.includes('drive.google.com'))) && (
                      <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-700 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setPreviewSourceMode('canvas')}
                          className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                            previewSourceMode === 'canvas'
                              ? 'bg-cyan-500 text-slate-950 shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Visor Canvas HD
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewSourceMode('drive_iframe')}
                          className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                            previewSourceMode === 'drive_iframe'
                              ? 'bg-cyan-500 text-slate-950 shadow-xs'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Visor Google Drive
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenInNewTab(previewDoc)}
                      className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition cursor-pointer px-2 py-1 hover:bg-[#111c2e] rounded-lg text-xs"
                      title="Abrir a pantalla completa en una nueva pestaña"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Pestaña nueva</span>
                    </button>
                  </div>

                  {/* Drive Banner notice if needed */}
                  {drivePreviewError && (
                    <div className="p-2.5 bg-amber-500/15 border border-amber-400/40 rounded-xl text-xs text-amber-200 flex items-center gap-2 animate-fadeIn">
                      <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{drivePreviewError}</span>
                    </div>
                  )}

                  <div className={`w-full rounded-lg overflow-hidden bg-slate-900 border border-[#334d6e] relative ${
                    isFullscreenPreview ? 'flex-1 min-h-[70vh]' : 'min-h-[580px] h-[640px] sm:h-[700px] max-h-[75vh]'
                  }`}>
                    {previewSourceMode === 'drive_iframe' && (previewDoc.driveFileId || extractGoogleDriveId(previewDoc.fileUrl || '')) ? (
                      <iframe
                        src={`https://drive.google.com/file/d/${previewDoc.driveFileId || extractGoogleDriveId(previewDoc.fileUrl || '')}/preview`}
                        className="w-full h-full border-0 bg-slate-950"
                        title={`Visor Google Drive: ${previewDoc.fileName}`}
                        allow="autoplay"
                      />
                    ) : isLoadingDrivePreview ? (
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-300 space-y-3 bg-slate-950">
                        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
                        <p className="font-bold text-white text-sm">
                          Conectando con Google Drive y preparando el visor de PDF...
                        </p>
                        <p className="text-xs text-slate-400 max-w-sm">
                          Descargando el archivo en alta resolución para visualización directa.
                        </p>
                      </div>
                    ) : previewBlob ? (
                      <div className="w-full h-full overflow-hidden bg-slate-950 flex flex-col">
                        <PdfCanvasViewer
                          blob={previewBlob}
                          filename={previewDoc.fileName || previewDoc.title}
                          blobUrl={previewBlobUrl || undefined}
                          onOpenInNewTab={() => handleOpenInNewTab(previewDoc)}
                        />
                      </div>
                    ) : (previewDoc.driveFileId || (previewDoc.fileUrl && previewDoc.fileUrl.includes('drive.google.com')) || (previewDoc.fileData && previewDoc.fileData.includes('drive.google.com'))) ? (
                      /* High-fidelity Google Drive Document Card (Never shows Chrome blocked page) */
                      <div className="flex flex-col items-center justify-center h-full p-6 sm:p-8 text-center bg-gradient-to-b from-[#111e33] to-[#0c1626] space-y-4">
                        <div className="p-4 bg-cyan-500/15 border border-cyan-500/30 rounded-2xl text-cyan-400 shadow-xl">
                          <FileType className="w-12 h-12 text-rose-400" />
                        </div>
                        <div className="space-y-1.5 max-w-md">
                          <h4 className="text-sm sm:text-base font-bold text-white">
                            {previewDoc.fileName || previewDoc.title}
                          </h4>
                          <p className="text-xs text-slate-300">
                            Documento oficial en <strong className="text-amber-400 font-bold">Google Drive</strong> ({previewDoc.fileSize || 'PDF'}).
                          </p>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Haz clic en <strong className="text-cyan-300">"Visualizar con Google Drive"</strong> para sincronizar tu sesión y cargarlo inmediatamente en el visor integrado:
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={handleConnectAndLoadDriveFile}
                            disabled={isLoadingDrivePreview}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDrivePreview ? 'animate-spin' : ''}`} />
                            <span>Visualizar con Google Drive</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenInNewTab(previewDoc)}
                            className="inline-flex items-center gap-1.5 bg-[#17253b] hover:bg-[#203452] border border-[#2d466b] text-slate-200 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Abrir en Google Drive</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadDoc(previewDoc)}
                            className="inline-flex items-center gap-1.5 bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold px-3.5 py-2.5 rounded-xl transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Descargar</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
                        <FileType className="w-10 h-10 text-rose-400 mb-2" />
                        <p className="font-bold text-white text-sm">Cargando visor de documento...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* IMAGE VIEWER */}
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

              {/* WORD VIEWER */}
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
                        Tamaño: <strong className="text-white">{previewDoc.fileSize}</strong> • Archivo nativo Word listo para descarga y edición.
                      </p>
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

              {/* Metadata Card */}
              <div className="bg-[#15253d] p-4 rounded-xl border border-[#334d6e] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Equipo Vinculado:</span>
                    <strong className="text-white text-xs block mt-0.5">{previewDoc.equipmentName}</strong>
                    {previewDoc.equipmentCode && (
                      <span className="text-cyan-400 font-mono text-[11px]">{previewDoc.equipmentCode}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Archivo Custodiado:</span>
                    <p className="text-cyan-400 font-mono mt-0.5 truncate">{previewDoc.fileName}</p>
                    <span className="text-slate-400 text-[10.5px]">Tamaño: {previewDoc.fileSize}</span>
                  </div>
                </div>

                {previewDoc.invimaNumber && (
                  <div className="bg-[#111c2e] p-3 rounded-lg border border-emerald-500/30 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
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

              <div className="flex items-center gap-2.5 ml-auto">
                <span className="text-[11px] text-slate-500 hidden sm:inline mr-1">Presione <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">ESC</kbd> para cerrar</span>
                {(previewDoc.driveFileId || (previewDoc.fileUrl && previewDoc.fileUrl.includes('drive.google.com')) || (previewDoc.fileData && previewDoc.fileData.includes('drive.google.com'))) && (
                  <button
                    type="button"
                    onClick={() => handleOpenInNewTab(previewDoc)}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                    title="Abrir directamente en Google Drive con tu cuenta autorizada"
                  >
                    <HardDrive className="w-4 h-4 text-slate-950" />
                    <span>Abrir en Google Drive</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDownloadDoc(previewDoc)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5"
                  title="Descargar este archivo"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Archivo</span>
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
          className="fixed inset-0 z-[100] bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-2.5 sm:p-4 animate-fadeIn"
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
                {(docToDelete.driveFileId || (docToDelete.fileUrl && docToDelete.fileUrl.includes('drive.google.com')) || (docToDelete.fileData && docToDelete.fileData.includes('drive.google.com'))) && (
                  <p className="text-[11px] text-amber-300 flex items-center gap-1.5 font-bold pt-1 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                    <HardDrive className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>También se eliminará de tu Google Drive.</span>
                  </p>
                )}
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

      <WarrantyAlertsWidget
        isOpen={isWarrantyAlertsModalOpen}
        onClose={() => setIsWarrantyAlertsModalOpen(false)}
      />
    </div>
  );
};
