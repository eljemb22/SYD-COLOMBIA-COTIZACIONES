import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles, Check, CheckCircle2, Wand2, X, EyeOff, AlertCircle } from 'lucide-react';
import {
  getSpellingSuggestions,
  getWordAtCursor,
  autoCorrectText,
  findSpellingErrorsInText,
  ignoreWord,
  isWordIgnored,
} from '../../utils/spellChecker';

interface ActiveCorrection {
  x: number;
  y: number;
  word: string;
  start: number;
  end: number;
  suggestions?: string[];
  targetElement?: HTMLInputElement | HTMLTextAreaElement;
  onApply?: (replacement: string) => void;
}

interface SpellingErrorItem {
  word: string;
  start: number;
  end: number;
  suggestions: string[];
}

export const SpellCheckProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCorrection, setActiveCorrection] = useState<ActiveCorrection | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeInput, setActiveInput] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [activeErrors, setActiveErrors] = useState<SpellingErrorItem[]>([]);
  const [inputRect, setInputRect] = useState<DOMRect | null>(null);
  const [inputStyle, setInputStyle] = useState<{
    paddingTop: string;
    paddingRight: string;
    paddingBottom: string;
    paddingLeft: string;
    fontSize: string;
    fontFamily: string;
    fontWeight: string;
    letterSpacing: string;
    lineHeight: string;
    textAlign: string;
  } | null>(null);
  const [, setIgnoredVersion] = useState(0);

  const menuRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Update errors for the currently active input
  const updateErrorsForInput = useCallback((input: HTMLInputElement | HTMLTextAreaElement | null) => {
    if (!input || input.readOnly || input.disabled || !input.isConnected) {
      setActiveErrors([]);
      setInputRect(null);
      setInputStyle(null);
      return;
    }

    const rect = input.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      setActiveErrors([]);
      setInputRect(null);
      setInputStyle(null);
      return;
    }

    const computed = window.getComputedStyle(input);
    setInputStyle({
      paddingTop: computed.paddingTop,
      paddingRight: computed.paddingRight,
      paddingBottom: computed.paddingBottom,
      paddingLeft: computed.paddingLeft,
      fontSize: computed.fontSize,
      fontFamily: computed.fontFamily,
      fontWeight: computed.fontWeight,
      letterSpacing: computed.letterSpacing,
      lineHeight: computed.lineHeight,
      textAlign: computed.textAlign,
    });
    setInputRect(rect);

    const errs = findSpellingErrorsInText(input.value);
    setActiveErrors(errs);
  }, []);

  // Set native spellcheck="true" and lang="es" on all text inputs across the app
  useEffect(() => {
    const markInputs = () => {
      document.querySelectorAll('input[type="text"], input:not([type]), textarea').forEach((el) => {
        if (!el.getAttribute('spellcheck')) {
          el.setAttribute('spellcheck', 'true');
        }
        if (!el.getAttribute('lang')) {
          el.setAttribute('lang', 'es');
        }
      });
    };
    markInputs();
    const observer = new MutationObserver(markInputs);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Track focused input element and user typing
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        (target instanceof HTMLInputElement && (target.type === 'text' || target.type === 'search' || !target.type)) ||
        target instanceof HTMLTextAreaElement
      ) {
        setActiveInput(target);
        updateErrorsForInput(target);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      // Delay clear so user can click on suggestions/omission buttons
      setTimeout(() => {
        if (document.activeElement !== activeInput) {
          setActiveInput(null);
          setActiveErrors([]);
          setInputRect(null);
        }
      }, 200);
    };

    const handleInput = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target === activeInput) {
        updateErrorsForInput(activeInput);
      }
    };

    const handleScrollOrResize = () => {
      if (activeInput) {
        updateErrorsForInput(activeInput);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('input', handleInput);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('input', handleInput);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeInput, updateErrorsForInput]);

  // Close context menu on outside click or escape
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveCorrection(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveCorrection(null);
      }
    };

    window.addEventListener('mousedown', handleGlobalClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Listen to right-click on input and textarea elements
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const isInput =
        target instanceof HTMLInputElement &&
        (target.type === 'text' || target.type === 'search' || !target.type);
      const isTextArea = target instanceof HTMLTextAreaElement;

      if (!isInput && !isTextArea) {
        return;
      }

      const inputEl = target as HTMLInputElement | HTMLTextAreaElement;
      if (inputEl.readOnly || inputEl.disabled) return;

      setActiveInput(inputEl);

      // Determine cursor position in input
      const cursor = inputEl.selectionStart ?? 0;
      const val = inputEl.value;

      // Find word under cursor
      let wordInfo = getWordAtCursor(val, cursor);
      let suggestions = wordInfo && !isWordIgnored(wordInfo.word) ? getSpellingSuggestions(wordInfo.word) : [];

      // If cursor didn't land directly on a misspelled word, check if any error word in this input is near the click
      if (suggestions.length === 0) {
        const errors = findSpellingErrorsInText(val);
        if (errors.length > 0) {
          const rect = inputEl.getBoundingClientRect();
          const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left - 8) / Math.max(1, rect.width - 16)));
          const estimatedChar = Math.floor(clickRatio * val.length);
          const matchingErr = errors.find((err) => estimatedChar >= err.start && estimatedChar <= err.end) || errors[0];
          if (matchingErr) {
            wordInfo = { word: matchingErr.word, start: matchingErr.start, end: matchingErr.end };
            suggestions = matchingErr.suggestions;
          }
        }
      }

      if (!wordInfo || suggestions.length === 0) {
        // No spelling error detected on this word; allow default browser context menu
        return;
      }

      // We have spelling / accent suggestions! Show custom menu
      e.preventDefault();

      // Ensure popup doesn't overflow viewport
      const x = Math.min(e.clientX, window.innerWidth - 270);
      const y = Math.min(e.clientY, window.innerHeight - 260);

      setActiveCorrection({
        x,
        y,
        word: wordInfo.word,
        start: wordInfo.start,
        end: wordInfo.end,
        suggestions,
        targetElement: inputEl,
      });
    };

    const handleCustomOpen = (e: Event) => {
      const ce = e as CustomEvent;
      if (!ce.detail) return;
      const { x, y, word, start, end, suggestions, onApply } = ce.detail;
      const safeX = Math.min(x, window.innerWidth - 270);
      const safeY = Math.min(y, window.innerHeight - 260);
      setActiveCorrection({
        x: safeX,
        y: safeY,
        word,
        start,
        end,
        suggestions,
        onApply,
      });
    };

    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('open-spellcheck-menu', handleCustomOpen);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('open-spellcheck-menu', handleCustomOpen);
    };
  }, []);

  const applyCorrection = (replacement: string, correction?: ActiveCorrection) => {
    const target = correction || activeCorrection;
    if (!target) return;

    if (target.onApply) {
      target.onApply(replacement);
      setActiveCorrection(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('spellcheck-ignored-changed'));
      }
      showToast(`Corregido a: "${replacement}"`);
      return;
    }

    const { targetElement, start, end } = target;
    if (!targetElement) return;

    const currentVal = targetElement.value;
    const newVal = currentVal.slice(0, start) + replacement + currentVal.slice(end);

    // Update input value and fire standard React input events
    const nativeInputValueSetter =
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set ||
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(targetElement, newVal);
    } else {
      targetElement.value = newVal;
    }

    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
    targetElement.dispatchEvent(new Event('change', { bubbles: true }));

    // Reposition cursor right after replaced word
    const newCursor = start + replacement.length;
    targetElement.focus();
    targetElement.setSelectionRange(newCursor, newCursor);

    setActiveCorrection(null);
    updateErrorsForInput(targetElement);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spellcheck-ignored-changed'));
    }
    showToast(`Corregido a: "${replacement}"`);
  };

  const handleIgnoreWord = (wordToIgnore?: string) => {
    const word = wordToIgnore || activeCorrection?.word;
    if (!word) return;

    ignoreWord(word);
    setIgnoredVersion((v) => v + 1);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('spellcheck-ignored-changed', { detail: { word } }));
    }

    if (activeCorrection) {
      const el = activeCorrection.targetElement;
      setActiveCorrection(null);
      updateErrorsForInput(el);
    } else if (activeInput) {
      updateErrorsForInput(activeInput);
    }

    showToast(`Se omitió la corrección para "${word}"`);
  };

  const applyAutoCorrectAll = () => {
    const targetElement = activeCorrection?.targetElement || activeInput;
    if (!targetElement) return;

    const { correctedText, fixesCount } = autoCorrectText(targetElement.value);
    if (fixesCount === 0) {
      setActiveCorrection(null);
      showToast('No se encontraron más errores');
      return;
    }

    const nativeInputValueSetter =
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set ||
      Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(targetElement, correctedText);
    } else {
      targetElement.value = correctedText;
    }

    targetElement.dispatchEvent(new Event('input', { bubbles: true }));
    targetElement.dispatchEvent(new Event('change', { bubbles: true }));

    setActiveCorrection(null);
    updateErrorsForInput(targetElement);
    showToast(`Se corrigieron ${fixesCount} palabras con tildes`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 2500);
  };

  // Helper to render text with transparent chars and red wavy underline on error words
  const renderUnderlinedOverlayText = (text: string, errors: SpellingErrorItem[]) => {
    if (!text || errors.length === 0) return null;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    errors.forEach((err, idx) => {
      if (err.start > lastIndex) {
        parts.push(
          <span key={`clean-${idx}`} style={{ color: 'transparent' }}>
            {text.slice(lastIndex, err.start)}
          </span>
        );
      }
      parts.push(
        <span
          key={`err-${idx}`}
          style={{
            color: 'transparent',
            textDecoration: 'underline wavy #ef4444',
            textDecorationThickness: '2px',
            textUnderlineOffset: '3px',
          }}
          className="select-none inline"
          title={`Error ortográfico: ${err.word}. Sugerencia: ${err.suggestions.join(', ')}`}
        >
          {text.slice(err.start, err.end)}
        </span>
      );
      lastIndex = err.end;
    });

    if (lastIndex < text.length) {
      parts.push(
        <span key="clean-end" style={{ color: 'transparent' }}>
          {text.slice(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  return (
    <>
      {children}

      {/* Floating Spell Check Context Menu (on right click) */}
      {activeCorrection && (
        <div
          ref={menuRef}
          style={{ top: `${activeCorrection.y}px`, left: `${activeCorrection.x}px` }}
          className="fixed z-9999 w-68 bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl border border-sky-500/40 p-2.5 animate-in fade-in zoom-in-95 duration-100 text-xs font-sans"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-1 border-b border-slate-700/80 mb-2">
            <span className="flex items-center gap-1.5 font-bold text-sky-400">
              <Sparkles className="w-3.5 h-3.5" />
              Corrección Ortográfica
            </span>
            <button
              onClick={() => setActiveCorrection(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 cursor-pointer"
              title="Cerrar"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Detected word with red wavy underline */}
          <div className="px-2 py-1 text-[11px] text-slate-300 flex items-center justify-between bg-slate-800/40 rounded-lg mb-2">
            <span>Palabra:</span>
            <span className="underline decoration-wavy decoration-red-500 decoration-1 underline-offset-3 font-bold text-red-300 tracking-wide">
              {activeCorrection.word}
            </span>
          </div>

          {/* Suggestions List */}
          <div className="space-y-1 my-1.5">
            {activeCorrection.suggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyCorrection(sug)}
                className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-sky-950/40 hover:bg-sky-600 hover:text-white border border-sky-800/50 hover:border-sky-400 transition font-medium group cursor-pointer"
              >
                <span className="font-bold text-white group-hover:text-white flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 group-hover:text-white" />
                  {sug}
                </span>
                <span className="text-[10px] text-sky-300 group-hover:text-sky-100">Aplicar</span>
              </button>
            ))}
          </div>

          {/* Action: Fix all accents in the entire field */}
          <div className="pt-2 mt-1 border-t border-slate-800 space-y-1">
            <button
              type="button"
              onClick={applyAutoCorrectAll}
              className="w-full text-left flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 hover:text-emerald-300 text-[11px] transition cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Corregir todas las tildes del texto</span>
            </button>

            {/* OMITIR CORRECCIÓN BUTTON */}
            <button
              type="button"
              onClick={() => handleIgnoreWord(activeCorrection.word)}
              className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-amber-300 text-[11px] transition cursor-pointer border border-transparent hover:border-slate-700"
            >
              <span className="flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Omitir corrección</span>
              </span>
              <span className="text-[10px] text-slate-500">Quitar subrayado</span>
            </button>
          </div>
        </div>
      )}

      {/* Quick feedback toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-9999 bg-slate-900/90 text-white border border-sky-400/50 px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-2 text-xs font-medium animate-in slide-in-from-bottom-2 fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
};
