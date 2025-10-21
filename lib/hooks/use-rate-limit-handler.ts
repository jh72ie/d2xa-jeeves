"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { RateLimitEvent, globalRateLimitMonitor } from '@/lib/ai/rate-limit-monitor';

export interface RateLimitState {
  isWaiting: boolean;
  waitTime: number;
  estimatedWait: number;
  context: string;
  type: 'approaching_limit' | 'limit_hit' | 'limit_reset' | null;
  currentLimits: any;
}

export interface UseRateLimitHandlerOptions {
  enableNotifications?: boolean;
  enableAutoRetry?: boolean;
  onRateLimitHit?: (event: RateLimitEvent) => void;
  onRateLimitReset?: (event: RateLimitEvent) => void;
}

export function useRateLimitHandler(options: UseRateLimitHandlerOptions = {}) {
  const {
    enableNotifications = true,
    enableAutoRetry = true,
    onRateLimitHit,
    onRateLimitReset
  } = options;

  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({
    isWaiting: false,
    waitTime: 0,
    estimatedWait: 0,
    context: '',
    type: null,
    currentLimits: null
  });

  const [notificationVisible, setNotificationVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle rate limit events
  const handleRateLimitEvent = useCallback((event: RateLimitEvent) => {
    console.log('[useRateLimitHandler] Received event:', event.type, event.context);

    switch (event.type) {
      case 'approaching_limit':
        setRateLimitState({
          isWaiting: false,
          waitTime: event.waitTime || 0,
          estimatedWait: event.estimatedWait || 0,
          context: event.context,
          type: 'approaching_limit',
          currentLimits: event.currentLimits
        });

        if (enableNotifications) {
          setNotificationVisible(true);
          // Auto-hide notification after 5 seconds for approaching limit
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            setNotificationVisible(false);
          }, 5000);
        }
        break;

      case 'limit_hit':
        setRateLimitState({
          isWaiting: true,
          waitTime: event.waitTime || 0,
          estimatedWait: event.estimatedWait || 0,
          context: event.context,
          type: 'limit_hit',
          currentLimits: event.currentLimits
        });

        if (enableNotifications) {
          setNotificationVisible(true);
        }

        // Custom callback
        if (onRateLimitHit) {
          onRateLimitHit(event);
        }
        break;

      case 'limit_reset':
        setRateLimitState(prev => ({
          ...prev,
          isWaiting: false,
          type: 'limit_reset',
          currentLimits: event.currentLimits
        }));

        if (enableNotifications) {
          // Show brief "resumed" notification
          setNotificationVisible(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => {
            setNotificationVisible(false);
          }, 3000);
        }

        // Custom callback
        if (onRateLimitReset) {
          onRateLimitReset(event);
        }
        break;
    }
  }, [enableNotifications, onRateLimitHit, onRateLimitReset]);

  // Subscribe to rate limit events
  useEffect(() => {
    const unsubscribe = globalRateLimitMonitor.onRateLimitEvent(handleRateLimitEvent);

    return () => {
      unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleRateLimitEvent]);

  // Manual controls
  const dismissNotification = useCallback(() => {
    setNotificationVisible(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  const forceReset = useCallback(() => {
    setRateLimitState({
      isWaiting: false,
      waitTime: 0,
      estimatedWait: 0,
      context: '',
      type: null,
      currentLimits: null
    });
    setNotificationVisible(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  // Get current rate limit status
  const getCurrentLimits = useCallback(() => {
    return globalRateLimitMonitor.getCurrentLimits();
  }, []);

  const getUsagePercentage = useCallback(() => {
    return globalRateLimitMonitor.getUsagePercentage();
  }, []);

  // Check if request would exceed limits
  const wouldExceedLimit = useCallback((estimatedTokens: number) => {
    const currentLimits = getCurrentLimits();
    return globalRateLimitMonitor.checkIfNearLimit(estimatedTokens);
  }, [getCurrentLimits]);

  // Get notification props for UI components
  const getNotificationProps = useCallback(() => {
    if (!notificationVisible || !rateLimitState.type) {
      return {
        isVisible: false,
        type: 'waiting' as const,
        context: '',
        waitTime: 0,
        estimatedWait: 0
      };
    }

    let notificationType: 'approaching_limit' | 'limit_hit' | 'waiting' | 'resumed';

    switch (rateLimitState.type) {
      case 'approaching_limit':
        notificationType = 'approaching_limit';
        break;
      case 'limit_hit':
        notificationType = 'limit_hit';
        break;
      case 'limit_reset':
        notificationType = 'resumed';
        break;
      default:
        notificationType = 'waiting';
    }

    return {
      isVisible: true,
      type: notificationType,
      context: rateLimitState.context,
      waitTime: rateLimitState.waitTime,
      estimatedWait: rateLimitState.estimatedWait,
      onDismiss: dismissNotification
    };
  }, [notificationVisible, rateLimitState, dismissNotification]);

  // Get analysis progress props
  const getAnalysisProgressProps = useCallback(() => {
    if (!rateLimitState.isWaiting) {
      return {
        status: 'analyzing' as const,
        rateLimitInfo: undefined
      };
    }

    return {
      status: 'rate_limited' as const,
      rateLimitInfo: {
        isWaiting: rateLimitState.isWaiting,
        waitTime: rateLimitState.waitTime,
        reason: `Rate limit reached during ${rateLimitState.context}`
      }
    };
  }, [rateLimitState]);

  return {
    // State
    rateLimitState,
    isWaiting: rateLimitState.isWaiting,
    notificationVisible,

    // Actions
    dismissNotification,
    forceReset,

    // Rate limit info
    getCurrentLimits,
    getUsagePercentage,
    wouldExceedLimit,

    // UI helpers
    getNotificationProps,
    getAnalysisProgressProps,

    // Direct monitor access
    monitor: globalRateLimitMonitor
  };
}