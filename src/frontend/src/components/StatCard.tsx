import React from 'react';

// ── Apple HIG Tokens ────────────────────────────────────────────────────────
const T = {
  surface:  '#ffffff',
  border:   'rgba(0,0,0,0.07)',
  text:     '#1D1D1F',
  sub:      '#6E6E73',
  muted:    '#AEAEB2',
  green:    '#34C759',
  red:      '#FF3B30',
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
  style?: React.CSSProperties;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, trend, className = '', style }) => {
  return (
    <div 
      className={className}
      style={{ 
        background: T.surface, 
        border: `1px solid ${T.border}`, 
        borderRadius: 16, 
        padding: '20px', 
        display: 'flex', 
        flexDirection: 'column', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        ...style 
      }}
    >
      <h3 style={{ fontSize: '10px', fontWeight: 600, color: T.sub, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 12px 0' }}>{title}</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div>
          <div style={{ fontSize: '34px', fontWeight: 300, color: T.text, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
          {subtitle && (
            <div style={{ fontSize: '11px', color: T.muted, marginTop: 8 }}>{subtitle}</div>
          )}
        </div>
        {trend && (
          <div style={{ 
            fontSize: '13px', 
            fontWeight: 500, 
            color: trend === 'up' ? T.red : trend === 'down' ? T.green : T.muted
          }}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </div>
        )}
      </div>
    </div>
  );
};
