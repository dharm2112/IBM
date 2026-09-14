import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, trend, className = '' }) => {
  return (
    <div className={`bg-base-card border border-base-border rounded-lg p-6 flex flex-col ${className}`}>
      <h3 className="text-sm font-semibold text-base-secondary mb-2">{title}</h3>
      <div className="flex items-end justify-between mt-auto">
        <div>
          <div className="text-3xl font-semibold text-base-ink leading-none">{value}</div>
          {subtitle && (
            <div className="text-sm text-base-muted mt-2">{subtitle}</div>
          )}
        </div>
        {trend && (
          <div className={`text-sm font-medium ${
            trend === 'up' ? 'text-risk-high' : trend === 'down' ? 'text-risk-low' : 'text-base-muted'
          }`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </div>
        )}
      </div>
    </div>
  );
};
