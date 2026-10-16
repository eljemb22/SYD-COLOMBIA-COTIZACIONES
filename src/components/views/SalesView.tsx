import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileDown,
  Printer,
  CheckCircle2,
  FileText,
  SlidersHorizontal,
  RotateCcw,
  Upload,
  X,
  Plus,
  PlusCircle,
  BookOpen,
  Save,
  History,
  Check,
  Sparkles,
  Download,
  Loader2,
  Building2,
  Search,
  ChevronDown,
  AlertCircle,
  UserCheck,
  PackageCheck,
  Trash2,
} from 'lucide-react';
import { QuoteHeader, QuoteItem, MedicalEquipment, AuthUser, SavedQuote } from '../../types';
import { formatCOP, numberToSpanishWords } from '../../utils/formatters';
import { exportQuoteToWord } from '../../utils/exportUtils';
import { exportQuoteToPdf, printQuoteDocument } from '../../utils/pdfAndPrintUtils';
import {
  extractDateCode,
  getFormattedQuoteNumber,
  incrementConsecutive,
  setConsecutive,
  advanceFromCurrentQuoteNumber,
  getNextDailyQuoteNumber,
} from '../../utils/quoteConsecutive';
import { getStoredClients, searchClientDirectory, ClientRecord, saveOrUpdateClientRecord } from '../../utils/clientStorage';
import { getSavedQuotes } from '../../utils/quoteStorage';
import { DefaultDocumentSignature } from '../common/SyDLetterhead';
import { getOfficialSyDLetterheadDataUrl, OFFICIAL_SYD_LETTERHEAD_SVG_PATH } from '../../utils/sydDefaultLetterhead';
import { ClientDirectoryModal } from '../modals/ClientDirectoryModal';
import { chunkQuoteItemsForPages } from '../../utils/paginationUtils';
import confetti from 'canvas-confetti';
import { Lock, ShieldAlert, Users } from 'lucide-react';

interface SalesViewProps {
  quoteHeader: QuoteHeader;
  quoteItems: QuoteItem[];
  equipments: MedicalEquipment[];
  savedQuotes?: SavedQuote[];
  onLoadQuote?: (quote: SavedQuote) => void;
  customLetterheadUrl?: string | null;
  onUpdateLetterhead?: (url: string | null) => void;
  marginSettings?: { subirBajar: number; izqDer: number; tableScale: number };
  onUpdateMarginSettings?: (settings: { subirBajar: number; izqDer: number; tableScale: number }) => void;
  onUpdateHeader: (header: Partial<QuoteHeader>) => void;
  onUpdateItem: (id: string, updates: Partial<QuoteItem>) => void;
  onDeleteItem: (id: string) => void;
  onNavigateToCatalog: () => void;
  onNavigateToCostManager: () => void;
  onSaveQuote?: (customLetterheadUrl: string | null, marginSettings: { subirBajar: number; izqDer: number; tableScale: number }) => void;
  onNavigateToHistory?: () => void;
  onCreateNewQuote?: () => void;
  savedQuotesCount?: number;
  onConvertToSalesOrder?: (quote: SavedQuote | { header: QuoteHeader; items: QuoteItem[] }) => void;
  onConvertToTender?: (quote: SavedQuote | { header: QuoteHeader; items: QuoteItem[] }) => void;
  currentUser?: AuthUser | null;
  editingQuoteId?: string | null;
  onCancelEditQuote?: () => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  quoteHeader,
  quoteItems,
  equipments,
  savedQuotes: savedQuotesProp,
  onLoadQuote,
  customLetterheadUrl: customLetterheadUrlProp,
  onUpdateLetterhead,
  marginSettings: marginSettingsProp,
  onUpdateMarginSettings,
  onUpdateHeader,
  onNavigateToCatalog,
  onNavigateToCostManager,
  onSaveQuote,
  onNavigateToHistory,
  onCreateNewQuote,
  savedQuotesCount = 0,
  onConvertToSalesOrder,
  onConvertToTender,
  currentUser,
  editingQuoteId,
  onCancelEditQuote,
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canEditSales;
  const [isClientDirectoryOpen, setIsClientDirectoryOpen] = useState(false);
  const activeSavedQuotes = useMemo(() => {
    return savedQuotesProp && savedQuotesProp.length > 0 ? savedQuotesProp : getSavedQuotes();
  }, [savedQuotesProp]);

