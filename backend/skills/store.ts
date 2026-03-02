/**
 * Skills 存储管理器
 *
 * 管理技能的内存缓存和状态
 */

import { logger } from "../utils/logger.ts";
import type { Skill, SkillScope } from "../../shared/types/skills.ts";
import type { SkillsStoreConfig } from "./types.ts";
import { getDefaultSkillsConfig } from "./types.ts";
import { loadAllSkills, reloadSkill } from "./loader.ts";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * 获取项目根目录
 * 从当前模块的路径向上查找
 */
function getProjectRoot(): string {
  const __dirname =
    import.meta.dirname ?? dirname(fileURLToPath(import.meta.url));
  // 当前在 backend/skills/store.ts，需要向上两级到项目根目录
  return join(dirname(dirname(__dirname)));
}

/**
 * Skills 存储类
 * 管理应用级和项目级技能的缓存
 */
export class SkillsStore {
  private config: SkillsStoreConfig;
  private appSkills: Map<string, Skill> = new Map();
  private projectSkills: Map<string, Map<string, Skill>> = new Map(); // projectId -> skills
  private initialized = false;

  constructor(config?: SkillsStoreConfig) {
    // 获取应用根目录（从当前文件路径推导）
    const appRoot = getProjectRoot();
    this.config = config || getDefaultSkillsConfig(appRoot);
    logger.skills.debug("SkillsStore created with appRoot: {appRoot}", {
      appRoot,
      builtinDir: this.config.builtinSkillsDir,
    });
  }

  /**
   * 初始化存储
   * 扫描并加载所有技能
   *
   * @param projectPaths - 项目路径列表
   */
  async initialize(projectPaths: string[] = []): Promise<void> {
    if (this.initialized) {
      logger.skills.debug("SkillsStore already initialized");
      return;
    }

    logger.skills.info(
      "Initializing SkillsStore with {projectCount} projects",
      {
        projectCount: projectPaths.length,
      },
    );

    try {
      const { appSkills, projectSkills } = await loadAllSkills(
        this.config,
        projectPaths,
      );

      // 缓存应用级技能
      for (const skill of appSkills) {
        this.appSkills.set(skill.id, skill);
      }

      // 缓存项目级技能
      for (const skill of projectSkills) {
        const projectId = skill.projectId || "default";
        if (!this.projectSkills.has(projectId)) {
          this.projectSkills.set(projectId, new Map());
        }
        this.projectSkills.get(projectId)!.set(skill.id, skill);
      }

      this.initialized = true;
      logger.skills.info(
        "SkillsStore initialized: {appCount} app skills, {projectCount} project skills",
        {
          appCount: this.appSkills.size,
          projectCount: projectSkills.length,
        },
      );
    } catch (error) {
      logger.skills.error("Failed to initialize SkillsStore", { error });
      throw error;
    }
  }

  /**
   * 获取所有应用级技能
   */
  getAppSkills(): Skill[] {
    return Array.from(this.appSkills.values());
  }

  /**
   * 获取指定项目的技能
   *
   * @param projectId - 项目 ID
   */
  getProjectSkills(projectId: string): Skill[] {
    const skills = this.projectSkills.get(projectId);
    return skills ? Array.from(skills.values()) : [];
  }

  /**
   * 获取所有项目级技能
   */
  getAllProjectSkills(): Skill[] {
    const allSkills: Skill[] = [];
    for (const skills of this.projectSkills.values()) {
      allSkills.push(...skills.values());
    }
    return allSkills;
  }

  /**
   * 根据 ID 获取技能
   *
   * @param skillId - 技能 ID
   * @param scope - 技能作用域
   * @param projectId - 项目 ID（project 级技能需要）
   */
  getSkill(
    skillId: string,
    scope: SkillScope,
    projectId?: string,
  ): Skill | undefined {
    if (scope === "app") {
      return this.appSkills.get(skillId);
    } else {
      const pid = projectId || "default";
      const skills = this.projectSkills.get(pid);
      return skills?.get(skillId);
    }
  }

