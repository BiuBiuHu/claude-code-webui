/**
 * MCP API 服务
 */

import type {
  McpServerInfo,
  McpServerRequest,
  McpTestRequest,
  McpTestResponse,
  McpServersResponse,
} from "../../../shared/types/mcp";

const API_BASE = "/api/mcp";

class McpApiError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "McpApiError";
    this.statusCode = statusCode;
  }
}

export { McpApiError };

/**
 * 获取 MCP 服务器列表
 */
export async function getMcpServers(): Promise<McpServerInfo[]> {
  const response = await fetch(`${API_BASE}/servers`);

  if (!response.ok) {
    throw new McpApiError("Failed to fetch MCP servers", response.status);
  }

  const data: McpServersResponse = await response.json();
  return data.servers;
}

/**
 * 添加 MCP 服务器
 */
export async function addMcpServer(
  server: McpServerRequest,
): Promise<{ server: McpServerInfo }> {
  const response = await fetch(`${API_BASE}/servers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(server),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new McpApiError(
      error.error || "Failed to add MCP server",
      response.status,
    );
  }

  return response.json();
}

/**
 * 删除 MCP 服务器
 */
export async function deleteMcpServer(serverId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/servers/${serverId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new McpApiError("Failed to delete MCP server", response.status);
  }
}

/**
 * 测试 MCP 服务器连接
 */
export async function testMcpServer(
  request: McpTestRequest,
): Promise<McpTestResponse> {
  const response = await fetch(`${API_BASE}/servers/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new McpApiError("Failed to test MCP server", response.status);
  }

  return response.json();
}

/**
 * 获取 MCP 服务器的工具列表
 */
export async function getMcpServerTools(
  serverId: string,
): Promise<{ serverId: string; tools: unknown[]; message?: string }> {
  const response = await fetch(`${API_BASE}/servers/${serverId}/tools`);

  if (!response.ok) {
    throw new McpApiError("Failed to fetch MCP server tools", response.status);
  }

  return response.json();
}

export const mcpApi = {
  getMcpServers,
  addMcpServer,
  deleteMcpServer,
  testMcpServer,
  getMcpServerTools,
};
