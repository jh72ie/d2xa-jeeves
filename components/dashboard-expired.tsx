import { format } from 'date-fns';

interface DashboardExpiredProps {
  reason: 'expired' | 'revoked';
  expiresAt?: Date;
}

export function DashboardExpired({ reason, expiresAt }: DashboardExpiredProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">
          {reason === 'expired' ? '⏰' : '🚫'}
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {reason === 'expired' ? 'Dashboard Expired' : 'Dashboard No Longer Available'}
        </h1>
        {reason === 'expired' && expiresAt ? (
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            This dashboard expired on{' '}
            <strong>{format(expiresAt, 'MMMM d, yyyy')}</strong>.
          </p>
        ) : (
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            The owner has revoked access to this dashboard.
          </p>
        )}
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Contact the dashboard owner to request a new link.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Homepage
        </a>
      </div>
    </div>
  );
}