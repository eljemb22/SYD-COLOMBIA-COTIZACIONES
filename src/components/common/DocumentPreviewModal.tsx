import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Download,
  ExternalLink,
  Printer,
  FileText,
  FileType,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Paperclip,
  CheckCircle2,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import { PdfCanvasViewer } from '../gmail/PdfCanvasViewer';
import { analyzeCloudUrl, isHttpUrl } from '../../utils/cloudLinkUtils';

export interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  fileName: string;
  fileSize?: string;
  fileData?: string; // base64 dataURI or blob URL
  fileType?: string;
  onDownload?: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  fileName,
  fileSize,
  fileData,
  fileType,
  onDownload,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Generate blob & blob URL if dataURI to optimize streaming for large PDFs (e.g. 500-page manuals)
  useEffect(() => {
    if (!isOpen || !fileData) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setPdfBlob(null);
      return;
    }

    if (fileData.startsWith('data:')) {
      try {
        const parts = fileData.split(',');
        const mime = parts[0]?.split(':')[1]?.split(';')[0] || 'application/pdf';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setPdfBlob(blob);

        return () => {
          URL.revokeObjectURL(url);
          setBlobUrl(null);
          setPdfBlob(null);
        };
      } catch (e) {
        setBlobUrl(fileData);
      }
    } else if (fileData.startsWith('blob:') || fileData.startsWith('http')) {
      setBlobUrl(fileData);
      fetch(fileData)
        .then((res) => res.blob())
        .then((blob) => setPdfBlob(blob))
        .catch(() => {});
    } else {
      setBlobUrl(fileData);
    }
  }, [isOpen, fileData]);

  const isCloud = useMemo(() => isHttpUrl(fileData), [fileData]);
  const cloudInfo = useMemo(() => (isCloud && fileData ? analyzeCloudUrl(fileData) : null), [isCloud, fileData]);

  // Determine category
  const category = useMemo(() => {
    if (isCloud) {
      return 'cloud';
    }
    const fn = (fileName || '').toLowerCase();
    const ft = (fileType || '').toLowerCase();
    const fd = (fileData || '').toLowerCase();

    if (fn.endsWith('.pdf') || ft.includes('pdf') || fd.startsWith('data:application/pdf')) {
      return 'pdf';
    }
    if (
      fn.endsWith('.jpg') ||
      fn.endsWith('.jpeg') ||
      fn.endsWith('.png') ||
      fn.endsWith('.webp') ||
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
  }, [isCloud, fileName, fileType, fileData]);

  if (!isOpen) return null;

  const effectiveUrl = blobUrl || fileData;

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
      return;
    }
    if (isCloud && cloudInfo) {
      window.open(cloudInfo.downloadUrl || cloudInfo.previewUrl, '_blank');
      return;
    }
    if (!effectiveUrl) return;

    const link = document.createElement('a');
    link.href = effectiveUrl;
    link.download = fileName || 'documento.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenNewTab = () => {
    if (isCloud && cloudInfo) {
      window.open(cloudInfo.previewUrl, '_blank');
      return;
    }
    if (!effectiveUrl) return;
    window.open(effectiveUrl, '_blank');
  };

  const handlePrint = () => {
    if (!effectiveUrl) return;
    const printWindow = window.open(effectiveUrl, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] bg-black/25 flex items-center justify-center p-2 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#15253d] border border-cyan-500/50 rounded-2xl max-w-5xl w-full p-4 sm:p-5 shadow-2xl animate-scaleUp max-h-[94vh] flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#334d6e] pb-3 gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">{title}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold uppercase">
                  Previsualización
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate mt-0.5">
                {subtitle ? <span>{subtitle} • </span> : null}
                <span className="text-cyan-300 font-mono font-medium">{fileName}</span>
                {fileSize && !fileSize.includes('NaN') ? <span className="text-slate-400"> ({fileSize})</span> : null}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {effectiveUrl && (
              <>
                <button
                  type="button"
                  onClick={handleOpenNewTab}
                  className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-[#192b45] border border-transparent hover:border-[#334d6e] transition cursor-pointer"
                  title="Abrir en ventana completa / nueva pestaña"
                >
                  <ExternalLink className="w-4 h-4 text-cyan-400" />
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-[#192b45] border border-transparent hover:border-[#334d6e] transition cursor-pointer hidden sm:block"
                  title="Imprimir documento"
                >
                  <Printer className="w-4 h-4 text-slate-300" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-[#192b45] transition cursor-pointer"
              title="Cerrar previsualización (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Viewer */}
        <div className="py-3 flex-1 overflow-y-auto min-h-[350px] max-h-[calc(90vh-140px)] flex flex-col justify-center">
          {/* CLOUD DOCUMENT VIEWER (GOOGLE DRIVE, DROPBOX, ONEDRIVE, DIRECT URL) */}
          {category === 'cloud' && cloudInfo && (
            <div className="w-full h-full flex flex-col flex-1 min-h-[480px] bg-slate-950 rounded-xl border border-sky-500/40 overflow-hidden">
              <div className="px-3.5 py-2.5 bg-[#101c2e] border-b border-[#253952] flex items-center justify-between text-xs flex-wrap gap-2">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4 text-amber-400" />
                  <span>Documento Vinculado en {cloudInfo.providerLabel}</span>
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={cloudInfo.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir en Pestaña Completa</span>
                  </a>
                </div>
              </div>

              {cloudInfo.embedUrl ? (
                <iframe
                  src={cloudInfo.embedUrl}
                  title={fileName}
                  className="w-full flex-1 min-h-[450px] border-0 bg-slate-900"
                  allow="autoplay"
                />
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 p-8 text-center space-y-4">
                  <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-400">
                    <HardDrive className="w-12 h-12 text-amber-400" />
                  </div>
                  <div className="max-w-md space-y-1">
                    <h4 className="text-base font-bold text-white">{fileName}</h4>
                    <p className="text-xs text-slate-300">
                      Este documento está alojado externamente en <strong>{cloudInfo.providerLabel}</strong> para optimizar el rendimiento y soportar archivos pesados.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <a
                      href={cloudInfo.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Abrir y Visualizar en {cloudInfo.providerLabel}</span>
                    </a>
                    {cloudInfo.downloadUrl && (
                      <a
                        href={cloudInfo.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5"
                      >
                        <Download className="w-4 h-4" />
                        <span>Descargar Directamente</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* A. PDF VIEWER (PDF.JS CANVAS STREAMING - CRITICAL: EVITA BLOQUEO DE CHROME EN IFRAMES) */}
          {category === 'pdf' && (
            <div className="w-full h-full flex flex-col flex-1 min-h-[480px] sm:min-h-[540px] bg-slate-950 rounded-xl border border-[#334d6e] overflow-hidden">
              {pdfBlob ? (
                <PdfCanvasViewer
                  blob={pdfBlob}
                  filename={fileName}
                  blobUrl={effectiveUrl || undefined}
                  onDownload={handleDownload}
                  onOpenInNewTab={handleOpenNewTab}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[420px] p-8 text-center text-slate-400">
                  <FileType className="w-10 h-10 text-cyan-400 mb-2 animate-pulse" />
                  <p className="font-bold text-white text-sm">Cargando visor de documento PDF...</p>
                  <p className="text-xs text-slate-400 mt-1">{fileName}</p>
                </div>
              )}
            </div>
          )}

          {/* B. IMAGE VIEWER */}
          {category === 'image' && (
            <div className="w-full h-full flex flex-col flex-1 bg-slate-950 rounded-xl border border-[#334d6e] p-2 space-y-2">
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#111c2e] rounded-lg border border-[#334d6e] text-xs flex-wrap gap-2">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Imagen Escaneada / Soporte</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRotation((prev) => (prev + 90) % 360)}
                    className="p-1.5 bg-[#192b45] hover:bg-[#253f68] text-slate-300 rounded-lg border border-[#334d6e] cursor-pointer"
                    title="Rotar 90°"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoom((prev) => Math.max(0.5, prev - 0.25))}
                    className="p-1.5 bg-[#192b45] hover:bg-[#253f68] text-slate-300 rounded-lg border border-[#334d6e] cursor-pointer"
                    title="Alejar"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[11px] font-mono font-bold text-slate-300">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((prev) => Math.min(3, prev + 0.25))}
                    className="p-1.5 bg-[#192b45] hover:bg-[#253f68] text-slate-300 rounded-lg border border-[#334d6e] cursor-pointer"
                    title="Acercar"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(1);
                      setRotation(0);
                    }}
                    className="px-2 py-1 text-[10.5px] bg-[#192b45] hover:bg-[#253f68] text-cyan-300 rounded-lg border border-[#334d6e] cursor-pointer"
                  >
                    Restablecer
                  </button>
                </div>
              </div>

              <div className="w-full flex-1 min-h-[420px] bg-slate-900 rounded-lg border border-[#334d6e] flex items-center justify-center overflow-auto p-4">
                {effectiveUrl && (
                  <img
                    src={effectiveUrl}
                    alt={fileName}
                    style={{
                      transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      transition: 'transform 0.15s ease-out',
                      maxHeight: '65vh',
                    }}
                    className="object-contain shadow-2xl rounded"
                  />
                )}
              </div>
            </div>
          )}

          {/* C. WORD DOCUMENT VIEWER */}
          {category === 'word' && (
            <div className="bg-[#111c2e] rounded-xl border border-blue-500/40 p-6 space-y-4 text-center my-auto">
              <div className="p-4 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/40 inline-flex mx-auto">
                <FileText className="w-12 h-12" />
              </div>
              <div className="space-y-1">
                <span className="text-[10.5px] font-black uppercase text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
                  DOCUMENTO MICROSOFT WORD (.DOC / .DOCX)
                </span>
                <h4 className="text-lg font-bold text-white">{fileName}</h4>
                <p className="text-xs text-slate-300">
                  {fileSize ? <span>Tamaño: <strong className="text-white">{fileSize}</strong> • </span> : null}
                  Documento editable protegido y listo para consulta.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-6 py-3 rounded-xl shadow-lg transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar y Abrir en Word</span>
                </button>
              </div>
            </div>
          )}

          {/* D. OTHER FILE CATEGORY */}
          {category === 'other' && (
            <div className="bg-[#111c2e] rounded-xl border border-[#334d6e] p-6 space-y-3 text-center my-auto">
              <Paperclip className="w-12 h-12 text-slate-400 mx-auto" />
              <h4 className="text-base font-bold text-white">{fileName}</h4>
              <p className="text-xs text-slate-300">
                Archivo adjunto disponible para descarga y revisión en la aplicación correspondiente.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-6 py-3 rounded-xl shadow-lg transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Archivo</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#334d6e] shrink-0">
          <div className="text-[11px] text-slate-400 italic">
            Puedes previsualizar el documento completo antes de confirmar la descarga.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600/60 transition cursor-pointer"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 rounded-xl text-xs font-black text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-md transition cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Descargar Documento</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
