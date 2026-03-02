/**
 * TaskCard Component
 * Cowork 任务卡片组件
 * 显示任务信息、进度条、状态徽章和操作按钮
 */

import {
  type CoworkTask,
  type TaskStatus,
} from "../../../../shared/types/cowork";
import {
  XMarkIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

export interface TaskCardProps {
  /** 任务数据 */
  task: CoworkTask;
  /** 是否正在取消 */
  isCancelling?: boolean;
  /** 取消回调 */
  onCancel?: (taskId: string) => void;
  /** 点击回调 */
  onClick?: (task: CoworkTask) => void;
  /** 额外的类名 */
  className?: string;
}

/**
 * 获取状态显示文本
 */
function getStatusText(status: TaskStatus): string {
  switch (status) {
    case "queued":
      return "排队中";
    case "running":
      return "执行中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    default:
      return status;
  }
}

/**
 * 获取状态徽章样式
 */
function getStatusBadgeStyles(status: TaskStatus): string {
  const baseStyles =
    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium";

  switch (status) {
    case "queued":
      return `${baseStyles} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300`;
    case "running":
      return `${baseStyles} bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400`;
    case "completed":
      return `${baseStyles} bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400`;
    case "failed":
      return `${baseStyles} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400`;
    case "cancelled":
      return `${baseStyles} bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400`;
    default:
      return baseStyles;
  }
}

/**
 * 获取状态图标
 */
function getStatusIcon(status: TaskStatus) {
  switch (status) {
    case "queued":
      return <ClockIcon className="w-3 h-3" />;
    case "running":
      return (
        <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      );
    case "completed":
      return <CheckCircleIcon className="w-3 h-3" />;
    case "failed":
      return <XCircleIcon className="w-3 h-3" />;
    case "cancelled":
      return <XMarkIcon className="w-3 h-3" />;
    default:
      return null;
  }
}

/**
 * 获取进度条颜色
 */
function getProgressColor(status: TaskStatus): string {
  switch (status) {
    case "running":
      return "bg-blue-500";
    case "completed":
      return "bg-green-500";
    case "failed":
      return "bg-red-500";
    case "cancelled":
      return "bg-slate-400";
    default:
      return "bg-slate-300";
  }
}

/**
 * 任务卡片组件
 * 完全遵循 UI 规范的样式
 */
export function TaskCard({
  task,
  isCancelling = false,
  onCancel,
  onClick,
  className = "",
}: TaskCardProps) {
  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCancel && !isCancelling) {
      onCancel(task.id);
    }
  };

  const canCancel = task.status === "queued" || task.status === "running";
  const showProgress = task.status === "running" || task.status === "completed";

  return (
    <article
      className={`
        p-3 rounded-lg border transition-all duration-200
        ${
          task.status === "running"
            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
            : task.status === "completed"
              ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
              : task.status === "failed"
                ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
        }
        ${onClick ? "cursor-pointer hover:shadow-md" : "cursor-default"}
        ${className}
      `}
      onClick={() => onClick?.(task)}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick(task);
        }
      }}
    >
      {/* 标题行 */}
      <div className="flex items-center justify-between mb-2">
        {/* 任务 ID 和技能 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
              {task.skillId || "通用任务"}
            </h3>
            {/* 状态徽章 */}
            <span className={getStatusBadgeStyles(task.status)}>
              {getStatusIcon(task.status)}
              <span>{getStatusText(task.status)}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            {task.id.slice(0, 8)}...
          </p>
        </div>

        {/* 取消按钮 */}
        {canCancel && onCancel && (
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="
              p-1 rounded
              hover:bg-slate-200 dark:hover:bg-slate-700
              text-slate-400 hover:text-red-500
              dark:hover:text-red-400
              transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            aria-label={`取消任务 ${task.id}`}
            title="取消任务"
          >
            {isCancelling ? (
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <XMarkIcon className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* 执行消息 */}
      {task.message && (
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
          {task.message}
        </p>
      )}

      {/* 进度条 */}
      {showProgress && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              进度
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {task.progress}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${getProgressColor(task.status)} transition-all duration-300`}
              style={{ width: `${task.progress}%` }}
              role="progressbar"
              aria-valuenow={task.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* 错误信息 */}
      {task.status === "failed" && task.error && (
        <div className="flex items-start gap-2 p-2 bg-red-100 dark:bg-red-900/20 rounded">
          <ExclamationTriangleIcon className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-600 dark:text-red-400 flex-1">
            {task.error}
          </p>
        </div>
      )}

      {/* 步骤列表（如果有） */}
      {task.steps && task.steps.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
          <details className="group">
            <summary className="text-[10px] text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300">
              查看执行步骤 ({task.steps.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {task.steps.slice(-3).map((step) => (
                <li
                  key={step.id}
                  className="text-[10px] text-slate-600 dark:text-slate-400 flex items-start gap-2"
                >
                  <span
                    className={`
                      mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0
                      ${step.status === "completed" ? "bg-green-500" : step.status === "failed" ? "bg-red-500" : "bg-slate-400"}
                    `}
                  />
                  <span className="flex-1">{step.message}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </article>
  );
}
