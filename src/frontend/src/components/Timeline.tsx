import React from 'react';
import { Check, AlertTriangle, Circle } from 'lucide-react';

export interface TimelineItem {
  id: string;
  title: string;
  subtitle?: string;
  status: 'Completed' | 'Pending' | 'Deviation' | 'Active';
  date?: string;
  onClick?: () => void;
  isActive?: boolean;
}

interface TimelineProps {
  items: TimelineItem[];
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ items, orientation = 'vertical', className = '' }) => {
  const isHorizontal = orientation === 'horizontal';

  return (
    <div className={`flex ${isHorizontal ? 'flex-row items-start overflow-x-auto pb-4' : 'flex-col'} ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <div 
            key={item.id} 
            className={`flex ${isHorizontal ? 'flex-row items-center' : 'flex-row'} relative ${item.onClick ? 'cursor-pointer group' : ''}`}
            onClick={item.onClick}
          >
            {/* Horizontal Line Connector */}
            {isHorizontal && !isLast && (
              <div className="absolute top-4 left-4 w-full h-0.5 bg-base-border -z-10" style={{ width: 'calc(100% + 2rem)' }}></div>
            )}
            
            <div className={`flex ${isHorizontal ? 'flex-col items-center mr-8' : 'flex-col items-center mr-4'} relative`}>
              {/* Vertical Line Connector */}
              {!isHorizontal && !isLast && (
                <div className="absolute top-8 left-1/2 -ml-[1px] w-0.5 h-full bg-base-border -z-10"></div>
              )}
              
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                item.status === 'Completed' ? 'bg-risk-low border-risk-low text-white' :
                item.status === 'Deviation' ? 'bg-risk-medium border-risk-medium text-white shadow-[0_0_0_4px_rgba(245,158,11,0.2)]' :
                item.status === 'Active' ? 'bg-white border-base-ink text-base-ink' :
                'bg-slate-100 border-base-border text-slate-400'
              } ${item.isActive ? 'ring-2 ring-offset-2 ring-base-ink' : ''} ${item.onClick ? 'group-hover:ring-2 group-hover:ring-offset-2 group-hover:ring-base-border' : ''}`}>
                {item.status === 'Completed' ? <Check size={14} strokeWidth={3} /> :
                 item.status === 'Deviation' ? <AlertTriangle size={14} strokeWidth={2.5} /> :
                 item.status === 'Active' ? <Circle size={10} fill="currentColor" /> :
                 <span className="text-xs font-medium">{index + 1}</span>}
              </div>
              
              {isHorizontal && (
                <div className="mt-3 text-center w-24">
                  <h4 className="text-xs font-semibold text-base-ink uppercase tracking-wider">{item.title}</h4>
                  {item.subtitle && <p className="text-xs text-base-muted mt-0.5">{item.subtitle}</p>}
                  {item.status === 'Deviation' && <p className="text-xs font-medium text-risk-medium mt-1 flex items-center justify-center gap-1"><AlertTriangle size={10} /> Deviation</p>}
                  {item.status === 'Completed' && <p className="text-xs text-base-muted mt-1 flex items-center justify-center gap-1"><Check size={10} /> Completed</p>}
                </div>
              )}
            </div>
            
            {!isHorizontal && (
              <div className="pb-8 pt-1">
                <h4 className="text-sm font-semibold text-base-ink">{item.title}</h4>
                {item.subtitle && <p className="text-sm text-base-secondary mt-1">{item.subtitle}</p>}
                {item.date && <p className="text-xs text-base-muted mt-1">{item.date}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
