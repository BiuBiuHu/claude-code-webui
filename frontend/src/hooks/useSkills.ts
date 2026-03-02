/**
 * useSkills Hook
 * 技能数据管理 Hook
 */

import { useState, useCallback, useEffect } from "react";
import type { Skill, SkillScope } from "../../../shared/types/skills";
import { skillsApi, SkillsApiError } from "../services/skillsApi";

export interface UseSkillsOptions {
  /** 是否自动加载技能列表 */
  autoLoad?: boolean;
  /** 作用域过滤 */
  scope?: SkillScope;
  /** 项目 ID（用于 project 级技能） */
  projectId?: string;
}

export interface UseSkillsReturn {
  /** 应用级技能列表 */
  appSkills: Skill[];
  /** 项目级技能列表 */
  projectSkills: Skill[];
  /** 所有技能列表（合并） */
  allSkills: Skill[];
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 刷新技能列表 */
  refresh: () => Promise<void>;
  /** 安装技能 */
  install: (request: {
    source: "github" | "zip";
    url?: string;
    scope: SkillScope;
    projectId?: string;
  }) => Promise<Skill>;
  /** 删除技能 */
  delete: (
    skillId: string,
    scope: SkillScope,
    projectId?: string,
  ) => Promise<void>;
  /** 切换技能状态 */
  toggle: (
    skillId: string,
    enabled: boolean,
    scope: SkillScope,
    projectId?: string,
  ) => Promise<void>;
  /** 扫描技能目录 */
  scan: () => Promise<void>;
}

/**
 * 技能数据管理 Hook
 * 提供技能列表状态管理和操作方法
 */
export function useSkills(options: UseSkillsOptions = {}): UseSkillsReturn {
  const { autoLoad = true, scope } = options;

  const [appSkills, setAppSkills] = useState<Skill[]>([]);
  const [projectSkills, setProjectSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 加载技能列表
   */
  const loadSkills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = scope ? { scope } : undefined;
      const response = await skillsApi.getSkills(params);

      setAppSkills(response.appSkills || []);
      setProjectSkills(response.projectSkills || []);
    } catch (err) {
      const message =
        err instanceof SkillsApiError ? err.message : "Failed to load skills";
      setError(message);
      console.error("Failed to load skills:", err);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  /**
   * 刷新技能列表
   */
  const refresh = useCallback(async () => {
    await loadSkills();
  }, [loadSkills]);

  /**
   * 安装技能
   */
  const install = useCallback(
    async (request: {
      source: "github" | "zip";
      url?: string;
      scope: SkillScope;
      projectId?: string;
    }): Promise<Skill> => {
      try {
        setLoading(true);
        setError(null);

        const newSkill = await skillsApi.installSkill({
          source: request.source,
          url: request.url,
          scope: request.scope,
          projectId: request.projectId,
        });

        // 重新加载技能列表
        await loadSkills();

        return newSkill;
      } catch (err) {
        const message =
          err instanceof SkillsApiError
            ? err.message
            : "Failed to install skill";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [loadSkills],
  );

  /**
   * 删除技能
   */
  const deleteSkillById = useCallback(
    async (
      skillId: string,
      skillScope: SkillScope,
      skillProjectId?: string,
    ) => {
      try {
        setLoading(true);
        setError(null);

        await skillsApi.deleteSkill({
          skillId,
          scope: skillScope,
          projectId: skillProjectId,
        });

        // 从状态中移除已删除的技能
        if (skillScope === "app") {
          setAppSkills((prev) => prev.filter((s) => s.id !== skillId));
        } else {
          setProjectSkills((prev) => prev.filter((s) => s.id !== skillId));
        }
      } catch (err) {
        const message =
          err instanceof SkillsApiError
            ? err.message
            : "Failed to delete skill";
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /**
   * 切换技能状态
   */
  const toggleSkillState = useCallback(
    async (
      skillId: string,
      enabled: boolean,
      skillScope: SkillScope,
      skillProjectId?: string,
    ) => {
      try {
        setError(null);

        const updatedSkill = await skillsApi.toggleSkill({
          skillId,
          enabled,
          scope: skillScope,
          projectId: skillProjectId,
        });

        // 乐观更新状态
        const updateSkillInList = (skills: Skill[]) =>
          skills.map((s) => (s.id === skillId ? updatedSkill : s));

        if (skillScope === "app") {
          setAppSkills(updateSkillInList);
        } else {
          setProjectSkills(updateSkillInList);
        }
      } catch (err) {
        const message =
          err instanceof SkillsApiError
            ? err.message
            : "Failed to toggle skill";
        setError(message);
        throw err;
      }
    },
    [],
  );

  /**
   * 扫描技能目录
   */
  const scan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await skillsApi.scanSkills();

      // 更新技能列表
      if (result.skills) {
        const appScanned = result.skills.filter((s) => s.scope === "app");
        const projectScanned = result.skills.filter(
          (s) => s.scope === "project",
        );
        setAppSkills(appScanned);
        setProjectSkills(projectScanned);
      }

      if (result.errors && result.errors.length > 0) {
        console.warn("Skill scan completed with errors:", result.errors);
      }
    } catch (err) {
      const message =
        err instanceof SkillsApiError ? err.message : "Failed to scan skills";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // 自动加载技能列表
  useEffect(() => {
    if (autoLoad) {
      loadSkills();
    }
  }, [autoLoad, loadSkills]);

  // 合并所有技能
  const allSkills: Skill[] = [...appSkills, ...projectSkills];

  return {
    appSkills,
    projectSkills,
    allSkills,
    loading,
    error,
    refresh,
    install,
    delete: deleteSkillById,
    toggle: toggleSkillState,
    scan,
  };
}
