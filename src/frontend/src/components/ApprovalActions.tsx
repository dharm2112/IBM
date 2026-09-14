import React, { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';

interface ApprovalActionsProps {
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  status?: string;
}

export const ApprovalActions: React.FC<ApprovalActionsProps> = ({ onApprove, onReject, status }) => {
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  if (status && status !== 'PENDING' && status !== 'Draft' && status !== 'Pending Review') {
    return (
      <div className="text-sm font-medium text-base-secondary">
        Status: <span className="text-base-ink">{status}</span>
      </div>
    );
  }

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      await onApprove();
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await onReject();
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={handleReject}
        disabled={isApproving || isRejecting}
        className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-base-ink bg-white border border-base-border hover:bg-slate-50 hover:border-slate-300 rounded-md shadow-sm transition-colors disabled:opacity-50"
      >
        {isRejecting ? <Loader2 size={16} className="animate-spin" /> : <X size={16} className="text-risk-high" />}
        <span>Reject</span>
      </button>
      
      <button
        onClick={handleApprove}
        disabled={isApproving || isRejecting}
        className="flex items-center space-x-1.5 px-3 py-1.5 text-sm font-medium text-white bg-base-ink hover:bg-black rounded-md shadow-sm transition-colors disabled:opacity-50"
      >
        {isApproving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        <span>Approve</span>
      </button>
    </div>
  );
};
