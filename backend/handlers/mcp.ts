/**
 * MCP API 处理器
 *
 * 处理所有 MCP 服务器配置相关的 API 请求
 */

import type { Context } from "hono";
import type {
  McpServersResponse,
  McpServerRequest,
  McpServerInfo,
  McpTestRequest,
  McpTestResponse,
} from "../../shared/types/mcp.ts";
import { readTextFile, writeTextFile, exists } from "../utils/fs.ts";
import { join } from "node:path";
import { logger } from "../utils/logger.ts";
import { spawn } from "node:child_process";

/**
 * 获取 MCP 配置文件路径
 */
function getMcpConfigPath(): string {
  const appRoot = process.cwd();
  // 从 backend 目录向上到项目根目录
  const projectRoot = join(appRoot, "..");
  return join(projectRoot, ".mcp.json");
}

/**
 * 读取 MCP 配置文件
 */
async function readMcpConfig(): Promise<Record<string, unknown>> {
  const configPath = getMcpConfigPath();

  if (!(await exists(configPath))) {
    return { mcpServers: {} };
  }

  try {
    const content = await readTextFile(configPath);
    return JSON.parse(content);
  } catch (error) {
    logger.mcp.error("Error reading MCP config: {error}", { error });
    return { mcpServers: {} };
  }
}

/**
 * 写入 MCP 配置文件
 */
async function writeMcpConfig(config: Record<string, unknown>): Promise<void> {
  const configPath = getMcpConfigPath();
  await writeTextFile(configPath, JSON.stringify(config, null, 2));
}

/**
 * 生成服务器 ID（从名称生成）
 */
function generateServerId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * GET /api/mcp/servers
 * 获取 MCP 服务器列表
 */
export async function handleGetMcpServers(c: Context): Promise<Response> {
  try {
    const config = await readMcpConfig();
    const mcpServers = (config.mcpServers as Record<string, unknown>) || {};

    const servers: McpServerInfo[] = Object.entries(mcpServers).map(
      ([id, serverConfig]) => {
        const config = serverConfig as {
          type: string;
          command?: string;
          args?: string[];
          env?: Record<string, string>;
          url?: string;
        };

        return {
          id,
          name: id,
          type: (config.type as "stdio" | "sse" | "ws") || "stdio",
          command: config.command,
          args: config.args,
          env: config.env,
          url: config.url,
          enabled: true,
          status: "disconnected",
        };
      },
    );

    const response: McpServersResponse = { servers };

    logger.mcp.debug("Returned {count} MCP servers", { count: servers.length });

    return c.json(response);
  } catch (error) {
    logger.mcp.error("Error getting MCP servers", { error });
    return c.json({ error: "Failed to get MCP servers" }, 500);
  }
}

/**
 * POST /api/mcp/servers
 * 添加 MCP 服务器
 */
export async function handleAddMcpServer(c: Context): Promise<Response> {
  try {
    const body = await c.req.json<McpServerRequest>();

    // 验证必填字段
    if (!body.name || !body.type) {
      return c.json({ error: "Name and type are required" }, 400);
    }

    if (body.type === "stdio" && !body.command) {
      return c.json({ error: "Command is required for stdio type" }, 400);
    }

    if ((body.type === "sse" || body.type === "ws") && !body.url) {
      return c.json({ error: "URL is required for sse/ws type" }, 400);
    }

    const config = await readMcpConfig();
    const mcpServers = (config.mcpServers as Record<string, unknown>) || {};

    // 生成服务器 ID
    const serverId = generateServerId(body.name);

    // 检查是否已存在
    if (mcpServers[serverId]) {
      return c.json({ error: "Server with this name already exists" }, 409);
    }

    // 构建服务器配置
    const serverConfig: Record<string, unknown> = {
      type: body.type,
    };

    if (body.command) serverConfig.command = body.command;
    if (body.args) serverConfig.args = body.args;
    if (body.env) serverConfig.env = body.env;
    if (body.url) serverConfig.url = body.url;

    mcpServers[serverId] = serverConfig;
    config.mcpServers = mcpServers;

    await writeMcpConfig(config);

    const newServer: McpServerInfo = {
      id: serverId,
      name: body.name,
      type: body.type,
      command: body.command,
      args: body.args,
      env: body.env,
      url: body.url,
      description: body.description,
      enabled: true,
      status: "disconnected",
    };

    logger.mcp.info("Added MCP server: {serverId}", { serverId });

    return c.json({ server: newServer });
  } catch (error) {
    logger.mcp.error("Error adding MCP server", { error });
    return c.json({ error: "Failed to add MCP server" }, 500);
  }
}

