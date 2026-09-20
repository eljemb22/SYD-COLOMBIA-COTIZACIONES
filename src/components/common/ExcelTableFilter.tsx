import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Filter,
  ArrowUpAZ,
  ArrowDownZA,
  ArrowUp01,
  ArrowDown10,
  ArrowUpDown,
  Search,
  Check,
  Minus,
  X,
  RotateCcw,
  CheckSquare,
  Square,
  ChevronDown,
} from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | null;

export interface ExcelColumnConfig<T = any> {
  id: string;
  label: string;
  accessor?: (row: T) => any;
  type?: 'text' | 'number' | 'date' | 'boolean' | 'enum';
  formatter?: (val: any) => string;
  align?: 'left' | 'center' | 'right';
  minWidth?: string;
  width?: string;
  className?: string;
  disableFilter?: boolean;
  disableSort?: boolean;
}

export interface ExcelFilterState {
  // Mapping of columnId -> Set of selected raw stringified values
  // If undefined or null, all values are selected (no filter active)
  [columnId: string]: string[] | undefined;
}

export interface ExcelSortState {
  columnId: string | null;
  direction: SortDirection;
}

interface ExcelFilterPopoverProps<T> {
  column: ExcelColumnConfig<T>;
  allRows: T[];
  selectedValues: string[] | undefined; // undefined means all selected
  sortState: ExcelSortState;
  onApplyFilter: (columnId: string, selectedValues: string[] | undefined) => void;
  onApplySort: (columnId: string, direction: SortDirection) => void;
  onClearColumnFilter: (columnId: string) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
}

const BLANK_VALUE_KEY = '__BLANK_VALUE__';
const BLANK_VALUE_LABEL = '(En blanco)';

