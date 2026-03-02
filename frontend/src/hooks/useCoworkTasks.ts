/**
 * useCoworkTasks Hook
 * Cowork 任务管理 Hook
 * 管理任务列表状态，提供任务操作方法
 */

import { useState, useCallback, useEffect } from "react";
import type {
  CoworkTask,
  TaskStatus,
  CreateTaskRequest,
} from "../../../shared/types/cowork";
import { coworkApi, CoworkApiError } from "../services/coworkApi";

export interface UseCoworkTasksOptions {
  /** 是否自动加载任务列表 */
  autoLoad?: boolean;
  /** 状态过滤 */
  statusFilter?: TaskStatus;
  /** 结果限制 */
  limit?: number;
  /** 轮询间隔（毫秒），0 表示不轮询 */
  pollInterval?: number;
}

export interface UseCoworkTasksReturn {
  /** 任务列表 */
  tasks: CoworkTask[];
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 统计信息 */
  stats: {
    running: number;
    queued: number;
    completed: number;
    failed: number;
  };
  /** 刷新任务列表 */
  refresh: () => Promise<void>;
  /** 创建任务 */
  create: (request: CreateTaskRequest) => Promise<string>;
  /** 取消任务 */
  cancel: (taskId: string) => Promise<void>;
  /** 更新任务状态（用于 SSE 更新） */
  updateTask: (taskId: string, updates: Partial<CoworkTask>) => void;
}

/**
 * Cowork 任务管理 Hook
 * 提供任务列表状态管理和操作方法
 */
export function useCoworkTasks(
  options: UseCoworkTasksOptions = {},
): UseCoworkTasksReturn {
  const { autoLoad = true, statusFilter, limit, pollInterval = 0 } = options;

  const [tasks, setTasks] = useState<CoworkTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载任务列表
   */
  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await coworkApi.getTasks({
        status: statusFilter,
        limit,
      });

      setTasks(response.tasks || []);
    } catch (err) {
      const message =
        err instanceof CoworkApiError ? err.message : "Failed to load tasks";
      setError(message);
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, limit]);

  /**
   * 刷新任务列表
   */
  const refresh = useCallback(async () => {
    await loadTasks();
  }, [loadTasks]);

  /**
   * 创建任务
   */
  const createTaskRequest = useCallback(
    async (request: CreateTaskRequest): Promise<string> => {
      try {
        setLoading(true);
        setError(null);

        const response = await coworkApi.createTask(request);

        // 重新加载任务列表
        await loadTasks();

        return response.taskId;
      } catch (err) {
        const message =
          err instanceof CoworkApiError ? err.message : "Failed to create task";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadTasks],
  );

  /**
   * 取消任务
   */
  const cancelTaskRequest = useCallback(async (taskId: string) => {
    try {
      setLoading(true);
      setError(null);

      await coworkApi.cancelTask({ taskId });

      // 从状态中移除已取消的任务
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "cancelled" as const, completedAt: Date.now() }
            : t,
        ),
      );
    } catch (err) {
      const message =
        err instanceof CoworkApiError ? err.message : "Failed to cancel task";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 更新任务状态（用于 SSE 更新）
   */
  const updateTask = useCallback(
    (taskId: string, updates: Partial<CoworkTask>) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
      );
    },
    [],
  );

  // 自动加载任务列表
  useEffect(() => {
    if (autoLoad) {
      loadTasks();
    }
  }, [autoLoad, loadTasks]);

  // 轮询支持
  useEffect(() => {
    if (!pollInterval || pollInterval <= 0) return;

    const intervalId = setInterval(() => {
      loadTasks();
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [pollInterval, loadTasks]);

  // 计算统计信息
  const stats = {
    running: tasks.filter((t) => t.status === "running").length,
    queued: tasks.filter((t) => t.status === "queued").length,
    completed: tasks.filter((t) => t.status === "completed").length,
    failed: tasks.filter((t) => t.status === "failed").length,
  };

  return {
    tasks,
    loading,
    error,
    stats,
    refresh,
    create: createTaskRequest,
    cancel: cancelTaskRequest,
    updateTask,
  };
}

/**
 * 单个任务管理 Hook
 * 用于管理单个任务的状态
 */
export function useCoworkTask(taskId: string | undefined) {
  const [task, setTask] = useState<CoworkTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTask = useCallback(async () => {
    if (!taskId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await coworkApi.getTask(taskId);
      setTask(response);
    } catch (err) {
      const message =
        err instanceof CoworkApiError ? err.message : "Failed to load task";
      setError(message);
      console.error("Failed to load task:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const updateTask = useCallback((updates: Partial<CoworkTask>) => {
    setTask((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  return {
    task,
    loading,
    error,
    refresh: loadTask,
    updateTask,
  };
}