  /**
   * 添加技能
   *
   * @param skill - 要添加的技能
   */
  addSkill(skill: Skill): void {
    if (skill.scope === "app") {
      this.appSkills.set(skill.id, skill);
    } else {
      const pid = skill.projectId || "default";
      if (!this.projectSkills.has(pid)) {
        this.projectSkills.set(pid, new Map());
      }
      this.projectSkills.get(pid)!.set(skill.id, skill);
    }

    logger.skills.debug("Added skill: {skillId} with scope {scope}", {
      skillId: skill.id,
      scope: skill.scope,
    });
  }

  /**
   * 移除技能
   *
   * @param skillId - 技能 ID
   * @param scope - 技能作用域
   * @param projectId - 项目 ID（project 级技能需要）
   */
  removeSkill(skillId: string, scope: SkillScope, projectId?: string): boolean {
    let removed = false;

    if (scope === "app") {
      removed = this.appSkills.delete(skillId);
    } else {
      const pid = projectId || "default";
      const skills = this.projectSkills.get(pid);
      if (skills) {
        removed = skills.delete(skillId);
      }
    }

    if (removed) {
      logger.skills.debug("Removed skill: {skillId} with scope {scope}", {
        skillId,
        scope,
      });
    }

    return removed;
  }

  /**
   * 切换技能启用状态
   *
   * @param skillId - 技能 ID
   * @param enabled - 是否启用
   * @param scope - 技能作用域
   * @param projectId - 项目 ID（project 级技能需要）
   */
  toggleSkill(
    skillId: string,
    enabled: boolean,
    scope: SkillScope,
    projectId?: string,
  ): boolean {
    const skill = this.getSkill(skillId, scope, projectId);
    if (skill) {
      skill.enabled = enabled;
      logger.skills.debug("Toggled skill {skillId}: {enabled}", {
        skillId,
        enabled,
      });
      return true;
    }
    return false;
  }

  /**
   * 重新加载技能
   *
   * @param skillId - 技能 ID
   * @param scope - 技能作用域
   * @param projectId - 项目 ID（project 级技能需要）
   */
  async reloadSkill(
    skillId: string,
    scope: SkillScope,
    projectId?: string,
  ): Promise<Skill | null> {
    const oldSkill = this.getSkill(skillId, scope, projectId);
    if (!oldSkill) {
      return null;
    }

    const newSkill = await reloadSkill(oldSkill);
    if (newSkill) {
      // 更新缓存
      if (scope === "app") {
        this.appSkills.set(skillId, newSkill);
      } else {
        const pid = projectId || "default";
        const skills = this.projectSkills.get(pid);
        if (skills) {
          skills.set(skillId, newSkill);
        }
      }

      logger.skills.info("Reloaded skill: {skillId}", { skillId });
    }

    return newSkill;
  }

  /**
   * 刷新所有技能
   *
   * @param projectPaths - 项目路径列表
   */
  async refresh(projectPaths: string[] = []): Promise<void> {
    logger.skills.info("Refreshing SkillsStore");

    // 清空缓存
    this.appSkills.clear();
    this.projectSkills.clear();
    this.initialized = false;

    // 重新初始化
    await this.initialize(projectPaths);
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 获取配置
   */
  getConfig(): SkillsStoreConfig {
    return this.config;
  }
}

// 单例实例
let storeInstance: SkillsStore | null = null;

/**
 * 获取 SkillsStore 单例
 *
 * @param config - 可选的配置（仅在首次调用时使用）
 */
export function getSkillsStore(config?: SkillsStoreConfig): SkillsStore {
  if (!storeInstance) {
    storeInstance = new SkillsStore(config);
  }
  return storeInstance;
}

/**
 * 重置 SkillsStore 单例
 * 主要用于测试
 */
export function resetSkillsStore(): void {
  storeInstance = null;
}