export function ExcelFilterPopover<T>({
  column,
  allRows,
  selectedValues,
  sortState,
  onApplyFilter,
  onApplySort,
  onClearColumnFilter,
  onClose,
  anchorRect,
}: ExcelFilterPopoverProps<T>) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [searchValue, setSearchValue] = useState('');

  // Extract distinct values and counts from allRows using accessor or column.id
  const { distinctItems, allDistinctValues } = useMemo(() => {
    const countsMap = new Map<string, { label: string; count: number; rawValue: any }>();
    const accessor = column.accessor || ((r: any) => r[column.id]);

    for (const row of allRows) {
      const raw = accessor(row);
      let strVal: string;
      let displayLabel: string;

      if (raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0)) {
        strVal = BLANK_VALUE_KEY;
        displayLabel = BLANK_VALUE_LABEL;
      } else if (Array.isArray(raw)) {
        // If array of items/strings, aggregate each
        for (const it of raw) {
          const itStr = typeof it === 'object' ? it?.name || JSON.stringify(it) : String(it);
          const itLabel = column.formatter ? column.formatter(it) : itStr;
          const curr = countsMap.get(itStr) || { label: itLabel, count: 0, rawValue: it };
          curr.count += 1;
          countsMap.set(itStr, curr);
        }
        continue;
      } else {
        strVal = String(raw);
        displayLabel = column.formatter ? column.formatter(raw) : strVal;
      }

      const current = countsMap.get(strVal) || { label: displayLabel, count: 0, rawValue: raw };
      current.count += 1;
      countsMap.set(strVal, current);
    }

    const items: Array<{ key: string; label: string; count: number; rawValue: any }> = [];
    countsMap.forEach((val, key) => {
      items.push({ key, label: val.label, count: val.count, rawValue: val.rawValue });
    });

    // Sort items alphabetically or numerically
    items.sort((a, b) => {
      if (a.key === BLANK_VALUE_KEY) return 1;
      if (b.key === BLANK_VALUE_KEY) return -1;
      if (column.type === 'number') {
        const numA = Number(a.rawValue) || 0;
        const numB = Number(b.rawValue) || 0;
        return numA - numB;
      }
      return a.label.localeCompare(b.label, 'es', { sensitivity: 'base', numeric: true });
    });

    const allKeys = items.map((i) => i.key);
    return { distinctItems: items, allDistinctValues: allKeys };
  }, [allRows, column]);

  // Local state of checked items in the popover before hitting "Aceptar"
  const [tempSelected, setTempSelected] = useState<Set<string>>(() => {
    if (selectedValues === undefined) {
      return new Set(allDistinctValues);
    }
    return new Set(selectedValues);
  });

  // Filter distinct items by search term
  const visibleItems = useMemo(() => {
    if (!searchValue.trim()) return distinctItems;
    const query = searchValue.toLowerCase().trim();
    return distinctItems.filter(
      (item) => item.label.toLowerCase().includes(query) || item.key.toLowerCase().includes(query)
    );
  }, [distinctItems, searchValue]);

  const visibleKeys = useMemo(() => visibleItems.map((i) => i.key), [visibleItems]);

  // Check state of "Seleccionar todo"
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((k) => tempSelected.has(k));
  const someVisibleSelected = visibleKeys.some((k) => tempSelected.has(k)) && !allVisibleSelected;

  // Toggle "Seleccionar todo"
  const handleToggleSelectAll = () => {
    const next = new Set(tempSelected);
    if (allVisibleSelected) {
      // Uncheck all visible
      visibleKeys.forEach((k) => next.delete(k));
    } else {
      // Check all visible
      visibleKeys.forEach((k) => next.add(k));
    }
    setTempSelected(next);
  };

  // Toggle single item
  const handleToggleItem = (key: string) => {
    const next = new Set(tempSelected);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setTempSelected(next);
  };

  // Select only this item
  const handleSelectOnly = (key: string) => {
    setTempSelected(new Set([key]));
  };

  // Handle Apply
  const handleApply = () => {
    // If all distinct values are selected, we treat it as no filter (undefined)
    if (tempSelected.size === allDistinctValues.length && allDistinctValues.every((k) => tempSelected.has(k))) {
      onApplyFilter(column.id, undefined);
    } else {
      onApplyFilter(column.id, Array.from(tempSelected));
    }
    onClose();
  };

  // Handle Clear
  const handleClear = () => {
    onClearColumnFilter(column.id);
    onClose();
  };

  // Handle Close with ESC and Click Outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
        // Apply filter on enter if not inside a textarea
        handleApply();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [tempSelected, allDistinctValues]);

  // Compute position relative to anchorRect
  const popoverStyle: React.CSSProperties = useMemo(() => {
    if (!anchorRect) {
      return { top: '50px', left: '50px' };
    }

    const width = 280;
    const padding = 8;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let left = anchorRect.left;
    if (left + width > windowWidth - padding) {
      left = Math.max(padding, windowWidth - width - padding);
    }

    let top = anchorRect.bottom + 4;
    const estimatedHeight = 380;
    if (top + estimatedHeight > windowHeight - padding && anchorRect.top > estimatedHeight) {
      top = anchorRect.top - estimatedHeight - 4;
    }

    return {
      position: 'fixed',
      top: `${Math.max(padding, top)}px`,
      left: `${Math.max(padding, left)}px`,
      width: `${width}px`,
      zIndex: 99999,
    };
  }, [anchorRect]);

  const isCurrentSortAsc = sortState.columnId === column.id && sortState.direction === 'asc';
  const isCurrentSortDesc = sortState.columnId === column.id && sortState.direction === 'desc';
  const isFiltered = selectedValues !== undefined && selectedValues.length < allDistinctValues.length;

  const isNumeric = column.type === 'number';

  return createPortal(
    <div
      ref={popoverRef}
      style={popoverStyle}
      className="bg-[#121f33] text-slate-100 border border-[#38bdf8]/50 rounded-xl shadow-2xl overflow-hidden font-sans text-xs animate-in fade-in zoom-in-95 duration-150 select-none flex flex-col max-h-[460px]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header bar */}
      <div className="bg-[#162740] px-3 py-2 border-b border-[#243a56] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Filter className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
          <span className="font-bold text-white truncate text-[11.5px]" title={column.label}>
            Filtro: {column.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-700/50 transition cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sorting section */}
      {!column.disableSort && (
        <div className="p-1.5 bg-[#0e192a] border-b border-[#243a56] space-y-0.5">
          <button
            type="button"
            onClick={() => onApplySort(column.id, isCurrentSortAsc ? null : 'asc')}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
              isCurrentSortAsc
                ? 'bg-[#38bdf8]/20 text-[#38bdf8] font-bold border border-[#38bdf8]/40'
                : 'text-slate-200 hover:bg-[#182b45] hover:text-white'
            }`}
          >
            {isNumeric ? <ArrowUp01 className="w-3.5 h-3.5 text-sky-400" /> : <ArrowUpAZ className="w-3.5 h-3.5 text-sky-400" />}
            <span className="flex-1">
              {isNumeric ? 'Ordenar de menor a mayor' : 'Ordenar de A a Z'}
            </span>
            {isCurrentSortAsc && <Check className="w-3 h-3 text-[#38bdf8]" />}
          </button>

          <button
            type="button"
            onClick={() => onApplySort(column.id, isCurrentSortDesc ? null : 'desc')}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition cursor-pointer ${
              isCurrentSortDesc
                ? 'bg-[#38bdf8]/20 text-[#38bdf8] font-bold border border-[#38bdf8]/40'
                : 'text-slate-200 hover:bg-[#182b45] hover:text-white'
            }`}
          >
            {isNumeric ? <ArrowDown10 className="w-3.5 h-3.5 text-sky-400" /> : <ArrowDownZA className="w-3.5 h-3.5 text-sky-400" />}
            <span className="flex-1">
              {isNumeric ? 'Ordenar de mayor a menor' : 'Ordenar de Z a A'}
            </span>
            {isCurrentSortDesc && <Check className="w-3 h-3 text-[#38bdf8]" />}
          </button>

          {isFiltered && (
            <button
              type="button"
              onClick={handleClear}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Borrar filtro de &ldquo;{column.label}&rdquo;</span>
            </button>
          )}
        </div>
      )}

      {/* Search Input Box */}
      <div className="p-2 border-b border-[#243a56] bg-[#121f33]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Buscar valores..."
            className="w-full bg-[#182a44] text-white placeholder-slate-400 border border-[#334d6e] rounded-lg pl-7 pr-7 py-1.5 text-xs focus:outline-none focus:border-[#38bdf8] transition"
            autoFocus
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => setSearchValue('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Values Selection List */}
      <div className="flex-1 overflow-y-auto max-h-48 p-1.5 space-y-0.5 divide-y divide-[#1e314b]/40">
        {/* Select All Option */}
        <div
          onClick={handleToggleSelectAll}
          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#182b45] cursor-pointer text-slate-200 group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-4 h-4 rounded border flex items-center justify-center transition ${
                allVisibleSelected
                  ? 'bg-[#38bdf8] border-[#38bdf8] text-slate-950'
                  : someVisibleSelected
                  ? 'bg-[#38bdf8]/40 border-[#38bdf8] text-white'
                  : 'border-[#4b6a94] bg-[#0e1726]'
              }`}
            >
              {allVisibleSelected ? (
                <Check className="w-3 h-3 stroke-[3]" />
              ) : someVisibleSelected ? (
                <Minus className="w-3 h-3 stroke-[3]" />
              ) : null}
            </div>
            <span className="font-bold text-white text-[11px] truncate">
              {searchValue ? '(Seleccionar resultados de búsqueda)' : '(Seleccionar todo)'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {tempSelected.size}/{allDistinctValues.length}
          </span>
        </div>

        {/* List of distinct values */}
        {visibleItems.length === 0 ? (
          <div className="py-4 text-center text-slate-400 text-[11px]">
            No se encontraron coincidencias
          </div>
        ) : (
          visibleItems.map((item) => {
            const isChecked = tempSelected.has(item.key);
            const isBlank = item.key === BLANK_VALUE_KEY;

            return (
              <div
                key={item.key}
                onClick={() => handleToggleItem(item.key)}
                className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg hover:bg-[#182b45] cursor-pointer group transition ${
                  isChecked ? 'text-white font-medium' : 'text-slate-400 font-normal'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition shrink-0 ${
                      isChecked
                        ? 'bg-[#38bdf8] border-[#38bdf8] text-slate-950'
                        : 'border-[#4b6a94] bg-[#0e1726]'
                    }`}
                  >
                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                  <span
                    className={`truncate text-[11px] ${
                      isBlank ? 'italic text-slate-400' : isChecked ? 'text-slate-100' : 'text-slate-400'
                    }`}
                    title={item.label}
                  >
                    {item.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectOnly(item.key);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-[9.5px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 hover:text-white transition cursor-pointer"
                    title="Seleccionar solo este valor"
                  >
                    Sólo este
                  </button>
                  <span className="text-[10px] text-slate-400 font-mono px-1 rounded bg-[#0b1422]">
                    {item.count}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-[#142338] px-3 py-2.5 border-t border-[#243a56] flex items-center justify-between gap-2">
        <div className="text-[10px] text-slate-400">
          <span className="font-semibold text-sky-300">{tempSelected.size}</span> de {allDistinctValues.length} elegidos
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-slate-700/50 rounded-lg transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-3 py-1 text-[11px] font-bold bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 rounded-lg transition shadow-xs cursor-pointer active:scale-95"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Excel Column Header component with title, Excel filter trigger button,
 * active indicator, sort badge, and popover toggle.
 */
export interface ExcelColumnHeaderProps<T = any> {
  column: ExcelColumnConfig<T>;
  allRows: T[];
  filters: ExcelFilterState;
  sort: ExcelSortState;
  onApplyFilter: (columnId: string, selectedValues: string[] | undefined) => void;
  onApplySort: (columnId: string, direction: SortDirection) => void;
  onClearColumnFilter: (columnId: string) => void;
  children?: React.ReactNode;
}

export function ExcelColumnHeader<T = any>({
  column,
  allRows,
  filters,
  sort,
  onApplyFilter,
  onApplySort,
  onClearColumnFilter,
  children,
}: ExcelColumnHeaderProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const selectedValues = filters[column.id];
  const isFiltered = selectedValues !== undefined;
  const isSorted = sort.columnId === column.id && sort.direction !== null;

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (buttonRef.current) {
      setAnchorRect(buttonRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  const alignClass =
    column.align === 'center'
      ? 'justify-center text-center'
      : column.align === 'right'
      ? 'justify-end text-right'
      : 'justify-between text-left';

  return (
    <div className={`flex items-center gap-1.5 ${alignClass} group/header relative`}>
      <div className="flex items-center gap-1 min-w-0 truncate">
        {children || <span className="truncate">{column.label}</span>}
        {isSorted && (
          <span className="text-sky-300 shrink-0">
            {sort.direction === 'asc' ? '▲' : '▼'}
          </span>
        )}
      </div>

      {!column.disableFilter && (
        <button
          ref={buttonRef}
          type="button"
          onClick={handleOpen}
          className={`p-1 rounded-md transition-all cursor-pointer shrink-0 flex items-center gap-0.5 ${
            isFiltered
              ? 'bg-[#38bdf8] text-slate-950 font-bold shadow-xs ring-1 ring-[#38bdf8]/50'
              : isSorted
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-700/60 opacity-70 group-hover/header:opacity-100'
          }`}
          title={`Filtro tipo Excel para "${column.label}"${isFiltered ? ' (Filtro Activo)' : ''}`}
        >
          <Filter className={`w-3 h-3 ${isFiltered ? 'stroke-[2.5]' : ''}`} />
          <ChevronDown className={`w-2.5 h-2.5 ${isFiltered ? 'stroke-[2.5]' : 'opacity-70'}`} />
        </button>
      )}

      {isOpen && (
        <ExcelFilterPopover
          column={column}
          allRows={allRows}
          selectedValues={selectedValues}
          sortState={sort}
          onApplyFilter={onApplyFilter}
          onApplySort={onApplySort}
          onClearColumnFilter={onClearColumnFilter}
          onClose={() => setIsOpen(false)}
          anchorRect={anchorRect}
        />
      )}
    </div>
  );
}

/**
 * Custom hook to manage Excel table filtering and sorting on any dataset
 */
export function useExcelTableFilters<T = any>(
  initialRows: T[],
  columns: ExcelColumnConfig<T>[]
) {
  const [filters, setFilters] = useState<ExcelFilterState>({});
  const [sort, setSort] = useState<ExcelSortState>({ columnId: null, direction: null });

  const columnsMap = useMemo(() => {
    const map = new Map<string, ExcelColumnConfig<T>>();
    columns.forEach((c) => map.set(c.id, c));
    return map;
  }, [columns]);

  const handleApplyFilter = (columnId: string, selectedValues: string[] | undefined) => {
    setFilters((prev) => {
      if (selectedValues === undefined) {
        const next = { ...prev };
        delete next[columnId];
        return next;
      }
      return { ...prev, [columnId]: selectedValues };
    });
  };

  const handleApplySort = (columnId: string, direction: SortDirection) => {
    setSort({ columnId: direction ? columnId : null, direction });
  };

  const handleClearColumnFilter = (columnId: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[columnId];
      return next;
    });
  };

  const handleResetAllFilters = () => {
    setFilters({});
    setSort({ columnId: null, direction: null });
  };

  const activeFiltersCount = useMemo(() => {
    return Object.keys(filters).length + (sort.columnId && sort.direction ? 1 : 0);
  }, [filters, sort]);

  const isFilteredOrSorted = activeFiltersCount > 0;

  // Compute filtered and sorted rows
  const processedRows = useMemo(() => {
    let result = [...initialRows];

    // 1. Apply column filters
    const filterKeys = Object.keys(filters);
    if (filterKeys.length > 0) {
      result = result.filter((row) => {
        for (const colId of filterKeys) {
          const selectedVals = filters[colId];
          if (!selectedVals) continue;

          const colConfig = columnsMap.get(colId);
          const accessor = colConfig?.accessor || ((r: any) => r[colId]);
          const raw = accessor(row);

          const allowedSet = new Set(selectedVals);

          if (raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0)) {
            if (!allowedSet.has(BLANK_VALUE_KEY)) return false;
          } else if (Array.isArray(raw)) {
            // For arrays, item matches if any item string is in allowedSet
            const hasMatch = raw.some((it) => {
              const str = typeof it === 'object' ? it?.name || JSON.stringify(it) : String(it);
              return allowedSet.has(str);
            });
            if (!hasMatch) return false;
          } else {
            const strVal = String(raw);
            if (!allowedSet.has(strVal)) return false;
          }
        }
        return true;
      });
    }

    // 2. Apply sorting
    if (sort.columnId && sort.direction) {
      const colConfig = columnsMap.get(sort.columnId);
      const accessor = colConfig?.accessor || ((r: any) => (r as any)[sort.columnId!]);
      const dir = sort.direction === 'asc' ? 1 : -1;
      const isNum = colConfig?.type === 'number';

      result.sort((a, b) => {
        const valA = accessor(a);
        const valB = accessor(b);

        if (valA === undefined || valA === null || valA === '') return 1;
        if (valB === undefined || valB === null || valB === '') return -1;

        if (isNum) {
          const numA = Number(valA) || 0;
          const numB = Number(valB) || 0;
          return (numA - numB) * dir;
        }

        return String(valA).localeCompare(String(valB), 'es', { sensitivity: 'base', numeric: true }) * dir;
      });
    }

    return result;
  }, [initialRows, filters, sort, columnsMap]);

  return {
    filteredRows: processedRows,
    filters,
    sort,
    onApplyFilter: handleApplyFilter,
    onApplySort: handleApplySort,
    onClearColumnFilter: handleClearColumnFilter,
    onResetAllFilters: handleResetAllFilters,
    activeFiltersCount,
    isFilteredOrSorted,
  };
}
