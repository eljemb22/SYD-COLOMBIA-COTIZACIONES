import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  History,
  Plus,
  FileText,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  QuoteHeader,
  QuoteItem,
  MedicalEquipment,
  SavedQuote,
  QuoteStatus,
  AuthUser,
} from '../../types';
import { SalesView } from './SalesView';
import { QuotesHistoryView } from './QuotesHistoryView';
import { formatCOP } from '../../utils/formatters';

interface QuotesViewProps {
  quoteHeader: QuoteHeader;
  quoteItems: QuoteItem[];
  equipments: MedicalEquipment[];
  savedQuotes: SavedQuote[];
  initialSubTab?: 'editor' | 'historial';
  customLetterheadUrl?: string | null;
  onUpdateLetterhead?: (url: string | null) => void;
  marginSettings?: { subirBajar: number; izqDer: number; tableScale: number };
  onUpdateMarginSettings?: (settings: { subirBajar: number; izqDer: number; tableScale: number }) => void;
  onUpdateHeader: (header: Partial<QuoteHeader>) => void;
  onUpdateItem: (id: string, updates: Partial<QuoteItem>) => void;
  onDeleteItem: (id: string) => void;
  onNavigateToCatalog: () => void;
  onNavigateToCostManager: () => void;
  onSaveQuote: (
    customLetterheadUrl: string | null,
    marginSettings: { subirBajar: number; izqDer: number; tableScale: number }
  ) => void;
  onCreateNewQuote: () => void;
  onLoadQuoteIntoEditor: (quote: SavedQuote) => void;
  onUpdateQuoteStatus: (id: string, status: QuoteStatus) => void;
  onDeleteQuote: (id: string) => void;
  onDuplicateQuote: (id: string) => void;
  onConvertToSalesOrder?: (quote: SavedQuote | { header: QuoteHeader; items: QuoteItem[] }) => void;
  onConvertToTender?: (quote: SavedQuote | { header: QuoteHeader; items: QuoteItem[] }) => void;
  currentUser?: AuthUser | null;
  editingQuoteId?: string | null;
  onCancelEditQuote?: () => void;
}

export const QuotesView: React.FC<QuotesViewProps> = ({
  quoteHeader,
  quoteItems,
  equipments,
  savedQuotes,
  initialSubTab = 'editor',
  customLetterheadUrl,
  onUpdateLetterhead,
  marginSettings,
  onUpdateMarginSettings,
  onUpdateHeader,
  onUpdateItem,
  onDeleteItem,
  onNavigateToCatalog,
  onNavigateToCostManager,
  onSaveQuote,
  onCreateNewQuote,
  onLoadQuoteIntoEditor,
  onUpdateQuoteStatus,
  onDeleteQuote,
  onDuplicateQuote,
  onConvertToSalesOrder,
  onConvertToTender,
  currentUser,
  editingQuoteId,
  onCancelEditQuote,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'editor' | 'historial'>(initialSubTab);

  // Sync if initialSubTab changes from external navigation
  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const activeQuoteSubtotal = quoteItems.reduce((acc, it) => acc + it.totalSalePrice, 0);
  const activeQuoteIVA = quoteItems.reduce((acc, it) => {
    const rate = it.taxExempt ? 0 : (it.taxRate !== undefined ? it.taxRate : (quoteHeader.taxRate ?? 0.19));
    return acc + Math.round(it.totalSalePrice * rate);
  }, 0);
  const activeQuoteTotal = activeQuoteSubtotal + activeQuoteIVA;

  const handleLoadQuote = (quote: SavedQuote) => {
    onLoadQuoteIntoEditor(quote);
    setActiveSubTab('editor');
  };

  const handleCreateNew = () => {
    onCreateNewQuote();
    setActiveSubTab('editor');
  };

  return (
    <div id="unified-quotes-module" className="space-y-5 animate-fadeIn max-w-7xl mx-auto">
      {/* UNIFIED SUB-NAVIGATION HEADER */}
      <div className="bg-[#18263a] border border-[#334d6e] rounded-2xl p-3 sm:p-4 shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: Tab Switcher (Editor vs Historial) */}
        <div className="flex items-center gap-2 bg-[#111c2e] p-1.5 rounded-xl border border-[#334d6e] self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            id="tab-btn-quote-editor"
            type="button"
            onClick={() => setActiveSubTab('editor')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
              activeSubTab === 'editor'
                ? 'bg-[#38bdf8] text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-[#15253d]'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Editor de Cotización</span>
            {quoteItems.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeSubTab === 'editor'
                    ? 'bg-slate-950 text-[#38bdf8]'
                    : 'bg-[#38bdf8]/20 text-[#38bdf8]'
                }`}
              >
                {quoteItems.length}
              </span>
            )}
          </button>

          <button
            id="tab-btn-quote-history"
            type="button"
            onClick={() => setActiveSubTab('historial')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
              activeSubTab === 'historial'
                ? 'bg-[#38bdf8] text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-[#15253d]'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Cotizaciones Guardadas</span>
            {savedQuotes.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                  activeSubTab === 'historial'
                    ? 'bg-slate-950 text-[#38bdf8]'
                    : 'bg-emerald-400/20 text-emerald-400'
                }`}
              >
                {savedQuotes.length}
              </span>
            )}
          </button>
        </div>

        {/* Right: Quick Actions and State Pill */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {activeSubTab === 'editor' && quoteItems.length > 0 && (
            <div className="flex items-center gap-2 bg-[#111c2e] px-3 py-1.5 rounded-xl border border-[#334d6e] text-xs">
              <span className="text-slate-400">Total Cotización:</span>
              <span className="text-emerald-400 font-bold font-mono">
                {formatCOP(activeQuoteTotal)} COP
              </span>
            </div>
          )}
        </div>
      </div>

      {/* SUB-VIEW RENDERING */}
      {activeSubTab === 'editor' ? (
        <SalesView
          quoteHeader={quoteHeader}
          quoteItems={quoteItems}
          equipments={equipments}
          savedQuotes={savedQuotes}
          onLoadQuote={handleLoadQuote}
          customLetterheadUrl={customLetterheadUrl}
          onUpdateLetterhead={onUpdateLetterhead}
          marginSettings={marginSettings}
          onUpdateMarginSettings={onUpdateMarginSettings}
          onUpdateHeader={onUpdateHeader}
          onUpdateItem={onUpdateItem}
          onDeleteItem={onDeleteItem}
          onNavigateToCatalog={onNavigateToCatalog}
          onNavigateToCostManager={onNavigateToCostManager}
          onSaveQuote={onSaveQuote}
          onNavigateToHistory={() => setActiveSubTab('historial')}
          onCreateNewQuote={handleCreateNew}
          savedQuotesCount={savedQuotes.length}
          onConvertToSalesOrder={onConvertToSalesOrder}
          onConvertToTender={onConvertToTender}
          currentUser={currentUser}
          editingQuoteId={editingQuoteId}
          onCancelEditQuote={onCancelEditQuote}
        />
      ) : (
        <QuotesHistoryView
          savedQuotes={savedQuotes}
          onLoadQuoteIntoEditor={handleLoadQuote}
          onCreateNewQuote={handleCreateNew}
          onUpdateQuoteStatus={onUpdateQuoteStatus}
          onDeleteQuote={onDeleteQuote}
          onDuplicateQuote={onDuplicateQuote}
          onConvertToSalesOrder={onConvertToSalesOrder}
          onConvertToTender={onConvertToTender}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
