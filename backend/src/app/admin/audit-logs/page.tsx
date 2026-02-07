"use client";

import { useState, useEffect } from "react";

interface AuditLog {
  id: string;
  workspace_id?: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  status: string;
  error_message?: string;
  created_at: string;
}

interface Pagination {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({ action: "" });
  const [pagination, setPagination] = useState<Pagination>({
    limit: 50,
    offset: 0,
    total: 0,
    hasMore: false,
  });

  useEffect(() => {
    fetchLogs();
  }, [filter, pagination.offset]);

  const fetchLogs = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.append("limit", String(pagination.limit));
      params.append("offset", String(pagination.offset));
      if (filter.action) params.append("action", filter.action);

      const response = await fetch(
        `/api/admin/audit-logs?${params.toString()}`,
      );
      const data = await response.json();

      if (data.success) {
        setLogs(data.data);
        setPagination({
          limit: data.pagination.limit,
          offset: data.pagination.offset,
          total: data.pagination.total,
          hasMore: data.pagination.hasMore,
        });
      } else {
        setError(data.error || "Failed to fetch audit logs");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Error fetching audit logs";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (action: string) => {
    setFilter({ action });
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const handleNextPage = () => {
    if (pagination.hasMore) {
      setPagination((prev) => ({ ...prev, offset: prev.offset + prev.limit }));
    }
  };

  const handlePreviousPage = () => {
    if (pagination.offset > 0) {
      setPagination((prev) => ({
        ...prev,
        offset: Math.max(0, prev.offset - prev.limit),
      }));
    }
  };

  const getStatusColor = (status: string) => {
    if (status === "SUCCESS") return "bg-green-100 text-green-800";
    if (status === "FAILED") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  const getActionColor = (action: string) => {
    if (action.includes("CREATE")) return "text-green-600";
    if (action.includes("UPDATE")) return "text-blue-600";
    if (action.includes("DELETE")) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-gray-600 mt-2">
          Complete audit trail of all system actions
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action (Filter)
            </label>
            <input
              type="text"
              value={filter.action}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., CREATE_USER"
            />
          </div>
          <div className="md:col-span-2">
            <button
              onClick={() => handleFilterChange("")}
              className="mt-7 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
            >
              Clear Filters
            </button>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          Showing {pagination.offset + 1}-
          {Math.min(pagination.offset + pagination.limit, pagination.total)} of{" "}
          {pagination.total} logs
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {/* Logs List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Loading audit logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No audit logs found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Entity
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                    Timestamp
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td
                      className={`px-6 py-4 text-sm font-medium ${getActionColor(log.action)}`}
                    >
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.entity_type}
                      {log.entity_id && (
                        <span className="text-gray-400">
                          {" "}
                          • {log.entity_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(log.status)}`}
                      >
                        {log.status}
                      </span>
                      {log.error_message && (
                        <p className="text-xs text-red-600 mt-1">
                          {log.error_message}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && logs.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
          <button
            onClick={handlePreviousPage}
            disabled={pagination.offset === 0}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {Math.floor(pagination.offset / pagination.limit) + 1} of{" "}
            {Math.ceil(pagination.total / pagination.limit)}
          </span>
          <button
            onClick={handleNextPage}
            disabled={!pagination.hasMore}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
