/**
 * SkillsSettings Component
 * Skills 设置页面 - 用于 SettingsModal
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  SparklesIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import type { Skill, SkillScope } from "../../../../shared/types/skills";
import { useSkillList } from "../../hooks/useSkillList";
import { useSkillToggleSimple } from "../../hooks/useSkillToggle";
import { skillsApi, SkillsApiError } from "../../services/skillsApi";

export function SkillsSettings() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false);
  const [installUrl, setInstallUrl] = useState("");
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 技能列表
  const { appSkills, projectSkills, loading, refetch } = useSkillList({});

  // 合并技能列表
  const allSkills: Skill[] = useMemo(
    () => [...appSkills, ...projectSkills],
    [appSkills, projectSkills],
  );

  // 技能切换
  const { isToggling, togglingSkillId, toggleSkill } = useSkillToggleSimple(
    allSkills,
    () => refetch(),
  );

  // 过滤技能
  const filteredSkills = useMemo(() => {
    if (!searchQuery) return allSkills;
    const query = searchQuery.toLowerCase();
    return allSkills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query),
    );
  }, [allSkills, searchQuery]);

  // 处理技能切换
  const handleToggleSkill = useCallback(
    async (skillId: string, enabled: boolean) => {
      const skill = allSkills.find((s) => s.id === skillId);
      if (!skill) return;
      await toggleSkill(skillId, enabled, skill.scope, skill.projectId);
    },
    [allSkills, toggleSkill],
  );

  // 安装技能
  const handleInstallSkill = useCallback(async () => {
    if (!installUrl.trim()) return;

    try {
      setInstalling(true);
      setError(null);
      await skillsApi.installSkill({ url: installUrl });
      setInstallUrl("");
      setIsInstallDialogOpen(false);
      await refetch();
    } catch (err) {
      const message =
        err instanceof SkillsApiError ? err.message : "安装技能失败";
      setError(message);
    } finally {
      setInstalling(false);
    }
  }, [installUrl, refetch]);

  // 删除技能
  const handleDeleteSkill = useCallback(
    async (skillId: string, skillName: string) => {
      if (!confirm(`确定要删除技能 "${skillName}" 吗？`)) {
        return;
      }

      try {
        setError(null);
        await skillsApi.deleteSkill(skillId);
        await refetch();
      } catch (err) {
        const message =
          err instanceof SkillsApiError ? err.message : "删除技能失败";
        setError(message);
      }
    },
    [refetch],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Skills
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            管理和安装 Claude 技能扩展
          </p>
        </div>
        <button
          onClick={() => setIsInstallDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          安装技能
        </button>
      </div>

      {/* 安装技能表单 */}
      {isInstallDialogOpen && (
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <h4 className="text-md font-medium text-slate-800 dark:text-slate-100 mb-4">
            安装技能
          </h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Git 仓库 URL 或 npm 包名
              </label>
              <input
                type="text"
                value={installUrl}
                onChange={(e) => setInstallUrl(e.target.value)}
                placeholder="https://github.com/user/skill-repo 或 @scope/skill-name"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleInstallSkill}
                disabled={!installUrl.trim() || installing}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {installing ? "安装中..." : "安装"}
              </button>
              <button
                onClick={() => {
                  setIsInstallDialogOpen(false);
                  setInstallUrl("");
                  setError(null);
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索技能..."
          className="w-full pl-10 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Skills List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
          <SparklesIcon className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-400">
            {searchQuery ? "没有找到匹配的技能" : "尚未安装任何技能"}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
            安装技能以扩展 Claude 的功能
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSkills.map((skill) => {
            const isTogglingThis = togglingSkillId === skill.id;

            return (
              <div
                key={skill.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Icon */}
                    {skill.icon ? (
                      <img
                        src={skill.icon}
                        alt={skill.name}
                        className="w-10 h-10 rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                        <SparklesIcon className="w-5 h-5 text-white" />
                      </div>
                    )}

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-800 dark:text-slate-100">
                          {skill.name}
                        </h4>
                        {skill.enabled ? (
                          <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircleIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        )}
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                          {skill.scope === "app" ? "全局" : "项目"}
                        </span>
                      </div>
                      {skill.description && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                          {skill.description}
                        </p>
                      )}
                      {skill.version && (
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                          版本 {skill.version}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <button
                      onClick={() => handleToggleSkill(skill.id, skill.enabled)}
                      disabled={isToggling}
                      className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                        skill.enabled
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      } ${isTogglingThis ? "opacity-50" : ""}`}
                    >
                      {isTogglingThis
                        ? "切换中..."
                        : skill.enabled
                          ? "已启用"
                          : "已禁用"}
                    </button>
                    <button
                      onClick={() => handleDeleteSkill(skill.id, skill.name)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="删除技能"
                    >
                      <TrashIcon className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
