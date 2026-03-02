/**
 * SSE 广播器
 *
 * 使用 Server-Sent Events 向客户端实时推送任务进度更新
 */

import { streamSSE } from "hono/streaming";
import type { Context } from "hono";
import { logger } from "../utils/logger.ts";
import type {
  TaskSSEEvent,
  CoworkTask,
  TaskStatus,
} from "../../shared/types/cowork.ts";
import type { SSEConnection, SSEBroadcastOptions } from "./types.ts";

/**
 * SSE 客户端连接信息
 */
interface SSEClient {
  id: string;
  sendMessage: (data: string) => void | Promise<void>;
  subscribedTaskIds: string[];
  connectedAt: number;
  lastActiveAt: number;
}

/**
 * SSE 广播器类
 */
export class SSEBroadcaster {
  private clients: Map<string, SSEClient> = new Map();
  private heartbeatInterval: number | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private options: Required<SSEBroadcastOptions>;

  constructor(options: SSEBroadcastOptions = {}) {
    this.options = {
      retryInterval: options.retryInterval || 3000,
      heartbeatInterval: options.heartbeatInterval || 30000,
    };
  }

  /**
   * 添加客户端连接
   */
  addClient(
    clientId: string,
    sendMessage: (data: string) => void | Promise<void>,
    subscribedTaskIds: string[] = [],
  ): void {
    const client: SSEClient = {
      id: clientId,
      sendMessage,
      subscribedTaskIds,
      connectedAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    this.clients.set(clientId, client);

    logger.cowork.debug("SSE client connected: {clientId}", {
      clientId,
      subscribedCount: subscribedTaskIds.length,
    });

    // 如果是第一个客户端，启动心跳
    if (this.clients.size === 1) {
      this.startHeartbeat();
    }
  }

  /**
   * 移除客户端连接
   */
  removeClient(clientId: string): void {
    const removed = this.clients.delete(clientId);
    if (removed) {
      logger.cowork.debug("SSE client disconnected: {clientId}", { clientId });
    }

    // 如果没有客户端了，停止心跳
    if (this.clients.size === 0) {
      this.stopHeartbeat();
    }
  }

  /**
   * 广播任务事件到所有订阅的客户端
   */
  async broadcast(event: TaskSSEEvent): Promise<void> {
    const data = JSON.stringify(event);
    const message = `data: ${data}\n\n`;

    let sentCount = 0;
    let errorCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      // 检查客户端是否订阅了此任务
      if (
        client.subscribedTaskIds.length > 0 &&
        !client.subscribedTaskIds.includes(event.taskId)
      ) {
        continue;
      }

      try {
        await client.sendMessage(message);
        client.lastActiveAt = Date.now();
        sentCount++;
      } catch (error) {
        logger.cowork.warning(
          "Failed to send SSE message to client: {clientId}",
          {
            clientId,
            error,
          },
        );
        errorCount++;
        // 移除无效的客户端
        this.removeClient(clientId);
      }
    }

    logger.cowork.debug("Broadcasted event: {type} to {count} clients", {
      type: event.type,
      sentCount,
      errorCount,
    });
  }

  /**
   * 发送任务进度更新
   */
  async broadcastProgress(
    taskId: string,
    status: TaskStatus,
    progress: number,
    message: string,
  ): Promise<void> {
    const event: TaskSSEEvent = {
      type: "task_progress",
      taskId,
      data: {
        status,
        progress,
        message,
        timestamp: Date.now(),
      },
    };

    await this.broadcast(event);
  }

  /**
   * 发送任务完成事件
   */
  async broadcastCompletion(taskId: string, result?: unknown): Promise<void> {
    const event: TaskSSEEvent = {
      type: "task_completed",
      taskId,
      data: {
        status: "completed",
        progress: 100,
        message: "Task completed",
        result,
        timestamp: Date.now(),
      },
    };

    await this.broadcast(event);
  }

  /**
   * 发送任务失败事件
   */
  async broadcastFailure(taskId: string, error: string): Promise<void> {
    const event: TaskSSEEvent = {
      type: "task_failed",
      taskId,
      data: {
        status: "failed",
        progress: 0,
        message: "Task failed",
        error,
        timestamp: Date.now(),
      },
    };

    await this.broadcast(event);
  }

