import React from 'react';
import type { Severity } from '../api/types';

interface SeverityBadgeProps {
  level: Severity;
  className?: string;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ level, className = '' }) => {
  const getStyles = () => {
    switch (level) {
      case 'MINOR':
        return 'bg-green-50 text-risk-low border-risk-low/20';
      case 'MAJOR':
        return 'bg-amber-50 text-risk-medium border-risk-medium/20';
      case 'CRITICAL':
        return 'bg-red-50 text-risk-high border-risk-high/20';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200';
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${getStyles()} ${className}`}>
      {level}
    </span>
  );
};
