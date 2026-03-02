/**
 * useTaskSSE Hook
 * SSE 实时更新 Hook
 * 管理 EventSource 连接，自动重连，消息解析
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  TaskSSEEvent,
  CoworkTask,
  TaskStatus,
} from "../../../shared/types/cowork";
import { coworkApi } from "../services/coworkApi";
import type { SSEConnectionState } from "../services/coworkApi";

export interface UseTaskSSEOptions {
  /** 会话 ID（可选，不传则监听所有任务） */
  sessionId?: string;
  /** 是否启用连接 */
  enabled?: boolean;
  /** 重连间隔（毫秒） */
  reconnectInterval?: number;
  /** 最大重连次数 */
  maxReconnectAttempts?: number;
}

export interface UseTaskSSEReturn {
  /** 连接状态 */
  connectionState: SSEConnectionState;
  /** 接收到的最新事件 */
  lastEvent: TaskSSEEvent | null;
  /** 所有接收到的任务更新 */
  taskUpdates: Map<string, Partial<CoworkTask>>;
  /** 手动连接 */
  connect: () => void;
  /** 手动断开 */
  disconnect: () => void;
  /** 重置任务更新 */
  resetUpdates: () => void;
}

/**
 * SSE 实时更新 Hook
 * 管理 SSE 连接，自动重连，解析任务更新
 */
export function useTaskSSE(options: UseTaskSSEOptions = {}): UseTaskSSEReturn {
  const {
    sessionId,
    enabled = true,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [connectionState, setConnectionState] =
    useState<SSEConnectionState>("disconnected");
  const [lastEvent, setLastEvent] = useState<TaskSSEEvent | null>(null);
  const [taskUpdates, setTaskUpdates] = useState<
    Map<string, Partial<CoworkTask>>
  >(new Map());

  // 使用 ref 存储连接状态，避免闭包问题
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const reconnectAttemptsRef = useRef(0);
  const isManualDisconnectRef = useRef(false);
  const connectRef = useRef<(() => void) | null>(null);
  const handleErrorRef = useRef<(error: Error) => void>(() => {});

  /**
   * 处理 SSE 消息
   */
  const handleMessage = useCallback((event: TaskSSEEvent) => {
    console.log("[useTaskSSE] Received event:", event);

    setLastEvent(event);

    // 更新任务状态映射
    setTaskUpdates((prev) => {
      const updated = new Map(prev);
      const taskId = event.taskId;

      // 合并更新数据
      const existing = updated.get(taskId) || {};
      updated.set(taskId, {
        ...existing,
        id: taskId,
        status: event.data.status,
        progress: event.data.progress,
        message: event.data.message,
        result: event.data.result,
        error: event.data.error,
        completedAt:
          event.data.status === "completed" ? event.data.timestamp : undefined,
      });

      return updated;
    });
  }, []);

  /**
   * 建立 SSE 连接
   */
  const connect = useCallback(() => {
    // 清理现有连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // 清理重连定时器
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    isManualDisconnectRef.current = false;
    setConnectionState("connecting");

    try {
      const { eventSource } = coworkApi.createSSEConnection(
        sessionId,
        handleMessage,
        (error: Error) => handleErrorRef.current(error),
      );

      eventSourceRef.current = eventSource;

      if (eventSource) {
        setConnectionState("connected");
        reconnectAttemptsRef.current = 0;
      } else {
        setConnectionState("error");
      }
    } catch (err) {
      console.error("[useTaskSSE] Failed to create SSE connection:", err);
      setConnectionState("error");
      handleErrorRef.current(
        err instanceof Error ? err : new Error("Unknown error"),
      );
    }
  }, [sessionId, handleMessage]);

  /**
   * 断开 SSE 连接
   */
  const disconnect = useCallback(() => {
    isManualDisconnectRef.current = true;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnectionState("disconnected");
  }, []);

  /**
   * 重置任务更新
   */
  const resetUpdates = useCallback(() => {
    setTaskUpdates(new Map());
    setLastEvent(null);
  }, []);

  // 设置 handleErrorRef 和 connectRef
  useEffect(() => {
    connectRef.current = connect;

    handleErrorRef.current = (error: Error) => {
      console.error("[useTaskSSE] Connection error:", error);
      setConnectionState("error");

      // 自动重连
      if (
        reconnectAttemptsRef.current < maxReconnectAttempts &&
        !isManualDisconnectRef.current
      ) {
        reconnectAttemptsRef.current++;
        console.log(
          `[useTaskSSE] Reconnecting... Attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`,
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isManualDisconnectRef.current) {
            connectRef.current?.();
          }
        }, reconnectInterval);
      } else {
        console.error(
          "[useTaskSSE] Max reconnect attempts reached or manually disconnected",
        );
      }
    };
  }, [connect, maxReconnectAttempts, reconnectInterval]);

  // 自动连接/断开
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    connectionState,
    lastEvent,
    taskUpdates,
    connect,
    disconnect,
    resetUpdates,
  };
}

/**
 * 简化版 SSE Hook
 * 只关注特定任务的状态变化
 */
export function useTaskSSESimple(taskId: string, enabled = true) {
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const { connectionState, lastEvent } = useTaskSSE({ enabled });

  useEffect(() => {
    if (lastEvent && lastEvent.taskId === taskId) {
      setTaskStatus(lastEvent.data.status);
      setProgress(lastEvent.data.progress);
      setMessage(lastEvent.data.message);
    }
  }, [lastEvent, taskId]);

  useEffect(() => {
    setIsConnected(connectionState === "connected");
  }, [connectionState]);

  return {
    taskStatus,
    progress,
    message,
    isConnected,
  };
}
