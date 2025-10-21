"use client";

import { useState, useEffect } from "react";
import { DashboardTable } from "./dashboard-table";
import { SummaryCards } from "./summary-cards";
import { SearchBar } from "./search-bar";

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

interface DashboardsResponse {
  success: boolean;
  dashboards: Dashboard[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary: {
    totalDashboards: number;
    activeDashboards: number;
    totalViews: number;
  };
}

interface DashboardControlPanelProps {
  userId: string;
}

export default function DashboardControlPanel({ userId }: DashboardControlPanelProps) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [summary, setSummary] = useState({
    totalDashboards: 0,
    activeDashboards: 0,
    totalViews: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    page: 1,
  });

  const fetchDashboards = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: filters.page.toString(),
        limit: pagination.limit.toString(),
        ...(filters.status !== 'all' && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/dashboards?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboards');
      }

      const data: DashboardsResponse = await response.json();
      setDashboards(data.dashboards);
      setPagination(data.pagination);
      setSummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboards();
  }, [filters]);

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/dashboards/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete dashboard');
      }

      // Refresh the list
      fetchDashboards();
    } catch (err) {
      console.error('Delete error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete dashboard');
    }
  };

  const handleFiltersChange = (newFilters: Partial<typeof filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  if (loading && dashboards.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading dashboards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="text-sm text-red-800">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SummaryCards summary={summary} />

      <SearchBar
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      <DashboardTable
        dashboards={dashboards}
        loading={loading}
        pagination={pagination}
        onPageChange={handlePageChange}
        onDelete={handleDelete}
        onRefresh={fetchDashboards}
      />
    </div>
  );
}