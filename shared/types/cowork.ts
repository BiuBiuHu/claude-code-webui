// 任务状态类型
export type TaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

// 任务步骤接口
export interface TaskStep {
  id: string;
  timestamp: number;
  message: string;
  progress: number;
  status: TaskStatus;
}

// Cowork 任务接口
export interface CoworkTask {
  id: string; // 任务 ID (UUID)
  sessionId: string; // 关联会话 ID
  skillId?: string; // 使用的技能
  status: TaskStatus;
  progress: number; // 进度 0-100
  message: string; // 当前执行消息
  result?: unknown; // 执行结果
  error?: string; // 错误信息
  startedAt?: number; // 开始时间
  completedAt?: number; // 完成时间
  steps: TaskStep[]; // 执行步骤
  createdAt: number; // 创建时间
}

// 创建任务请求
export interface CreateTaskRequest {
  skillId?: string;
  sessionId?: string;
  input?: Record<string, unknown>;
}

// 创建任务响应
export interface CreateTaskResponse {
  taskId: string;
  status: TaskStatus;
  createdAt: number;
}

// 任务列表响应
export interface TasksListResponse {
  tasks: CoworkTask[];
  running: number;
  queued: number;
  completed: number;
  failed: number;
}

// SSE 事件类型
export type TaskEventType =
  | "task_progress"
  | "task_completed"
  | "task_failed"
  | "task_cancelled";

// SSE 事件接口
export interface TaskSSEEvent {
  type: TaskEventType;
  taskId: string;
  data: {
    status: TaskStatus;
    progress: number;
    message: string;
    result?: unknown;
    error?: string;
    timestamp: number;
  };
}

// 取消任务请求
export interface CancelTaskRequest {
  taskId: string;
}
