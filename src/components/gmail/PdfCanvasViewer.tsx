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
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  try {
    // Primary: use local worker in public directory
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
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

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  blob,
  filename,
  blobUrl,
  onDownload,
  onOpenInNewTab,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'canvas' | 'native'>('canvas');

  // Ensure an active blobUrl is always available
  const effectiveBlobUrl = React.useMemo(() => {
    if (blobUrl && blobUrl.startsWith('blob:')) return blobUrl;
    try {
      return URL.createObjectURL(blob);
    } catch {
      return '';
    }
  }, [blob, blobUrl]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<any>(null);

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

        // Verify valid PDF header (%PDF) in the initial chunk (handles BOM or leading comments)
        const headerSlice = new Uint8Array(arrayBuffer.slice(0, 1024));
        let headerStr = '';
        for (let i = 0; i < headerSlice.length; i++) {
          headerStr += String.fromCharCode(headerSlice[i]);
        }
        if (!headerStr.includes('%PDF')) {
          throw new Error('El archivo no contiene un encabezado PDF estándar válido (%PDF). Se visualizará en modo nativo.');
        }

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(arrayBuffer),
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
          cMapPacked: true,
        });

        const pdfDoc = await loadingTask.promise;
        if (!isMounted) return;

        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        setIsLoading(false);
      } catch (err: any) {
        console.warn('PDF.js canvas decoder aviso:', err?.message || err);
        if (isMounted) {
          setRenderError(err?.message || 'No se pudo decodificar mediante Canvas. Activando visor nativo integrado.');
          setIsLoading(false);
          // Fallback seamlessly to native embed
          setViewMode('native');
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }
      if (pdfDocRef.current) {
        try {
          (pdfDocRef.current as any).destroy?.();
          pdfDocRef.current.cleanup?.();
        } catch {}
        pdfDocRef.current = null;
      }
    };
  }, [blob]);

  // Render the current page onto canvas
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDocRef.current || !canvasRef.current || currentPage < 1) return;

    try {
      // Cancel previous render task if still in progress
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {}
      }

      const page = await pdfDocRef.current.getPage(currentPage);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) return;

      // Handle Hi-DPI (Retina) display crispness
      const pixelRatio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale, rotation: rotation });

      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      // White background for page canvas
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
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.warn('Advertencia en renderizado de página PDF:', err);
      }
    }
  }, [currentPage, scale, rotation]);

  useEffect(() => {
    if (!isLoading && pdfDocRef.current) {
      renderCurrentPage();
    }
  }, [isLoading, currentPage, scale, rotation, renderCurrentPage]);

  // Page Controls
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((prev) => prev - 1);
  };

  const handleNextPage = () => {
    if (currentPage < numPages) setCurrentPage((prev) => prev + 1);
  };

  // Zoom Controls
  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleFitWidth = () => {
    if (containerRef.current && pdfDocRef.current) {
      pdfDocRef.current.getPage(currentPage).then((page) => {
        const vp = page.getViewport({ scale: 1.0, rotation: rotation });
        const containerWidth = containerRef.current?.clientWidth || 800;
        const targetScale = Math.max((containerWidth - 64) / vp.width, 0.5);
        setScale(Number(targetScale.toFixed(2)));
      });
    }
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="px-4 py-2 bg-slate-900/95 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0 z-10 shadow-xs">
        {/* Mode Selector */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setViewMode('canvas')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition cursor-pointer ${
              viewMode === 'canvas'
                ? 'bg-cyan-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Visualizador interactivo por página"
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

        {viewMode === 'canvas' && !renderError && (
          <>
            {/* Page Navigator */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage <= 1 || isLoading}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                title="Página Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 text-xs text-slate-300 font-semibold px-2">
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
                  className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center text-xs font-mono text-cyan-300 font-bold focus:outline-hidden focus:border-cyan-400"
                />
                <span className="text-slate-400">de {numPages || 1}</span>
              </div>

              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage >= numPages || isLoading}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                title="Página Siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Zoom & View Controls */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={scale <= 0.5 || isLoading}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition cursor-pointer"
                title="Reducir Zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <span className="text-xs font-mono font-bold text-cyan-300 min-w-[48px] text-center">
                {Math.round(scale * 100)}%
              </span>

              <button
                type="button"
                onClick={handleZoomIn}
                disabled={scale >= 3.0 || isLoading}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition cursor-pointer"
                title="Aumentar Zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-3.5 bg-slate-800 mx-1" />

              <button
                type="button"
                onClick={handleFitWidth}
                className="text-[11px] font-semibold text-slate-300 hover:text-cyan-300 px-1.5 py-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
                title="Ajustar al ancho de la ventana"
              >
                Ajustar
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
          </>
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

      {/* Main Display Area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 w-full overflow-hidden bg-[#0a0f1d] flex flex-col items-center justify-center relative"
      >
        {viewMode === 'native' || renderError ? (
          <div className="w-full h-full flex flex-col p-4 sm:p-6 overflow-y-auto">
            <div className="max-w-xl w-full mx-auto my-auto bg-[#131f33] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10.5px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-bold uppercase">
                  Documento PDF Adjunto
                </span>
                <h4 className="text-base font-bold text-white break-all">{filename}</h4>
                <p className="text-xs text-slate-300 max-w-md mx-auto">
                  El visor del navegador bloquea iframes embebidos por seguridad. Puedes abrir la previsualización directa en una pestaña limpia o descargarlo.
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
                    setRenderError(null);
                    setViewMode('canvas');
                  }}
                  className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reintentar Canvas</span>
                </button>
              </div>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-sm font-semibold text-white">Procesando y renderizando documento PDF...</p>
            <p className="text-xs text-slate-400">{filename}</p>
          </div>
        ) : (
          <div className="w-full h-full overflow-auto flex items-center justify-center p-4 sm:p-8">
            <div className="relative shadow-2xl rounded-sm transition-transform duration-100 ease-out border border-slate-800">
              <canvas
                ref={canvasRef}
                className="block rounded-xs bg-white shadow-2xl"
                style={{ maxWidth: 'none' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
