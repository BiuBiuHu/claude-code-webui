/**
 * 任务队列管理器
 *
 * 管理任务的创建、执行、取消和状态跟踪
 */

import { logger } from "../utils/logger.ts";
import type {
  CoworkTask,
  CreateTaskRequest,
} from "../../shared/types/cowork.ts";
import type {
  TaskManagerConfig,
  TaskQueueItem,
  TaskProgressUpdate,
  TaskExecutor,
  TaskStatistics,
} from "./types.ts";
import { createEmptyTask } from "./types.ts";
import { getTaskStateStore, type TaskStateStore } from "./stateStore.ts";

/**
 * 任务队列管理器
 */
export class TaskManager {
  private store: TaskStateStore;
  private config: TaskManagerConfig;
  private queue: TaskQueueItem[] = [];
  private runningTasks: Map<string, TaskQueueItem> = new Map();
  private executor: TaskExecutor | null = null;
  private isProcessing = false;
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: TaskManagerConfig, store: TaskStateStore) {
    this.config = config;
    this.store = store;
  }

  /**
   * 设置任务执行器
   */
  setExecutor(executor: TaskExecutor): void {
    this.executor = executor;
  }

  /**
   * 创建新任务
   */
  async createTask(request: CreateTaskRequest): Promise<CoworkTask> {
    const task = createEmptyTask(
      request.sessionId || "default",
      request.skillId,
    );

    // 保存到存储
    await this.store.saveTask(task);

    // 添加到队列
    const queueItem: TaskQueueItem = {
      ...task,
      retryCount: 0,
      queuedAt: Date.now(),
    };
    this.queue.push(queueItem);

    logger.cowork.info("Created task: {taskId} for session {sessionId}", {
      taskId: task.id,
      sessionId: task.sessionId,
      skillId: task.skillId,
    });

    // 触发任务处理
    this.processQueue().catch((error) => {
      logger.cowork.error("Error processing queue: {error}", { error });
    });

    return task;
  }

  /**
   * 获取任务
   */
  async getTask(taskId: string): Promise<CoworkTask | null> {
    return await this.store.getTask(taskId);
  }

  /**
   * 获取所有任务
   */
  async listTasks(): Promise<CoworkTask[]> {
    return await this.store.getAllTasks();
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<boolean> {
    // 检查运行中的任务
    const runningTask = this.runningTasks.get(taskId);
    if (runningTask) {
      // 发送中止信号
      const controller = this.abortControllers.get(taskId);
      if (controller) {
        controller.abort();
        this.abortControllers.delete(taskId);
      }

      // 更新状态
      await this.store.updateTaskStatus(taskId, "cancelled", {
        completedAt: Date.now(),
        message: "Task cancelled by user",
      });

      this.runningTasks.delete(taskId);
      logger.cowork.info("Cancelled running task: {taskId}", { taskId });
      return true;
    }

    // 检查队列中的任务
    const queueIndex = this.queue.findIndex((t) => t.id === taskId);
    if (queueIndex !== -1) {
      const task = this.queue.splice(queueIndex, 1)[0];
      await this.store.updateTaskStatus(task.id, "cancelled", {
        completedAt: Date.now(),
        message: "Task cancelled before execution",
      });
      logger.cowork.info("Cancelled queued task: {taskId}", { taskId });
      return true;
    }

    // 检查存储中的任务
    const task = await this.store.getTask(taskId);
    if (task && task.status === "queued") {
      await this.store.updateTaskStatus(taskId, "cancelled", {
        completedAt: Date.now(),
        message: "Task cancelled",
      });
      return true;
    }

    return false;
  }

  /**
   * 获取任务统计
   */
  async getStatistics(): Promise<TaskStatistics> {
    const stats = await this.store.getTaskStatistics();
    return {
      ...stats,
      cancelled: stats.cancelled,
    };
  }

  /**
   * 处理任务队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        // 检查并发限制
        if (this.runningTasks.size >= this.config.maxConcurrent) {
          break;
        }

        const task = this.queue.shift();
        if (!task) {
          break;
        }

        // 跳过已取消的任务
        const currentTask = await this.store.getTask(task.id);
        if (!currentTask || currentTask.status === "cancelled") {
          continue;
        }

        // 执行任务
        this.executeTask(task).catch((error) => {
          logger.cowork.error("Error executing task: {taskId}", {
            taskId: task.id,
            error,
          });
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 执行单个任务
   */
  private async executeTask(task: TaskQueueItem): Promise<void> {
    const controller = new AbortController();
    this.abortControllers.set(task.id, controller);

    // 更新状态为运行中
    await this.store.updateTaskStatus(task.id, "running", {
      startedAt: Date.now(),
      message: "Task started",
    });

    this.runningTasks.set(task.id, task);

    logger.cowork.info("Started task execution: {taskId}", {
      taskId: task.id,
    });

    try {
      if (!this.executor) {
        throw new Error("No task executor configured");
      }

      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error("Task timeout")),
          this.config.taskTimeout,
        );
      });

      // 执行任务
      const executionPromise = this.executor.execute(task, (update) => {
        // 进度回调
        this.handleTaskProgress(task.id, update);
      });

      // 等待执行完成或超时
      const result = await Promise.race([executionPromise, timeoutPromise]);

      // 任务成功完成
      await this.store.updateTaskStatus(task.id, "completed", {
        completedAt: Date.now(),
        progress: 100,
        message: "Task completed",
        result: result.result,
      });

      logger.cowork.info("Task completed: {taskId}", { taskId: task.id });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // 任务失败
      await this.store.updateTaskStatus(task.id, "failed", {
        completedAt: Date.now(),
        message: `Task failed: ${errorMessage}`,
        error: errorMessage,
      });

      logger.cowork.error("Task failed: {taskId}", {
        taskId: task.id,
        error: errorMessage,
      });
    } finally {
      this.runningTasks.delete(task.id);
      this.abortControllers.delete(task.id);

      // 继续处理队列
      this.processQueue().catch((error) => {
        logger.cowork.error("Error processing queue after task completion", {
          error,
        });
      });
    }
  }

  /**
   * 处理任务进度更新
   */
  private async handleTaskProgress(
    taskId: string,
    update: TaskProgressUpdate,
  ): Promise<void> {
    await this.store.updateTaskProgress(
      taskId,
      update.progress,
      update.message,
    );

    logger.cowork.debug("Task progress: {taskId} - {progress}% - {message}", {
      taskId,
      progress: update.progress,
      message: update.message,
    });
  }

  /**
   * 清理旧任务
   */
  async cleanupOldTasks(): Promise<number> {
    return await this.store.cleanupOldTasks();
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queued: number;
    running: number;
  } {
    return {
      queued: this.queue.length,
      running: this.runningTasks.size,
    };
  }

  /**
   * 停止所有任务
   */
  async stopAll(): Promise<void> {
    // 取消所有运行中的任务
    for (const [taskId, controller] of this.abortControllers.entries()) {
      controller.abort();
      await this.store.updateTaskStatus(taskId, "cancelled", {
        completedAt: Date.now(),
        message: "Task cancelled during shutdown",
      });
    }

    this.runningTasks.clear();
    this.abortControllers.clear();

    // 清空队列
    this.queue = [];

    logger.cowork.info("Stopped all tasks");
  }
}

/**
 * 单例实例
 */
let managerInstance: TaskManager | null = null;

/**
 * 获取任务管理器单例
 *
 * @param config - 任务管理器配置
 */
export function getTaskManager(config?: TaskManagerConfig): TaskManager {
  if (!managerInstance && config) {
    const store = getTaskStateStore(config);
    managerInstance = new TaskManager(config, store);
  }
  if (!managerInstance) {
    throw new Error(
      "TaskManager not initialized. Call getTaskManager with config first.",
    );
  }
  return managerInstance;
}

/**
 * 重置任务管理器单例
 * 主要用于测试
 */
export function resetTaskManager(): void {
  if (managerInstance) {
    managerInstance.stopAll().catch((error) => {
      logger.cowork.error("Error stopping task manager during reset", {
        error,
      });
    });
  }
  managerInstance = null;
}