/**
 * DELETE /api/mcp/servers/:id
 * 删除 MCP 服务器
 */
export async function handleDeleteMcpServer(c: Context): Promise<Response> {
  try {
    const serverId = c.req.param("id");

    if (!serverId) {
      return c.json({ error: "Server ID is required" }, 400);
    }

    const config = await readMcpConfig();
    const mcpServers = (config.mcpServers as Record<string, unknown>) || {};

    if (!mcpServers[serverId]) {
      return c.json({ error: "Server not found" }, 404);
    }

    delete mcpServers[serverId];
    config.mcpServers = mcpServers;

    await writeMcpConfig(config);

    logger.mcp.info("Deleted MCP server: {serverId}", { serverId });

    return c.json({ success: true });
  } catch (error) {
    logger.mcp.error("Error deleting MCP server", { error });
    return c.json({ error: "Failed to delete MCP server" }, 500);
  }
}

/**
 * POST /api/mcp/servers/test
 * 测试 MCP 服务器连接
 */
export async function handleTestMcpServer(c: Context): Promise<Response> {
  try {
    const body = await c.req.json<McpTestRequest>();

    if (body.type === "stdio") {
      if (!body.command) {
        return c.json({ error: "Command is required for stdio type" }, 400);
      }

      // 测试命令是否可用
      const testResult = await testCommand(body.command, body.args || []);

      const response: McpTestResponse = {
        success: testResult.success,
        status: testResult.success ? "connected" : "error",
        error: testResult.error,
      };

      return c.json(response);
    }

    // 对于 SSE/WS 类型，暂时返回成功（实际需要网络请求测试）
    const response: McpTestResponse = {
      success: true,
      status: "connected",
    };

    return c.json(response);
  } catch (error) {
    logger.mcp.error("Error testing MCP server", { error });
    return c.json({ error: "Failed to test MCP server" }, 500);
  }
}

/**
 * 测试命令是否可用
 */
async function testCommand(
  command: string,
  args: string[],
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      const child = spawn(command, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      // 设置超时
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill();
        resolve({ success: false, error: "Connection timeout" });
      }, 5000);

      child.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("close", (code: number | null) => {
        if (timedOut) return;
        clearTimeout(timeout);

        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: `Command failed with code ${code}: ${stderr}`,
          });
        }
      });

      child.on("error", (error: Error) => {
        if (timedOut) return;
        clearTimeout(timeout);
        resolve({ success: false, error: error.message });
      });
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

/**
 * GET /api/mcp/servers/:id/tools
 * 获取 MCP 服务器的工具列表
 */
export async function handleGetMcpServerTools(c: Context): Promise<Response> {
  try {
    const serverId = c.req.param("id");

    if (!serverId) {
      return c.json({ error: "Server ID is required" }, 400);
    }

    const config = await readMcpConfig();
    const mcpServers = (config.mcpServers as Record<string, unknown>) || {};

    const serverConfig = mcpServers[serverId] as {
      type?: string;
      command?: string;
      args?: string[];
    };

    if (!serverConfig) {
      return c.json({ error: "Server not found" }, 404);
    }

    // 暂时返回空工具列表
    // 实际需要通过 MCP 协议连接服务器获取工具列表
    // TODO: 实现 MCP 协议连接和工具发现

    return c.json({
      serverId,
      tools: [],
      message: "Tool discovery not yet implemented",
    });
  } catch (error) {
    logger.mcp.error("Error getting MCP server tools", { error });
    return c.json({ error: "Failed to get MCP server tools" }, 500);
  }
}
