"use client";

import { formatDistanceToNow } from "date-fns";
import { StatusBadge } from "./status-badge";
import { ActionMenu } from "./action-menu";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";

interface Dashboard {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  url: string;
  status: 'active' | 'expired' | 'paused' | 'revoked';
  createdAt: Date;
  expiresAt: Date | null;
  currentViews: number;
  maxViews: number | null;
  hasPassword: boolean;
  streams: any[];
  lastAccessed: Date | null;
  userEmail: string | null;
  userName: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface DashboardTableProps {
  dashboards: Dashboard[];
  loading: boolean;
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export function DashboardTable({
  dashboards,
  loading,
  pagination,
  onPageChange,
  onDelete,
  onRefresh
}: DashboardTableProps) {
  const formatUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname;
      return `${domain}${path.substring(0, 20)}${path.length > 20 ? '...' : ''}`;
    } catch {
      return url.substring(0, 30) + (url.length > 30 ? '...' : '');
    }
  };

  if (loading && dashboards.length === 0) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading dashboards...</p>
        </div>
      </div>
    );
  }

  if (dashboards.length === 0) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-8 text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8zm0 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No dashboards found</h3>
          <p className="text-gray-500 mb-4">
            You haven't published any dashboards yet. Create and publish your first dashboard to see it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Title</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">User</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">URL</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Status</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Views</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Created</th>
              <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {dashboards.map((dashboard) => (
              <tr key={dashboard.id} className="hover:bg-gray-50">
                <td className="py-4 px-4">
                  <div>
                    <div className="font-medium text-gray-900 truncate max-w-xs">
                      {dashboard.title}
                    </div>
                    {dashboard.description && (
                      <div className="text-sm text-gray-500 truncate max-w-xs">
                        {dashboard.description}
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {dashboard.userEmail || 'Unknown User'}
                    </div>
                    {dashboard.userEmail && dashboard.userName !== dashboard.userEmail && (
                      <div className="text-gray-500 truncate max-w-xs">
                        {dashboard.userName}
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 font-mono">
                      {formatUrl(dashboard.url)}
                    </span>
                    <button
                      onClick={() => window.open(dashboard.url, '_blank')}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <StatusBadge status={dashboard.status} hasPassword={dashboard.hasPassword} />
                </td>
                <td className="py-4 px-4">
                  <div className="text-sm">
                    <div className="font-medium">{dashboard.currentViews.toLocaleString()}</div>
                    {dashboard.maxViews && (
                      <div className="text-gray-500">
                        of {dashboard.maxViews.toLocaleString()}
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="text-sm text-gray-600">
                    {formatDistanceToNow(new Date(dashboard.createdAt), { addSuffix: true })}
                  </div>
                  {dashboard.expiresAt && (
                    <div className="text-xs text-gray-400">
                      Expires {formatDistanceToNow(new Date(dashboard.expiresAt), { addSuffix: true })}
                    </div>
                  )}
                </td>
                <td className="py-4 px-4 relative">
                  <ActionMenu
                    dashboard={dashboard}
                    onDelete={onDelete}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} results
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={!pagination.hasPrev}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`px-3 py-2 text-sm border rounded-md ${
                      page === pagination.page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={!pagination.hasNext}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}