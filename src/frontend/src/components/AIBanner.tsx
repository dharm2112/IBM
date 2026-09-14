import React from 'react';
import { Sparkles } from 'lucide-react';

interface AIBannerProps {
  children: React.ReactNode;
  className?: string;
}

export const AIBanner: React.FC<AIBannerProps> = ({ children, className = '' }) => {
  return (
    <div className={`bg-ai-accent border border-ai-border rounded-lg overflow-hidden ${className}`}>
      <div className="bg-white/50 px-4 py-2 border-b border-ai-border flex items-center space-x-2">
        <Sparkles size={14} className="text-ai-text" />
        <span className="text-xs font-medium text-ai-text uppercase tracking-wider">AI-generated demo response</span>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};
