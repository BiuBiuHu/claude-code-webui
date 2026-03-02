/**
 * SkillCard Component
 * 技能卡片组件
 * 显示技能信息和开关
 */

import { type Skill, type SkillScope } from "../../../../shared/types/skills";
import { ToggleSwitch } from "./ToggleSwitch";
import { SparklesIcon } from "@heroicons/react/24/outline";

export interface SkillCardProps {
  /** 技能数据 */
  skill: Skill;
  /** 是否正在切换 */
  isToggling?: boolean;
  /** 切换回调 */
  onToggle?: (skillId: string, enabled: boolean) => void;
  /** 点击卡片回调 */
  onClick?: (skill: Skill) => void;
  /** 额外的类名 */
  className?: string;
}

/**
 * 获取作用域标签的显示文本
 */
function getScopeLabel(scope: SkillScope): string {
  switch (scope) {
    case "app":
      return "应用级";
    case "project":
      return "项目级";
    default:
      return scope;
  }
}

/**
 * 获取作用域标签的颜色类名
 */
function getScopeColorClass(scope: SkillScope): string {
  switch (scope) {
    case "app":
      return "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400";
    case "project":
      return "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400";
    default:
      return "bg-slate-50 text-slate-700 dark:bg-slate-900/20 dark:text-slate-400";
  }
}

/**
 * 技能卡片组件
 * 完全遵循 UI 规范的样式
 */
export function SkillCard({
  skill,
  isToggling = false,
  onToggle,
  onClick,
  className = "",
}: SkillCardProps) {
  const handleToggle = (enabled: boolean) => {
    if (onToggle && !isToggling) {
      onToggle(skill.id, enabled);
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick(skill);
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    // 阻止事件冒泡，避免触发卡片点击
    e.stopPropagation();
  };

  return (
    <article
      role="article"
      aria-label={`${skill.name} 技能，${skill.enabled ? "已启用" : "已禁用"}`}
      className={`
        p-3 rounded-lg border transition-all duration-200
        ${
          skill.enabled
            ? "bg-white dark:bg-slate-800 border-l-2 border-l-blue-500 border-slate-200 dark:border-slate-700 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600"
            : "bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
        }
        ${onClick ? "cursor-pointer" : "cursor-default"}
        ${className}
      `}
      onClick={handleCardClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick(skill);
        }
      }}
    >
      {/* 标题行 */}
      <div className="flex items-center gap-2 mb-1">
        {/* 技能图标 */}
        <span className="w-6 h-6 flex items-center justify-center flex-shrink-0">
          <SparklesIcon
            className={`w-5 h-5 ${skill.enabled ? "text-blue-500" : "text-slate-400"}`}
          />
        </span>

        {/* 技能名称 */}
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 truncate">
          {skill.name}
        </h3>

        {/* 开关 */}
        <div className="flex-shrink-0 ml-2" onClick={handleToggleClick}>
          <ToggleSwitch
            enabled={skill.enabled}
            onChange={handleToggle}
            disabled={isToggling}
            ariaLabel={`启用 ${skill.name} 技能`}
          />
        </div>
      </div>

      {/* 描述 */}
      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
        {skill.description}
      </p>

      {/* 元信息 */}
      <div className="flex items-center gap-2 text-[10px]">
        {/* 作用域标签 */}
        <span
          className={`
            inline-flex items-center px-2 py-0.5 rounded font-medium
            ${getScopeColorClass(skill.scope)}
          `}
        >
          {getScopeLabel(skill.scope)}
        </span>

        {/* 作者信息 */}
        {skill.metadata?.author && (
          <span className="text-slate-400 dark:text-slate-500">
            by {skill.metadata.author}
          </span>
        )}

        {/* 版本信息 */}
        {skill.metadata?.version && (
          <span className="text-slate-400 dark:text-slate-500 font-mono">
            v{skill.metadata.version}
          </span>
        )}
      </div>
    </article>
  );
}
