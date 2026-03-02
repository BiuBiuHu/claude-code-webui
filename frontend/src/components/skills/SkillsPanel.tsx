/**
 * SkillsPanel Component
 * Skills 主面板组件
 * 左侧边栏布局，支持展开/收起
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  SparklesIcon,
  CogIcon,
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import type { Skill, SkillScope } from "../../../../shared/types/skills";
import { useSkillList } from "../../hooks/useSkillList";
import { useSkillToggleSimple } from "../../hooks/useSkillToggle";
import { SkillSearchInput } from "./SkillSearchInput";
import { SkillList } from "./SkillList";
import { InstallSkillDialog } from "./InstallSkillDialog";

export interface SkillsPanelProps {
  /** 是否展开 */
  isOpen?: boolean;
  /** 切换展开/收起 */
  onToggle?: () => void;
  /** 作用域过滤 */
  scope?: SkillScope;
  /** 项目 ID */
  projectId?: string;
  /** 技能启用变化回调 */
  onSkillToggle?: (skillId: string, enabled: boolean) => void;
}

/**
 * Skills 主面板组件
 * 完全遵循 UI 规范的样式和布局
 */
export function SkillsPanel({
  isOpen = true,
  onToggle,
  scope,
  projectId,
  onSkillToggle,
}: SkillsPanelProps) {
  // 面板状态
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false);

  // 技能列表
  const { appSkills, projectSkills, loading, error, refetch } = useSkillList({
    scope,
    projectId,
  });

  // 合并技能列表（包含作用域信息）
  const allSkills: Skill[] = useMemo(
    () => [...appSkills, ...projectSkills],
    [appSkills, projectSkills],
  );

  // 技能切换
  const { isToggling, togglingSkillId, toggleSkill } = useSkillToggleSimple(
    allSkills,
    () => refetch(),
  );

  // 搜索输入框引用
  const searchInputRef = useRef<HTMLInputElement>(null);

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
   * 处理搜索变化
   */
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  /**
   * 处理技能切换
   */
  const handleSkillToggleState = useCallback(
    async (skillId: string, enabled: boolean) => {
      const skill = allSkills.find((s) => s.id === skillId);
      if (!skill) return;

      await toggleSkill(skillId, enabled, skill.scope, skill.projectId);
      onSkillToggle?.(skillId, !enabled);
    },
    [allSkills, toggleSkill, onSkillToggle],
  );

  /**
   * 打开安装对话框
   */
  const handleOpenInstallDialog = useCallback(() => {
    setIsInstallDialogOpen(true);
  }, []);

  /**
   * 关闭安装对话框
   */
  const handleCloseInstallDialog = useCallback(() => {
    setIsInstallDialogOpen(false);
  }, []);

  /**
   * 安装成功回调
   */
  const handleInstallSuccess = useCallback(() => {
    refetch();
  }, [refetch]);

  /**
   * 重试加载
   */
  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  /**
   * 处理空状态操作
   */
  const handleEmptyAction = useCallback(() => {
    handleOpenInstallDialog();
  }, [handleOpenInstallDialog]);

  /**
   * 展开/收起后聚焦搜索框
   */
  useEffect(() => {
    if (!isCollapsed && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isCollapsed]);

  // 计算统计信息
  const enabledCount = allSkills.filter((s) => s.enabled).length;
  const totalCount = allSkills.length;

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
          border-r border-slate-200 dark:border-slate-700
          flex flex-col items-center py-4
          transition-all duration-250 ease-out
          w-12
        "
        role="complementary"
        aria-label="Skills 管理"
      >
        <button
          onClick={handleCollapseToggle}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="展开 Skills 面板"
          title="展开 Skills 面板"
        >
          <ChevronRightIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
        <button
          onClick={handleOpenInstallDialog}
          className="mt-4 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          aria-label="安装技能"
          title="安装技能"
        >
          <PlusIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        </button>
      </div>
    );
  }

  // 展开状态
  return (
    <>
      <div
        className="
          flex-shrink-0
          bg-white dark:bg-slate-800
          border-r border-slate-200 dark:border-slate-700
          flex flex-col h-screen
          transition-all duration-250 ease-out
          w-72
        "
        role="complementary"
        aria-label="Skills 管理"
      >
        {/* 顶部栏 */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              Skills
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="设置"
              title="设置"
            >
              <CogIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <button
              onClick={handleCollapseToggle}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="收起面板"
              title="收起面板"
            >
              <ChevronLeftIcon className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        {/* 安装按钮 */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={handleOpenInstallDialog}
            className="
              w-full flex items-center justify-center gap-2
              px-3 py-1.5
              bg-blue-600 hover:bg-blue-700
              text-white
              rounded-lg
              text-sm font-medium
              transition-colors
            "
          >
            <PlusIcon className="w-4 h-4" />
            安装技能
          </button>
        </div>

        {/* 搜索栏 */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-700">
          <SkillSearchInput
            ref={searchInputRef}
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="搜索技能..."
          />
        </div>

        {/* 技能列表 */}
        <div className="flex-1 overflow-y-auto">
          <SkillList
            skills={allSkills}
            searchQuery={searchQuery}
            isToggling={isToggling}
            togglingSkillId={togglingSkillId}
            onToggle={handleSkillToggleState}
            loading={loading}
            error={error}
            onEmptyAction={handleEmptyAction}
            onRetry={handleRetry}
          />
        </div>

        {/* 底部统计 */}
        <div className="p-2 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            {totalCount} 个技能 • {enabledCount} 个已启用
          </p>
        </div>
      </div>

      {/* 安装技能对话框 */}
      <InstallSkillDialog
        isOpen={isInstallDialogOpen}
        onClose={handleCloseInstallDialog}
        onSuccess={handleInstallSuccess}
        defaultScope={scope}
        projectId={projectId}
      />
    </>
  );
}
