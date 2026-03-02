/**
 * Cowork 模块内部类型定义
 *
 * 定义 Cowork 任务管理、状态存储、SSE 广播的内部类型
 */

import type { CoworkTask, TaskStatus } from "../../shared/types/cowork.ts";

/**
 * 任务状态变更事件
 */
export interface TaskStateChangeEvent {
  taskId: string;
  oldStatus: TaskStatus;
  newStatus: TaskStatus;
  timestamp: number;
}

/**
 * 任务进度更新
 */
export interface TaskProgressUpdate {
  taskId: string;
  progress: number;
  message: string;
  timestamp: number;
}

/**
 * 任务执行选项
 */
export interface TaskExecutionOptions {
  /**
   * 最大并发任务数
   */
  maxConcurrent?: number;

  /**
   * 任务超时时间（毫秒）
   */
  timeout?: number;

  /**
   * 是否自动重试
   */
  autoRetry?: boolean;

  /**
   * 最大重试次数
   */
  maxRetries?: number;
}

/**
 * 任务执行结果
 */
export interface TaskExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

/**
 * 任务队列项
 * 扩展自 CoworkTask，添加队列管理字段
 */
export interface TaskQueueItem extends CoworkTask {
  /**
   * 重试次数
   */
  retryCount: number;

  /**
   * 创建时间戳
   */
  queuedAt: number;

  /**
   * 开始执行时间戳
   */
  startedAt?: number;

  /**
   * 完成时间戳
   */
  completedAt?: number;
}

/**
 * 任务优先级
 */
export type TaskPriority = "low" | "normal" | "high";

/**
 * 可扩展的任务队列项
 */
export interface PrioritizedTaskQueueItem extends TaskQueueItem {
  /**
   * 任务优先级
   */
  priority: TaskPriority;

  /**
   * 依赖的任务 ID 列表
   */
  dependencies?: string[];
}

/**
 * 任务执行器接口
 * 定义任务执行的具体实现
 */
export interface TaskExecutor {
  /**
   * 执行任务
   *
   * @param task - 要执行的任务
   * @param onProgress - 进度回调
   */
  execute(
    task: CoworkTask,
    onProgress: (update: TaskProgressUpdate) => void,
  ): Promise<TaskExecutionResult>;
}

/**
 * 任务存储接口
 * 定义任务状态持久化的抽象接口
 */
export interface TaskStorage {
  /**
   * 保存任务
   */
  save(task: CoworkTask): Promise<void>;

  /**
   * 获取任务
   */
  get(taskId: string): Promise<CoworkTask | null>;

  /**
   * 获取所有任务
   */
  list(): Promise<CoworkTask[]>;

  /**
   * 更新任务状态
   */
  updateStatus(
    taskId: string,
    status: TaskStatus,
    update?: Partial<CoworkTask>,
  ): Promise<void>;

  /**
   * 删除任务
   */
  delete(taskId: string): Promise<void>;

  /**
   * 清理旧任务
   */
  cleanup(olderThan: number): Promise<number>;
}

/**
 * SSE 连接信息
 */
export interface SSEConnection {
  /**
   * 连接 ID
   */
  id: string;

  /**
   * 连接创建时间
   */
  connectedAt: number;

  /**
   * 最后活动时间
   */
  lastActiveAt: number;

  /**
   * 订阅的任务 ID 列表（空列表表示订阅所有任务）
   */
  subscribedTaskIds: string[];
}

/**
 * SSE 广播选项
 */
export interface SSEBroadcastOptions {
  /**
   * 重连间隔（毫秒）
   */
  retryInterval?: number;

  /**
   * 心跳间隔（毫秒）
   */
  heartbeatInterval?: number;
}

/**
 * 任务统计信息
 */
export interface TaskStatistics {
  /**
   * 总任务数
   */
  total: number;

  /**
   * 排队中的任务数
   */
  queued: number;

  /**
   * 运行中的任务数
   */
  running: number;

  /**
   * 已完成的任务数
   */
  completed: number;

  /**
   * 失败的任务数
   */
  failed: number;

  /**
   * 已取消的任务数
   */
  cancelled: number;
}

/**
 * 任务过滤器
 */
export interface TaskFilter {
  /**
   * 按状态筛选
   */
  status?: TaskStatus[];

  /**
   * 按会话 ID 筛选
   */
  sessionId?: string;

  /**
   * 按技能 ID 筛选
   */
  skillId?: string;

  /**
   * 时间范围
   */
  createdAfter?: number;
  createdBefore?: number;

  /**
   * 限制返回数量
   */
  limit?: number;

  /**
   * 偏移量
   */
  offset?: number;
}

/**
 * 任务管理器配置
 */
export interface TaskManagerConfig {
  /**
   * 最大并发任务数
   */
  maxConcurrent: number;

  /**
   * 任务超时时间（毫秒）
   */
  taskTimeout: number;

  /**
   * 是否启用持久化
   */
  enablePersistence: boolean;

  /**
   * 持久化路径（SQLite 或文件路径）
   */
  persistencePath?: string;

  /**
   * 任务清理策略（保留天数）
   */
  retentionDays: number;
}

/**
 * 默认任务管理器配置
 */
export function getDefaultTaskManagerConfig(): TaskManagerConfig {
  return {
    maxConcurrent: 3,
    taskTimeout: 300000, // 5 分钟
    enablePersistence: true,
    retentionDays: 7,
  };
}

/**
 * 生成任务 ID
 */
export function generateTaskId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 生成步骤 ID
 */
export function generateStepId(taskId: string, stepIndex: number): string {
  return `${taskId}_step_${stepIndex}`;
}

/**
 * 创建空任务
 */
export function createEmptyTask(
  sessionId: string,
  skillId?: string,
): CoworkTask {
  return {
    id: generateTaskId(),
    sessionId,
    skillId,
    status: "queued",
    progress: 0,
    message: "Task queued",
    steps: [],
    createdAt: Date.now(),
  };
}

/**
 * 克隆任务（用于创建不可变更新）
 */
export function cloneTask(task: CoworkTask): CoworkTask {
  return {
    ...task,
    steps: [...task.steps],
  };
}
