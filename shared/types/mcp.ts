/**
 * MCP (Model Context Protocol) 类型定义
 */

/**
 * MCP 服务器连接类型
 */
export type McpServerType = "stdio" | "sse" | "ws";

/**
 * MCP 服务器环境变量
 */
export interface McpServerEnv {
  [key: string]: string;
}

/**
 * MCP 服务器配置
 */
export interface McpServerConfig {
  /** 服务器唯一标识 */
  id: string;
  /** 服务器名称 */
  name: string;
  /** 连接类型 */
  type: McpServerType;
  /** 命令 (stdio 类型) */
  command?: string;
  /** 命令参数 */
  args?: string[];
  /** 环境变量 */
  env?: McpServerEnv;
  /** URL (sse/ws 类型) */
  url?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 描述 */
  description?: string;
}

/**
 * MCP 工具定义
 */
export interface McpTool {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description?: string;
  /** 输入 schema JSON */
  inputSchema?: unknown;
}

/**
 * MCP 服务器状态
 */
export type McpServerStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "loading";

/**
 * MCP 服务器信息（包含状态和工具）
 */
export interface McpServerInfo extends McpServerConfig {
  /** 连接状态 */
  status?: McpServerStatus;
  /** 提供的工具列表 */
  tools?: McpTool[];
  /** 错误信息 */
  error?: string;
}

/**
 * MCP 服务器列表响应
 */
export interface McpServersResponse {
  servers: McpServerInfo[];
}

/**
 * 添加/更新 MCP 服务器请求
 */
export interface McpServerRequest {
  name: string;
  type: McpServerType;
  command?: string;
  args?: string[];
  env?: McpServerEnv;
  url?: string;
  description?: string;
}

/**
 * 测试 MCP 服务器请求
 */
export interface McpTestRequest {
  type: McpServerType;
  command?: string;
  args?: string[];
  env?: McpServerEnv;
  url?: string;
}

/**
 * 测试 MCP 服务器响应
 */
export interface McpTestResponse {
  success: boolean;
  status?: McpServerStatus;
  tools?: McpTool[];
  error?: string;
}
