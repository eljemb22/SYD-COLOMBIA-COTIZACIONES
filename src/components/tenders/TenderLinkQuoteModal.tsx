import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  Search,
  X,
  Building2,
  Calendar,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Link2,
  PlusCircle,
  FileText,
} from 'lucide-react';
import { SavedQuote, TenderClientProject, MedicalEquipment, TenderItem, QuoteItem, TechnicalRequirement } from '../../types';
import { formatCOP } from '../../utils/formatters';

interface TenderLinkQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedQuotes: SavedQuote[];
  activeClient: TenderClientProject | null;
  equipments: MedicalEquipment[];
  onCreateTenderFromQuote: (quote: SavedQuote) => void;
  onLinkQuoteToCurrentTender?: (quote: SavedQuote, importItems: boolean) => void;
}

export const TenderLinkQuoteModal: React.FC<TenderLinkQuoteModalProps> = ({
  isOpen,
  onClose,
  savedQuotes,
  activeClient,
  equipments,
  onCreateTenderFromQuote,
  onLinkQuoteToCurrentTender,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [importItemsOption, setImportItemsOption] = useState(true);

  useEffect(() => {
    if (isOpen) {
      if (savedQuotes.length > 0 && !selectedQuoteId) {
        setSelectedQuoteId(savedQuotes[0].id);
      }
    }
  }, [isOpen, savedQuotes, selectedQuoteId]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredQuotes = savedQuotes.filter((q) => {
    const term = searchQuery.toLowerCase();
    return (
      q.quoteNumber?.toLowerCase().includes(term) ||
      q.clientName?.toLowerCase().includes(term) ||
      q.nit?.toLowerCase().includes(term) ||
      q.city?.toLowerCase().includes(term) ||
      q.advisorName?.toLowerCase().includes(term) ||
      q.items?.some((it) => it.name?.toLowerCase().includes(term))
    );
  });

  const selectedQuote = savedQuotes.find((q) => q.id === selectedQuoteId) || filteredQuotes[0] || null;

  const handleCreateNewTender = () => {
    if (!selectedQuote) return;
    onCreateTenderFromQuote(selectedQuote);
    onClose();
  };

  const handleLinkToActive = () => {
    if (!selectedQuote || !onLinkQuoteToCurrentTender || !activeClient) return;
    onLinkQuoteToCurrentTender(selectedQuote, importItemsOption);
    onClose();
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-[#111e30] border border-[#334d6e] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-[#192b45] border-b border-[#334d6e] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Link2 className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <span>Enlazar Cotización con Licitación / Contrato</span>
                <span className="text-[11px] font-mono bg-purple-500/20 text-purple-200 px-2 py-0.5 rounded-full border border-purple-500/30">
                  {savedQuotes.length} Cotizaciones Disponibles
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Seleccione una cotización guardada para transferir equipos, precios y especificaciones técnicas a la licitación
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (Split: List & Preview) */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-[#334d6e]">
          {/* Left Column: Search & List (5 cols) */}
          <div className="md:col-span-5 flex flex-col min-h-0 bg-[#0e1726]">
            <div className="p-3 border-b border-[#334d6e]">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por N° cotización, cliente, NIT..."
                  className="w-full pl-9 pr-3 py-2 bg-[#15253d] border border-[#334d6e] rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 custom-scrollbar">
              {filteredQuotes.length === 0 ? (
                <div className="p-6 text-center text-slate-400 space-y-2">
                  <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-500 opacity-60" />
                  <p className="text-xs">No se encontraron cotizaciones guardadas</p>
                </div>
              ) : (
                filteredQuotes.map((q) => {
                  const isSelected = selectedQuote?.id === q.id;
                  const totalUnits = q.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0;
                  return (
                    <div
                      key={q.id}
                      onClick={() => setSelectedQuoteId(q.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600/20 border-purple-400 shadow-sm'
                          : 'bg-[#15253d]/70 hover:bg-[#15253d] border-[#334d6e]/70 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-amber-300">
                          {q.quoteNumber || 'COT-SIN-NUM'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{q.date}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white truncate">{q.clientName}</h4>
                      <div className="flex items-center justify-between text-[11px] mt-2 pt-2 border-t border-[#334d6e]/40">
                        <span className="text-slate-400">
                          {q.items?.length || 0} equipos ({totalUnits} uds)
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          {formatCOP(q.total || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Quote Details Preview & Target Actions (7 cols) */}
          <div className="md:col-span-7 flex flex-col min-h-0 bg-[#111e30] p-4 overflow-y-auto custom-scrollbar space-y-4">
            {selectedQuote ? (
              <>
                {/* Executive Card */}
                <div className="bg-[#15253d] border border-[#334d6e] rounded-xl p-3.5 space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-[#334d6e]/60 pb-2.5">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
                        {selectedQuote.quoteNumber}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-1">{selectedQuote.clientName}</h3>
                      <p className="text-xs text-slate-400">
                        {selectedQuote.nit ? `NIT: ${selectedQuote.nit} • ` : ''}
                        {selectedQuote.city}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Total Cotizado</span>
                      <span className="text-sm font-mono font-black text-emerald-400">
                        {formatCOP(selectedQuote.total || 0)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-300">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Contacto:</span>
                      <span className="font-semibold text-slate-200 truncate block">
                        {selectedQuote.contactPerson || 'No registrado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Plazo Entrega:</span>
                      <span className="font-semibold text-slate-200 truncate block">
                        {selectedQuote.deliveryTime || '30 días'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Asesor:</span>
                      <span className="font-semibold text-slate-200 truncate block">
                        {selectedQuote.advisorName || 'Biomédico SYD'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items preview */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>Equipos en esta Cotización ({selectedQuote.items?.length || 0})</span>
                    <span className="text-slate-400 font-normal">Se transferirán a la licitación con sus precios y specs</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto rounded-xl border border-[#334d6e] divide-y divide-[#334d6e]/50 bg-[#15253d]/50 custom-scrollbar">
                    {selectedQuote.items?.map((it, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-[#192b45]">
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-white block truncate">
                            {idx + 1}. {it.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {it.brand} {it.model ? `• Mod: ${it.model}` : ''} • Cant: {it.quantity || 1}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-200 text-right whitespace-nowrap">
                          {formatCOP(it.totalSalePrice || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Options */}
                <div className="pt-2 border-t border-[#334d6e] space-y-3">
                  <div className="bg-[#15253d]/80 border border-purple-500/30 rounded-xl p-3 space-y-2">
                    <h4 className="text-xs font-bold text-purple-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>Enlazar a la licitación activa</span>
                    </h4>

                    <div className="space-y-2">
                      {/* Link to Current Active Tender */}
                      {activeClient && onLinkQuoteToCurrentTender ? (
                        <div className="p-2.5 rounded-xl bg-[#111e30] border border-[#334d6e] space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-300 font-semibold truncate">
                              Licitación actual: <strong>{activeClient.clientName}</strong>
                            </span>
                          </div>

                          <label className="flex items-center gap-2 text-[11.5px] text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={importItemsOption}
                              onChange={(e) => setImportItemsOption(e.target.checked)}
                              className="rounded border-[#334d6e] text-purple-600 focus:ring-0 w-3.5 h-3.5"
                            />
                            <span>Reemplazar / importar los equipos de la cotización en este proceso</span>
                          </label>

                          <button
                            type="button"
                            onClick={handleLinkToActive}
                            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-bold text-xs transition cursor-pointer active:scale-98"
                          >
                            <Link2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Vincular con {activeClient.header.processNumber || activeClient.clientName}</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">
                          Seleccione o cree una licitación en el espacio de trabajo para vincular esta cotización.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-slate-400 p-8">
                <p className="text-xs">Seleccione una cotización del panel izquierdo para ver sus datos</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#192b45] border-t border-[#334d6e] flex items-center justify-between text-xs text-slate-400">
          <span>
            Las especificaciones técnicas del catálogo de equipos se vincularán automáticamente a los pliegos.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#15253d] hover:bg-[#203758] text-slate-200 font-semibold border border-[#334d6e] transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
