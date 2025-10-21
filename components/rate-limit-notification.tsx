"use client";

import { useState, useEffect } from "react";
import { Clock, AlertTriangle, CheckCircle, X } from "lucide-react";

export interface RateLimitNotificationProps {
  isVisible: boolean;
  type: 'approaching_limit' | 'limit_hit' | 'waiting' | 'resumed';
  context: string;
  waitTime?: number;
  estimatedWait?: number;
  onCancel?: () => void;
  onDismiss?: () => void;
  showProgress?: boolean;
}

export function RateLimitNotification({
  isVisible,
  type,
  context,
  waitTime = 0,
  estimatedWait = 0,
  onCancel,
  onDismiss,
  showProgress = true
}: RateLimitNotificationProps) {
  const [countdown, setCountdown] = useState(estimatedWait);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isVisible || type === 'resumed') return;

    setCountdown(estimatedWait);
    setProgress(0);

    if (estimatedWait > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => {
          const newCount = Math.max(0, prev - 1);
          setProgress(((estimatedWait - newCount) / estimatedWait) * 100);

          if (newCount <= 0) {
            clearInterval(timer);
          }
          return newCount;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isVisible, estimatedWait, type]);

  if (!isVisible) return null;

  const getNotificationConfig = () => {
    switch (type) {
      case 'approaching_limit':
        return {
          icon: AlertTriangle,
          iconColor: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          title: 'Rate Limit Approaching',
          message: `Analysis will pause briefly due to API rate limits. Continuing with ${context}...`,
          showCountdown: false
        };

      case 'limit_hit':
      case 'waiting':
        return {
          icon: Clock,
          iconColor: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          title: 'Rate Limit Reached',
          message: `Waiting for rate limit reset during ${context}. Analysis will resume automatically.`,
          showCountdown: true
        };

      case 'resumed':
        return {
          icon: CheckCircle,
          iconColor: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          title: 'Analysis Resumed',
          message: `Rate limit reset. Continuing with ${context}.`,
          showCountdown: false
        };

      default:
        return {
          icon: Clock,
          iconColor: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          title: 'Processing',
          message: context,
          showCountdown: false
        };
    }
  };

  const config = getNotificationConfig();
  const Icon = config.icon;

  // For full-screen modal (when waiting)
  if (type === 'limit_hit' || type === 'waiting') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 rounded-full ${config.bgColor}`}>
              <Icon className={`h-6 w-6 ${config.iconColor}`} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{config.title}</h3>
          </div>

          <p className="text-gray-600 mb-6">
            {config.message}
          </p>

          {config.showCountdown && countdown > 0 && (
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-blue-600 mb-3">
                {countdown}s
              </div>

              {showProgress && (
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full transition-all duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              )}

              <p className="text-sm text-gray-500 mt-2">
                Automatically resuming when rate limit resets
              </p>
            </div>
          )}

          <div className="flex gap-3">
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel Analysis
              </button>
            )}
            <button
              disabled
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md opacity-50 cursor-not-allowed"
            >
              Waiting for Reset...
            </button>
          </div>
        </div>
      </div>
    );
  }

  // For banner notifications (approaching limit, resumed)
  return (
    <div className={`rounded-lg border p-4 mb-4 ${config.bgColor} ${config.borderColor}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${config.iconColor}`} />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium ${config.iconColor.replace('text-', 'text-').replace('-600', '-800')}`}>
            {config.title}
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            {config.message}
          </p>

          {config.showCountdown && countdown > 0 && (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">Resuming in:</span>
                <span className={`font-bold ${config.iconColor}`}>
                  {countdown}s
                </span>
              </div>

              {showProgress && (
                <div className="w-full bg-white bg-opacity-50 rounded-full h-2 mt-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-1000 ease-linear ${config.iconColor.replace('text-', 'bg-')}`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-1 rounded-md hover:bg-white hover:bg-opacity-50 transition-colors"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}