/**
 * MCP Settings Component
 * MCP 服务器配置管理界面
 */

import { useState, useCallback, useEffect } from "react";
import {
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import type {
  McpServerInfo,
  McpServerType,
} from "../../../../shared/types/mcp";
import { mcpApi, McpApiError } from "../../services/mcpApi";

export function McpSettings() {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingServers, setTestingServers] = useState<Set<string>>(new Set());
  const [expandedServers, setExpandedServers] = useState<Set<string>>(
    new Set(),
  );

  // 新服务器表单状态
  const [newServer, setNewServer] = useState({
    name: "",
    type: "stdio" as McpServerType,
    command: "",
    args: "",
    description: "",
  });

  // 加载 MCP 服务器列表
  const loadServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await mcpApi.getMcpServers();
      setServers(data);
    } catch (err) {
      const message =
        err instanceof McpApiError ? err.message : "Failed to load MCP servers";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 添加服务器
  const handleAddServer = useCallback(async () => {
    try {
      setError(null);

      // 解析 args
      const args = newServer.args.trim()
        ? newServer.args.split(/\s+/).filter(Boolean)
        : undefined;

      await mcpApi.addMcpServer({
        name: newServer.name,
        type: newServer.type,
        command: newServer.command || undefined,
        args,
        description: newServer.description || undefined,
      });

      // 重置表单
      setNewServer({
        name: "",
        type: "stdio",
        command: "",
        args: "",
        description: "",
      });
      setShowAddForm(false);

      // 重新加载列表
      await loadServers();
    } catch (err) {
      const message =
        err instanceof McpApiError ? err.message : "Failed to add server";
      setError(message);
    }
  }, [newServer, loadServers]);

  // 删除服务器
  const handleDeleteServer = useCallback(
    async (serverId: string) => {
      if (!confirm("Are you sure you want to delete this MCP server?")) {
        return;
      }

      try {
        setError(null);
        await mcpApi.deleteMcpServer(serverId);
        await loadServers();
      } catch (err) {
        const message =
          err instanceof McpApiError ? err.message : "Failed to delete server";
        setError(message);
      }
    },
    [loadServers],
  );

  // 测试服务器连接
  const handleTestServer = useCallback(
    async (serverId: string, server: McpServerInfo) => {
      try {
        setTestingServers((prev) => new Set(prev).add(serverId));

        await mcpApi.testMcpServer({
          type: server.type,
          command: server.command,
          args: server.args,
          env: server.env,
          url: server.url,
        });

        // 更新服务器状态
        setServers((prev) =>
          prev.map((s) =>
            s.id === serverId ? { ...s, status: "connected" as const } : s,
          ),
        );

        setTimeout(() => {
          setTestingServers((prev) => {
            const next = new Set(prev);
            next.delete(serverId);
            return next;
          });
        }, 1000);
      } catch {
        setServers((prev) =>
          prev.map((s) =>
            s.id === serverId
              ? { ...s, status: "error" as const, error: "Connection failed" }
              : s,
          ),
        );

        setTestingServers((prev) => {
          const next = new Set(prev);
          next.delete(serverId);
          return next;
        });
      }
    },
    [],
  );

  // 切换展开状态
  const toggleExpand = useCallback((serverId: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev);
      if (next.has(serverId)) {
        next.delete(serverId);
      } else {
        next.add(serverId);
      }
      return next;
    });
  }, []);

  // 初始加载
  useEffect(() => {
    loadServers();
  }, [loadServers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            MCP Servers
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Model Context Protocol 服务器配置
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          Add Server
        </button>
      </div>

      {/* Add Server Form */}
      {showAddForm && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <h4 className="text-md font-medium text-slate-800 dark:text-slate-100 mb-4">
            Add MCP Server
          </h4>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={newServer.name}
                onChange={(e) =>
                  setNewServer({ ...newServer, name: e.target.value })
                }
                placeholder="my-mcp-server"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Type
              </label>
              <select
                value={newServer.type}
                onChange={(e) =>
                  setNewServer({
                    ...newServer,
                    type: e.target.value as McpServerType,
                  })
                }
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="stdio">stdio (Command)</option>
                <option value="sse">SSE (HTTP)</option>
                <option value="ws">WebSocket</option>
              </select>
            </div>

            {/* Command (stdio only) */}
            {newServer.type === "stdio" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Command
                </label>
                <input
                  type="text"
                  value={newServer.command}
                  onChange={(e) =>
                    setNewServer({ ...newServer, command: e.target.value })
                  }
                  placeholder="npx"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Args (stdio only) */}
            {newServer.type === "stdio" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Arguments (space-separated)
                </label>
                <input
                  type="text"
                  value={newServer.args}
                  onChange={(e) =>
                    setNewServer({ ...newServer, args: e.target.value })
                  }
                  placeholder="@my-mcp-server@latest"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={newServer.description}
                onChange={(e) =>
                  setNewServer({ ...newServer, description: e.target.value })
                }
                placeholder="My custom MCP server"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleAddServer}
                disabled={
                  !newServer.name ||
                  (newServer.type === "stdio" && !newServer.command)
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Add Server
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Server List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <WrenchScrewdriverIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-400">
            No MCP servers configured
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
            Add an MCP server to extend Claude's capabilities
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => {
            const isExpanded = expandedServers.has(server.id);
            const isTesting = testingServers.has(server.id);

            return (
              <div
                key={server.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
              >
                {/* Server Header */}
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleExpand(server.id)}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDownIcon className="w-4 h-4 text-slate-500" />
                      ) : (
                        <ChevronRightIcon className="w-4 h-4 text-slate-500" />
                      )}
                    </button>

                    {/* Status Indicator */}
                    {isTesting ? (
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : server.status === "connected" ? (
                      <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    ) : server.status === "error" ? (
                      <XCircleIcon className="w-5 h-5 text-red-500" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                    )}

                    <div>
                      <h4 className="font-medium text-slate-800 dark:text-slate-100">
                        {server.name}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {server.type}
                        {server.command && ` • ${server.command}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestServer(server.id, server)}
                      disabled={isTesting}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                      title="Test connection"
                    >
                      <WrenchScrewdriverIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                    </button>
                    <button
                      onClick={() => handleDeleteServer(server.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Delete server"
                    >
                      <TrashIcon className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-200 dark:border-slate-700 pt-4">
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">
                          Type
                        </dt>
                        <dd className="text-slate-800 dark:text-slate-200 font-mono">
                          {server.type}
                        </dd>
                      </div>
                      {server.command && (
                        <div>
                          <dt className="text-slate-500 dark:text-slate-400">
                            Command
                          </dt>
                          <dd className="text-slate-800 dark:text-slate-200 font-mono">
                            {server.command}
                          </dd>
                        </div>
                      )}
                      {server.args && server.args.length > 0 && (
                        <div className="col-span-2">
                          <dt className="text-slate-500 dark:text-slate-400">
                            Arguments
                          </dt>
                          <dd className="text-slate-800 dark:text-slate-200 font-mono">
                            {server.args.join(" ")}
                          </dd>
                        </div>
                      )}
                      {server.description && (
                        <div className="col-span-2">
                          <dt className="text-slate-500 dark:text-slate-400">
                            Description
                          </dt>
                          <dd className="text-slate-800 dark:text-slate-200">
                            {server.description}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
