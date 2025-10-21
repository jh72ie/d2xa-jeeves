"use client";

import { useState } from "react";
import { MoreHorizontal, Eye, Copy, Edit, Pause, Play, BarChart3, Trash2 } from "lucide-react";

interface Dashboard {
  id: string;
  title: string;
  url: string;
  status: 'active' | 'expired' | 'paused' | 'revoked';
}

interface ActionMenuProps {
  dashboard: Dashboard;
  onDelete: (id: string) => void;
  onEdit?: (id: string) => void;
  onToggleStatus?: (id: string, newStatus: string) => void;
}

export function ActionMenu({ dashboard, onDelete, onEdit, onToggleStatus }: ActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(dashboard.url);
      // TODO: Add toast notification
      console.log('URL copied to clipboard');
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
    setIsOpen(false);
  };

  const handlePreview = () => {
    window.open(dashboard.url, '_blank');
    setIsOpen(false);
  };

  const handleToggleStatus = () => {
    if (onToggleStatus) {
      const newStatus = dashboard.status === 'active' ? 'paused' : 'active';
      onToggleStatus(dashboard.id, newStatus);
    }
    setIsOpen(false);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
    setIsOpen(false);
  };

  const confirmDelete = () => {
    onDelete(dashboard.id);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
            <div className="py-1">
              <button
                onClick={handlePreview}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Preview
              </button>

              <button
                onClick={handleCopyUrl}
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy URL
              </button>

              {onEdit && (
                <button
                  onClick={() => {
                    onEdit(dashboard.id);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Settings
                </button>
              )}

              {onToggleStatus && dashboard.status !== 'expired' && (
                <button
                  onClick={handleToggleStatus}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  {dashboard.status === 'active' ? (
                    <>
                      <Pause className="h-4 w-4" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Resume
                    </>
                  )}
                </button>
              )}

              <button
                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                disabled
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
                <span className="text-xs text-gray-400 ml-auto">Soon</span>
              </button>

              <hr className="my-1" />

              <button
                onClick={handleDelete}
                className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        )}

        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete Dashboard</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete "{dashboard.title}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}