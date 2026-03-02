/**
 * useSkillList Hook
 * 技能列表查询 Hook
 * 封装 getSkills() API 调用，处理加载和错误状态
 */

import { useState, useEffect, useCallback } from "react";
import type { Skill, SkillScope } from "../../../shared/types/skills";
import { getSkillsUrl } from "../config/api";

export interface UseSkillListOptions {
  /** 作用域过滤 */
  scope?: SkillScope;
  /** 项目 ID（用于 project 级技能） */
  projectId?: string;
  /** 是否启用轮询 */
  pollInterval?: number;
}

export interface UseSkillListReturn {
  /** 应用级技能列表 */
  appSkills: Skill[];
  /** 项目级技能列表 */
  projectSkills: Skill[];
  /** 所有技能列表（合并） */
  skills: Skill[];
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** 重新加载 */
  refetch: () => Promise<void>;
}

/**
 * 技能列表查询 Hook
 * 用于获取和过滤技能列表
 */
export function useSkillList(
  options: UseSkillListOptions = {},
): UseSkillListReturn {
  const { scope, projectId, pollInterval } = options;

  const [appSkills, setAppSkills] = useState<Skill[]>([]);
  const [projectSkills, setProjectSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 获取技能列表
   */
  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (scope) params.set("scope", scope);
      if (projectId) params.set("projectId", projectId);

      const url = `${getSkillsUrl()}${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch skills: ${response.statusText}`);
      }

      const data = await response.json();
      setAppSkills(data.appSkills || []);
      setProjectSkills(data.projectSkills || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch skills";
      setError(message);
      console.error("Failed to fetch skills:", err);
    } finally {
      setLoading(false);
    }
  }, [scope, projectId]);

  /**
   * 重新加载
   */
  const refetch = useCallback(async () => {
    await fetchSkills();
  }, [fetchSkills]);

  // 初始加载
  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // 轮询支持
  useEffect(() => {
    if (!pollInterval || pollInterval <= 0) return;

    const intervalId = setInterval(() => {
      fetchSkills();
    }, pollInterval);

    return () => clearInterval(intervalId);
  }, [pollInterval, fetchSkills]);

  // 合并所有技能
  const skills: Skill[] = [...appSkills, ...projectSkills];

  return {
    appSkills,
    projectSkills,
    skills,
    loading,
    error,
    refetch,
  };
}

/**
 * 技能列表过滤 Hook
 * 根据搜索关键词过滤技能列表
 */
export function useSkillFilter(skills: Skill[], searchQuery: string = "") {
  const [filteredSkills, setFilteredSkills] = useState<Skill[]>(skills);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSkills(skills);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.id.toLowerCase().includes(query),
    );

    setFilteredSkills(filtered);
  }, [skills, searchQuery]);

  return {
    filteredSkills,
    count: filteredSkills.length,
    totalCount: skills.length,
  };
}
