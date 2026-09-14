import React from 'react';
import type { RiskLevel } from '../api/types';

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, className = '' }) => {
  const getStyles = () => {
    switch (level) {
      case 'LOW':
        return 'bg-green-50 text-risk-low border-risk-low/20';
      case 'MEDIUM':
        return 'bg-amber-50 text-risk-medium border-risk-medium/20';
      case 'HIGH':
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
