import React, { useState } from 'react';
import {
  MessageSquare,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  CornerDownRight,
  Layers,
  AlignLeft,
  FileText,
  Clock,
  User,
  Mail,
} from 'lucide-react';
import {
  ParsedThreadMessage,
  splitEmailThread,
} from '../../utils/emailThreadUtils';
import { EmailContentRenderer } from './EmailContentRenderer';

interface CleanEmailReaderProps {
  rawText?: string;
  rawHtml?: string;
  senderName?: string;
  senderEmail?: string;
  dateStr?: string;
  className?: string;
}

export const CleanEmailReader: React.FC<CleanEmailReaderProps> = ({
  rawText = '',
  rawHtml,
  senderName,
  senderEmail,
  dateStr,
  className = '',
}) => {
  const threadMessages: ParsedThreadMessage[] = splitEmailThread(rawText, senderName, dateStr);
  const isThread = threadMessages.length > 1;

  // View modes: 'thread' (if multi-message), 'latest' (single/focused), 'raw' (plain unstyled text)
  const [viewMode, setViewMode] = useState<'thread' | 'latest' | 'raw'>(isThread ? 'thread' : 'latest');
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
  const [isDisclaimerExpanded, setIsDisclaimerExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const latestMessage = threadMessages[0] || {
    id: 'msg_0',
    body: rawText,
    senderName,
    dateStr,
    isLatest: true,
  };

  const handleCopyText = () => {
    const textToCopy = viewMode === 'raw' ? rawText : latestMessage.body || rawText;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-sm ${className}`}>
      {/* Top Header / View Mode Controls Bar */}
      <div className="px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {isThread && (
            <button
              type="button"
              onClick={() => setViewMode('thread')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                viewMode === 'thread'
                  ? 'bg-cyan-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
              title="Ver la cadena completa de correos y respuestas"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Cola de Correos ({threadMessages.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setViewMode('latest')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              viewMode === 'latest'
                ? 'bg-cyan-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
            title={isThread ? 'Ver únicamente la última respuesta' : 'Vista con formato y tablas del correo'}
          >
            {isThread ? <MessageSquare className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
            <span>{isThread ? 'Última Respuesta' : 'Vista Correo'}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('raw')}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
              viewMode === 'raw'
                ? 'bg-cyan-500 text-slate-950 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
            }`}
            title="Ver texto plano original sin formato"
          >
            <AlignLeft className="w-3.5 h-3.5" />
            <span>Texto Plano</span>
          </button>
        </div>

        {/* Font size and Copy Action buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFontSize(fontSize === 'normal' ? 'large' : 'normal')}
            className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-mono font-bold transition cursor-pointer border border-slate-700/80"
            title={fontSize === 'normal' ? 'Aumentar tamaño de letra' : 'Restablecer tamaño de letra'}
          >
            {fontSize === 'normal' ? 'A+' : 'A-'}
          </button>

          <button
            type="button"
            onClick={handleCopyText}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition cursor-pointer border border-slate-700/80"
            title="Copiar texto del correo"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      {/* Main Email Display Area */}
      <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
        {/* VIEW 1: COLA DE MENSAJES (FULL THREAD) */}
        {viewMode === 'thread' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
              <span className="font-semibold text-cyan-300">
                Historial de Conversación ({threadMessages.length} correos enlazados)
              </span>
              <span>Orden de respuesta</span>
            </div>

            {threadMessages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`rounded-xl border p-4 transition shadow-xs ${
                  msg.isLatest
                    ? 'bg-slate-900/95 border-cyan-500/50 shadow-cyan-950/20'
                    : 'bg-slate-950/90 border-slate-800'
                }`}
              >
                {/* Header for this thread message */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 min-w-0">
                    {msg.isLatest ? (
                      <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold uppercase tracking-wider shrink-0">
                        Respuesta Reciente
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
                        <CornerDownRight className="w-3 h-3 text-cyan-400" />
                        Mensaje Anterior #{threadMessages.length - idx}
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {msg.senderName}
                    </span>
                  </div>
                  {msg.dateStr && (
                    <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                      {msg.dateStr}
                    </span>
                  )}
                </div>

                {/* Header snippet / quotation line if present */}
                {msg.headerSnippet && (
                  <div className="mb-2 text-[11px] text-slate-400 bg-slate-950/80 p-2 rounded border border-slate-800 font-mono">
                    {msg.headerSnippet}
                  </div>
                )}

                {/* Body with authentic tables and formatting */}
                <EmailContentRenderer
                  content={msg.body}
                  rawHtml={msg.isLatest ? rawHtml : undefined}
                  fontSize={fontSize}
                />

                {/* Signature if detected */}
                {msg.signature && (
                  <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
                    {msg.signature}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* VIEW 2: LATEST / SINGLE MESSAGE VIEW */}
        {viewMode === 'latest' && (
          <div className="space-y-4">
            {/* Sender & Date bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs border border-cyan-500/30">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Remitente:</span>
                  <strong className="text-white font-medium">{senderName || latestMessage.senderName || 'Remitente'}</strong>
                  {senderEmail && <span className="text-slate-400 font-mono text-[11px] ml-1.5">({senderEmail})</span>}
                </div>
              </div>

              {dateStr && (
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono bg-slate-900 px-2.5 py-1 rounded-md border border-slate-800">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>{dateStr}</span>
                </div>
              )}
            </div>

            {/* Content with authentic tables and formatting */}
            <EmailContentRenderer
              content={latestMessage.body || rawText}
              rawHtml={rawHtml}
              fontSize={fontSize}
            />

            {/* Signature Block */}
            {latestMessage.signature && (
              <div className="pt-3 border-t border-slate-800/80 mt-4">
                <div className="text-xs text-slate-400 font-medium pb-1 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>Firma del Correo:</span>
                </div>
                <div className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  {latestMessage.signature}
                </div>
              </div>
            )}

            {/* Collapsible Legal Disclaimer */}
            {latestMessage.disclaimer && (
              <div className="pt-2 border-t border-slate-900">
                <button
                  type="button"
                  onClick={() => setIsDisclaimerExpanded(!isDisclaimerExpanded)}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900/40 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-300 text-xs transition cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500/80" />
                    <span>Aviso Legal y Cláusula de Confidencialidad</span>
                  </span>
                  {isDisclaimerExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isDisclaimerExpanded && (
                  <div className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-500 leading-relaxed whitespace-pre-wrap font-sans">
                    {latestMessage.disclaimer}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: TEXTO PLANO (RAW) */}
        {viewMode === 'raw' && (
          <div className="space-y-2">
            <div className="text-xs text-slate-400 flex items-center justify-between pb-1 border-b border-slate-800">
              <span>Texto sin formato tal como fue recibido:</span>
              <span className="font-mono text-[11px] text-cyan-400">{rawText.length} caracteres</span>
            </div>
            <pre
              className={`p-3.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-slate-200 whitespace-pre-wrap break-all overflow-x-auto select-text ${
                fontSize === 'large' ? 'text-sm leading-relaxed' : 'text-xs leading-normal'
              }`}
            >
              {rawText || '(Sin contenido recibido)'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
