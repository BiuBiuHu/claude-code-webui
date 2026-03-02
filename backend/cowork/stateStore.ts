/**
 * 任务状态持久化存储
 *
 * 实现任务状态的内存存储和持久化（可扩展到 SQLite）
 */

import { logger } from "../utils/logger.ts";
import type { CoworkTask, TaskStatus } from "../../shared/types/cowork.ts";
import type { TaskStorage, TaskManagerConfig } from "./types.ts";

/**
 * 内存任务存储实现
 * 使用 Map 存储任务状态，重启后丢失
 */
export class InMemoryTaskStorage implements TaskStorage {
  private tasks: Map<string, CoworkTask> = new Map();

  async save(task: CoworkTask): Promise<void> {
    this.tasks.set(task.id, { ...task });
    logger.cowork.debug("Saved task: {taskId}", { taskId: task.id });
  }

  async get(taskId: string): Promise<CoworkTask | null> {
    const task = this.tasks.get(taskId);
    return task ? { ...task } : null;
  }

  async list(): Promise<CoworkTask[]> {
    return Array.from(this.tasks.values()).map((task) => ({ ...task }));
  }

  async updateStatus(
    taskId: string,
    status: TaskStatus,
    update?: Partial<CoworkTask>,
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      if (update) {
        Object.assign(task, update);
      }
      logger.cowork.debug("Updated task status: {taskId} -> {status}", {
        taskId,
        status,
      });
    }
  }

  async delete(taskId: string): Promise<void> {
    const deleted = this.tasks.delete(taskId);
    if (deleted) {
      logger.cowork.debug("Deleted task: {taskId}", { taskId });
    }
  }

  async cleanup(olderThan: number): Promise<number> {
    let count = 0;
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.createdAt < olderThan) {
        this.tasks.delete(taskId);
        count++;
      }
    }
    if (count > 0) {
      logger.cowork.info("Cleaned up {count} old tasks", { count });
    }
    return count;
  }

  /**
   * 获取存储大小
   */
  size(): number {
    return this.tasks.size;
  }

  /**
   * 清空所有任务
   */
  async clear(): Promise<void> {
    this.tasks.clear();
    logger.cowork.debug("Cleared all tasks");
  }
}

/**
 * 任务状态存储管理器
 * 提供统一的任务状态管理接口
 */
export class TaskStateStore {
  private storage: TaskStorage;
  private config: TaskManagerConfig;

  constructor(storage: TaskStorage, config: TaskManagerConfig) {
    this.storage = storage;
    this.config = config;
  }

  /**
   * 保存任务
   */
  async saveTask(task: CoworkTask): Promise<void> {
    await this.storage.save(task);
  }

  /**
   * 获取任务
   */
  async getTask(taskId: string): Promise<CoworkTask | null> {
    return await this.storage.get(taskId);
  }

  /**
   * 获取所有任务
   */
  async getAllTasks(): Promise<CoworkTask[]> {
    return await this.storage.list();
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(
    taskId: string,
    status: TaskStatus,
    update?: Partial<CoworkTask>,
  ): Promise<void> {
    await this.storage.updateStatus(taskId, status, update);
  }

  /**
   * 更新任务进度
   */
  async updateTaskProgress(
    taskId: string,
    progress: number,
    message: string,
  ): Promise<void> {
    const task = await this.storage.get(taskId);
    if (task) {
      task.progress = progress;
      task.message = message;
      await this.storage.save(task);
    }
  }

  /**
   * 添加任务步骤
   */
  async addTaskStep(
    taskId: string,
    message: string,
    progress: number,
    status: TaskStatus,
  ): Promise<void> {
    const task = await this.storage.get(taskId);
    if (task) {
      const step = {
        id: `${taskId}_step_${task.steps.length}`,
        timestamp: Date.now(),
        message,
        progress,
        status,
      };
      task.steps.push(step);
      task.progress = progress;
      task.message = message;
      await this.storage.save(task);
    }
  }

  /**
   * 删除任务
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.storage.delete(taskId);
  }

  /**
   * 清理旧任务
   */
  async cleanupOldTasks(): Promise<number> {
    const retentionMs = this.config.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;
    return await this.storage.cleanup(cutoff);
  }

  /**
   * 获取任务统计
   */
  async getTaskStatistics(): Promise<{
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    const tasks = await this.storage.list();

    return {
      total: tasks.length,
      queued: tasks.filter((t) => t.status === "queued").length,
      running: tasks.filter((t) => t.status === "running").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      failed: tasks.filter((t) => t.status === "failed").length,
      cancelled: tasks.filter((t) => t.status === "cancelled").length,
    };
  }

  /**
   * 根据会话 ID 获取任务
   */
  async getTasksBySession(sessionId: string): Promise<CoworkTask[]> {
    const tasks = await this.storage.list();
    return tasks.filter((t) => t.sessionId === sessionId);
  }

  /**
   * 根据状态获取任务
   */
  async getTasksByStatus(status: TaskStatus): Promise<CoworkTask[]> {
    const tasks = await this.storage.list();
    return tasks.filter((t) => t.status === status);
  }

  /**
   * 获取底层存储实例
   */
  getStorage(): TaskStorage {
    return this.storage;
  }
}

/**
 * 创建任务状态存储
 *
 * @param config - 任务管理器配置
 */
export function createTaskStateStore(
  config: TaskManagerConfig,
): TaskStateStore {
  let storage: TaskStorage;

  if (config.enablePersistence && config.persistencePath) {
    // TODO: 实现 SQLite 持久化存储
    // 目前使用内存存储
    logger.cowork.warning(
      "SQLite persistence not yet implemented, using in-memory storage",
    );
    storage = new InMemoryTaskStorage();
  } else {
    storage = new InMemoryTaskStorage();
  }

  return new TaskStateStore(storage, config);
}

/**
 * 单例实例
 */
let storeInstance: TaskStateStore | null = null;

/**
 * 获取任务状态存储单例
 *
 * @param config - 任务管理器配置（仅在首次调用时使用）
 */
export function getTaskStateStore(config?: TaskManagerConfig): TaskStateStore {
  if (!storeInstance && config) {
    storeInstance = createTaskStateStore(config);
  }
  if (!storeInstance) {
    // 使用默认配置
    const defaultConfig = {
      maxConcurrent: 3,
      taskTimeout: 300000,
      enablePersistence: false,
      retentionDays: 7,
    };
    storeInstance = createTaskStateStore(defaultConfig);
  }
  return storeInstance;
}

/**
 * 重置任务状态存储单例
 * 主要用于测试
 */
export function resetTaskStateStore(): void {
  storeInstance = null;
}
