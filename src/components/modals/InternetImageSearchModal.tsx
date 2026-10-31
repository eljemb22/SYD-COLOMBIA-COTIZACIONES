import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2, Globe, Check, Image as ImageIcon, AlertCircle } from 'lucide-react';
import {
  ProductImageOption,
  searchEquipmentImagesFromInternet,
  proxyAndConvertImageToBase64,
} from '../../services/imageSearchService';

interface InternetImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentName: string;
  brand?: string;
  model?: string;
  onSelectImage: (base64Url: string) => void;
}

export const InternetImageSearchModal: React.FC<InternetImageSearchModalProps> = ({
  isOpen,
  onClose,
  equipmentName,
  brand = '',
  model = '',
  onSelectImage,
}) => {
  const initialQuery = [equipmentName, brand, model].filter(Boolean).join(' ').trim();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [options, setOptions] = useState<ProductImageOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imgLoadErrors, setImgLoadErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      const q = [equipmentName, brand, model].filter(Boolean).join(' ').trim();
      setSearchQuery(q);
      setImgLoadErrors({});
      executeSearch(q);
    }
  }, [isOpen, equipmentName, brand, model]);

  const executeSearch = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsLoading(true);
    setErrorMessage(null);
    setImgLoadErrors({});
    try {
      const results = await searchEquipmentImagesFromInternet(equipmentName, brand, model, queryText.trim());
      setOptions(results);
      if (results.length === 0) {
        setErrorMessage('No se encontraron imágenes directas para esta búsqueda. Intente con términos más específicos o la marca.');
      }
    } catch (err: any) {
      setErrorMessage('Ocurrió un inconveniente al conectar con el servicio de búsqueda de imágenes.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(searchQuery);
  };

  const handleSelectOption = async (option: ProductImageOption) => {
    try {
      setDownloadingUrl(option.url);
      const base64 = await proxyAndConvertImageToBase64(option.url);
      if (base64) {
        onSelectImage(base64);
        onClose();
      } else {
        setErrorMessage('No se pudo optimizar la imagen seleccionada. Por favor seleccione otra de las opciones.');
      }
    } catch (e) {
      setErrorMessage('Error al descargar la imagen elegida.');
    } finally {
      setDownloadingUrl(null);
    }
  };

  const getProxiedImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('data:')) return url;
    if (url.startsWith('/assets/') || url.startsWith('assets/') || url.startsWith('/images/')) {
      return url.startsWith('/') ? url : `/${url}`;
    }
    // Route image requests via backend proxy to eliminate CORS, hotlink blocks and DNS issues
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/40 backdrop-blur-[1.5px] animate-fadeIn"
      onClick={(e) => {
        // Prevent accidental closing when clicking on the backdrop
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        className="relative w-full max-w-6xl bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-700/80 text-slate-100"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header - Dark Navy theme matching the app */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/80 bg-gradient-to-r from-slate-950 via-slate-900 to-sky-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-inner">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                <span>Buscar Imagen del Equipo en Internet</span>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  {options.length > 0 ? `${options.length} Opciones Disponibles` : 'Buscando opciones...'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Fotografías biomédicas de catálogo y fuentes hospitalarias oficiales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar - Dark Themed */}
        <div className="px-6 py-3.5 bg-slate-850 bg-slate-900/90 border-b border-slate-700/80">
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Nombre, marca o modelo del equipo biomédico..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-800/90 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-inner"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim()}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 active:scale-95 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-md flex items-center gap-2 transition cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Buscar</span>
                </>
              )}
            </button>
          </form>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>Equipo: <strong className="text-sky-300 font-semibold">{equipmentName || 'Sin especificar'}</strong></span>
            {brand && <span>· Marca: <strong className="text-sky-300 font-semibold">{brand}</strong></span>}
            {model && <span>· Modelo: <strong className="text-sky-300 font-semibold">{model}</strong></span>}
          </div>
        </div>

        {/* Content Area - Dark Navy Theme */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950/60">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-10 h-10 animate-spin text-sky-400 mb-3" />
              <p className="text-sm font-semibold text-slate-200">
                Buscando opciones de internet para este equipo...
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Consultando catálogos biomédicos oficiales, repositorios médicos y fuentes verificadas
              </p>
            </div>
          ) : errorMessage && options.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
              <p className="text-sm font-semibold text-slate-200">{errorMessage}</p>
              <p className="text-xs text-slate-400 mt-1">
                Puede intentar buscar con palabras clave más generales o el tipo de equipo.
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                  Opciones encontradas ({options.length}):
                </span>
                <span className="text-xs text-slate-400">
                  Haga clic en <strong className="text-sky-300">"Seleccionar"</strong> para aplicarla automáticamente
                </span>
              </div>

              {/* Cards Grid - Responsive up to 8 options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {options.map((opt, idx) => {
                  const isDownloading = downloadingUrl === opt.url;
                  const hasImgError = imgLoadErrors[opt.url];
                  const proxiedSrc = getProxiedImageUrl(opt.thumbnail || opt.url);

                  return (
                    <div
                      key={idx}
                      className="bg-slate-900 border border-slate-700/80 hover:border-sky-500 rounded-xl overflow-hidden shadow-lg hover:shadow-sky-500/10 transition flex flex-col group relative"
                    >
                      {/* Badge Option Number */}
                      <div className="absolute top-2.5 left-2.5 z-10">
                        <span className="px-2.5 py-0.5 text-[10.5px] font-bold rounded-full bg-slate-950/85 text-sky-300 border border-sky-400/40 shadow-sm backdrop-blur-sm">
                          Opción {idx + 1}
                        </span>
                      </div>

                      {/* Image Preview Box with Dark Background */}
                      <div className="h-44 bg-slate-950 flex items-center justify-center p-3 border-b border-slate-800 overflow-hidden relative">
                        {!hasImgError ? (
                          <img
                            src={proxiedSrc}
                            alt={opt.title}
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300 rounded"
                            loading="eager"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              const target = e.currentTarget;
                              if (target.dataset.failedOnce === 'true') {
                                setImgLoadErrors((prev) => ({ ...prev, [opt.url]: true }));
                                return;
                              }
                              target.dataset.failedOnce = 'true';
                              // If it tried .jpg, try .svg
                              if (target.src.includes('.jpg')) {
                                target.src = target.src.replace(/\.jpg/g, '.svg');
                                return;
                              }
                              // Try direct URL if different
                              const directUrl = opt.url || opt.thumbnail;
                              if (directUrl && !target.src.endsWith(directUrl)) {
                                target.src = directUrl;
                              } else {
                                setImgLoadErrors((prev) => ({ ...prev, [opt.url]: true }));
                              }
                            }}
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center p-3 text-slate-400 w-full h-full bg-slate-950/90">
                            <ImageIcon className="w-9 h-9 text-sky-400/80 mb-1.5 animate-pulse" />
                            <span className="text-[11px] text-slate-200 font-semibold line-clamp-2 px-2">{opt.title}</span>
                            <span className="text-[9.5px] text-sky-300 mt-1 px-2 py-0.5 rounded bg-sky-950/80 border border-sky-500/30">
                              Fotografía Técnica
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between bg-slate-900/90">
                        <div>
                          <p
                            className="text-xs font-semibold text-slate-100 group-hover:text-sky-300 transition line-clamp-2 leading-snug mb-1"
                            title={opt.title}
                          >
                            {opt.title}
                          </p>
                          {opt.source && (
                            <span className="text-[10.5px] text-sky-400/80 block truncate">
                              {opt.source}
                            </span>
                          )}
                        </div>

                        {/* Select Action Button */}
                        <div className="mt-3 pt-2.5 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => handleSelectOption(opt)}
                            disabled={Boolean(downloadingUrl)}
                            className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 active:scale-95 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                          >
                            {isDownloading ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Aplicando...</span>
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Seleccionar</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-900 border-t border-slate-700/80 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-sky-400" />
            La imagen elegida se guardará en alta resolución y se incluirá en PDF y Word.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
