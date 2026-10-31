import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Download,
  ExternalLink,
  Loader2,
  AlertCircle,
  FileText,
  RefreshCw,
  Layers,
  File,
  Eye,
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs?v=${pdfjsLib.version}`;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  }
}

interface PdfCanvasViewerProps {
  blob: Blob;
  filename: string;
  blobUrl?: string;
  onDownload?: () => void;
  onOpenInNewTab?: () => void;
}

/**
 * Component to render a single PDF page onto a canvas
 */
const SinglePageCanvas: React.FC<{
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  scale: number;
  rotation: number;
  totalNumPages: number;
}> = ({ pdfDoc, pageNum, scale, rotation, totalNumPages }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const renderTaskRef = useRef<any>(null);
  const [pageLoading, setPageLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;

    const renderPage = async () => {
      if (!canvasRef.current || !pdfDoc) return;
      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (_) {}
        }

        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        const pixelRatio = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale, rotation });

        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, viewport.width, viewport.height);

        const renderContext: any = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
        renderTaskRef.current = null;
        if (!isCancelled) setPageLoading(false);
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Error rendering PDF page ${pageNum}:`, err);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (_) {}
      }
    };
  }, [pdfDoc, pageNum, scale, rotation]);

  return (
    <div id={`pdf-page-container-${pageNum}`} className="flex flex-col items-center my-3 group min-w-fit">
      {/* Page Header Bar */}
      <div className="flex items-center justify-between w-full px-3 py-1 mb-1.5 rounded-t-lg bg-slate-900/95 border border-slate-700 text-[11px] font-bold text-slate-300 shadow-sm">
        <span className="flex items-center gap-1.5 text-cyan-400 font-mono">
          <File className="w-3.5 h-3.5 text-cyan-400" />
          <span>Página {pageNum} de {totalNumPages}</span>
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          {Math.round(scale * 100)}% zoom
        </span>
      </div>

      {/* Page Canvas Container with clean paper drop-shadow */}
      <div className="relative shadow-2xl rounded-xs bg-white border border-slate-700/90 transition-transform duration-100 ease-out min-w-fit">
        {pageLoading && (
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-2xs flex items-center justify-center text-cyan-300 text-xs font-bold gap-2 z-10">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
            <span>Cargando página {pageNum}...</span>
          </div>
        )}
        <canvas ref={canvasRef} className="block rounded-xs bg-white" style={{ maxWidth: 'none', display: 'block' }} />
      </div>
    </div>
  );
};

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  blob,
  filename,
  blobUrl,
  onDownload,
  onOpenInNewTab,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(0.95);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'canvas' | 'native'>('canvas');
  // 'continuous' shows all pages vertically; 'single' shows one page with pagination
  const [pageLayoutMode, setPageLayoutMode] = useState<'continuous' | 'single'>('continuous');

  // Ensure an active blobUrl is always available
  const effectiveBlobUrl = React.useMemo(() => {
    if (blobUrl && blobUrl.startsWith('blob:')) return blobUrl;
    try {
      return URL.createObjectURL(blob);
    } catch {
      return '';
    }
  }, [blob, blobUrl]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);

  // Load PDF document from Blob
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setRenderError(null);
    setCurrentPage(1);

    const loadPdf = async () => {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        if (!isMounted) return;

        // Verify valid PDF header (%PDF) in the initial chunk
        const headerSlice = new Uint8Array(arrayBuffer.slice(0, 1024));
        let headerStr = '';
        for (let i = 0; i < headerSlice.length; i++) {
          headerStr += String.fromCharCode(headerSlice[i]);
        }
        if (!headerStr.includes('%PDF')) {
          if (isMounted) {
            setViewMode('native');
            setIsLoading(false);
          }
          return;
        }

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
        });

        const doc = await loadingTask.promise;
        if (!isMounted) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setIsLoading(false);

        // Auto-calculate comfortable initial scale based on container width
        try {
          const firstPage = await doc.getPage(1);
          const vp = firstPage.getViewport({ scale: 1.0 });
          const containerW = containerRef.current?.clientWidth || 750;
          const fitWScale = Math.max(0.6, Math.min(1.15, (containerW - 80) / vp.width));
          setScale(Number(fitWScale.toFixed(2)));
        } catch (_) {}
      } catch (err: any) {
        if (isMounted) {
          setViewMode('native');
          setIsLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
      if (pdfDoc) {
        try {
          (pdfDoc as any).destroy?.();
          pdfDoc.cleanup?.();
        } catch (_) {}
      }
    };
  }, [blob]);

  // Page Controls
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < numPages) setCurrentPage((prev) => prev + 1);
  };

  // Zoom Controls
  const handleZoomIn = () => {
    setScale((prev) => Math.min(Number((prev + 0.15).toFixed(2)), 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(Number((prev - 0.15).toFixed(2)), 0.4));
  };

  const handleFitWidth = () => {
    if (containerRef.current && pdfDoc) {
      pdfDoc.getPage(currentPage || 1).then((page) => {
        const vp = page.getViewport({ scale: 1.0, rotation: rotation });
        const containerWidth = containerRef.current?.clientWidth || 800;
        const targetScale = Math.max(0.4, Math.min(2.5, (containerWidth - 64) / vp.width));
        setScale(Number(targetScale.toFixed(2)));
      });
    }
  };

  const handleFitPage = () => {
    if (containerRef.current && pdfDoc) {
      pdfDoc.getPage(currentPage || 1).then((page) => {
        const vp = page.getViewport({ scale: 1.0, rotation: rotation });
        const containerHeight = containerRef.current?.clientHeight || 600;
        const targetScale = Math.max(0.4, Math.min(2.0, (containerHeight - 100) / vp.height));
        setScale(Number(targetScale.toFixed(2)));
      });
    }
  };

  const handleResetZoom = () => {
    setScale(1.0);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Page list for continuous view
  const pagesList = React.useMemo(() => {
    return Array.from({ length: numPages }, (_, i) => i + 1);
  }, [numPages]);

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="px-3 sm:px-4 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0 z-10 shadow-xs">
        {/* Mode Selector & Continuous vs Single Page toggle */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                viewMode === 'canvas'
                  ? 'bg-cyan-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Visualizador interactivo Canvas de alta resolución"
            >
              Modo Canvas
            </button>
            <button
              type="button"
              onClick={() => setViewMode('native')}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                viewMode === 'native'
                  ? 'bg-cyan-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Visualizador PDF integrado del navegador"
            >
              Visor Nativo
            </button>
          </div>

          {viewMode === 'canvas' && !renderError && numPages > 0 && (
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setPageLayoutMode('continuous')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  pageLayoutMode === 'continuous'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Ver todas las hojas continuamente una tras otra"
              >
                <Layers className="w-3 h-3" />
                <span>Todas las Hojas ({numPages})</span>
              </button>
              <button
                type="button"
                onClick={() => setPageLayoutMode('single')}
                className={`px-2 py-1 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                  pageLayoutMode === 'single'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Navegar hoja por hoja con controles de página"
              >
                <FileText className="w-3 h-3" />
                <span>Por Hoja</span>
              </button>
            </div>
          )}
        </div>

        {/* Page navigation (for single-page mode) */}
        {viewMode === 'canvas' && !renderError && pageLayoutMode === 'single' && (
          <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-1 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={handlePrevPage}
              disabled={currentPage <= 1 || isLoading}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Página Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 text-xs text-slate-300 font-semibold px-1">
              <span>Página</span>
              <input
                type="number"
                min={1}
                max={numPages || 1}
                value={currentPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= numPages) {
                    setCurrentPage(val);
                  }
                }}
                className="w-10 bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-center text-xs font-mono text-cyan-300 font-bold focus:outline-hidden focus:border-cyan-400"
              />
              <span className="text-slate-400">de {numPages || 1}</span>
            </div>

            <button
              type="button"
              onClick={handleNextPage}
              disabled={currentPage >= numPages || isLoading}
              className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              title="Página Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Zoom & View Controls */}
        {viewMode === 'canvas' && !renderError && (
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1 flex-wrap">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={scale <= 0.4 || isLoading}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition cursor-pointer"
              title="Reducir Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleResetZoom}
              className="text-xs font-mono font-bold text-cyan-300 min-w-[44px] text-center hover:bg-slate-800 rounded px-1 py-0.5 cursor-pointer"
              title="Restablecer a 100%"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              type="button"
              onClick={handleZoomIn}
              disabled={scale >= 3.0 || isLoading}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-3.5 bg-slate-800 mx-0.5" />

            <button
              type="button"
              onClick={handleFitWidth}
              className="text-[11px] font-semibold text-slate-300 hover:text-cyan-300 px-1.5 py-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
              title="Ajustar al ancho de la pantalla para ver el documento completo sin recorte horizontal"
            >
              Ajustar Ancho
            </button>

            <button
              type="button"
              onClick={handleFitPage}
              className="text-[11px] font-semibold text-slate-300 hover:text-cyan-300 px-1.5 py-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
              title="Ajustar a la página entera"
            >
              Página
            </button>

            <button
              type="button"
              onClick={handleRotate}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Girar 90°"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onOpenInNewTab && (
            <button
              type="button"
              onClick={onOpenInNewTab}
              className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-200 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/80 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
              title="Abrir el documento original en una pestaña independiente"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nueva Pestaña</span>
            </button>
          )}

          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 px-3 py-1.5 rounded-lg transition cursor-pointer shadow-xs"
              title="Descargar archivo PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-Page Quick Jump Navigation Strip */}
      {viewMode === 'canvas' && !renderError && numPages > 1 && (
        <div className="px-3 py-1.5 bg-slate-900/90 border-b border-slate-800/90 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0 z-10 scrollbar-thin">
          <span className="text-[10.5px] font-bold text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400" />
            <span>Ver Hojas ({numPages}):</span>
          </span>
          {pagesList.map((p) => (
            <button
              key={`jump-page-${p}`}
              type="button"
              onClick={() => {
                setCurrentPage(p);
                if (pageLayoutMode === 'continuous') {
                  const el = document.getElementById(`pdf-page-container-${p}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold transition shrink-0 cursor-pointer ${
                currentPage === p
                  ? 'bg-cyan-500 text-slate-950 shadow-xs'
                  : 'bg-slate-800/90 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              Hoja {p}
            </button>
          ))}
        </div>
      )}

      {/* Main Display Area with full scrollability (never clips or crops zoom) */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 w-full overflow-auto bg-[#0a0f1d] relative p-3 sm:p-6"
      >
        {viewMode === 'native' ? (
          <div className="w-full h-full min-h-[500px] flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
            {effectiveBlobUrl ? (
              <div className="w-full flex-1 min-h-[520px] flex flex-col relative">
                <object
                  data={`${effectiveBlobUrl}#toolbar=1&navpanes=1`}
                  type="application/pdf"
                  className="w-full flex-1 min-h-[520px] rounded-lg bg-white"
                >
                  <div className="flex flex-col items-center justify-center p-8 text-center text-slate-300 m-auto space-y-3">
                    <FileText className="w-12 h-12 text-cyan-400 mb-1" />
                    <p className="font-bold text-white text-base">{filename}</p>
                    <p className="text-xs text-slate-400 max-w-md">
                      El navegador restringió la incrustación nativa en este entorno. Puedes visualizarlo en Modo Canvas o abrirlo en una nueva pestaña:
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setViewMode('canvas')}
                        className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                      >
                        Volver a Modo Canvas
                      </button>
                      {(onOpenInNewTab || effectiveBlobUrl) && (
                        <button
                          type="button"
                          onClick={onOpenInNewTab || (() => window.open(effectiveBlobUrl, '_blank'))}
                          className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition cursor-pointer"
                        >
                          Abrir en Pestaña Nueva
                        </button>
                      )}
                    </div>
                  </div>
                </object>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-300">
                <FileText className="w-12 h-12 text-cyan-400 mb-3" />
                <p className="font-bold text-white text-base">{filename}</p>
              </div>
            )}
          </div>
        ) : renderError ? (
          <div className="w-full h-full flex flex-col p-4 sm:p-6 overflow-y-auto">
            <div className="max-w-xl w-full mx-auto my-auto bg-[#131f33] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10.5px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold uppercase">
                  Documento PDF
                </span>
                <h4 className="text-base font-bold text-white break-all">{filename}</h4>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  {renderError}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                {effectiveBlobUrl && (
                  <button
                    type="button"
                    onClick={onOpenInNewTab || (() => window.open(effectiveBlobUrl, '_blank'))}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Abrir en Pestaña Nueva</span>
                  </button>
                )}

                {onDownload && (
                  <button
                    type="button"
                    onClick={onDownload}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Archivo</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setViewMode('native');
                  }}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Activar Visor Nativo</span>
                </button>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center m-auto">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-sm font-semibold text-white">Procesando y renderizando documento PDF...</p>
            <p className="text-xs text-slate-400">{filename}</p>
          </div>
        ) : pdfDoc ? (
          <div className="min-w-fit w-full flex flex-col items-center justify-start min-h-full mx-auto">
            {pageLayoutMode === 'continuous' ? (
              // Continuous multi-page mode: render all pages vertically
              <div className="min-w-fit w-full flex flex-col items-center gap-4 py-2">
                {pagesList.map((pNum) => (
                  <SinglePageCanvas
                    key={`pdf-page-${pNum}-${scale}-${rotation}`}
                    pdfDoc={pdfDoc}
                    pageNum={pNum}
                    scale={scale}
                    rotation={rotation}
                    totalNumPages={numPages}
                  />
                ))}
              </div>
            ) : (
              // Single page mode
              <div className="min-w-fit w-full flex flex-col items-center py-2 m-auto">
                <SinglePageCanvas
                  key={`pdf-single-page-${currentPage}-${scale}-${rotation}`}
                  pdfDoc={pdfDoc}
                  pageNum={currentPage}
                  scale={scale}
                  rotation={rotation}
                  totalNumPages={numPages}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full min-h-[500px] flex flex-col bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
            {effectiveBlobUrl ? (
              <object
                data={`${effectiveBlobUrl}#toolbar=1&navpanes=1`}
                type="application/pdf"
                className="w-full flex-1 min-h-[520px] rounded-lg bg-white"
              >
                <iframe
                  src={`${effectiveBlobUrl}#toolbar=1&navpanes=1`}
                  title={filename}
                  className="w-full flex-1 min-h-[520px] border-0 rounded-lg bg-white"
                />
              </object>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center text-slate-300 m-auto">
                <FileText className="w-12 h-12 text-cyan-400 mb-3" />
                <p className="font-bold text-white text-base">{filename}</p>
                <p className="text-xs text-slate-400 mt-1">Listo para visualizar o descargar</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
