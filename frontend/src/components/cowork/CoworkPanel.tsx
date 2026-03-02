/**
 * CoworkPanel Component
 * Cowork 任务面板组件
 * 右侧边栏布局，显示任务队列
 */

import { useState, useCallback, useEffect } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import type { CoworkTask } from "../../../../shared/types/cowork";
import { useCoworkTasks } from "../../hooks/useCoworkTasks";
import { useTaskSSE } from "../../hooks/useTaskSSE";
import { TaskCard } from "./TaskCard";

export interface CoworkPanelProps {
  /** 是否展开 */
  isOpen?: boolean;
  /** 切换展开/收起 */
  onToggle?: () => void;
  /** 会话 ID（用于过滤任务） */
  sessionId?: string;
  /** 任务点击回调 */
  onTaskClick?: (task: CoworkTask) => void;
}

/**
 * Cowork 任务面板组件
 * 右侧边栏布局，显示任务队列
 */
export function CoworkPanel({
  isOpen = true,
  onToggle,
  sessionId,
  onTaskClick,
}: CoworkPanelProps) {
  // 面板状态
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "running" | "queued" | "completed" | "failed"
  >("all");
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null);

  // 任务列表
  const {
    tasks,
    loading,
    error,
    stats,
    refresh,
    cancel: cancelTask,
  } = useCoworkTasks({
    autoLoad: true,
    statusFilter: statusFilter === "all" ? undefined : statusFilter,
    limit: 20,
  });

  // SSE 实时更新
  const { connectionState } = useTaskSSE({
    sessionId,
    enabled: isOpen && !isCollapsed,
  });

  /**
   * 处理面板折叠切换
   */
  const handleCollapseToggle = useCallback(() => {
    setIsCollapsed((prev) => !prev);
    if (onToggle) {
      onToggle();
    }
  }, [onToggle]);

  /**
   * 处理取消任务
   */
  const handleCancelTask = useCallback(
    async (taskId: string) => {
      setCancellingTaskId(taskId);
      try {
        await cancelTask(taskId);
      } finally {
        setCancellingTaskId(null);
      }
    },
    [cancelTask],
  );

  /**
   * 处理任务点击
   */
  const handleTaskClick = useCallback(
    (task: CoworkTask) => {
      onTaskClick?.(task);
    },
    [onTaskClick],
  );

  /**
   * 处理状态过滤变化
   */
  const handleStatusFilterChange = useCallback(
    (newFilter: typeof statusFilter) => {
      setStatusFilter(newFilter);
    },
    [],
  );

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      setCancellingTaskId(null);
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  // 折叠状态
  if (isCollapsed) {
    return (
      <div
        className="
          flex-shrink-0
          bg-white dark:bg-slate-800
          border-l border-slate-200 dark:border-slate-700
          flex flex-col items-center py-4
          transition-all duration-250 ease-out
          w-12
        "
        role="complementary"
        aria-label="Cowork 任务"
      >
        <button
          onClick={handleCollapseToggle}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="展开 Cowork 面板"
          title="展开 Cowork 面板"
        >
          <ChevronLeftIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>

        {/* 运行中任务数量 */}
        {stats.running > 0 && (
          <div className="mt-4 relative">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          </div>
        )}
      </div>
    );
  }

  // 展开状态
  return (
    <div
      className="
        flex-shrink-0
        bg-white dark:bg-slate-800
        border-l border-slate-200 dark:border-slate-700
        flex flex-col h-screen
        transition-all duration-250 ease-out
        w-80
      "
      role="complementary"
      aria-label="Cowork 任务"
    >
      {/* 顶部栏 */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-purple-500 rounded" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Cowork
            </h2>
            {/* SSE 连接状态指示器 */}
            <div
              className={`
                w-2 h-2 rounded-full
                ${connectionState === "connected" ? "bg-green-500" : connectionState === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-slate-400"}
              `}
              title={`连接状态: ${connectionState}`}
            />
          </div>
          <button
            onClick={handleCollapseToggle}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="收起面板"
            title="收起面板"
          >
            <ChevronRightIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* 状态过滤器 */}
        <div className="flex gap-1">
          <FilterButton
            active={statusFilter === "all"}
            count={tasks.length}
            onClick={() => handleStatusFilterChange("all")}
          >
            全部
          </FilterButton>
          <FilterButton
            active={statusFilter === "running"}
            count={stats.running}
            onClick={() => handleStatusFilterChange("running")}
          >
            运行
          </FilterButton>
          <FilterButton
            active={statusFilter === "queued"}
            count={stats.queued}
            onClick={() => handleStatusFilterChange("queued")}
          >
            排队
          </FilterButton>
          <FilterButton
            active={statusFilter === "completed"}
            count={stats.completed}
            onClick={() => handleStatusFilterChange("completed")}
          >
            完成
          </FilterButton>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                加载任务中...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 mb-3 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              加载失败
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500 mb-4">
              {error}
            </p>
            <button
              onClick={refresh}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              重试
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <ClockIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              暂无任务
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              任务将在此处显示
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isCancelling={cancellingTaskId === task.id}
                onCancel={handleCancelTask}
                onClick={handleTaskClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* 底部统计 */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {stats.running > 0 && (
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                {stats.running} 运行中
              </span>
            )}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            {stats.completed} 已完成
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * 过滤按钮组件
 */
interface FilterButtonProps {
  children: React.ReactNode;
  active?: boolean;
  count?: number;
  onClick: () => void;
}

function FilterButton({
  children,
  active = false,
  count = 0,
  onClick,
}: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 flex items-center justify-center gap-1
        px-2 py-1.5 rounded-lg text-xs font-medium
        transition-all duration-200
        ${
          active
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
        }
      `}
    >
      {children}
      {count > 0 && (
        <span
          className={`
            px-1.5 py-0.5 rounded-full text-[10px]
            ${active ? "bg-blue-200 dark:bg-blue-800" : "bg-slate-200 dark:bg-slate-700"}
          `}
        >
          {count}
        </span>
      )}
    </button>
  );
}
