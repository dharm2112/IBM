import React, { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronRight, ChevronLeft, Search } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: keyof T;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T>({ data, columns, keyField, onRowClick, className = '' }: DataTableProps<T>) {
  return (
    <div className={`overflow-x-auto bg-base-card rounded-lg border border-base-border ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-base-border bg-slate-50/50">
            {columns.map((col) => (
              <th 
                key={col.key} 
                className={`px-6 py-3 text-xs font-semibold text-base-secondary uppercase tracking-wider ${
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                }`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-base-border">
          {data.map((row) => (
            <tr 
              key={String(row[keyField])} 
              className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
              onClick={() => onRowClick && onRowClick(row)}
            >
              {columns.map((col) => (
                <td 
                  key={col.key} 
                  className={`px-6 py-4 text-sm text-base-ink ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  }`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-6 py-8 text-center text-sm text-base-muted">
                No data available.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
