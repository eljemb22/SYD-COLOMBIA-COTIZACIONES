import React, { useEffect } from 'react';
import { History, X } from 'lucide-react';
import { OCTrackingItem } from '../../../types';

interface OCHistoryModalProps {
  contractName: string;
  item: OCTrackingItem;
  onClose: () => void;
}

export const OCHistoryModal: React.FC<OCHistoryModalProps> = ({ contractName, item, onClose }) => {
  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-3 sm:p-5 md:p-6 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#192b45] border border-[#334d6e] rounded-2xl w-full max-w-3xl lg:max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-3.5 sm:p-4 bg-[#142338] border-b border-[#334d6e] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-400" />
            <div>
              <h3 className="text-sm font-black text-white">Bitácora & Trazabilidad de Eventos</h3>
              <p className="text-[11px] text-slate-400">{item.name} • {item.ocNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-3 text-xs">
          <div className="bg-[#15253d] p-3 rounded-xl border border-[#334d6e] flex items-center justify-between">
            <div>
              <span className="text-[10.5px] text-slate-400 block">Orden / Contrato:</span>
              <strong className="text-white text-xs font-bold">{contractName}</strong>
            </div>
            <div className="text-right">
              <span className="text-[10.5px] text-slate-400 block">Estado Actual:</span>
              <span className="font-bold text-sky-300">{item.status}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
              <span>Línea de Tiempo ({item.history?.length || 0} registros)</span>
            </h4>

            {!item.history || item.history.length === 0 ? (
              <p className="text-slate-500 italic p-4 text-center">No hay registros de historial previos.</p>
            ) : (
              item.history.map((log, idx) => (
                <div
                  key={log.id || idx}
                  className="bg-[#15253d] p-3 rounded-xl border border-[#2d4666] space-y-1 relative pl-4 border-l-4 border-l-purple-400"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-purple-300">{log.newStatus}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.timestamp).toLocaleString('es-CO')}
                    </span>
                  </div>
                  <p className="text-slate-200 text-xs">{log.note}</p>
                  <div className="text-[10px] text-slate-400">
                    Registrado por: <strong className="text-slate-300">{log.user}</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-3 bg-[#142338] border-t border-[#334d6e] text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#15253d] hover:bg-[#203654] text-white rounded-xl font-bold text-xs cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
