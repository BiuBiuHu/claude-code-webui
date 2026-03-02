/**
 * Cowork API 处理器
 *
 * 处理所有 Cowork 任务相关的 API 请求
 */

import type { Context } from "hono";
import type {
  CreateTaskRequest,
  CreateTaskResponse,
  TasksListResponse,
} from "../../shared/types/cowork.ts";
import { getTaskManager } from "../cowork/taskManager.ts";
import {
  handleSSEConnection,
  broadcastTaskStateChange,
} from "../cowork/sseBroadcaster.ts";
import { getDefaultTaskManagerConfig } from "../cowork/types.ts";
import { logger } from "../utils/logger.ts";

/**
 * 确保 TaskManager 已初始化
 */
function ensureTaskManager() {
  try {
    return getTaskManager();
  } catch {
    const config = getDefaultTaskManagerConfig();
    return getTaskManager(config);
  }
}

/**
 * POST /api/cowork/tasks
 * 创建新任务
 */
export async function handleCreateTask(c: Context): Promise<Response> {
  try {
    const body = await c.req.json<CreateTaskRequest>();

    logger.cowork.info(
      "Creating task for skill: {skillId}, session: {sessionId}",
      {
        skillId: body.skillId,
        sessionId: body.sessionId,
      },
    );

    const manager = ensureTaskManager();
    const task = await manager.createTask(body);

    const response: CreateTaskResponse = {
      taskId: task.id,
      status: task.status,
      createdAt: task.createdAt,
    };

    // 广播任务创建事件
    await broadcastTaskStateChange(task);

    return c.json(response);
  } catch (error) {
    logger.cowork.error("Error creating task", { error });
    return c.json({ error: "Failed to create task" }, 500);
  }
}

/**
 * GET /api/cowork/tasks
 * 获取任务列表
 */
export async function handleListTasks(c: Context): Promise<Response> {
  try {
    const manager = ensureTaskManager();
    const tasks = await manager.listTasks();
    const stats = await manager.getStatistics();

    const response: TasksListResponse = {
      tasks,
      running: stats.running,
      queued: stats.queued,
      completed: stats.completed,
      failed: stats.failed,
    };

    return c.json(response);
  } catch (error) {
    logger.cowork.error("Error listing tasks", { error });
    return c.json({ error: "Failed to list tasks" }, 500);
  }
}

/**
 * GET /api/cowork/tasks/:taskId
 * 获取任务详情
 */
export async function handleGetTask(c: Context): Promise<Response> {
  try {
    const taskId = c.req.param("taskId");

    if (!taskId) {
      return c.json({ error: "Task ID is required" }, 400);
    }

    const manager = ensureTaskManager();
    const task = await manager.getTask(taskId);

    if (!task) {
      return c.json({ error: "Task not found" }, 404);
    }

    return c.json(task);
  } catch (error) {
    logger.cowork.error("Error getting task: {taskId}", {
      taskId: c.req.param("taskId"),
      error,
    });
    return c.json({ error: "Failed to get task" }, 500);
  }
}

/**
 * DELETE /api/cowork/tasks/:taskId
 * 取消任务
 */
export async function handleCancelTask(c: Context): Promise<Response> {
  try {
    const taskId = c.req.param("taskId");

    if (!taskId) {
      return c.json({ error: "Task ID is required" }, 400);
    }

    const manager = ensureTaskManager();
    const cancelled = await manager.cancelTask(taskId);

    if (!cancelled) {
      return c.json({ error: "Task not found or cannot be cancelled" }, 404);
    }

    // 获取更新后的任务状态
    const task = await manager.getTask(taskId);

    // 广播任务取消事件
    if (task) {
      await broadcastTaskStateChange(task);
    }

    return c.json({ success: true });
  } catch (error) {
    logger.cowork.error("Error cancelling task: {taskId}", {
      taskId: c.req.param("taskId"),
      error,
    });
    return c.json({ error: "Failed to cancel task" }, 500);
  }
}

/**
 * GET /api/cowork/stream
 * SSE 任务进度流
 */
export async function handleTaskStream(c: Context): Promise<Response> {
  try {
    // 获取订阅的任务 ID 列表（可选）
    const taskIdsParam = c.req.query("taskIds");
    const subscribedTaskIds = taskIdsParam
      ? taskIdsParam.split(",").filter(Boolean)
      : [];

    logger.cowork.debug("New SSE connection, subscribing to {count} tasks", {
      count: subscribedTaskIds.length,
    });

    return await handleSSEConnection(c, subscribedTaskIds);
  } catch (error) {
    logger.cowork.error("Error establishing SSE stream", { error });
    return c.json({ error: "Failed to establish SSE stream" }, 500);
  }
}

/**
 * GET /api/cowork/statistics
 * 获取任务统计信息
 */
export async function handleGetStatistics(c: Context): Promise<Response> {
  try {
    const manager = ensureTaskManager();
    const stats = await manager.getStatistics();

    return c.json(stats);
  } catch (error) {
    logger.cowork.error("Error getting statistics", { error });
    return c.json({ error: "Failed to get statistics" }, 500);
  }
}

/**
 * DELETE /api/cowork/tasks
 * 清理旧任务
 */
export async function handleCleanupTasks(c: Context): Promise<Response> {
  try {
    const manager = ensureTaskManager();
    const count = await manager.cleanupOldTasks();

    return c.json({ success: true, deletedCount: count });
  } catch (error) {
    logger.cowork.error("Error cleaning up tasks", { error });
    return c.json({ error: "Failed to cleanup tasks" }, 500);
  }
}

/**
 * GET /api/cowork/queue-status
 * 获取队列状态
 */
export async function handleQueueStatus(c: Context): Promise<Response> {
  try {
    const manager = ensureTaskManager();
    const status = manager.getQueueStatus();

    return c.json(status);
  } catch (error) {
    logger.cowork.error("Error getting queue status", { error });
    return c.json({ error: "Failed to get queue status" }, 500);
  }
}
