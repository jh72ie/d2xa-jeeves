"use client";

import { CheckCircle, XCircle, Pause, AlertTriangle, Lock } from "lucide-react";

interface StatusBadgeProps {
  status: 'active' | 'expired' | 'paused' | 'revoked';
  hasPassword?: boolean;
}

export function StatusBadge({ status, hasPassword }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'active':
        return {
          label: 'Active',
          icon: CheckCircle,
          className: 'bg-green-100 text-green-800 border-green-200',
        };
      case 'expired':
        return {
          label: 'Expired',
          icon: XCircle,
          className: 'bg-red-100 text-red-800 border-red-200',
        };
      case 'paused':
        return {
          label: 'Paused',
          icon: Pause,
          className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        };
      case 'revoked':
        return {
          label: 'Revoked',
          icon: XCircle,
          className: 'bg-gray-100 text-gray-800 border-gray-200',
        };
      default:
        return {
          label: 'Unknown',
          icon: AlertTriangle,
          className: 'bg-gray-100 text-gray-800 border-gray-200',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </span>
      {hasPassword && (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
          <Lock className="h-3 w-3" />
          Protected
        </span>
      )}
    </div>
  );
}