  // Margin / Calibration State (Defaults: 50px Top when blank without letterhead, 78px Lateral)
  const [localSubirBajar, setLocalSubirBajar] = useState<number>(() => {
    if (marginSettingsProp?.subirBajar !== undefined) {
      return marginSettingsProp.subirBajar;
    }
    // Clean blank sheet defaults to 50px top padding
    return 50;
  });
  const [localIzqDer, setLocalIzqDer] = useState<number>(marginSettingsProp?.izqDer ?? 78);
  const [localTableScale, setLocalTableScale] = useState<number>(marginSettingsProp?.tableScale ?? 85);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfProgressMsg, setPdfProgressMsg] = useState<string | null>(null);

  const subirBajar = marginSettingsProp ? marginSettingsProp.subirBajar : localSubirBajar;
  const izqDer = marginSettingsProp ? marginSettingsProp.izqDer : localIzqDer;
  const tableScale = marginSettingsProp ? marginSettingsProp.tableScale : localTableScale;

  const setSubirBajar = (val: number | ((prev: number) => number)) => {
    const nextVal = typeof val === 'function' ? val(subirBajar) : val;
    setLocalSubirBajar(nextVal);
    onUpdateMarginSettings?.({ subirBajar: nextVal, izqDer, tableScale });
  };

  const setIzqDer = (val: number | ((prev: number) => number)) => {
    const nextVal = typeof val === 'function' ? val(izqDer) : val;
    setLocalIzqDer(nextVal);
    onUpdateMarginSettings?.({ subirBajar, izqDer: nextVal, tableScale });
  };

  const setTableScale = (val: number | ((prev: number) => number)) => {
    const nextVal = typeof val === 'function' ? val(tableScale) : val;
    setLocalTableScale(nextVal);
    onUpdateMarginSettings?.({ subirBajar, izqDer, tableScale: nextVal });
  };

  // Unified Letterhead State (defaults to NULL: clean white sheet without letterhead)
  const [localLetterheadUrl, setLocalLetterheadUrl] = useState<string | null>(() => {
    if (customLetterheadUrlProp !== undefined && customLetterheadUrlProp !== null) {
      if (customLetterheadUrlProp === 'none') return null;
      return customLetterheadUrlProp;
    }
    try {
      const savedManual = localStorage.getItem('syd_custom_manual_letterhead');
      if (savedManual && savedManual.length > 20 && savedManual !== 'none' && !savedManual.includes('OFICIAL SYD COLOMBIA')) {
        return savedManual;
      }
      const saved = localStorage.getItem('syd_active_letterhead_url');
      if (saved && saved.length > 20 && saved !== 'none' && !saved.includes('OFICIAL SYD COLOMBIA')) {
        return saved;
      }
    } catch {}
    // Default to BLANK (no letterhead) - user must place it manually
    return null;
  });
  const customLetterheadUrl = customLetterheadUrlProp !== undefined ? customLetterheadUrlProp : localLetterheadUrl;

  // The effective letterhead URL: NULL by default (hoja en blanco), only shows if manually placed
  const effectiveLetterhead = useMemo(() => {
    if (!customLetterheadUrl || customLetterheadUrl === 'none' || customLetterheadUrl.trim() === '') {
      return null;
    }
    if (customLetterheadUrl.length > 20) {
      return customLetterheadUrl;
    }
    return null;
  }, [customLetterheadUrl]);

  const setCustomLetterheadUrl = (url: string | null) => {
    setLocalLetterheadUrl(url);
    try {
      if (url) {
        localStorage.setItem('syd_custom_manual_letterhead', url);
        localStorage.setItem('syd_active_letterhead_url', url);
        // If placing a letterhead and margin is low, calibrate up to standard 154px
        if (subirBajar <= 80) {
          setSubirBajar(154);
        }
      } else {
        localStorage.setItem('syd_active_letterhead_url', 'none');
        localStorage.removeItem('syd_custom_manual_letterhead');
        localStorage.removeItem('syd_permanent_default_letterhead');
        // If removing letterhead, calibrate down to standard clean 50px
        if (subirBajar >= 130) {
          setSubirBajar(50);
        }
      }
    } catch (e) {
      console.error(e);
    }
    onUpdateLetterhead?.(url);
  };

  const handleRemoveLetterhead = () => {
    setCustomLetterheadUrl(null);
    setSaveSuccessMsg('Membrete removido. La cotización está en blanco limpia sin membrete.');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const letterheadFileInputRef = useRef<HTMLInputElement | null>(null);

  // Financial calculations
  const totalQuantity = quoteItems.reduce((acc, it) => acc + it.quantity, 0);
  const subtotal = quoteItems.reduce((acc, it) => acc + it.totalSalePrice, 0);
  const iva = quoteItems.reduce((acc, it) => {
    const rate = it.taxExempt ? 0 : (it.taxRate !== undefined ? it.taxRate : (quoteHeader.taxRate ?? 0.19));
    return acc + Math.round(it.totalSalePrice * rate);
  }, 0);
  const total = subtotal + iva;
  const totalWords = numberToSpanishWords(total);

  // Client Directory state for autocomplete & live search
  const [storedClients, setStoredClients] = useState<ClientRecord[]>(() => getStoredClients());
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [clientNameError, setClientNameError] = useState(false);
  const [tableEmptyError, setTableEmptyError] = useState(false);
  const [validationErrorMessage, setValidationErrorMessage] = useState<string | null>(null);
  const clientInputContainerRef = useRef<HTMLDivElement | null>(null);

  // Close client dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        clientInputContainerRef.current &&
        !clientInputContainerRef.current.contains(e.target as Node)
      ) {
        setShowClientDropdown(false);
        setClientSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const matchingClients = useMemo(() => {
    const effectiveQuery = clientSearchQuery.trim() ? clientSearchQuery : quoteHeader.clientName;
    return searchClientDirectory(effectiveQuery, storedClients);
  }, [clientSearchQuery, quoteHeader.clientName, storedClients]);

  const handleSelectClient = (client: ClientRecord) => {
    const formattedLocation = client.city
      ? (client.department ? `${client.city}, ${client.department}` : client.city)
      : (client.department || '');

    onUpdateHeader({
      clientName: client.name,
      city: formattedLocation || quoteHeader.city || '',
      nit: client.nit ? client.nit.trim() : '',
      contactPerson: client.contactPerson ? client.contactPerson.trim() : '',
      contactEmail: client.contactEmail ? client.contactEmail.trim() : '',
      contactPhone: client.contactPhone ? client.contactPhone.trim() : '',
    });
    setClientNameError(false);
    setValidationErrorMessage(null);
    setClientSearchQuery('');
    setShowClientDropdown(false);
  };

  const handleCreateNewClientFromInput = (rawName: string) => {
    const clean = rawName.trim();
    if (!clean) return;

    // Reset client specific fields so the new client starts totally clean without inheriting previous client data
    onUpdateHeader({
      clientName: clean,
      nit: '',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
      city: quoteHeader.city || '',
    });
    setClientNameError(false);
    setValidationErrorMessage(null);
    setClientSearchQuery('');
    setShowClientDropdown(false);
  };

  // Validate quote before saving
  const validateQuoteBeforeSave = (): boolean => {
    const cleanClient = (quoteHeader.clientName || '').trim();
    const isBlankClient =
      !cleanClient ||
      cleanClient.toUpperCase() === 'NOMBRE DEL CLIENTE O INSTITUCIÓN' ||
      cleanClient.toUpperCase() === 'CLIENTE NO ESPECIFICADO';

    if (isBlankClient) {
      setClientNameError(true);
      setValidationErrorMessage('⚠️ Para guardar la cotización, primero debe ingresar el Nombre de la Institución o Cliente.');
      const clientInput = document.getElementById('quote-client-name-input');
      if (clientInput) {
        clientInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        clientInput.focus();
      }
      setTimeout(() => setValidationErrorMessage(null), 6000);
      return false;
    }

    const validItems = (quoteItems || []).filter(
      (it) =>
        (it.name && it.name.trim() !== '') ||
        (it.code && it.code.trim() !== '') ||
        (it.totalSalePrice && it.totalSalePrice > 0)
    );

    if (validItems.length === 0) {
      setTableEmptyError(true);
      setValidationErrorMessage('⚠️ Debe ingresar al menos un equipo o ítem con datos en la tabla de cotización antes de guardar.');
      const tableElem = document.getElementById('quote-items-table-container');
      if (tableElem) {
        tableElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setTimeout(() => setValidationErrorMessage(null), 6000);
      return false;
    }

    setClientNameError(false);
    setTableEmptyError(false);
    setValidationErrorMessage(null);
    return true;
  };

  // Handle Save and Create New Quote: Saves current quote AND generates a fresh new quote
  const handleSaveCurrentQuote = () => {
    if (!validateQuoteBeforeSave()) return;

    if (onSaveQuote) {
      const savedNum = quoteHeader.quoteNumber;
      onSaveQuote(customLetterheadUrl, {
        subirBajar,
        izqDer,
        tableScale,
      });

      setStoredClients(getStoredClients());

      confetti({
        particleCount: 50,
        spread: 70,
        origin: { y: 0.7 },
      });

      // Automatically generate clean new quote as requested by user
      if (onCreateNewQuote) {
        onCreateNewQuote();
      }

      setSaveSuccessMsg(`¡Cotización N° ${savedNum} guardada exitosamente! Se ha preparado una nueva cotización en blanco.`);
      setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 5000);
    }
  };

  // Handle Save Only Changes: Updates existing quote in place without clearing the screen
  const handleSaveOnlyChanges = () => {
    if (!validateQuoteBeforeSave()) return;

    if (onSaveQuote) {
      const savedNum = quoteHeader.quoteNumber;
      onSaveQuote(customLetterheadUrl, {
        subirBajar,
        izqDer,
        tableScale,
      });

      setStoredClients(getStoredClients());

      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
      });

      setSaveSuccessMsg(`¡Cambios de la Cotización N° ${savedNum} guardados exitosamente en la base de datos!`);
      setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 5000);
    }
  };

  // Handle Save Draft without resetting
  const handleSaveDraftOnly = () => {
    if (!validateQuoteBeforeSave()) return;

    if (onSaveQuote) {
      const savedNum = quoteHeader.quoteNumber;
      onSaveQuote(customLetterheadUrl, {
        subirBajar,
        izqDer,
        tableScale,
      });

      setStoredClients(getStoredClients());

      confetti({
        particleCount: 30,
        spread: 50,
        origin: { y: 0.7 },
      });

      setSaveSuccessMsg(`¡Cotización N° ${savedNum} guardada en base de datos! Puede continuar editándola.`);
      setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 5000);
    }
  };

  // Handle Date change and automatically adjust daily consecutive if date code changes
  const handleDateChange = (newDateStr: string) => {
    const newDateCode = extractDateCode(newDateStr);
    const currentDateCode = extractDateCode(quoteHeader.date);

    if (newDateCode !== currentDateCode) {
      // Switched to a different day -> auto-format to new date's consecutive (starts at -1)
      const newQuoteNum = getFormattedQuoteNumber(newDateCode);
      onUpdateHeader({ date: newDateStr, quoteNumber: newQuoteNum });
    } else {
      onUpdateHeader({ date: newDateStr });
    }
  };

  // Next consecutive (+1) (e.g., 18082026-2 -> 18082026-3)
  const handleNextConsecutive = () => {
    const nextQuoteNum = advanceFromCurrentQuoteNumber(quoteHeader.quoteNumber);
    onUpdateHeader({ quoteNumber: nextQuoteNum });
  };

  // Reset consecutive back to -1 for the current date
  const handleResetConsecutive = () => {
    const dateCode = extractDateCode(quoteHeader.date);
    const resetQuoteNum = setConsecutive(dateCode, 1);
    onUpdateHeader({ quoteNumber: resetQuoteNum });
  };

  const handleExportWord = async () => {
    await exportQuoteToWord(quoteHeader, quoteItems, {
      headerMarginTop: subirBajar,
      sidePadding: izqDer,
      companyLetterheadUrl: effectiveLetterhead || undefined,
    });
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.8 },
    });
  };

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    try {
      setIsExportingPdf(true);
      setPdfProgressMsg('Preparando documento en alta resolución...');
      await exportQuoteToPdf(quoteHeader.quoteNumber, (msg) => {
        setPdfProgressMsg(msg);
      });
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      alert('Hubo un inconveniente al generar el PDF. Asegúrese de que todas las páginas estén visibles.');
    } finally {
      setIsExportingPdf(false);
      setPdfProgressMsg(null);
    }
  };

  const handlePrint = () => {
    printQuoteDocument();
  };

  // Unified single letterhead uploader
  const handleLetterheadImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        if (url) {
          setCustomLetterheadUrl(url);
          setSaveSuccessMsg('¡Membrete fijado y guardado como membrete permanente para todas las cotizaciones y exportaciones a Word!');
          confetti({
            particleCount: 45,
            spread: 65,
            origin: { y: 0.75 },
          });
          setTimeout(() => {
            setSaveSuccessMsg(null);
          }, 5000);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Window-level Ctrl+V listener: captures image pasted from clipboard in SalesView
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const isTypingText =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const url = event.target?.result as string;
              if (url) {
                setCustomLetterheadUrl(url);
                setSaveSuccessMsg('¡Membrete / Logo pegado exitosamente mediante Ctrl + V!');
                confetti({
                  particleCount: 50,
                  spread: 70,
                  origin: { y: 0.75 },
                });
                setTimeout(() => setSaveSuccessMsg(null), 5000);
              }
            };
            reader.readAsDataURL(file);
          }
          return;
        }
      }

      if (!isTypingText) {
        const text = e.clipboardData?.getData('text')?.trim();
        if (text && (text.startsWith('http') || text.startsWith('data:image/')) && /\.(png|jpe?g|webp|svg|gif)($|\?)/i.test(text)) {
          e.preventDefault();
          setCustomLetterheadUrl(text);
          setSaveSuccessMsg('¡Imagen de membrete cargada exitosamente desde URL pegada!');
          confetti({
            particleCount: 40,
            spread: 60,
            origin: { y: 0.75 },
          });
          setTimeout(() => setSaveSuccessMsg(null), 5000);
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [setCustomLetterheadUrl]);

  // Dynamic style calculations based on tableScale (uniform font size across headers, items and prices)
  const fontSize = Math.max(9.5, ((tableScale / 100) * 11.5)).toFixed(1);
  const headerFontSize = fontSize;
  const subTextFontSize = Math.max(8, ((tableScale / 100) * 9.5)).toFixed(1);
  const cellPaddingY = tableScale < 75 ? '4px' : tableScale < 90 ? '6px' : '8px';
  const cellPaddingX = tableScale < 75 ? '5px' : tableScale < 90 ? '7px' : '10px';

  // Dynamically paginate quote items into Letter-sized pages so the table never stretches the page
  const tablePages = useMemo(() => {
    return chunkQuoteItemsForPages(quoteItems, subirBajar, Number(fontSize));
  }, [quoteItems, subirBajar, fontSize]);

  const lastTableChunk = tablePages[tablePages.length - 1];
  const hasStandaloneConditionsPage = !lastTableChunk?.canFitConditions;
  const totalPagesCount = 1 + tablePages.length + (hasStandaloneConditionsPage ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        type="file"
        ref={letterheadFileInputRef}
        onChange={handleLetterheadImageUpload}
        accept="image/*"
        className="hidden"
      />

      {/* TOP CONTROL PANEL */}
      <div
        id="sales-view-top-control-panel"
        className="border border-[#334d6e] rounded-2xl p-4 sm:p-5 shadow-xl relative transition-all"
        style={{
          backgroundColor: 'var(--syd-card-bg, #15253d)',
        }}
      >
        {/* Banner for ReadOnly / Investigator Mode */}
        {isReadOnly && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                <strong>Modo Consulta &amp; Descarga Activo (Usuario Investigador):</strong> Puede consultar la propuesta y descargar la cotización en <strong>Word (.docx)</strong> o <strong>Imprimir</strong>. La edición de textos, datos del cliente y precios está restringida al usuario Administrador.
              </span>
            </div>
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md text-[10px] font-bold border border-emerald-500/40 uppercase whitespace-nowrap">
              Solo Descargas
            </span>
          </div>
        )}

        {/* Banner for Quote Editing Mode */}
        {editingQuoteId && !isReadOnly && (
          <div className="mb-4 p-3 bg-amber-500/15 border border-amber-500/40 rounded-xl text-amber-200 text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-base">✏️</span>
              <span>
                <strong>Modo Modificación Activo:</strong> Editando la Cotización N° <span className="font-mono font-black text-amber-300 underline">{quoteHeader.quoteNumber}</span>. Al guardar cambios se actualizará esta cotización en la base de datos.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onCancelEditQuote) onCancelEditQuote();
                else if (onCreateNewQuote) onCreateNewQuote();
              }}
              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 hover:text-white rounded-lg text-[11px] font-bold border border-amber-500/40 transition cursor-pointer shrink-0"
              title="Salir de la edición de esta cotización y comenzar una nueva cotización en blanco"
            >
              Cancelar Edición / Nueva Cotización
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-[#334d6e]">
          {/* GRUPO 1: GESTIÓN DE COTIZACIÓN Y CLIENTES */}
          <div className="flex items-center gap-2 flex-wrap">
            {!isReadOnly && (
              editingQuoteId ? (
                <>
                  <button
                    id="btn-save-changes-quote"
                    onClick={handleSaveOnlyChanges}
                    title="Guardar los cambios efectuados a esta cotización en la base de datos"
                    className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-[11.5px] px-3 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar Cambios</span>
                  </button>

                  <button
                    id="btn-save-changes-and-new-quote"
                    onClick={handleSaveCurrentQuote}
                    title="Guardar cambios a esta cotización y preparar inmediatamente una nueva cotización en blanco"
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11.5px] px-3 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Guardar Cambios y Nueva Cotización</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    id="btn-save-quote-db"
                    onClick={handleSaveCurrentQuote}
                    title="Guardar esta cotización en la base de datos y preparar una nueva cotización en blanco"
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11.5px] px-3 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Guardar y nueva</span>
                  </button>

                  <button
                    id="btn-save-draft-quote"
                    onClick={handleSaveDraftOnly}
                    title="Guardar esta cotización sin limpiar los datos de la pantalla"
                    className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold text-[11.5px] px-3 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar Borrador</span>
                  </button>
                </>
              )
            )}

            <button
              id="btn-open-client-directory"
              onClick={() => setIsClientDirectoryOpen(true)}
              title="Abrir directorio general de clientes, consultar cotizaciones asociadas y cargar datos a la cotización"
              className="inline-flex items-center gap-1.5 bg-[#15253d] hover:bg-[#1f375b] text-[#38bdf8] border border-[#38bdf8]/40 hover:border-[#38bdf8] text-[11.5px] font-medium px-3 py-1.5 rounded-lg transition cursor-pointer shadow-sm"
            >
              <Users className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Directorio Clientes</span>
            </button>
          </div>

          {/* GRUPO 2: MEMBRETE Y HOJA EN BLANCO */}
          {!isReadOnly && (
            <div className="flex items-center gap-2 flex-wrap">
              {effectiveLetterhead ? (
                <>
                  <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold px-2.5 py-1.5 rounded-lg shadow-2xs">
                    <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                    <span>Membrete Manual Activo</span>
                  </div>
                  <button
                    id="btn-remove-letterhead"
                    type="button"
                    onClick={handleRemoveLetterhead}
                    title="Quitar el membrete actual de la cotización y dejar la hoja blanca limpia"
                    className="inline-flex items-center gap-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Quitar (Dejar en Blanco)</span>
                  </button>
                  <button
                    id="btn-upload-letterhead"
                    type="button"
                    onClick={() => letterheadFileInputRef.current?.click()}
                    title="Cambiar la imagen del membrete o presionar Ctrl + V para pegar desde el portapapeles"
                    className="inline-flex items-center gap-1 bg-[#15253d] hover:bg-[#1f375b] text-sky-300 border border-[#38bdf8]/40 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Cambiar (Ctrl+V)</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="inline-flex items-center gap-1.5 bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px] font-medium px-2.5 py-1.5 rounded-lg">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sin Membrete (Hoja en Blanco)</span>
                  </div>
                  <button
                    id="btn-upload-manual-letterhead"
                    type="button"
                    onClick={() => letterheadFileInputRef.current?.click()}
                    title="Cargar manualmente una imagen de membrete desde su equipo (PNG, JPG, SVG) o pegarla con Ctrl + V"
                    className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold text-[11.5px] px-3 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Colocar Membrete Manual (Ctrl+V)</span>
                  </button>
                  <button
                    id="btn-restore-letterhead"
                    type="button"
                    onClick={() => {
                      const official = getOfficialSyDLetterheadDataUrl() || OFFICIAL_SYD_LETTERHEAD_SVG_PATH;
                      setCustomLetterheadUrl(official);
                      setSaveSuccessMsg('Membrete oficial SYD colocado en la cotización.');
                      setTimeout(() => setSaveSuccessMsg(null), 3500);
                    }}
                    title="Cargar el membrete oficial corporativo prediseñado de SYD Colombia"
                    className="inline-flex items-center gap-1 bg-[#15253d] hover:bg-[#1f375b] text-slate-300 hover:text-white border border-slate-600/60 text-[11px] font-medium px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    <span>Cargar Membrete Oficial</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* GRUPO 3: EXPORTACIÓN E IMPRESIÓN */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-export-word-main"
              onClick={handleExportWord}
              title="Descargar cotización en formato Microsoft Word (.docx)"
              className="inline-flex items-center gap-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white font-semibold text-[11.5px] px-3 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Word (.docx)</span>
            </button>

            <button
              id="btn-export-pdf-main"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className={`inline-flex items-center gap-1.5 ${
                isExportingPdf
                  ? 'bg-rose-700 text-white cursor-wait opacity-90'
                  : 'bg-[#e11d48] hover:bg-[#be123c] text-white cursor-pointer'
              } font-semibold text-[11.5px] px-3 py-1.5 rounded-lg shadow-sm transition`}
              title="Descargar cotización en formato PDF idéntico a las hojas"
            >
              {isExportingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isExportingPdf ? 'Generando...' : 'Descargar PDF'}</span>
            </button>

            <button
              id="btn-print-main"
              onClick={handlePrint}
              title="Imprimir cotización"
              className="inline-flex items-center gap-1.5 bg-[#1e314b] hover:bg-[#253e60] text-slate-200 border border-[#334d6e] text-[11.5px] font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* PDF EXPORT PROGRESS TOAST */}
        {isExportingPdf && pdfProgressMsg && (
          <div className="mt-3 p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
              <Loader2 className="w-4 h-4 text-rose-400 animate-spin" />
              <span>{pdfProgressMsg}</span>
            </div>
            <span className="text-[11px] text-rose-300/80 font-mono">
              Procesando 3 páginas...
            </span>
          </div>
        )}

        {/* VALIDATION ERROR NOTIFICATION TOAST BANNER */}
        {validationErrorMessage && (
          <div className="mt-3 p-3.5 bg-red-500/20 border-2 border-red-500 rounded-xl flex items-center justify-between animate-bounce shadow-lg">
            <div className="flex items-center gap-2.5 text-xs font-bold text-red-200">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span className="text-sm font-black">{validationErrorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setValidationErrorMessage(null)}
              className="text-xs font-bold text-red-300 hover:text-white px-2 py-1 bg-red-900/50 rounded-lg cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* SUCCESS NOTIFICATION TOAST BANNER */}
        {saveSuccessMsg && (
          <div className="mt-3 p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{saveSuccessMsg}</span>
            </div>
            {onNavigateToHistory && (
              <button
                onClick={onNavigateToHistory}
                className="text-xs font-bold text-emerald-400 hover:text-white underline cursor-pointer"
              >
                Ver en la Base de Cotizaciones →
              </button>
            )}
          </div>
        )}

        {/* CALIBRATION SLIDERS (Subir / Bajar, Márgenes Laterales y Tamaño de Tabla) */}
        <div
          className="mt-4 pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-xl border border-[#334d6e]/70"
          style={{
            backgroundColor: 'var(--syd-sidebar-bg, #111c2e)',
          }}
        >
          {/* SLIDER 1: SUBIR / BAJAR */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#38bdf8]" />
                Margen Superior (Subir / Bajar):
              </span>
              <span className="font-mono text-[#38bdf8] font-bold bg-[#1e314b] px-2 py-0.5 rounded border border-[#334d6e]">
                {subirBajar} px
              </span>
            </div>
            <input
              id="slider-subir-bajar"
              type="range"
              min="40"
              max="260"
              step="2"
              value={subirBajar}
              onChange={(e) => setSubirBajar(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[#38bdf8]"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>40px (Arriba)</span>
              <span>140px (Estándar)</span>
              <span>260px (Abajo)</span>
            </div>
          </div>

          {/* SLIDER 2: IZQ / DER */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                Márgenes Laterales (Izq / Der):
              </span>
              <span className="font-mono text-amber-400 font-bold bg-[#1e314b] px-2 py-0.5 rounded border border-[#334d6e]">
                {izqDer} px
              </span>
            </div>
            <input
              id="slider-izq-der"
              type="range"
              min="20"
              max="120"
              step="2"
              value={izqDer}
              onChange={(e) => setIzqDer(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>20px (Ancho)</span>
              <span>50px (Estándar)</span>
              <span>120px (Estrecho)</span>
            </div>
          </div>

          {/* SLIDER 3: TAMAÑO / REGULADOR DE TABLA */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-bold flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                Tamaño / Escala de Tabla:
              </span>
              <span className="font-mono text-emerald-400 font-bold bg-[#1e314b] px-2 py-0.5 rounded border border-[#334d6e]">
                {tableScale}% {tableScale <= 75 ? '(Compacta)' : tableScale <= 90 ? '(Media)' : '(Grande)'}
              </span>
            </div>
            <input
              id="slider-table-scale"
              type="range"
              min="65"
              max="100"
              step="5"
              value={tableScale}
              onChange={(e) => setTableScale(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>65% (Compacta)</span>
              <span>85% (Recomendada)</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Quick Reset */}
        <div className="mt-3 flex justify-end text-xs">
          <button
            onClick={() => {
              setSubirBajar(154);
              setIzqDer(78);
              setTableScale(85);
            }}
            className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 hover:underline cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Restablecer valores predeterminados (154px / 78px)
          </button>
        </div>
      </div>

      {/* DOCUMENT PREVIEW CONTAINER (3 HOJAS DE WORD) */}
      <div className="relative z-0 flex flex-col items-center space-y-12">
        {/* ========================================================================= */}
        {/* ======================= HOJA 1: CARTA DE PRESENTACIÓN ================== */}
        {/* ========================================================================= */}
        <div className="w-full max-w-[850px]">
          <div className="flex items-center justify-between px-3 py-1.5 mb-2 text-xs text-slate-400">
            <span className="font-bold uppercase tracking-wider text-[#38bdf8] flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              Página 1 de {totalPagesCount} — Presentación SYD Colombia
            </span>
            <span>Formato Carta (Letter)</span>
          </div>

          <div
            id="hoja-word-1"
            data-printable-sheet="true"
            className="relative z-0 bg-white text-slate-900 rounded-lg shadow-2xl overflow-hidden min-h-[1100px] border border-slate-300 print:border-none print:shadow-none print:m-0 commercial-quote-sheet print-paper word-document-page"
            style={{
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
            }}
          >
            {/* MEMBRETE CUBRIENDO TODA LA HOJA */}
            {effectiveLetterhead ? (
              <div className="absolute inset-0 w-full h-full pointer-events-none z-0 select-none print:w-full print:h-full overflow-hidden">
                <img
                  src={effectiveLetterhead}
                  alt="Membrete Hoja 1"
                  className="w-full h-full object-fill pointer-events-none z-0 select-none print:w-full print:h-full"
                />
              </div>
            ) : null}

            {/* DOCUMENT CONTENT */}
            <div
              className="relative z-1 font-sans text-[13.5px] leading-relaxed text-slate-900"
              style={{
                paddingTop: `${subirBajar}px`,
                paddingLeft: `${izqDer}px`,
                paddingRight: `${izqDer}px`,
                paddingBottom: '60px',
              }}
            >
              {/* Date */}
              <div className="mb-6">
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={quoteHeader.date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className={`w-full font-medium text-slate-800 ${isReadOnly ? 'cursor-default bg-transparent' : 'hover:bg-slate-100/70 focus:bg-white'} px-1.5 py-0.5 rounded outline-none transition`}
                  placeholder="Ciudad y Fecha (ej: Barranquilla, 28 febrero de 2026)"
                />
              </div>

              {/* Client Info with Intelligent Dropdown Autocomplete */}
              <div ref={clientInputContainerRef} className="mb-6 space-y-1 relative">
                <p className="text-slate-700 font-semibold">Señor(es):</p>

                <div className="relative">
                  <input
                    id="quote-client-name-input"
                    type="text"
                    disabled={isReadOnly}
                    value={quoteHeader.clientName}
                    onFocus={() => setShowClientDropdown(true)}
                    onChange={(e) => {
                      onUpdateHeader({ clientName: e.target.value });
                      setClientNameError(false);
                      setShowClientDropdown(true);
                    }}
                    className={`w-full font-bold text-[15px] uppercase tracking-wide text-slate-950 ${
                      clientNameError
                        ? 'bg-red-50 border-2 border-red-500 ring-2 ring-red-400/50 animate-pulse'
                        : isReadOnly
                        ? 'cursor-default bg-transparent'
                        : 'hover:bg-slate-100/70 focus:bg-white border border-transparent focus:border-sky-400'
                    } px-1.5 py-0.5 rounded outline-none transition`}
                    placeholder="NOMBRE DEL CLIENTE O INSTITUCIÓN"
                  />

                  {clientNameError && (
                    <div className="mt-1 text-[11px] font-bold text-red-600 flex items-center gap-1 bg-red-100/90 border border-red-300 rounded px-2 py-0.5 animate-fadeIn">
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      <span>⚠️ Por favor ingrese o seleccione el nombre del cliente aquí para continuar</span>
                    </div>
                  )}

                  {/* Autocomplete Dropdown floating menu with built-in search */}
                  {showClientDropdown && !isReadOnly && (
                    <div className="absolute top-full left-0 z-50 mt-1 w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-300 overflow-hidden animate-fadeIn text-left select-none">
                      {/* Search header inside dropdown */}
                      <div className="p-2 bg-slate-50 border-b border-slate-200">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={clientSearchQuery}
                            onChange={(e) => setClientSearchQuery(e.target.value)}
                            placeholder="Buscar cliente por nombre, NIT, municipio o departamento..."
                            className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            autoFocus
                          />
                          {clientSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setClientSearchQuery('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer text-xs font-bold w-4 h-4 flex items-center justify-center rounded-full hover:bg-slate-200"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Option to insert as brand new client */}
                      {(clientSearchQuery.trim() || quoteHeader.clientName.trim()) && (
                        <div className="p-1.5 bg-sky-50/60 border-b border-sky-100">
                          <button
                            type="button"
                            onClick={() => handleCreateNewClientFromInput(clientSearchQuery.trim() || quoteHeader.clientName.trim())}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white hover:bg-sky-100/80 text-sky-900 transition flex items-center justify-between gap-2 cursor-pointer border border-sky-200 shadow-2xs font-semibold text-xs"
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <Plus className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              <span>Establecer <strong>&quot;{(clientSearchQuery.trim() || quoteHeader.clientName.trim()).toUpperCase()}&quot;</strong> como cliente nuevo</span>
                            </span>
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold shrink-0">
                              Datos limpios / pendientes
                            </span>
                          </button>
                        </div>
                      )}

                      <div className="max-h-52 overflow-y-auto p-1 space-y-0.5 scrollbar-thin">
                        {matchingClients.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">
                            No se encontraron clientes registrados que coincidan. Puede ingresarlo como un nuevo cliente.
                          </div>
                        ) : (
                          matchingClients.map((client) => {
                            const locationLabel = client.city
                              ? (client.department ? `${client.city}, ${client.department}` : client.city)
                              : (client.department || 'Colombia');

                            return (
                              <button
                                key={client.id}
                                type="button"
                                onClick={() => handleSelectClient(client)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-sky-50 text-slate-900 transition flex flex-col cursor-pointer border border-transparent hover:border-sky-200"
                              >
                                <span className="font-bold text-xs text-slate-950 uppercase tracking-tight">
                                  {client.name}
                                </span>
                                <div className="flex items-center gap-2 text-[10.5px] text-slate-500 mt-0.5 flex-wrap">
                                  {client.nit && (
                                    <span className="font-mono bg-slate-100 px-1 py-0.2 rounded text-slate-700 font-semibold">
                                      NIT: {client.nit}
                                    </span>
                                  )}
                                  <span className="text-slate-700 font-medium bg-sky-50 text-sky-800 px-1.5 py-0.2 rounded border border-sky-200">
                                    📍 {locationLabel}
                                  </span>
                                  {client.contactPerson && (
                                    <span className="truncate max-w-[200px] text-slate-500">
                                      👤 {client.contactPerson}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <input
                  type="text"
                  disabled={isReadOnly}
                  value={quoteHeader.city}
                  onChange={(e) => onUpdateHeader({ city: e.target.value })}
                  className={`w-full text-slate-700 ${isReadOnly ? 'cursor-default bg-transparent' : 'hover:bg-slate-100/70 focus:bg-white'} px-1.5 py-0.5 rounded outline-none transition`}
                  placeholder="Ciudad, Departamento"
                />
              </div>

              {/* Subject & Number (Exact matching style with smart consecutive buttons from image) */}
              <div className="flex flex-col items-end mb-6">
                <p className="font-bold text-slate-900 text-[14px] text-right mb-1">
                  Asunto: Cotización Comercial
                </p>
                <div className="flex items-center justify-end gap-2 text-slate-900 font-bold">
                  <span className="text-[15px] font-bold text-slate-900">N°:</span>
                  <input
                    type="text"
                    disabled={isReadOnly}
                    value={quoteHeader.quoteNumber}
                    onChange={(e) => onUpdateHeader({ quoteNumber: e.target.value })}
                    className={`w-36 sm:w-40 font-bold text-center text-[15px] text-slate-950 bg-white ${isReadOnly ? 'cursor-default opacity-90' : 'hover:bg-slate-50 focus:bg-white'} px-2.5 py-1 rounded-md border border-slate-300 focus:border-[#0284c7] focus:ring-1 focus:ring-[#0284c7] outline-none shadow-2xs tracking-tight transition`}
                    placeholder="18082026-1"
                    title="Número consecutivo diario DDMMAAAA-N"
                  />
                  {/* Consecutive is handled automatically */}
                </div>
              </div>

              {/* Greeting */}
              <p className="font-bold mb-4 text-slate-900">Cordial Saludo:</p>

              {/* Presentation Body Paragraphs matching exact image */}
              <div className="space-y-4 text-justify text-slate-800 leading-[1.65]">
                <p>
                  <strong>SUMINISTROS Y DOTACIONES COLOMBIA S.A.</strong> presentamos a su consideración la propuesta para la adquisición de equipos, insumos y material médico, cuya descripción y demás condiciones de venta están incorporadas a la presente cotización.
                </p>

                <p>
                  <strong>SYD COLOMBIA S.A.</strong> distribuye en el país a algunas de las más importantes empresas fabricantes de medicamentos, insumos y dispositivos médicos del mundo, situación que avala su seriedad y profesionalismo en este campo.
                </p>

                <p>
                  Contamos con personal calificado para brindarle una asesoría integral en todas las etapas de su adquisición, de manera que usted pueda satisfacer sus necesidades. Disponemos además de personal técnico, cuyos conocimientos incluyen una excelente preparación teórica y experiencia en el campo, lo que nos permite brindar una oportuna atención a todos nuestros clientes.
                </p>

                <p>
                  En caso de optar por nuestra propuesta, podrá estar seguro de que tendrá todo el respaldo que da nuestra amplia trayectoria a nivel nacional, bajo un marco de honestidad, calidad y profesionalismo. La expedición de la orden de compra mediante la cual se acepta la presente oferta mercantil supone el conocimiento y aceptación expresa de las condiciones contempladas en ella.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ======================= HOJAS DE TABLA DE EQUIPOS Y PRECIOS ============= */}
        {/* ========================================================================= */}
        {tablePages.map((pageChunk) => {
          const isSingleTablePage = tablePages.length === 1;
          const pageTitle = pageChunk.canFitConditions
            ? `Página ${pageChunk.globalPageNumber} de ${totalPagesCount} — Tabla de Equipos, Condiciones Comerciales y Firma`
            : isSingleTablePage
            ? `Página 2 de ${totalPagesCount} — Tabla de Equipos y Precios`
            : `Página ${pageChunk.globalPageNumber} de ${totalPagesCount} — Tabla de Equipos y Precios (Parte ${pageChunk.pageNumber} de ${tablePages.length})`;

          return (
            <div key={`table-page-${pageChunk.pageIndex}`} className="w-full max-w-[850px]">
              <div className="flex items-center justify-between px-3 py-1.5 mb-2 text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider text-[#38bdf8] flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  {pageTitle}
                </span>
                <span>Escala: {tableScale}%</span>
              </div>

              <div
                id={`hoja-word-${pageChunk.globalPageNumber}`}
                data-printable-sheet="true"
                className="relative z-0 bg-white text-slate-900 rounded-lg shadow-2xl overflow-hidden min-h-[1056px] h-[1056px] border border-slate-300 print:border-none print:shadow-none print:m-0 commercial-quote-sheet print-paper word-document-page flex flex-col justify-between"
                style={{
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
                }}
              >
                {/* MEMBRETE CUBRIENDO TODA LA HOJA */}
                {effectiveLetterhead ? (
                  <div className="absolute inset-0 w-full h-full pointer-events-none z-0 select-none print:w-full print:h-full overflow-hidden">
                    <img
                      src={effectiveLetterhead}
                      alt={`Membrete Hoja ${pageChunk.globalPageNumber}`}
                      className="w-full h-full object-fill pointer-events-none z-0 select-none print:w-full print:h-full"
                    />
                  </div>
                ) : null}

                {/* DOCUMENT CONTENT */}
                <div
                  className="relative z-1 font-sans text-slate-900 flex-1 flex flex-col justify-start"
                  style={{
                    paddingTop: `${subirBajar}px`,
                    paddingLeft: `${izqDer}px`,
                    paddingRight: `${izqDer}px`,
                    paddingBottom: pageChunk.canFitConditions ? '40px' : '140px',
                  }}
                >
                  {/* Equipment Table */}
                  <div
                    id="quote-items-table-container"
                    className={`w-full ${
                      tableEmptyError ? 'ring-2 ring-red-500 rounded-lg p-1 bg-red-50/20 animate-pulse' : ''
                    }`}
                  >
                    {tableEmptyError && (
                      <div className="mb-2 p-1.5 bg-red-100 border border-red-400 rounded text-center text-xs font-bold text-red-700 flex items-center justify-center gap-1">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span>⚠️ Ingrese al menos un equipo o ítem con datos en la tabla antes de guardar</span>
                      </div>
                    )}
                    <table
                      className="w-full table-fixed border-collapse text-left border border-black font-sans text-black"
                      style={{ fontSize: `${fontSize}px` }}
                    >
                      <colgroup>
                        <col style={{ width: '4%' }} />
                        <col style={{ width: '27%' }} />
                        <col style={{ width: '8.5%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '4.5%' }} />
                        <col style={{ width: '11.5%' }} />
                        <col style={{ width: '11.5%' }} />
                        <col style={{ width: '11%' }} />
                        <col style={{ width: '12%' }} />
                      </colgroup>
                      <thead>
                        <tr
                          className="bg-[#d9e2f3] text-black font-bold border-b border-black uppercase"
                          style={{ fontSize: `${headerFontSize}px` }}
                        >
                          <th
                            style={{ padding: `${cellPaddingY} 2px` }}
                            className="text-center align-middle border-r border-black font-bold whitespace-nowrap"
                          >
                            Item
                          </th>
                          <th
                            style={{ padding: `${cellPaddingY} ${cellPaddingX}` }}
                            className="text-center align-middle border-r border-black font-bold"
                          >
                            Descripción
                          </th>
                          <th
                            style={{ padding: `${cellPaddingY} 2px` }}
                            className="text-center align-middle border-r border-black font-bold whitespace-nowrap"
                          >
                            Marca
                          </th>
                          <th
                            style={{ padding: `${cellPaddingY} 2px` }}
                            className="text-center align-middle border-r border-black font-bold whitespace-nowrap"
                          >
                            Modelo
                          </th>
                          <th
                            style={{ padding: `${cellPaddingY} 2px` }}
                            className="text-center align-middle border-r border-black font-bold whitespace-nowrap"
                          >
                            Cant.
                          </th>
                          <th
                            style={{ padding: `${cellPaddingY} 2px` }}
                            className="text-center align-middle border-r border-black font-bold whitespace-nowrap"
                          >
                            Precio
                          </th>
                          <th
                            style={{ padding: `${cellPaddingY} 2px` }}
                            className="text-center align-middle border-r border-black font-bold whitespace-nowrap"
                          >
                            Subtotal
                          </th>
                          <th
                            style={{ padding: `${cellPaddingY} 2px` }}
                            className="text-center align-middle border-r border-black font-bold whitespace-nowrap"
                          >
                            Iva
                          </th>
                          <th
                            style={{ padding: `${cellPaddingY} 2px` }}
                            className="text-center align-middle font-bold whitespace-nowrap"
                          >
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageChunk.items.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-8 text-center align-middle text-slate-500 italic bg-slate-50 border border-black">
                              <p className="text-xs font-semibold text-slate-700 mb-1">
                                No hay equipos en la propuesta.
                              </p>
                              <p className="text-xs text-slate-500 mb-3">
                                Para agregar equipos a esta cotización, diríjase a la <strong>Ventana 2 (Gestor de Costos)</strong>.
                              </p>
                              <button
                                id="btn-add-equipment-to-quote"
                                onClick={onNavigateToCostManager || onNavigateToCatalog}
                                className="inline-flex items-center gap-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md transition cursor-pointer"
                              >
                                <PlusCircle className="w-4 h-4" />
                                <span>Agregar equipo a la cotización</span>
                              </button>
                            </td>
                          </tr>
                        ) : (
                          pageChunk.items.map((item, idx) => {
                            const itemSubtotal = item.totalSalePrice;
                            const itemTaxRate = item.taxExempt ? 0 : (item.taxRate !== undefined ? item.taxRate : (quoteHeader.taxRate ?? 0.19));
                            const itemIva = Math.round(itemSubtotal * itemTaxRate);
                            const itemTotal = itemSubtotal + itemIva;
                            const itemNumber = pageChunk.startIndex + idx + 1;

                            // Formatter for values: perfectly centered with uniform font size matching table scale
                            const formatNumberCell = (val: number) => {
                              const str = formatCOP(val);
                              return (
                                <span
                                  className="inline-block w-full text-center tabular-nums whitespace-nowrap truncate"
                                  style={{ fontSize: `${fontSize}px` }}
                                  title={str}
                                >
                                  {str}
                                </span>
                              );
                            };

                            return (
                              <tr
                                key={item.id}
                                className="border-b border-black hover:bg-slate-50/70 transition"
                              >
                                <td
                                  style={{ padding: `${cellPaddingY} 2px`, fontSize: `${fontSize}px` }}
                                  className="text-center align-middle text-black border-r border-black font-normal"
                                >
                                  {itemNumber}
                                </td>
                                <td
                                  style={{ padding: `${cellPaddingY} ${cellPaddingX}` }}
                                  className="border-r border-black align-middle text-left text-black"
                                >
                                  <div className="text-black leading-tight font-normal uppercase break-words">
                                    {item.name.toUpperCase()}
                                  </div>
                                  {item.accessories && item.accessories.length > 0 && (
                                    <div
                                      className="text-slate-600 mt-1 leading-snug uppercase break-words"
                                      style={{ fontSize: `${subTextFontSize}px` }}
                                    >
                                      <strong>Accesorios:</strong>{' '}
                                      {item.accessories
                                        .map((a) => `${a.name.toUpperCase()}${a.quantity > 1 ? ` (X${a.quantity})` : ''}`)
                                        .join(', ')}
                                    </div>
                                  )}
                                </td>
                                <td
                                  style={{ padding: `${cellPaddingY} 2px` }}
                                  className="text-center align-middle text-black border-r border-black font-normal leading-tight overflow-hidden"
                                >
                                  <div
                                    className="w-full text-center uppercase leading-tight"
                                    style={{
                                      wordBreak: 'break-word',
                                      overflowWrap: 'anywhere',
                                      fontSize: `${fontSize}px`,
                                    }}
                                  >
                                    {item.brand.toUpperCase()}
                                  </div>
                                </td>
                                <td
                                  style={{ padding: `${cellPaddingY} 2px` }}
                                  className="text-center align-middle text-black border-r border-black font-normal leading-tight overflow-hidden"
                                >
                                  <div
                                    className="w-full text-center uppercase leading-tight"
                                    style={{
                                      wordBreak: 'break-word',
                                      overflowWrap: 'anywhere',
                                      fontSize: `${fontSize}px`,
                                    }}
                                  >
                                    {item.model.toUpperCase()}
                                  </div>
                                </td>
                                <td
                                  style={{ padding: `${cellPaddingY} 2px`, fontSize: `${fontSize}px` }}
                                  className="text-center align-middle text-black border-r border-black whitespace-nowrap font-normal overflow-hidden"
                                >
                                  {item.quantity}
                                </td>
                                <td
                                  style={{ padding: `${cellPaddingY} 2px` }}
                                  className="text-center align-middle text-black border-r border-black font-normal overflow-hidden"
                                >
                                  {formatNumberCell(item.unitSalePrice)}
                                </td>
                                <td
                                  style={{ padding: `${cellPaddingY} 2px` }}
                                  className="text-center align-middle text-black border-r border-black font-normal overflow-hidden"
                                >
                                  {formatNumberCell(itemSubtotal)}
                                </td>
                                <td
                                  style={{ padding: `${cellPaddingY} 2px` }}
                                  className="text-center align-middle text-black border-r border-black font-normal overflow-hidden"
                                >
                                  {formatNumberCell(itemIva)}
                                </td>
                                <td
                                  style={{ padding: `${cellPaddingY} 2px` }}
                                  className="text-center align-middle text-black font-normal overflow-hidden"
                                >
                                  {formatNumberCell(itemTotal)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {pageChunk.isLastTablePage && quoteItems.length > 0 && (
                        <tfoot>
                          <tr className="bg-[#d9e2f3] font-bold border-t border-black text-black">
                            <td
                              colSpan={6}
                              style={{ padding: `${cellPaddingY} 4px` }}
                              className="text-right align-middle uppercase text-black font-bold border-r border-black"
                            >
                              TOTALES
                            </td>
                            <td
                              style={{ padding: `${cellPaddingY} 2px` }}
                              className="text-center align-middle font-bold text-black border-r border-black overflow-hidden"
                            >
                              <span
                                className="inline-block w-full text-center font-bold tabular-nums whitespace-nowrap truncate"
                                style={{ fontSize: `${fontSize}px` }}
                                title={formatCOP(subtotal)}
                              >
                                {formatCOP(subtotal)}
                              </span>
                            </td>
                            <td
                              style={{ padding: `${cellPaddingY} 2px` }}
                              className="text-center align-middle font-bold text-black border-r border-black overflow-hidden"
                            >
                              <span
                                className="inline-block w-full text-center font-bold tabular-nums whitespace-nowrap truncate"
                                style={{ fontSize: `${fontSize}px` }}
                                title={formatCOP(iva)}
                              >
                                {formatCOP(iva)}
                              </span>
                            </td>
                            <td
                              style={{ padding: `${cellPaddingY} 2px` }}
                              className="text-center align-middle font-bold text-black overflow-hidden"
                            >
                              <span
                                className="inline-block w-full text-center font-bold tabular-nums whitespace-nowrap truncate"
                                style={{ fontSize: `${fontSize}px` }}
                                title={formatCOP(total)}
                              >
                                {formatCOP(total)}
                              </span>
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Total in Words only on the last table page */}
                  {pageChunk.isLastTablePage && quoteItems.length > 0 && (
                    <div
                      className="mt-2.5 p-2 bg-slate-50 border border-black rounded text-black"
                      style={{ fontSize: `${subTextFontSize}px` }}
                    >
                      <strong className="text-black">VALOR TOTAL EN LETRAS (CON IVA 19%):</strong>{' '}
                      <span className="font-medium uppercase">{totalWords}</span>
                    </div>
                  )}

                  {/* ========================================================================= */}
                  {/* EMBEDDED CONDICIONES COMERCIALES Y FIRMA (WHEN TABLE FITS ON SAME PAGE) */}
                  {/* ========================================================================= */}
                  {pageChunk.canFitConditions && (
                    <div className="mt-3.5 pt-0.5 font-sans text-slate-900 leading-relaxed text-[12.5px]">
                      {/* Title: CONDICIONES COMERCIALES */}
                      <h3 className="font-extrabold text-[13.5px] text-slate-950 uppercase tracking-wide mb-2">
                        CONDICIONES COMERCIALES
                      </h3>

                      {/* Conditions Body */}
                      <div className="space-y-1.5 text-justify text-slate-900 text-[12px] leading-snug">
                        {/* Payment Terms */}
                        <div>
                          <strong>Forma de pago:</strong>{' '}
                          <input
                            type="text"
                            disabled={isReadOnly}
                            value={quoteHeader.paymentTerms ?? '50% Anticipo y 50% Contra-entrega.'}
                            onChange={(e) => onUpdateHeader({ paymentTerms: e.target.value })}
                            className={`font-normal text-slate-900 ${isReadOnly ? 'cursor-default bg-transparent' : 'hover:bg-slate-100/70 focus:bg-white border-b border-transparent focus:border-slate-400'} px-1 rounded outline-none w-auto inline-block min-w-[260px]`}
                          />
                        </div>

                        {/* Delivery Time */}
                        <p>
                          <strong>Tiempo de entrega estimado:</strong>{' '}
                          <input
                            type="text"
                            disabled={isReadOnly}
                            value={quoteHeader.deliveryTime ?? '90D'}
                            onChange={(e) => onUpdateHeader({ deliveryTime: e.target.value })}
                            className={`w-14 font-normal text-slate-900 ${isReadOnly ? 'cursor-default bg-transparent' : 'hover:bg-slate-100/70 focus:bg-white border-b border-transparent focus:border-slate-400'} px-1 rounded outline-none text-left inline`}
                          />
                          . El tiempo de entrega será confirmado al momento de suscribir el contrato o recibir el anticipo, teniendo en cuenta la disponibilidad de fábrica de los equipos contados a partir de la aceptación de la propuesta en mención. El tiempo de entrega será prorrogable por mutuo acuerdo entre las partes, o en caso de que se presente alguna eventualidad en la entrega por parte del fabricante.
                        </p>

                        {/* Training */}
                        <p>
                          <strong>Capacitación:</strong>{' '}
                          {quoteHeader.trainingTerms || 'Un (1) día en la ubicación del equipo. Las fechas de las visitas serán acordadas entre las partes.'}
                        </p>

                        {/* Maintenance */}
                        <p>
                          <strong>Mantenimiento:</strong>{' '}
                          {quoteHeader.maintenanceTerms || 'SYD COLOMBIA S.A. realizara un (1) mantenimiento preventivo por parte del Servicio Técnico de Nuestra Empresa por parte de un personal altamente calificado y entrenado, en apoyo de la marca para instalar y dar mantenimiento a esta clase de equipos.'}
                        </p>

                        {/* Warranty & Exceptions */}
                        <div>
                          <p className="mb-0.5">
                            <strong>Garantía:</strong> {quoteHeader.warrantyTerms || 'Doce (12) meses contados a partir de la fecha de instalación del equipo.'}
                          </p>
                          <p className="mb-0.5 text-[11.5px]">
                            Quedan exceptuados de esta garantía los siguientes casos:
                          </p>
                          <ul className="list-disc pl-5 space-y-0.5 text-slate-900 text-[11.5px]">
                            <li>Daños generados por la incorrecta operación, manipulación o cuidado de los sistemas.</li>
                            <li>Mal uso o abuso.</li>
                            <li>Omisión al seguir las instrucciones de operación del equipo.</li>
                            <li>Las anormalidades de energía eléctrica, instalación eléctrica inadecuada.</li>
                          </ul>
                        </div>

                        {/* Transport */}
                        <p>
                          <strong>Transporte:</strong> SYD COLOMBIA asume los gastos del envío de los equipos adquiridos adjudicados en la oferta
                        </p>

                        {/* Offer Validity */}
                        <p>
                          <strong>Validez De La Oferta:</strong> Treinta 30 días calendario a partir de la fecha de entrega de la oferta
                        </p>
                      </div>

                      {/* Closing & Signature Section */}
                      <div className="mt-3 pt-0.5">
                        <p className="mb-1 text-slate-900 text-[12px]">Atentamente,</p>

                        {/* Signature display */}
                        <div className="my-0.5 min-h-[50px] flex items-center">
                          <DefaultDocumentSignature className="h-13" />
                        </div>

                        <div className="mt-1 text-slate-950 font-bold text-[12.5px]">
                          <p className="uppercase font-extrabold">SUMINISTROS Y DOTACIONES COLOMBIA S.A.</p>
                          <p className="font-bold text-slate-900 text-[11.5px]">Dpto. Mercadeo y Ventas</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* ========================================================================= */}
        {/* ======================= HOJA FINAL: CONDICIONES COMERCIALES ============= */}
        {/* (RENDERED ONLY IF CONDITIONS CANNOT FIT ON THE LAST TABLE SHEET) ========= */}
        {/* ========================================================================= */}
        {hasStandaloneConditionsPage && (
          <div className="w-full max-w-[850px]">
            <div className="flex items-center justify-between px-3 py-1.5 mb-2 text-xs text-slate-400">
              <span className="font-bold uppercase tracking-wider text-[#38bdf8] flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Página {totalPagesCount} de {totalPagesCount} — Condiciones Comerciales y Firma
              </span>
              <span>Formato Exacto Imagen SYD</span>
            </div>

            <div
              id={`hoja-word-${totalPagesCount}`}
              data-printable-sheet="true"
              className="relative z-0 bg-white text-slate-900 rounded-lg shadow-2xl overflow-hidden min-h-[1056px] border border-slate-300 print:border-none print:shadow-none print:m-0 commercial-quote-sheet print-paper word-document-page"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
              }}
            >
              {/* MEMBRETE CUBRIENDO TODA LA HOJA */}
              {effectiveLetterhead ? (
                <div className="absolute inset-0 w-full h-full pointer-events-none z-0 select-none print:w-full print:h-full overflow-hidden">
                  <img
                    src={effectiveLetterhead}
                    alt={`Membrete Hoja ${totalPagesCount}`}
                    className="w-full h-full object-fill pointer-events-none z-0 select-none print:w-full print:h-full"
                  />
                </div>
              ) : null}

              {/* DOCUMENT CONTENT */}
              <div
                className="relative z-1 font-sans text-[13.5px] leading-relaxed text-slate-900"
                style={{
                  paddingTop: `${subirBajar}px`,
                  paddingLeft: `${izqDer}px`,
                  paddingRight: `${izqDer}px`,
                  paddingBottom: '60px',
                }}
              >
                {/* Title: CONDICIONES COMERCIALES */}
                <h3 className="font-extrabold text-[14.5px] text-slate-950 uppercase tracking-wide mb-4">
                  CONDICIONES COMERCIALES
                </h3>

                {/* Conditions Body */}
                <div className="space-y-4 text-justify text-slate-900 text-[13.5px] leading-relaxed">
                  {/* Payment Terms */}
                  <div>
                    <strong>Forma de pago:</strong>{' '}
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={quoteHeader.paymentTerms ?? '50% Anticipo y 50% Contra-entrega.'}
                      onChange={(e) => onUpdateHeader({ paymentTerms: e.target.value })}
                      className={`font-normal text-slate-900 ${isReadOnly ? 'cursor-default bg-transparent' : 'hover:bg-slate-100/70 focus:bg-white border-b border-transparent focus:border-slate-400'} px-1 rounded outline-none w-auto inline-block min-w-[280px]`}
                    />
                  </div>

                  {/* Delivery Time */}
                  <p>
                    <strong>Tiempo de entrega estimado:</strong>{' '}
                    <input
                      type="text"
                      disabled={isReadOnly}
                      value={quoteHeader.deliveryTime ?? '90D'}
                      onChange={(e) => onUpdateHeader({ deliveryTime: e.target.value })}
                      className={`w-14 font-normal text-slate-900 ${isReadOnly ? 'cursor-default bg-transparent' : 'hover:bg-slate-100/70 focus:bg-white border-b border-transparent focus:border-slate-400'} px-1 rounded outline-none text-left inline`}
                    />
                    . El tiempo de entrega será confirmado al momento de suscribir el contrato o recibir el anticipo, teniendo en cuenta la disponibilidad de fábrica de los equipos contados a partir de la aceptación de la propuesta en mención. El tiempo de entrega será prorrogable por mutuo acuerdo entre las partes, o en caso de que se presente alguna eventualidad en la entrega por parte del fabricante.
                  </p>

                  {/* Training */}
                  <p>
                    <strong>Capacitación:</strong>{' '}
                    {quoteHeader.trainingTerms || 'Un (1) día en la ubicación del equipo. Las fechas de las visitas serán acordadas entre las partes.'}
                  </p>

                  {/* Maintenance */}
                  <p>
                    <strong>Mantenimiento:</strong>{' '}
                    {quoteHeader.maintenanceTerms || 'SYD COLOMBIA S.A. realizara un (1) mantenimiento preventivo por parte del Servicio Técnico de Nuestra Empresa por parte de un personal altamente calificado y entrenado, en apoyo de la marca para instalar y dar mantenimiento a esta clase de equipos.'}
                  </p>

                  {/* Warranty & Exceptions */}
                  <div>
                    <p className="mb-2">
                      <strong>Garantía:</strong> {quoteHeader.warrantyTerms || 'Doce (12) meses contados a partir de la fecha de instalación del equipo.'}
                    </p>
                    <p className="mb-1.5">
                      Quedan exceptuados de esta garantía los siguientes casos:
                    </p>
                    <ul className="list-disc pl-7 space-y-1 text-slate-900 text-[13.5px]">
                      <li>Daños generados por la incorrecta operación, manipulación o cuidado de los sistemas.</li>
                      <li>Mal uso o abuso.</li>
                      <li>Omisión al seguir las instrucciones de operación del equipo.</li>
                      <li>Las anormalidades de energía eléctrica, instalación eléctrica inadecuada.</li>
                    </ul>
                  </div>

                  {/* Transport */}
                  <p>
                    <strong>Transporte:</strong> SYD COLOMBIA asume los gastos del envío de los equipos adquiridos adjudicados en la oferta
                  </p>

                  {/* Offer Validity */}
                  <p>
                    <strong>Validez De La Oferta:</strong> Treinta 30 días calendario a partir de la fecha de entrega de la oferta
                  </p>
                </div>

                {/* Closing & Signature Section */}
                <div className="mt-8 pt-2">
                  <p className="mb-3 text-slate-900">Atentamente,</p>

                  {/* Signature display */}
                  <div className="my-2 min-h-[75px] flex items-center">
                    <DefaultDocumentSignature className="h-18" />
                  </div>

                  <div className="mt-3 text-slate-950 font-bold text-[14px]">
                    <p className="uppercase font-extrabold">SUMINISTROS Y DOTACIONES COLOMBIA S.A.</p>
                    <p className="font-bold text-slate-900">Dpto. Mercadeo y Ventas</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CLIENT DIRECTORY MODAL */}
      {isClientDirectoryOpen && (
        <ClientDirectoryModal
          isOpen={isClientDirectoryOpen}
          onClose={() => setIsClientDirectoryOpen(false)}
          savedQuotes={activeSavedQuotes}
          onSelectClient={(client) => {
            const formattedLocation = client.city
              ? (client.department ? `${client.city}, ${client.department}` : client.city)
              : (client.department || '');

            onUpdateHeader({
              clientName: client.name,
              nit: client.nit ? client.nit.trim() : '',
              city: formattedLocation || quoteHeader.city || '',
              contactPerson: client.contactPerson ? client.contactPerson.trim() : '',
              contactEmail: client.contactEmail ? client.contactEmail.trim() : '',
              contactPhone: client.contactPhone ? client.contactPhone.trim() : '',
            });
          }}
          onViewQuote={(quote) => {
            if (onLoadQuote) {
              onLoadQuote(quote);
            } else if (onNavigateToHistory) {
              onNavigateToHistory();
            }
          }}
        />
      )}

      {/* QUICK CLIENT DATA MODAL (OUTSIDE DOCUMENT CANVAS) */}
      {isClientModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-4 animate-fadeIn"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsClientModalOpen(false);
            }}
          >
            <div className="bg-[#192b45] border border-[#38bdf8]/50 rounded-2xl max-w-xl w-full shadow-2xl animate-scaleUp overflow-hidden flex flex-col text-slate-200">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 bg-[#15253d] border-b border-[#334d6e]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#38bdf8]/15 border border-[#38bdf8]/30 flex items-center justify-center text-[#38bdf8]">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Ficha y Datos del Cliente
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Información de NIT y contacto vinculada a esta cotización
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(false)}
                  className="w-7 h-7 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer text-xs font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Modal Form Content */}
              <div className="p-5 space-y-4 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                    Nombre o Razón Social del Cliente
                  </label>
                  <input
                    type="text"
                    value={quoteHeader.clientName}
                    disabled={isReadOnly}
                    onChange={(e) => onUpdateHeader({ clientName: e.target.value })}
                    placeholder="Ej: HOSPITAL REGIONAL SAN JERONIMO"
                    className="w-full bg-[#111f33] border border-[#334d6e] focus:border-[#38bdf8] rounded-lg px-3 py-2 text-white text-xs outline-none uppercase font-bold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      NIT / Identificación
                    </label>
                    <input
                      type="text"
                      value={quoteHeader.nit || ''}
                      disabled={isReadOnly}
                      onChange={(e) => onUpdateHeader({ nit: e.target.value })}
                      placeholder="Ej: 892.115.347-1"
                      className="w-full bg-[#111f33] border border-[#334d6e] focus:border-[#38bdf8] rounded-lg px-3 py-2 text-white text-xs outline-none font-mono font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 uppercase mb-1">
                      Ciudad / Departamento
                    </label>
                    <input
                      type="text"
                      value={quoteHeader.city || ''}
                      disabled={isReadOnly}
                      onChange={(e) => onUpdateHeader({ city: e.target.value })}
                      placeholder="Ej: Barranquilla, Atlántico"
                      className="w-full bg-[#111f33] border border-[#334d6e] focus:border-[#38bdf8] rounded-lg px-3 py-2 text-white text-xs outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-[#334d6e] pt-3 space-y-3">
                  <h4 className="text-[11px] font-bold text-[#38bdf8] uppercase tracking-wider">
                    Datos de Contacto
                  </h4>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Persona de Contacto / Cargo
                    </label>
                    <input
                      type="text"
                      value={quoteHeader.contactPerson || ''}
                      disabled={isReadOnly}
                      onChange={(e) => onUpdateHeader({ contactPerson: e.target.value })}
                      placeholder="Ej: Dra. María Elena Gómez - Subgerente Administrativa"
                      className="w-full bg-[#111f33] border border-[#334d6e] focus:border-[#38bdf8] rounded-lg px-3 py-2 text-white text-xs outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Teléfono / Celular
                      </label>
                      <input
                        type="text"
                        value={quoteHeader.contactPhone || ''}
                        disabled={isReadOnly}
                        onChange={(e) => onUpdateHeader({ contactPhone: e.target.value })}
                        placeholder="Ej: (605) 300-1234 / 310-0000000"
                        className="w-full bg-[#111f33] border border-[#334d6e] focus:border-[#38bdf8] rounded-lg px-3 py-2 text-white text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Correo Electrónico
                      </label>
                      <input
                        type="email"
                        value={quoteHeader.contactEmail || ''}
                        disabled={isReadOnly}
                        onChange={(e) => onUpdateHeader({ contactEmail: e.target.value })}
                        placeholder="Ej: compras@hospital.gov.co"
                        className="w-full bg-[#111f33] border border-[#334d6e] focus:border-[#38bdf8] rounded-lg px-3 py-2 text-white text-xs outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between px-5 py-3.5 bg-[#15253d] border-t border-[#334d6e]">
                <button
                  type="button"
                  onClick={() => {
                    setIsClientModalOpen(false);
                    setIsClientDirectoryOpen(true);
                  }}
                  className="text-xs text-[#38bdf8] hover:underline cursor-pointer flex items-center gap-1 font-medium"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Ver en Directorio General</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsClientModalOpen(false)}
                    className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs transition cursor-pointer"
                  >
                    Aceptar
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
