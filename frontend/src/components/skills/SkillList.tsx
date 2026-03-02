/**
 * SkillList Component
 * 技能列表组件
 * 渲染技能卡片列表，支持搜索过滤和空状态处理
 */

import { type Skill } from "../../../../shared/types/skills";
import { SkillCard } from "./SkillCard";
import { SparklesIcon } from "@heroicons/react/24/outline";

export interface SkillListProps {
  /** 技能列表 */
  skills: Skill[];
  /** 搜索关键词 */
  searchQuery?: string;
  /** 是否正在切换 */
  isToggling?: boolean;
  /** 正在切换的技能 ID */
  togglingSkillId?: string | null;
  /** 切换回调 */
  onToggle?: (skillId: string, enabled: boolean) => void;
  /** 点击技能卡片回调 */
  onSkillClick?: (skill: Skill) => void;
  /** 加载状态 */
  loading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 空状态操作回调 */
  onEmptyAction?: () => void;
  /** 重试回调 */
  onRetry?: () => void;
}

/**
 * 技能列表组件
 * 渲染技能卡片列表，支持搜索过滤和空状态处理
 */
export function SkillList({
  skills,
  searchQuery = "",
  isToggling = false,
  togglingSkillId = null,
  onToggle,
  onSkillClick,
  loading = false,
  error = null,
  onEmptyAction,
  onRetry,
}: SkillListProps) {
  // 过滤技能列表
  const filteredSkills = searchQuery.trim()
    ? skills.filter(
        (skill) =>
          skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          skill.id.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : skills;

  // 加载状态
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            加载技能中...
          </p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
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
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            重试
          </button>
        )}
      </div>
    );
  }

  // 空状态 - 无技能
  if (skills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div
          className="
          w-16 h-16 mb-4
          bg-slate-100 dark:bg-slate-700
          rounded-full
          flex items-center justify-center
        "
        >
          <SparklesIcon className="w-8 h-8 text-slate-400 dark:text-slate-500" />
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
          还没有安装技能
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mb-4">
          安装技能来扩展 Claude 的能力
        </p>
        {onEmptyAction && (
          <button
            onClick={onEmptyAction}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            安装技能
          </button>
        )}
      </div>
    );
  }

  // 空状态 - 搜索无结果
  if (filteredSkills.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div
          className="
          w-16 h-16 mb-4
          bg-slate-100 dark:bg-slate-700
          rounded-full
          flex items-center justify-center
        "
        >
          <svg
            className="w-8 h-8 text-slate-400 dark:text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
          未找到匹配的技能
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500">
          尝试其他关键词
        </p>
      </div>
    );
  }

  // 技能列表
  return (
    <div className="space-y-3 p-2">
      {filteredSkills.map((skill) => (
        <SkillCard
          key={skill.id}
          skill={skill}
          isToggling={isToggling && togglingSkillId === skill.id}
          onToggle={onToggle}
          onClick={onSkillClick}
        />
      ))}
    </div>
  );
}
