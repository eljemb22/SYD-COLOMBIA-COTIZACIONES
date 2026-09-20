import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Play,
  Download,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Table,
  FileCode,
  Layers,
  ArrowRight,
  TrendingUp,
  Search,
  Code2
} from 'lucide-react';
import {
  MedicalEquipment,
  SavedQuote,
  TenderClientProject,
  OCTrackingContract,
  SalesOrderRecord,
  SalesInvoiceRecord,
  AuthUser
} from '../../types';
import { createSyDRelationalDatabase } from '../../services/sqlStudioService';

interface SQLAnalyticsViewProps {
  equipments: MedicalEquipment[];
  savedQuotes: SavedQuote[];
  tenderClients: TenderClientProject[];
  ocContracts: OCTrackingContract[];
  salesOrders: SalesOrderRecord[];
  salesInvoices: SalesInvoiceRecord[];
  currentUser: AuthUser | null;
}

const PRESET_QUERIES = [
  {
    id: 'top-cotizados',
    title: 'Top 10 Equipos Más Cotizados y Rentabilidad',
    description: 'Calcula cantidad total, ingreso estimado y margen promedio por equipo médico.',
    sql: `SELECT 
  name AS equipo, 
  brand AS marca, 
  SUM(quantity) AS cant_total,
  ROUND(SUM(total_sale_price_cop)) AS ingreso_total_cop,
  ROUND(AVG(margin_percentage), 1) AS margen_promedio_pct
FROM quote_items
GROUP BY name, brand
ORDER BY cant_total DESC
LIMIT 10;`
  },
  {
    id: 'resumen-clientes',
    title: 'Ranking de Clientes por Valor Cotizado',
    description: 'Agrupa cotizaciones por cliente, cantidad de cotizaciones y total en COP.',
    sql: `SELECT 
  client_name AS cliente, 
  city AS ciudad, 
  COUNT(*) AS num_cotizaciones,
  ROUND(SUM(total_cop)) AS valor_total_cop
FROM quotations
GROUP BY client_name, city
ORDER BY valor_total_cop DESC;`
  },
  {
    id: 'catalogo-marcas',
    title: 'Distribución de Catálogo por Fabricante / Marca',
    description: 'Muestra cantidad de equipos en catálogo y promedio de costo base por marca.',
    sql: `SELECT 
  brand AS fabricante, 
  COUNT(*) AS total_equipos,
  ROUND(AVG(base_cost_cop)) AS costo_base_promedio_cop,
  MIN(base_cost_cop) AS costo_min_cop,
  MAX(base_cost_cop) AS costo_max_cop
FROM equipments
GROUP BY brand
ORDER BY total_equipos DESC;`
  },
  {
    id: 'licitaciones-resumen',
    title: 'Estado de Licitaciones y Presupuestos Oficiales',
    description: 'Resumen de procesos licitatorios, ciudad y presupuesto total asignado.',
    sql: `SELECT 
  client_name AS entidad, 
  process_number AS num_proceso, 
  city AS ciudad, 
  status AS estado,
  items_count AS cantidad_items,
  ROUND(budget_cop) AS presupuesto_oficial_cop
FROM tender_clients
ORDER BY budget_cop DESC;`
  },
  {
    id: 'analisis-margenes',
    title: 'Análisis de Cotizaciones por Lista de Margen (L1 - L8)',
    description: 'Identifica cuáles listas de margen comercial se utilizan más frecuentemente.',
    sql: `SELECT 
  margin_type AS lista_margen, 
  COUNT(*) AS lineas_cotizadas,
  ROUND(SUM(total_sale_price_cop)) AS total_vendido_cop,
  ROUND(SUM(profit_cop)) AS utilidad_bruta_cop
FROM quote_items
GROUP BY margin_type
ORDER BY total_vendido_cop DESC;`
  }
];

