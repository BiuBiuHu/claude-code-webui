/**
 * useSkillToggle Hook
 * 技能启用/禁用 Hook
 * 封装 toggleSkill() API 调用，乐观更新 UI
 */

import { useState, useCallback } from "react";
import type { Skill, SkillScope } from "../../../shared/types/skills";
import { getToggleSkillUrl } from "../config/api";

export interface ToggleSkillOptions {
  /** 技能 ID */
  skillId: string;
  /** 当前是否启用 */
  enabled: boolean;
  /** 作用域 */
  scope: SkillScope;
  /** 项目 ID（project 级技能需要） */
  projectId?: string;
  /** 成功回调 */
  onSuccess?: (updatedSkill: Skill) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

export interface UseSkillToggleReturn {
  /** 切换中状态 */
  isToggling: boolean;
  /** 当前正在切换的技能 ID */
  togglingSkillId: string | null;
  /** 错误信息 */
  error: string | null;
  /** 切换技能状态 */
  toggleSkill: (options: ToggleSkillOptions) => Promise<void>;
  /** 重置错误 */
  resetError: () => void;
}

/**
 * 技能启用/禁用 Hook
 * 支持乐观更新和错误回滚
 */
export function useSkillToggle(
  /** 更新回调，用于乐观更新父组件状态 */
  onSkillUpdate?: (skillId: string, enabled: boolean) => void,
): UseSkillToggleReturn {
  const [isToggling, setIsToggling] = useState(false);
  const [togglingSkillId, setTogglingSkillId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 切换技能状态
   */
  const toggleSkill = useCallback(
    async (options: ToggleSkillOptions) => {
      const { skillId, scope, projectId, onSuccess, onError } = options;

      setIsToggling(true);
      setTogglingSkillId(skillId);
      setError(null);

      try {
        const response = await fetch(getToggleSkillUrl(), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skillId,
            enabled: !options.enabled, // 注意：这里需要传入目标状态
            scope,
            projectId,
          }),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ message: "Toggle failed" }));
          throw new Error(errorData.message || "Failed to toggle skill");
        }

        const updatedSkill: Skill = await response.json();

        // 调用成功回调
        onSuccess?.(updatedSkill);

        // 通知父组件更新
        onSkillUpdate?.(skillId, updatedSkill.enabled);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to toggle skill";
        setError(message);
        onError?.(err instanceof Error ? err : new Error(message));

        // 通知父组件回滚状态
        onSkillUpdate?.(skillId, !options.enabled);
      } finally {
        setIsToggling(false);
        setTogglingSkillId(null);
      }
    },
    [onSkillUpdate],
  );

  /**
   * 重置错误
   */
  const resetError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isToggling,
    togglingSkillId,
    error,
    toggleSkill,
    resetError,
  };
}

/**
 * 简化版技能切换 Hook
 * 返回一个简单的切换函数，自动处理乐观更新
 */
export function useSkillToggleSimple(
  _skills: Skill[],
  setSkills: React.Dispatch<React.SetStateAction<Skill[]>>,
) {
  const [isToggling, setIsToggling] = useState(false);
  const [togglingSkillId, setTogglingSkillId] = useState<string | null>(null);

  const toggleSkill = useCallback(
    async (
      skillId: string,
      currentEnabled: boolean,
      scope: SkillScope,
      projectId?: string,
    ) => {
      // 乐观更新
      const targetEnabled = !currentEnabled;
      setSkills((prev) =>
        prev.map((s) =>
          s.id === skillId ? { ...s, enabled: targetEnabled } : s,
        ),
      );

      setIsToggling(true);
      setTogglingSkillId(skillId);

      try {
        const response = await fetch(getToggleSkillUrl(), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skillId,
            enabled: targetEnabled,
            scope,
            projectId,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to toggle skill");
        }

        const updatedSkill: Skill = await response.json();

        // 更新为服务器返回的值
        setSkills((prev) =>
          prev.map((s) => (s.id === skillId ? updatedSkill : s)),
        );
      } catch (err) {
        // 回滚到原始状态
        setSkills((prev) =>
          prev.map((s) =>
            s.id === skillId ? { ...s, enabled: currentEnabled } : s,
          ),
        );
        console.error("Failed to toggle skill:", err);
      } finally {
        setIsToggling(false);
        setTogglingSkillId(null);
      }
    },
    [setSkills],
  );

  return {
    isToggling,
    togglingSkillId,
    toggleSkill,
  };
}
