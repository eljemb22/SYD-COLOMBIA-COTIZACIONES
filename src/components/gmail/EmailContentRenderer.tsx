import React from 'react';
import { TableData, parseEmailContentToBlocks } from '../../utils/emailTableParser';

interface EmailContentRendererProps {
  content: string;
  rawHtml?: string;
  fontSize?: 'normal' | 'large';
  className?: string;
}

export const EmailContentRenderer: React.FC<EmailContentRendererProps> = ({
  content,
  rawHtml,
  fontSize = 'normal',
  className = '',
}) => {
  const blocks = parseEmailContentToBlocks(content, rawHtml);

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, idx) => {
        if (block.type === 'text') {
          if (!block.content.trim()) return null;
          return (
            <div
              key={idx}
              className={`select-text leading-relaxed whitespace-pre-wrap text-slate-100 ${
                fontSize === 'large' ? 'text-base sm:text-lg leading-loose' : 'text-sm sm:text-[15px]'
              }`}
            >
              {block.content}
            </div>
          );
        }

        if (block.type === 'table') {
          return <AuthenticEmailTable key={idx} table={block.table} fontSize={fontSize} />;
        }

        return null;
      })}
    </div>
  );
};

/**
 * Renders an authentic table matching the exact layout and style of the original email client:
 * Vibrant cyan/sky-blue header (#00a2e8), crisp 1px black borders, white cell backgrounds, black text.
 */
interface AuthenticEmailTableProps {
  table: TableData;
  fontSize?: 'normal' | 'large';
}

export const AuthenticEmailTable: React.FC<AuthenticEmailTableProps> = ({ table, fontSize = 'normal' }) => {
  if (!table.headers || table.headers.length === 0) return null;

  return (
    <div
      data-email-table="true"
      data-email-canvas="true"
      className="authentic-email-table email-preview-canvas email-sheet-paper my-3 overflow-hidden rounded-xs border border-black shadow-md bg-white text-black"
      style={{
        backgroundColor: 'var(--syd-text-primary)',
        color: '#000000',
        colorScheme: 'light',
      }}
    >
      {/* Scroll container for responsiveness on smaller screens */}
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse border border-black text-left table-auto"
          style={{
            borderCollapse: 'collapse',
            border: '1px solid #000000',
            backgroundColor: 'var(--syd-text-primary)',
            color: '#000000',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {/* Header Row */}
          <thead>
            <tr style={{ backgroundColor: '#00a2e8' }}>
              {table.headers.map((header, hIdx) => {
                const hLower = header.toLowerCase();
                const isCentered =
                  hLower.includes('parte') ||
                  hLower.includes('precio') ||
                  hLower.includes('iva') ||
                  hLower.includes('cant') ||
                  hLower.includes('marca');

                return (
                  <th
                    key={hIdx}
                    className={`font-bold uppercase tracking-tight px-3 py-2 border border-black text-black ${
                      fontSize === 'large' ? 'text-sm' : 'text-xs sm:text-sm'
                    } ${isCentered ? 'text-center' : 'text-left'}`}
                    style={{
                      backgroundColor: '#00a2e8',
                      color: '#000000',
                      border: '1px solid #000000',
                      padding: '8px 10px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ color: '#000000', fontWeight: 'bold' }}>{header}</span>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody>
            {table.rows.map((row, rIdx) => (
              <tr
                key={rIdx}
                className="hover:bg-sky-50/40 transition-colors"
                style={{ backgroundColor: 'var(--syd-text-primary)' }}
              >
                {table.headers.map((header, cIdx) => {
                  const cellValue = row.cells[cIdx] !== undefined ? row.cells[cIdx] : '';
                  const hLower = header.toLowerCase();
                  const isPrice = hLower.includes('precio') || hLower.includes('valor');
                  const isCentered =
                    hLower.includes('iva') ||
                    hLower.includes('cant') ||
                    hLower.includes('parte') ||
                    hLower.includes('marca');

                  return (
                    <td
                      key={cIdx}
                      className={`border border-black align-top px-3 py-2 text-black leading-snug ${
                        fontSize === 'large' ? 'text-sm' : 'text-xs sm:text-sm'
                      } ${isPrice ? 'text-right font-mono font-medium' : isCentered ? 'text-center' : 'text-left'}`}
                      style={{
                        border: '1px solid #000000',
                        color: '#000000',
                        padding: '8px 10px',
                        backgroundColor: 'var(--syd-text-primary)',
                      }}
                    >
                      {cellValue ? (
                        <span
                          className="whitespace-pre-wrap text-black"
                          style={{ color: '#000000', display: 'inline-block' }}
                        >
                          {cellValue}
                        </span>
                      ) : (
                        <span className="text-transparent select-none">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
