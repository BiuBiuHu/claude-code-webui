/**
 * Cowork API Service
 * Cowork 任务管理相关的 API 服务
 */

import type {
  CoworkTask,
  CreateTaskRequest,
  CreateTaskResponse,
  TasksListResponse,
  CancelTaskRequest,
  TaskSSEEvent,
} from "../../../shared/types/cowork";
import {
  getCoworkTasksUrl,
  getCoworkTaskUrl,
  getCoworkCreateUrl,
  getCoworkCancelUrl,
  getCoworkSSEUrl,
} from "../config/api";

/**
 * API 错误类
 */
class CoworkApiError extends Error {
  statusCode?: number;
  response?: unknown;

  constructor(message: string, statusCode?: number, response?: unknown) {
    super(message);
    this.name = "CoworkApiError";
    this.statusCode = statusCode;
    this.response = response;
  }
}

export { CoworkApiError };

/**
 * 获取任务列表
 * @param params 查询参数
 * @returns 任务列表响应
 */
export async function getTasks(params?: {
  status?: string;
  limit?: number;
}): Promise<TasksListResponse> {
  const response = await fetch(getCoworkTasksUrl(params));

  if (!response.ok) {
    throw new CoworkApiError(
      "Failed to fetch tasks",
      response.status,
      await response.json().catch(() => undefined),
    );
  }

  return response.json();
}

/**
 * 获取任务详情
 * @param taskId 任务 ID
 * @returns 任务详情
 */
export async function getTask(taskId: string): Promise<CoworkTask> {
  const response = await fetch(getCoworkTaskUrl(taskId));

  if (!response.ok) {
    throw new CoworkApiError(
      "Failed to fetch task details",
      response.status,
      await response.json().catch(() => undefined),
    );
  }

  return response.json();
}

/**
 * 创建任务
 * @param request 创建请求
 * @returns 创建响应
 */
export async function createTask(
  request: CreateTaskRequest,
): Promise<CreateTaskResponse> {
  const response = await fetch(getCoworkCreateUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new CoworkApiError(
      "Failed to create task",
      response.status,
      await response.json().catch(() => undefined),
    );
  }

  return response.json();
}

/**
 * 取消任务
 * @param request 取消请求
 * @returns 取消结果
 */
export async function cancelTask(
  request: CancelTaskRequest,
): Promise<{ success: boolean }> {
  const response = await fetch(getCoworkCancelUrl(request.taskId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new CoworkApiError(
      "Failed to cancel task",
      response.status,
      await response.json().catch(() => undefined),
    );
  }

  return response.json();
}

/**
 * SSE 事件监听器类型
 */
export type SSEEventListener = (event: TaskSSEEvent) => void;

/**
 * SSE 连接状态
 */
export type SSEConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

/**
 * 创建 SSE 连接
 * @param sessionId 会话 ID
 * @param onMessage 消息回调
 * @param onError 错误回调
 * @returns EventSource 实例和清理函数
 */
export function createSSEConnection(
  sessionId: string | undefined,
  onMessage: SSEEventListener,
  onError?: (error: Error) => void,
): { eventSource: EventSource | null; disconnect: () => void } {
  // 检查浏览器支持
  if (typeof EventSource === "undefined") {
    onError?.(new Error("EventSource is not supported in this browser"));
    return { eventSource: null, disconnect: () => {} };
  }

  const url = getCoworkSSEUrl(sessionId);
  const eventSource = new EventSource(url);

  eventSource.onopen = () => {
    console.log("[Cowork SSE] Connection opened");
  };

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (err) {
      console.error("[Cowork SSE] Failed to parse message:", err);
    }
  };

  eventSource.onerror = (error) => {
    console.error("[Cowork SSE] Connection error:", error);
    onError?.(new Error("SSE connection error"));
    eventSource.close();
  };

  const disconnect = () => {
    eventSource.close();
    console.log("[Cowork SSE] Connection closed");
  };

  return { eventSource, disconnect };
}

/**
 * Cowork API 服务对象
 * 导出统一的服务接口
 */
export const coworkApi = {
  getTasks,
  getTask,
  createTask,
  cancelTask,
  createSSEConnection,
} as const;
