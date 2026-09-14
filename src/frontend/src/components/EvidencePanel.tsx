import React from 'react';
import { SeverityBadge } from './SeverityBadge';
import type { Severity } from '../api/types';

interface EvidencePanelProps {
  expected: string;
  actual: string;
  severity: Severity;
  className?: string;
}

export const EvidencePanel: React.FC<EvidencePanelProps> = ({ expected, actual, severity, className = '' }) => {
  return (
    <div className={`border border-base-border rounded-lg bg-base-bg overflow-hidden flex flex-col md:flex-row ${className}`}>
      <div className="flex-1 p-4 border-b md:border-b-0 md:border-r border-base-border bg-slate-50/50">
        <h4 className="text-xs font-semibold text-base-muted uppercase tracking-wider mb-2">Expected</h4>
        <p className="text-sm font-medium text-base-ink">{expected}</p>
      </div>
      
      <div className="flex-1 p-4 relative">
        <h4 className="text-xs font-semibold text-base-muted uppercase tracking-wider mb-2">Actual</h4>
        <p className="text-sm font-medium text-base-ink">{actual}</p>
        
        <div className="absolute top-4 right-4">
          <SeverityBadge level={severity} />
        </div>
      </div>
    </div>
  );
};