  /**
   * 发送任务取消事件
   */
  async broadcastCancellation(taskId: string): Promise<void> {
    const event: TaskSSEEvent = {
      type: "task_cancelled",
      taskId,
      data: {
        status: "cancelled",
        progress: 0,
        message: "Task cancelled",
        timestamp: Date.now(),
      },
    };

    await this.broadcast(event);
  }

  /**
   * 获取连接的客户端数量
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * 获取所有客户端信息
   */
  getClients(): SSEConnection[] {
    return Array.from(this.clients.values()).map((client) => ({
      id: client.id,
      connectedAt: client.connectedAt,
      lastActiveAt: client.lastActiveAt,
      subscribedTaskIds: [...client.subscribedTaskIds],
    }));
  }

  /**
   * 启动心跳
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return;
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.options.heartbeatInterval);

    logger.cowork.debug("SSE heartbeat started");
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      logger.cowork.debug("SSE heartbeat stopped");
    }
  }

  /**
   * 发送心跳消息
   */
  private async sendHeartbeat(): Promise<void> {
    const message = ": heartbeat\n\n";

    for (const [clientId, client] of this.clients.entries()) {
      try {
        await client.sendMessage(message);
        client.lastActiveAt = Date.now();
      } catch (error) {
        logger.cowork.warning(
          "Failed to send heartbeat to client: {clientId}",
          { clientId, error },
        );
        this.removeClient(clientId);
      }
    }
  }

  /**
   * 清理不活跃的客户端
   */
  cleanupInactiveClients(maxInactiveTime: number = 60000): void {
    const now = Date.now();
    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastActiveAt > maxInactiveTime) {
        logger.cowork.debug("Cleaning up inactive client: {clientId}", {
          clientId,
        });
        this.removeClient(clientId);
      }
    }
  }

  /**
   * 关闭所有连接
   */
  closeAll(): void {
    for (const clientId of this.clients.keys()) {
      this.removeClient(clientId);
    }
    this.stopHeartbeat();
    logger.cowork.info("All SSE connections closed");
  }
}

/**
 * 单例实例
 */
let broadcasterInstance: SSEBroadcaster | null = null;

/**
 * 获取 SSE 广播器单例
 *
 * @param options - SSE 广播选项
 */
export function getSSEBroadcaster(
  options?: SSEBroadcastOptions,
): SSEBroadcaster {
  if (!broadcasterInstance) {
    broadcasterInstance = new SSEBroadcaster(options);
  }
  return broadcasterInstance;
}

/**
 * 重置 SSE 广播器单例
 * 主要用于测试
 */
export function resetSSEBroadcaster(): void {
  if (broadcasterInstance) {
    broadcasterInstance.closeAll();
  }
  broadcasterInstance = null;
}

/**
 * 处理 SSE 流连接
 *
 * @param c - Hono 上下文
 * @param subscribedTaskIds - 订阅的任务 ID 列表
 */
export async function handleSSEConnection(
  c: Context,
  subscribedTaskIds: string[] = [],
): Promise<Response> {
  const broadcaster = getSSEBroadcaster();
  const clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  return streamSSE(c, async (stream) => {
    // 发送初始连接消息
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ clientId, retryInterval: 3000 }),
    });

    // 添加客户端到广播器
    broadcaster.addClient(
      clientId,
      async (data) => {
        await stream.writeSSE({ data });
      },
      subscribedTaskIds,
    );

    // 清理函数
    stream.onAbort(() => {
      logger.cowork.debug("SSE stream aborted: {clientId}", { clientId });
      broadcaster.removeClient(clientId);
    });
  });
}

/**
 * 广播任务状态变更
 */
export async function broadcastTaskStateChange(
  task: CoworkTask,
  _previousStatus?: TaskStatus,
): Promise<void> {
  const broadcaster = getSSEBroadcaster();

  switch (task.status) {
    case "running":
      await broadcaster.broadcastProgress(
        task.id,
        task.status,
        task.progress,
        task.message,
      );
      break;
    case "completed":
      await broadcaster.broadcastCompletion(task.id, task.result);
      break;
    case "failed":
      await broadcaster.broadcastFailure(
        task.id,
        task.error || "Unknown error",
      );
      break;
    case "cancelled":
      await broadcaster.broadcastCancellation(task.id);
      break;
  }
}
