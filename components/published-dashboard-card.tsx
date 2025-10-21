'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface PublishedDashboardCardProps {
  url: string;
  slug: string;
  title: string;
  expiresAt?: string | null;
  maxViews?: number | null;
  currentViews?: number;
  hasPassword?: boolean;
}

export function PublishedDashboardCard({
  url,
  slug,
  title,
  expiresAt,
  maxViews,
  currentViews = 0,
  hasPassword = false,
}: PublishedDashboardCardProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="border border-green-200 dark:border-green-800 rounded-lg p-5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white text-xl">
          ✓
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            Dashboard Published
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            <strong>{title}</strong> is now live and ready to share
          </p>
        </div>
      </div>

      {/* URL Display */}
      <div className="mt-4 p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
        <code className="text-sm text-slate-900 dark:text-slate-100 break-all block">
          {url}
        </code>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={copyLink}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm"
        >
          {copied ? (
            <>
              <span>✓</span>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <span>📋</span>
              <span>Copy Link</span>
            </>
          )}
        </button>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
        >
          <span>🔗</span>
          <span>Open Dashboard</span>
        </a>
      </div>

      {/* Metadata */}
      <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span>👁️</span>
          <span>
            {currentViews} {maxViews ? `/ ${maxViews}` : ''} views
          </span>
        </div>

        {expiresAt && (
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span>⏰</span>
            <span>Expires {formatDistanceToNow(new Date(expiresAt), { addSuffix: true })}</span>
          </div>
        )}

        {hasPassword && (
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <span>🔒</span>
            <span>Password protected</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span>Live</span>
        </div>
      </div>

      {/* Tips */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>💡 Tip:</strong> Share this link via Slack, email, or any messaging app.
          Recipients don't need an account to view the dashboard.
        </p>
      </div>
    </div>
  );
}