export const SQLAnalyticsView: React.FC<SQLAnalyticsViewProps> = ({
  equipments,
  savedQuotes,
  tenderClients,
  ocContracts,
  salesOrders,
  salesInvoices,
  currentUser
}) => {
  const [query, setQuery] = useState(PRESET_QUERIES[0].sql);
  const [results, setResults] = useState<{ columns: string[]; values: any[][] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [executionTimeMs, setExecutionTimeMs] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbInstance, setDbInstance] = useState<any>(null);
  const [selectedTable, setSelectedTable] = useState<string>('quotations');

  // Initialize and populate SQLite database
  useEffect(() => {
    let isMounted = true;
    const initDb = async () => {
      try {
        const db = await createSyDRelationalDatabase({
          equipments,
          savedQuotes,
          tenderClients,
          ocContracts,
          salesOrders,
          salesInvoices
        });
        if (isMounted) {
          setDbInstance(db);
        }
      } catch (err: any) {
        console.error('Error initializing SQL database:', err);
      }
    };
    initDb();
    return () => {
      isMounted = false;
    };
  }, [equipments, savedQuotes, tenderClients, ocContracts, salesOrders, salesInvoices]);

  // Execute SQL Query
  const handleExecuteQuery = (sqlToRun?: string) => {
    const textToRun = sqlToRun || query;
    if (!dbInstance || !textToRun.trim()) return;

    setLoading(true);
    setError(null);
    const start = performance.now();

    try {
      const res = dbInstance.exec(textToRun);
      const elapsed = performance.now() - start;
      setExecutionTimeMs(Number(elapsed.toFixed(2)));

      if (res && res.length > 0) {
        setResults({
          columns: res[0].columns,
          values: res[0].values
        });
      } else {
        setResults({ columns: ['Mensaje'], values: [['Consulta ejecutada con éxito. (0 registros retornados)']] });
      }
    } catch (err: any) {
      setError(err.message || 'Error de sintaxis en la consulta SQL');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  // Run first query automatically when DB is ready
  useEffect(() => {
    if (dbInstance) {
      handleExecuteQuery(PRESET_QUERIES[0].sql);
    }
  }, [dbInstance]);

  const handleCopySQL = () => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    if (!results || results.values.length === 0) return;
    const headers = results.columns.join(',');
    const rows = results.values.map(row => 
      row.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `syd_reporte_sql_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const availableTables = [
    { name: 'equipments', count: equipments.length, desc: 'Catálogo de 306+ equipos y fichas' },
    { name: 'quotations', count: savedQuotes.length, desc: 'Cotizaciones registradas' },
    { name: 'quote_items', count: savedQuotes.reduce((acc, q) => acc + (q.items?.length || 0), 0), desc: 'Líneas detalladas de cotización' },
    { name: 'tender_clients', count: tenderClients.length, desc: 'Procesos de licitación' },
    { name: 'tender_items', count: tenderClients.reduce((acc, tc) => acc + (tc.items?.length || 0), 0), desc: 'Items de licitaciones y contratos' },
    { name: 'purchase_orders', count: ocContracts.reduce((acc, c) => acc + (c.purchaseOrders?.length || 0), 0), desc: 'Órdenes de Compra a proveedores' },
    { name: 'sales_orders', count: salesOrders.length, desc: 'Órdenes de Venta y Despacho' },
  ];

  return (
    <div id="sql-analytics-view-container" className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold border border-cyan-400/30">
              <Database className="w-3.5 h-3.5" />
              <span>Motor Relacional SQL & Analítica de Datos SYD</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Consultas SQL en Vivo
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl">
              Explora, cruza y analiza todos los datos del proyecto (Catálogo, Cotizaciones, Licitaciones, OCs y Facturación) usando sintaxis SQL estándar de alto rendimiento.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={!results || results.values.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Exportar a Excel / CSV</span>
            </button>
            <button
              onClick={() => handleExecuteQuery()}
              disabled={loading || !dbInstance}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs sm:text-sm font-black transition-all shadow-lg shadow-cyan-500/25 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>{loading ? 'Ejecutando...' : 'Ejecutar SQL (Ctrl+Enter)'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Left Presets / Schema, Right Editor & Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Preset Queries & Tables Schema */}
        <div className="lg:col-span-4 space-y-6">
          {/* Preset Queries */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Consultas SQL Predefinidas</span>
            </h3>
            <div className="space-y-2">
              {PRESET_QUERIES.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    setQuery(preset.sql);
                    handleExecuteQuery(preset.sql);
                  }}
                  className="w-full text-left p-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-cyan-500/40 transition-all group cursor-pointer"
                >
                  <p className="text-xs font-bold text-cyan-300 group-hover:text-cyan-200">{preset.title}</p>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Tables Schema */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2 mb-3">
              <Table className="w-4 h-4 text-cyan-400" />
              <span>Tablas Disponibles en Base de Datos</span>
            </h3>
            <div className="space-y-2">
              {availableTables.map((tbl) => (
                <div
                  key={tbl.name}
                  onClick={() => {
                    const q = `SELECT * FROM ${tbl.name} LIMIT 10000000;`;
                    setQuery(q);
                    handleExecuteQuery(q);
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 transition-all cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                    <div>
                      <p className="font-mono font-bold text-slate-200">{tbl.name}</p>
                      <p className="text-[10px] text-slate-400">{tbl.desc}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold">
                    {tbl.count} filas
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: SQL Editor & Result Grid */}
        <div className="lg:col-span-8 space-y-6">
          {/* SQL Editor Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-slate-300">Editor SQL interactivo</span>
                {executionTimeMs !== null && (
                  <span className="text-[11px] text-emerald-400 font-mono ml-2">
                    ⚡ {executionTimeMs} ms
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopySQL}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                  title="Copiar SQL"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>
            </div>

            <div className="p-3">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleExecuteQuery();
                  }
                }}
                rows={7}
                placeholder="Escribe tu consulta SQL aquí... Ej: SELECT * FROM quotations;"
                className="w-full bg-slate-950 text-cyan-300 font-mono text-xs sm:text-sm p-4 rounded-xl border border-slate-800 focus:outline-none focus:border-cyan-500 resize-y leading-relaxed"
                spellCheck={false}
              />
            </div>
          </div>

          {/* Results Area */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">Resultado de la Consulta</span>
                {results && (
                  <span className="text-[11px] text-slate-400 ml-2">
                    ({results.values.length} filas retornadas)
                  </span>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs font-mono">
                ❌ <strong>Error SQL:</strong> {error}
              </div>
            )}

            <div className="overflow-x-auto max-h-96">
              {results && results.values.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="bg-slate-950 text-slate-300 border-b border-slate-800">
                      {results.columns.map((col, idx) => (
                        <th key={idx} className="p-3 font-bold text-cyan-400 whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {results.values.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-800/50 transition-colors">
                        {row.map((cell, cIdx) => {
                          const colName = (results.columns[cIdx] || '').toLowerCase();
                          let displayValue = cell === null || cell === undefined ? 'null' : String(cell);

                          if (typeof cell === 'number' && !Number.isNaN(cell)) {
                            if (colName.includes('cop') || colName.includes('precio') || colName.includes('costo') || colName.includes('total') || colName.includes('valor') || colName.includes('ingreso') || colName.includes('utilidad') || colName.includes('presupuesto')) {
                              displayValue = `$${Math.round(cell).toLocaleString('es-CO')}`;
                            } else if (colName.includes('pct') || colName.includes('margen') || colName.includes('porcentaje')) {
                              displayValue = `${cell.toLocaleString('es-CO')}%`;
                            } else {
                              displayValue = cell.toLocaleString('es-CO');
                            }
                          }

                          return (
                            <td key={cIdx} className="p-3 whitespace-nowrap text-slate-300">
                              {cell === null || cell === undefined ? (
                                <span className="text-slate-600 italic">null</span>
                              ) : (
                                displayValue
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Sin datos para mostrar. Ejecuta una consulta SQL para visualizar resultados.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
