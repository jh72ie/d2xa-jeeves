'use client';

import { useState } from 'react';
import { V0Card } from '@/components/v0-card';
import { V0CardScriptRunner } from '@/components/v0card-script-runner';

interface DashboardCardWithPublishProps {
  cardId: string;
  html: string;
  script: string;
  onPublish: (options: {
    cardId: string;
    html: string;
    script: string;
    title: string;
    expiresIn: string;
    password?: string;
    maxViews?: number;
  }) => void;
}

export function DashboardCardWithPublish({
  cardId,
  html,
  script,
  onPublish,
}: DashboardCardWithPublishProps) {
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [title, setTitle] = useState('Dashboard');
  const [expiresIn, setExpiresIn] = useState<'1h' | '24h' | '7d' | '30d' | 'never'>('never');
  const [password, setPassword] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [useViewLimit, setUseViewLimit] = useState(false);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await onPublish({
        cardId,
        html,
        script,
        title,
        expiresIn,
        password: usePassword ? password : undefined,
        maxViews: useViewLimit && maxViews ? parseInt(maxViews, 10) : undefined,
      });
      setShowPublishDialog(false);
    } catch (error) {
      console.error('Failed to publish:', error);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="mb-3">
      {/* Dashboard Display */}
      <div className="relative border border-blue-500/30 rounded-lg overflow-hidden">
        <V0Card id={cardId} html={html} />
        <V0CardScriptRunner cardId={cardId} script={script} />

        {/* Publish Button Overlay */}
        <div className="absolute top-2 right-2 z-10">
          <button
            onClick={() => setShowPublishDialog(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-lg transition-colors"
          >
            <span>🔗</span>
            <span>Publish Dashboard</span>
          </button>
        </div>
      </div>

      {/* Publish Dialog */}
      {showPublishDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Publish Dashboard</h2>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Dashboard Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                  placeholder="My Dashboard"
                />
              </div>

              {/* Expiry */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Expires In
                </label>
                <select
                  value={expiresIn}
                  onChange={(e) => setExpiresIn(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                >
                  <option value="never">Never</option>
                  <option value="1h">1 Hour</option>
                  <option value="24h">24 Hours</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                </select>
              </div>

              {/* Password Protection */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePassword}
                    onChange={(e) => setUsePassword(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Password Protection</span>
                </label>
                {usePassword && (
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg mt-2 dark:bg-slate-700 dark:border-slate-600"
                    placeholder="Enter password"
                  />
                )}
              </div>

              {/* View Limit */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useViewLimit}
                    onChange={(e) => setUseViewLimit(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm font-medium">Limit Views</span>
                </label>
                {useViewLimit && (
                  <input
                    type="number"
                    value={maxViews}
                    onChange={(e) => setMaxViews(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg mt-2 dark:bg-slate-700 dark:border-slate-600"
                    placeholder="Maximum views (e.g., 100)"
                    min="1"
                  />
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPublishDialog(false)}
                disabled={publishing}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !title}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}