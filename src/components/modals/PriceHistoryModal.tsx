import React, { useState, useMemo } from 'react';
import {
  Search,
  Clock,
  TrendingUp,
  TrendingDown,
  Minimize2,
  X,
  Table,
  BarChart,
  LineChart,
} from 'lucide-react';
import { PriceHistoryEntry } from '../../types';
import {
  getPriceHistory,
  getPriceHistoryForEquipment,
  getLatestPriceForEquipment,
  getPriceStatsForEquipment,
} from '../../utils/priceHistory';

export interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: { name: string; roleLabel: string } | null;
}

export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEquipment, setSelectedEquipment] = useState<{ name: string; brand: string; model: string } | null>(null);

  const history = getPriceHistory();
  const filteredHistory = searchQuery
    ? history.filter(
        (h) =>
          h.equipmentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
          h.clientName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : history;

  // Agrupar por equipo único para el selector
  const uniqueEquipments = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ name: string; brand: string; model: string }> = [];
    for (const h of history) {
      const key = `${h.equipmentName}|${h.brand}|${h.model}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ name: h.equipmentName, brand: h.brand, model: h.model });
      }
    }
    return result;
  }, [history]);

  const selectedStats = selectedEquipment
    ? getPriceStatsForEquipment(
        selectedEquipment.name,
        selectedEquipment.brand,
        selectedEquipment.model
      )
    : null;

  const latestPrice = selectedEquipment
    ? getLatestPriceForEquipment(
        selectedEquipment.name,
        selectedEquipment.brand,
        selectedEquipment.model
      )
    : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1a2e] border border-[#334d6e] rounded-2xl shadow-2xl w-[95%] sm:w-[90%] max-w-[1400px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#132238] border-b border-[#243b5a] p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-bold text-white">Historial de Precios de Equipos</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-[#1e314b] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-6">
          {/* Búsqueda y selector */}
          <div className="flex flex-wrap gap-3 items-start">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar equipo, marca, modelo o cliente..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#14233a] border border-[#2d4972] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#38bdf8] outline-none"
                />
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <select
                  value={selectedEquipment ? `${selectedEquipment.name}|${selectedEquipment.brand}|${selectedEquipment.model}` : ''}
                  onChange={(e) => {
                    if (!e.target.value) {
                      setSelectedEquipment(null);
                    } else {
                      const [name, brand, model] = e.target.value.split('|');
                      setSelectedEquipment({ name, brand, model });
                    }
                  }}
                  className="w-full bg-[#14233a] border border-[#2d4972] rounded-xl px-4 py-2.5 text-sm text-white focus:border-[#38bdf8] outline-none"
                >
                  <option value="">Seleccionar equipo para ver estadísticas</option>
                  {uniqueEquipments.map((eq) => (
                    <option key={`${eq.name}|${eq.brand}|${eq.model}`} value={`${eq.name}|${eq.brand}|${eq.model}`}>
                      {eq.name} - {eq.brand} {eq.model}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Estadísticas del equipo seleccionado */}
          {selectedEquipment && selectedStats && (
            <div className="bg-[#15243b] border border-[#334d6e] rounded-xl p-5 flex flex-wrap gap-4">
              <div className="flex-1 min-w-[120px]">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Registros</div>
                <div className="text-2xl font-bold text-white">{selectedStats.count}</div>
              </div>
              <div className="flex-1 min-w-[120px]">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Precio Promedio</div>
                <div className="text-2xl font-bold text-white">${selectedStats.avgSalePrice.toLocaleString()}</div>
              </div>
              <div className="flex-1 min-w-[120px]">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Mínimo</div>
                <div className="text-2xl font-bold text-white">${selectedStats.minSalePrice.toLocaleString()}</div>
              </div>
              <div className="flex-1 min-w-[120px]">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Máximo</div>
                <div className="text-2xl font-bold text-white">${selectedStats.maxSalePrice.toLocaleString()}</div>
              </div>
              <div className="flex-1 min-w-[120px]">
                <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Margen Promedio</div>
                <div className="text-2xl font-bold text-cyan-400">{selectedStats.avgMargin}%</div>
              </div>
              {latestPrice && (
                <div className="flex-1 min-w-[120px]">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-bold">Última Venta</div>
                  <div className="text-2xl font-bold text-white">${latestPrice.unitSalePriceCOP.toLocaleString()}</div>
                  <div className="text-xs text-slate-400">{latestPrice.quoteDate}</div>
                </div>
              )}
            </div>
          )}

          {/* Tabla de historial */}
          <div className="bg-[#15243b] border border-[#334d6e] rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#111c2e] text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="px-4 py-3 font-bold">Equipo</th>
                  <th className="px-4 py-3 font-bold">Marca</th>
                  <th className="px-4 py-3 font-bold">Modelo</th>
                  <th className="px-4 py-3 font-bold text-right">Costo Base</th>
                  <th className="px-4 py-3 font-bold text-right">Precio Venta</th>
                  <th className="px-4 py-3 font-bold text-center">Margen</th>
                  <th className="px-4 py-3 font-bold">Cliente</th>
                  <th className="px-4 py-3 font-bold">Cotización</th>
                  <th className="px-4 py-3 font-bold text-right">Fecha</th>
                </tr>
              </thead>
              <tbody className="text-slate-300 divide-y divide-[#2d4972]">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-6 text-center text-slate-500">
                      No se encontraron registros.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-[#1e314b]/50 transition">
                      <td className="px-4 py-3 font-semibold text-white">{h.equipmentName}</td>
                      <td className="px-4 py-3 text-slate-400">{h.brand}</td>
                      <td className="px-4 py-3 text-slate-300">{h.model}</td>
                      <td className="px-4 py-3 text-right text-slate-400">${h.unitCostCOP.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">${h.unitSalePriceCOP.toLocaleString()}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            h.marginPercent >= 30
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : h.marginPercent >= 20
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-slate-500/20 text-slate-400'
                          }`}
                        >
                          {h.marginPercent}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{h.clientName}</td>
                      <td className="px-4 py-3 text-slate-400">{h.quoteNumber}</td>
                      <td className="px-4 py-3 text-right text-slate-400 text-[10px]">{h.quoteDate}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-slate-500 text-right mt-2">
            Mostrando {filteredHistory.length} de {history.length} registros
          </div>
        </div>
      </div>
    </div>
  );
};