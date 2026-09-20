import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  X,
  Save,
  Camera,
  UploadCloud,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  RefreshCw,
  Trash2,
  DollarSign,
  Calendar,
  Clock,
  Link2,
  Search,
  FileText,
  ChevronDown,
  ChevronUp,
  UserPlus,
} from 'lucide-react';
import { TenderClientProject, SavedQuote } from '../../types';
import { cleanNumericString, formatExactCOP, formatCOP } from '../../utils/formatters';
import { getStoredClients, searchClientDirectory, saveOrUpdateClientRecord, ClientRecord } from '../../utils/clientStorage';

interface TenderClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (clientData: {
    clientName: string;
    nit: string;
    processNumber: string;
    budgetCOP: number;
    city: string;
    processType: string;
    contractObject: string;
    contactPerson: string;
    status: TenderClientProject['status'];
    openingDate?: string;
    closingDate?: string;
    executionTerm?: string;
    linkedQuote?: SavedQuote | null;
  }) => void;
  editingClient?: TenderClientProject | null;
  savedQuotes?: SavedQuote[];
}

// Ultra-fast client-side image compression & optimization helper (< 40ms)
const compressImageForOcr = async (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1400;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ base64: e.target?.result as string, mimeType: file.type || 'image/jpeg' });
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ base64: compressedDataUrl, mimeType: 'image/jpeg' });
      };
      img.onerror = () => {
        resolve({ base64: e.target?.result as string, mimeType: file.type || 'image/jpeg' });
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

export const TenderClientModal: React.FC<TenderClientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingClient,
  savedQuotes = [],
}) => {
  const [form, setForm] = useState({
    clientName: editingClient?.clientName || '',
    nit: editingClient?.header?.nit || '',
    processNumber: editingClient?.header?.processNumber || '',
    budgetCOP: editingClient?.header?.budgetCOP !== undefined ? editingClient.header.budgetCOP : 0,
    city: editingClient?.header?.city || 'Bogotá D.C.',
    processType: editingClient?.header?.processType || 'Licitación Pública',
    contractObject:
      editingClient?.header?.contractObject ||
      'Adquisición, instalación y puesta en marcha de equipos biomédicos hospitalarios.',
    contactPerson: editingClient?.header?.contactPerson || '',
    status: editingClient?.status || 'En Preparación',
    openingDate: editingClient?.header?.openingDate || new Date().toISOString().split('T')[0],
    closingDate: editingClient?.header?.closingDate || '',
    executionTerm: editingClient?.header?.executionTerm || '',
  });

  // Client Directory Autocomplete
  const [storedClients, setStoredClients] = useState<ClientRecord[]>(() => getStoredClients());
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [clientSearchFilter, setClientSearchFilter] = useState('');
  const clientDropdownRef = useRef<HTMLDivElement | null>(null);

  // Link to saved quote state
  const [isLinkQuoteSectionOpen, setIsLinkQuoteSectionOpen] = useState(false);
  const [quoteSearchTerm, setQuoteSearchTerm] = useState('');
  const [selectedLinkedQuote, setSelectedLinkedQuote] = useState<SavedQuote | null>(null);

  // AI OCR from Image / Photo states
  const [isScanningImage, setIsScanningImage] = useState(false);
  const [scanSuccessMessage, setScanSuccessMessage] = useState<string | null>(null);
  const [scanErrorMessage, setScanErrorMessage] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Close client dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        clientDropdownRef.current &&
        !clientDropdownRef.current.contains(e.target as Node)
      ) {
        setShowClientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync form if editingClient changes
  useEffect(() => {
    if (editingClient) {
      setForm({
        clientName: editingClient.clientName || '',
        nit: editingClient.header?.nit || '',
        processNumber: editingClient.header?.processNumber || '',
        budgetCOP: editingClient.header?.budgetCOP !== undefined ? editingClient.header.budgetCOP : 0,
        city: editingClient.header?.city || 'Bogotá D.C.',
        processType: editingClient.header?.processType || 'Licitación Pública',
        contractObject:
          editingClient.header?.contractObject ||
          'Adquisición, instalación y puesta en marcha de equipos biomédicos hospitalarios.',
        contactPerson: editingClient.header?.contactPerson || '',
        status: editingClient.status || 'En Preparación',
        openingDate: editingClient.header?.openingDate || new Date().toISOString().split('T')[0],
        closingDate: editingClient.header?.closingDate || '',
        executionTerm: editingClient.header?.executionTerm || '',
      });
      setSelectedLinkedQuote(null);
      setPreviewImage(null);
      setScanSuccessMessage(null);
      setScanErrorMessage(null);
    }
  }, [editingClient]);

  // Handle client selection from autocomplete
  const handleSelectClientRecord = (client: ClientRecord) => {
    setForm((prev) => ({
      ...prev,
      clientName: client.name,
      nit: client.nit || prev.nit,
      city: client.city || prev.city,
      contactPerson: client.contactPerson || prev.contactPerson,
    }));
    setShowClientSuggestions(false);
  };

  // Handle quote linking selection
  const handleSelectQuoteToLink = (quote: SavedQuote) => {
    setSelectedLinkedQuote(quote);
    const subtotal = quote.subtotal || quote.items?.reduce((acc, it) => acc + (it.totalSalePrice || 0), 0) || 0;
    const ivaRate = quote.taxRate ?? 0.19;
    const totalWithIva = quote.total || (subtotal + (quote.items?.reduce((acc, it) => acc + (it.taxExempt ? 0 : (it.totalSalePrice || 0) * ivaRate), 0) || 0));

    setForm((prev) => ({
      ...prev,
      clientName: quote.clientName || prev.clientName,
      nit: quote.nit || prev.nit,
      city: quote.city || prev.city,
      contactPerson: quote.contactPerson || prev.contactPerson,
      budgetCOP: totalWithIva > 0 ? totalWithIva : prev.budgetCOP,
      executionTerm: quote.deliveryTime || prev.executionTerm,
      contractObject: prev.contractObject || `Adquisición de ${quote.items?.length || 0} equipos biomédicos según cotización ${quote.quoteNumber}.`,
    }));
    setIsLinkQuoteSectionOpen(false);
  };

  const matchingClients = useMemo(() => {
    const q = clientSearchFilter.trim() || form.clientName.trim();
    if (!q) return storedClients.slice(0, 8);
    return searchClientDirectory(q, storedClients);
  }, [clientSearchFilter, form.clientName, storedClients]);

  const filteredSavedQuotes = useMemo(() => {
    if (!quoteSearchTerm.trim()) return savedQuotes;
    const q = quoteSearchTerm.toLowerCase();
    return savedQuotes.filter(
      (sq) =>
        sq.quoteNumber?.toLowerCase().includes(q) ||
        sq.clientName?.toLowerCase().includes(q) ||
        sq.city?.toLowerCase().includes(q)
    );
  }, [savedQuotes, quoteSearchTerm]);

  // Handle ESC key press to close modal and paste from clipboard
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            handleProcessImageFile(blob);
            break;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleProcessImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setScanErrorMessage('Por favor seleccione un archivo de imagen válido (PNG, JPG, JPEG, WEBP).');
      return;
    }

    setScanErrorMessage(null);
    setScanSuccessMessage(null);
    setIsScanningImage(true);

    try {
      // Compress and optimize image for blazing fast OCR
      const { base64: base64Data, mimeType } = await compressImageForOcr(file);
      setPreviewImage(base64Data);

      const response = await fetch('/api/gemini/extract-contract-from-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: mimeType || 'image/jpeg',
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Error en el servidor (${response.status})`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        const extracted = result.data;
        setForm((prev) => ({
          ...prev,
          clientName: extracted.clientName?.trim() || prev.clientName,
          nit: extracted.nit?.trim() || prev.nit,
          processNumber: extracted.processNumber?.trim() || prev.processNumber,
          budgetCOP:
            extracted.budgetCOP !== undefined && Number(extracted.budgetCOP) > 0
              ? Number(extracted.budgetCOP)
              : prev.budgetCOP,
          city: extracted.city?.trim() || prev.city,
          processType: extracted.processType?.trim() || prev.processType,
          contractObject: extracted.contractObject?.trim() || prev.contractObject,
          executionTerm: extracted.executionTerm?.trim() || prev.executionTerm,
          contactPerson: extracted.contactPerson?.trim() || prev.contactPerson,
          openingDate: extracted.openingDate?.trim() || prev.openingDate,
          closingDate: extracted.closingDate?.trim() || prev.closingDate,
          status: extracted.status || prev.status,
        }));

        const budgetFormatted = extracted.budgetCOP
          ? ` • Valor: $${Number(extracted.budgetCOP).toLocaleString('es-CO')} COP`
          : '';
        setScanSuccessMessage(
          `✨ ¡Lectura exitosa! Se extrajeron los datos de: ${extracted.clientName || 'la entidad'}${budgetFormatted}.`
        );
      } else {
        throw new Error(result.error || 'No se pudieron extraer datos legibles del documento');
      }
    } catch (fetchErr: any) {
      console.error('Error invoking Gemini OCR endpoint:', fetchErr);
      setScanErrorMessage(
        fetchErr.message || 'No fue posible leer la imagen con exactitud. Ingrese los datos manualmente.'
      );
    } finally {
      setIsScanningImage(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleProcessImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim()) {
      return;
    }

    // Persist new or updated client to client storage / database
    saveOrUpdateClientRecord({
      name: form.clientName.trim(),
      nit: form.nit.trim(),
      city: form.city.trim(),
      contactPerson: form.contactPerson.trim(),
    });

    onSave({
      ...form,
      budgetCOP: Number(form.budgetCOP) || 0,
      linkedQuote: selectedLinkedQuote,
    });
    onClose();
  };

  const isExistingClient = storedClients.some(
    (c) => c.name.toLowerCase().trim() === form.clientName.toLowerCase().trim()
  );

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-[#192b45] border border-purple-400/60 rounded-2xl max-w-4xl w-full shadow-2xl animate-scaleUp max-h-[90vh] flex flex-col overflow-hidden my-auto">
        <div className="px-4 py-3 border-b border-[#334d6e] flex items-center justify-between gap-3 bg-[#15253d] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white truncate">
                {editingClient ? 'Editar Cliente / Licitación' : 'Registrar Nuevo Cliente / Licitación'}
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                Datos del contrato, entidad contratante, valor total y enlace a cotizaciones
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#334d6e] rounded-lg transition cursor-pointer flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">Cerrar</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs scrollbar-thin bg-[#15253d]">
            {/* OPTION 1: LINK WITH A SAVED QUOTE */}
            {!editingClient && savedQuotes.length > 0 && (
              <div className="bg-[#0f1a2d] border border-cyan-500/40 rounded-xl p-3 space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-cyan-500/20 text-cyan-300 rounded-lg border border-cyan-500/30">
                      <Link2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>Enlazar con una Cotización ya Guardada</span>
                        <span className="text-[9.5px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded font-black border border-cyan-500/40">
                          {savedQuotes.length} disponibles
                        </span>
                      </h4>
                      <p className="text-[10.5px] text-slate-300">
                        Hereda automáticamente el cliente, valor presupuestal y lista de equipos biomédicos
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsLinkQuoteSectionOpen(!isLinkQuoteSectionOpen)}
                    className="inline-flex items-center gap-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 font-bold text-xs px-3 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    <span>{isLinkQuoteSectionOpen ? 'Ocultar Cotizaciones' : 'Seleccionar Cotización'}</span>
                    {isLinkQuoteSectionOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {selectedLinkedQuote && (
                  <div className="p-2.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div>
                        <span className="font-bold text-white text-xs">
                          Cotización {selectedLinkedQuote.quoteNumber} — {selectedLinkedQuote.clientName}
                        </span>
                        <p className="text-[10.5px] text-cyan-200 font-mono">
                          {selectedLinkedQuote.items?.length || 0} equipos | Total presupuestal cargado: {formatCOP(form.budgetCOP)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedLinkedQuote(null)}
                      className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/15 rounded-lg transition cursor-pointer"
                      title="Desvincular cotización"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {isLinkQuoteSectionOpen && (
                  <div className="p-3 bg-[#14233a] border border-[#2a4263] rounded-xl space-y-2 animate-fadeIn">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Buscar por N° cotización, cliente o ciudad..."
                        value={quoteSearchTerm}
                        onChange={(e) => setQuoteSearchTerm(e.target.value)}
                        className="w-full bg-[#0c1524] border border-[#334d6e] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                      {filteredSavedQuotes.length === 0 ? (
                        <p className="text-center text-slate-400 py-3 text-xs">No se encontraron cotizaciones coincidentes</p>
                      ) : (
                        filteredSavedQuotes.map((sq) => {
                          const totalQuoteCOP = sq.items?.reduce((acc, it) => acc + (it.totalSalePrice || 0), 0) || 0;
                          return (
                            <div
                              key={sq.id}
                              onClick={() => handleSelectQuoteToLink(sq)}
                              className="p-2 bg-[#1a2d47] hover:bg-cyan-950/40 border border-[#2d4970] hover:border-cyan-400 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-cyan-300 text-xs">{sq.quoteNumber}</span>
                                  <span className="text-white font-semibold truncate text-xs">{sq.clientName}</span>
                                </div>
                                <p className="text-[10px] text-slate-400">
                                  {sq.city || 'Sin ciudad'} • {sq.date || 'Sin fecha'} • {sq.items?.length || 0} ítems
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono font-bold text-emerald-400 text-xs block">
                                  {formatCOP(totalQuoteCOP)}
                                </span>
                                <span className="text-[10px] text-cyan-300 font-bold bg-cyan-500/20 px-1.5 py-0.5 rounded border border-cyan-500/30">
                                  Seleccionar
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Photo / Document OCR Scanning Zone */}
            <div className="bg-[#0f1a2d] border border-purple-500/40 rounded-xl p-3 space-y-2 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/30">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Lector Inteligente con Foto o Captura (OCR)</span>
                      <span className="text-[9.5px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-black border border-purple-500/40 flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5" />
                        IA Gemini
                      </span>
                    </h4>
                    <p className="text-[10.5px] text-slate-300">
                      Suba o pegue (Ctrl+V) una foto de la carátula contractual o SECOP II para autocompletar los campos y el valor
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isScanningImage}
                  className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{previewImage ? 'Subir otra Foto' : 'Subir o Pegar Foto'}</span>
                </button>
              </div>

              <input
                ref={imageInputRef}
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                onChange={(e) => e.target.files?.[0] && handleProcessImageFile(e.target.files[0])}
                className="hidden"
              />

              {/* Drag and Drop Zone or Preview Box */}
              {!previewImage ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => imageInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition flex items-center justify-center gap-2.5 ${
                    dragActive
                      ? 'border-purple-400 bg-purple-950/30'
                      : 'border-[#334d6e] hover:border-purple-400/80 bg-[#121e33] hover:bg-[#16253e]'
                  }`}
                >
                  <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-[11.5px] font-medium text-slate-300">
                    Arrastre una foto / captura aquí, haga clic para buscarla o presione <kbd className="px-1.5 py-0.5 bg-[#1b2b42] border border-[#3a5477] rounded text-white font-mono text-[10px]">Ctrl+V</kbd> para pegar
                  </span>
                </div>
              ) : (
                <div className="bg-[#14233a] border border-[#2a4263] rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={previewImage}
                      alt="Captura contrato"
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 object-cover rounded-lg border border-[#334d6e] shrink-0 bg-slate-900"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">Imagen procesada para extracción</p>
                      {isScanningImage ? (
                        <p className="text-[11px] text-purple-300 flex items-center gap-1.5 animate-pulse font-medium">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Analizando documento y extrayendo cuantía y datos...</span>
                        </p>
                      ) : scanSuccessMessage ? (
                        <p className="text-[11px] text-emerald-300 flex items-center gap-1 font-medium truncate">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>{scanSuccessMessage}</span>
                        </p>
                      ) : scanErrorMessage ? (
                        <p className="text-[11px] text-rose-300 flex items-center gap-1 font-medium truncate">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span>{scanErrorMessage}</span>
                        </p>
                      ) : (
                        <p className="text-[10.5px] text-slate-400">Datos procesados</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isScanningImage}
                      className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white bg-[#1e314b] hover:bg-[#284163] rounded-lg transition border border-[#334d6e]"
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewImage(null);
                        setScanSuccessMessage(null);
                        setScanErrorMessage(null);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition cursor-pointer"
                      title="Quitar foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Client / Entity Name with Autocomplete */}
              <div className="sm:col-span-2 relative" ref={clientDropdownRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-300 font-bold">Nombre de la Entidad / Cliente *</label>
                  {form.clientName.trim() && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        isExistingClient
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                      }`}
                    >
                      {isExistingClient ? '✓ Cliente existente en directorio' : '+ Nuevo cliente (se guardará automáticamente)'}
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Ej: Hospital Universitario San Ignacio, Clínica Las Américas..."
                    value={form.clientName}
                    onFocus={() => setShowClientSuggestions(true)}
                    onChange={(e) => {
                      setForm({ ...form, clientName: e.target.value });
                      setClientSearchFilter(e.target.value);
                      setShowClientSuggestions(true);
                    }}
                    className="w-full bg-[#111c2e] border border-[#334d6e] focus:border-purple-400 rounded-xl p-2.5 text-white font-bold outline-none text-sm pr-10"
                  />
                  {form.clientName && (
                    <button
                      type="button"
                      onClick={() => setShowClientSuggestions(!showClientSuggestions)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showClientSuggestions && matchingClients.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-[#14233a] border border-[#2a4263] rounded-xl shadow-2xl z-30 max-h-56 overflow-y-auto divide-y divide-[#233854] scrollbar-thin">
                    <div className="p-2 bg-[#0d1726] text-[10px] text-slate-400 font-bold flex items-center justify-between">
                      <span>CLIENTES REGISTRADOS ({matchingClients.length})</span>
                      <span>Clic para autocompletar NIT y ciudad</span>
                    </div>
                    {matchingClients.map((client) => (
                      <div
                        key={client.id}
                        onClick={() => handleSelectClientRecord(client)}
                        className="p-2.5 hover:bg-purple-950/40 hover:text-purple-200 cursor-pointer transition flex items-center justify-between text-xs"
                      >
                        <div>
                          <p className="font-bold text-white">{client.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            NIT: {client.nit || 'Sin NIT'} • Ciudad: {client.city || 'Bogotá D.C.'}
                          </p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                          Seleccionar
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">NIT de la Entidad</label>
                <input
                  type="text"
                  placeholder="Ej: 860.012.345-1"
                  value={form.nit}
                  onChange={(e) => setForm({ ...form, nit: e.target.value })}
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2 text-white font-mono outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">N° de Proceso / Convocatoria / Contrato</label>
                <input
                  type="text"
                  placeholder="Ej: LP-2026-045"
                  value={form.processNumber}
                  onChange={(e) => setForm({ ...form, processNumber: e.target.value })}
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2 text-purple-300 font-bold font-mono outline-none focus:border-purple-400"
                />
              </div>

              {/* Valor / Presupuesto Total del Contrato o Licitación */}
              <div className="sm:col-span-2 bg-[#101c2e] p-3 rounded-xl border border-emerald-500/40 space-y-1.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-emerald-300 font-bold flex items-center gap-1.5 text-xs">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <span>Valor Total del Contrato o Presupuesto Oficial ($ COP) *</span>
                  </label>
                  {cleanNumericString(form.budgetCOP) !== '' && cleanNumericString(form.budgetCOP) !== '0' && (
                    <span className="text-xs font-black text-emerald-300 font-mono">
                      {formatExactCOP(form.budgetCOP)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-emerald-400 text-sm">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={cleanNumericString(form.budgetCOP) === '0' || !cleanNumericString(form.budgetCOP) ? '' : cleanNumericString(form.budgetCOP)}
                    onChange={(e) => {
                      const sanitized = cleanNumericString(e.target.value);
                      setForm({
                        ...form,
                        budgetCOP: sanitized === '' ? 0 : Number(sanitized) || 0,
                      });
                    }}
                    className="w-full bg-[#0a1322] border border-[#334d6e] focus:border-emerald-400 rounded-xl pl-8 pr-3 py-2 text-white font-bold font-mono text-sm outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-400 font-bold">Valores rápidos:</span>
                  {[50000000, 100000000, 250000000, 500000000, 1000000000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm({ ...form, budgetCOP: val })}
                      className="text-[10px] px-2 py-0.5 rounded-lg bg-[#14233a] hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-[#2a4263] transition cursor-pointer font-mono"
                    >
                      ${(val / 1000000).toFixed(0)}M
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, budgetCOP: 0 })}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-[#14233a] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-[#2a4263] transition cursor-pointer"
                  >
                    Borrar
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Ciudad</label>
                <input
                  type="text"
                  placeholder="Ej: Bogotá D.C."
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2 text-white outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Modalidad del Proceso</label>
                <select
                  value={form.processType}
                  onChange={(e) => setForm({ ...form, processType: e.target.value })}
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2 text-white outline-none focus:border-purple-400 cursor-pointer"
                >
                  <option value="Licitación Pública">Licitación Pública</option>
                  <option value="Selección Abreviada">Selección Abreviada</option>
                  <option value="Convocatoria Privada">Convocatoria Privada</option>
                  <option value="Contratación Directa">Contratación Directa</option>
                  <option value="Subasta Inversa Electrónica">Subasta Inversa Electrónica</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-300 font-bold mb-1">Objeto del Contrato / Pliego</label>
                <textarea
                  rows={2}
                  placeholder="Ej: Adquisición, instalación y puesta en marcha de equipos biomédicos..."
                  value={form.contractObject}
                  onChange={(e) => setForm({ ...form, contractObject: e.target.value })}
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2.5 text-white outline-none focus:border-purple-400 text-xs resize-none"
                />
              </div>

              <div className="sm:col-span-2 bg-[#101b2c] p-2.5 rounded-xl border border-[#233a59]">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-200 font-bold flex items-center gap-1.5">
                    <span>⏱️ Tiempo / Plazo de Ejecución del Contrato</span>
                    {form.status === 'Adjudicada' && (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/40 font-bold">
                        ⭐ Vital para Contratos Adjudicados
                      </span>
                    )}
                  </label>
                  <span className="text-[10.5px] text-slate-400">Días, meses o fecha límite</span>
                </div>
                <input
                  type="text"
                  placeholder="Ej: 30 días calendario, 60 días hábiles, 6 meses, 1 año..."
                  value={form.executionTerm}
                  onChange={(e) => setForm({ ...form, executionTerm: e.target.value })}
                  className="w-full bg-[#0a1322] border border-[#334d6e] focus:border-purple-400 rounded-lg p-2 text-white font-medium outline-none text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Persona de Contacto</label>
                <input
                  type="text"
                  placeholder="Ej: Dr. Roberto Méndez"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2 text-white outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Estado del Proyecto</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2 text-white font-bold outline-none focus:border-purple-400 cursor-pointer"
                >
                  <option value="En Preparación">En Preparación</option>
                  <option value="Presentada">Presentada</option>
                  <option value="Adjudicada">⭐ Adjudicada (Sincroniza con Seguimiento de OC)</option>
                  <option value="Desierta">Desierta</option>
                  <option value="Cerrada">Cerrada</option>
                </select>
                {form.status === 'Adjudicada' && (
                  <p className="text-[10.5px] text-emerald-300 mt-1 flex items-center gap-1 font-medium">
                    <span>✓ Se creará automáticamente la Orden de Compra en el módulo de Seguimiento de OC.</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-[#111c2e] border-t border-[#334d6e] flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-lg active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>{editingClient ? 'Guardar Cambios' : 'Crear Cliente / Licitación'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

