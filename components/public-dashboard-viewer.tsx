'use client';

import { useState, useEffect } from 'react';
import type { PublishedDashboard } from '@/lib/db/schema';
import { V0Card } from '@/components/v0-card';
import { V0CardScriptRunner } from '@/components/v0card-script-runner';
import { formatDistanceToNow, format } from 'date-fns';

interface PublicDashboardViewerProps {
  dashboard: PublishedDashboard;
  html: string;
  script: string;
}

export function PublicDashboardViewer({ dashboard, html, script }: PublicDashboardViewerProps) {
  const [cardId] = useState(dashboard.cardId);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Dashboard is ready
    setIsLoading(false);
    console.log('[PublicDashboardViewer] Dashboard rendered:', cardId);
  }, [cardId]);

  const currentViews = parseInt(dashboard.currentViews || '0', 10);
  const maxViews = dashboard.maxViews ? parseInt(dashboard.maxViews, 10) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white dark:bg-slate-900 shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {dashboard.title}
              </h1>
              {dashboard.description && (
                <p className="text-slate-600 dark:text-slate-300 mt-1 text-sm">
                  {dashboard.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span>📊</span>
                  <span>Live Dashboard</span>
                </span>

                {dashboard.expiresAt && (
                  <span className="flex items-center gap-1.5">
                    <span>⏰</span>
                    <span>Expires {formatDistanceToNow(new Date(dashboard.expiresAt), { addSuffix: true })}</span>
                  </span>
                )}

                <span className="flex items-center gap-1.5">
                  <span>👁️</span>
                  <span>
                    {currentViews} {maxViews ? `/ ${maxViews}` : ''} views
                  </span>
                </span>

                <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span>Real-time</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/"
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Create Your Own
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-slate-600 dark:text-slate-300">Loading dashboard...</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg overflow-hidden">
            <div className="p-6">
              <V0Card id={cardId} html={html} />
              <V0CardScriptRunner cardId={cardId} script={script} />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-slate-900 mt-12 py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500 dark:text-slate-400">
            <div>
              Powered by <strong className="text-slate-900 dark:text-white">Jeeves Analytics</strong>
            </div>

            {dashboard.expiresAt && (
              <div>
                This dashboard expires on{' '}
                <strong className="text-slate-900 dark:text-white">
                  {format(new Date(dashboard.expiresAt), 'PPP')}
                </strong>
              </div>
            )}

            <div className="flex items-center gap-4">
              <a
                href="/docs"
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Documentation
              </a>
              <a
                href="/contact"
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}