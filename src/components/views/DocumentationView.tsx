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
} from 'lucide-react';
import {
  TechnicalDocument,
  MedicalEquipment,
  AuthUser,
  OCTrackingContract,
  TenderClientProject,
} from '../../types';
import {
  getStoredOCTrackingContracts,
  saveStoredOCTrackingContracts,
} from '../../utils/ocTrackingStorage';
import { QuickTechnicalSheetGenerator } from './documentation/QuickTechnicalSheetGenerator';
import { ContractsDocumentationTab } from './documentation/ContractsDocumentationTab';
import { MasterCatalogDocumentationTab } from './documentation/MasterCatalogDocumentationTab';

interface DocumentationViewProps {
  documents: TechnicalDocument[];
  equipments: MedicalEquipment[];
  tenderClients?: TenderClientProject[];
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

export const DocumentationView: React.FC<DocumentationViewProps> = ({
  documents,
  equipments,
  tenderClients = [],
  ocContracts,
  onUpdateContracts,
  onOpenNewDocumentModal,
  onSaveDocument,
  onDeleteDocument,
  currentUser,
  onNavigateToOCTracking,
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canEditDocuments;

  // Primary view tabs:
  // 1. 'contracts': Contratos & OCs Directas (unificado con seriales y despachos adentro)
  // 2. 'catalog_master': Base Maestra / Catálogo General (almacén central con cuadro automático por cada equipo)
  // 3. 'technical_sheet': Ficha Técnica Rápida Oficial (PDF)
  const [viewTab, setViewTab] = useState<'contracts' | 'catalog_master' | 'technical_sheet'>('contracts');

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

  // Search filter query
  const [searchQuery, setSearchQuery] = useState<string>('');

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

  const totalContractsCount = (tenderClients?.length || 0) + (contractsInternal?.length || 0);

  return (
    <div id="documentation-view-container" className="space-y-3 animate-fadeIn">
      {/* Unified Top Header & Search Controls Bar - Compact & High-Density */}
      <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-2.5 shadow-md space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Main 3 Unified Tabs: 1. Contratos & OCs Directas | 2. Base Maestra Catálogo | 3. Ficha Técnica PDF */}
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
          </div>

          {/* Quick Context Summary Tag */}
          <div className="text-[11px] text-slate-400 hidden md:flex items-center gap-2">
            <span className="text-emerald-400 font-bold">● {equipments.length} equipos en catálogo</span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-400 font-bold">● {documents.length} documentos adjuntos</span>
          </div>
        </div>

        {/* Search Bar (Ultra compact) */}
        {viewTab !== 'technical_sheet' && (
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
      {/* MODAL: DOCUMENT PREVIEW (PDF, IMAGES, WORD)                               */}
      {/* ========================================================================= */}
      {previewDoc && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn"
        >
          <div className="bg-[#192b45] border border-cyan-500/50 rounded-2xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl animate-scaleUp max-h-[92vh] flex flex-col my-auto">
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

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenInNewTab(previewDoc)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#15253d] transition cursor-pointer"
                  title="Abrir en ventana completa"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#15253d] transition cursor-pointer"
                  title="Cerrar (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="py-4 space-y-4 overflow-y-auto flex-1 pr-1">
              {/* PDF VIEWER */}
              {getDocFileCategory(previewDoc) === 'pdf' && (
                <div className="bg-[#111c2e] rounded-xl border border-[#334d6e] p-2 space-y-2">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#15253d] rounded-lg border border-[#334d6e] text-xs">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <FileType className="w-4 h-4 text-rose-400" />
                      <span>Visor Integrado de PDF ({previewDoc.fileName})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenInNewTab(previewDoc)}
                      className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Abrir a pantalla completa</span>
                    </button>
                  </div>

                  <div className="w-full h-[520px] rounded-lg overflow-hidden bg-slate-900 border border-[#334d6e]">
                    {previewBlobUrl || previewDoc.fileData ? (
                      <object
                        data={previewBlobUrl || previewDoc.fileData}
                        type="application/pdf"
                        className="w-full h-full"
                      >
                        <iframe
                          src={previewBlobUrl || previewDoc.fileData}
                          className="w-full h-full border-none"
                          title={previewDoc.title}
                        >
                          <div className="p-8 text-center text-slate-400 space-y-3">
                            <p className="font-bold text-white">Visualizador embebido no compatible con este navegador.</p>
                            <button
                              type="button"
                              onClick={() => handleDownloadDoc(previewDoc)}
                              className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5"
                            >
                              <Download className="w-4 h-4" />
                              <span>Descargar PDF</span>
                            </button>
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-fadeIn">
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
