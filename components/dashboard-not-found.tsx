export function DashboardNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Dashboard Not Found
        </h1>
        <p className="text-slate-600 dark:text-slate-300 mb-6">
          This dashboard doesn't exist or has been deleted.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Please check the URL or contact the dashboard owner for a new link.
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