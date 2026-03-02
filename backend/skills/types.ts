/**
 * Skills 模块内部类型定义
 *
 * 定义 Skills 扫描、加载、验证过程中使用的内部类型
 */

import type {
  Skill,
  SkillMetadata,
  SkillScope,
} from "../../shared/types/skills.ts";

/**
 * 扫描结果接口
 * 包含扫描到的技能、统计信息和错误
 */
export interface ScanResult {
  skills: Skill[];
  scanned: number;
  errors: string[];
}

/**
 * 技能目录结构
 * 描述技能目录的文件组织
 */
export interface SkillDirectoryStructure {
  hasSkillMd: boolean;
  hasScriptsDir: boolean;
  hasReferencesDir: boolean;
  hasAssetsDir: boolean;
  scriptFiles?: string[];
}

/**
 * 解析后的 SKILL.md 内容
 */
export interface ParsedSkillFile {
  metadata: SkillMetadata;
  content: string;
  name: string;
  description: string;
}

/**
 * Skills 存储配置
 */
export interface SkillsStoreConfig {
  /**
   * 应用级技能根目录
   */
  appSkillsRoot: string;

  /**
   * 内置技能目录（只读）
   */
  builtinSkillsDir: string;

  /**
   * 用户安装技能目录
   */
  userSkillsDir: string;

  /**
   * 项目级技能目录相对于项目根目录的路径
   */
  projectSkillsRelativePath: string;
}

/**
 * 技能安装选项
 */
export interface SkillInstallOptions {
  source: "github" | "zip";
  url?: string;
  scope: SkillScope;
  projectId?: string;
}

/**
 * 技能安装结果
 */
export interface SkillInstallResult {
  success: boolean;
  skill?: Skill;
  error?: string;
}

/**
 * 技能文件验证错误
 */
export interface SkillValidationError {
  path: string;
  field: string;
  message: string;
}

/**
 * Skills 缓存项
 */
export interface SkillCacheItem {
  skill: Skill;
  lastModified: number;
  valid: boolean;
}

/**
 * 技能加载状态
 */
export type SkillLoadStatus = "pending" | "loading" | "loaded" | "error";

/**
 * 技能加载任务
 */
export interface SkillLoadTask {
  skillId: string;
  status: SkillLoadStatus;
  error?: string;
}

/**
 * 默认的 Skills 存储配置
 */
export function getDefaultSkillsConfig(appRoot: string): SkillsStoreConfig {
  return {
    appSkillsRoot: `${appRoot}/skills`,
    builtinSkillsDir: `${appRoot}/skills/builtin`,
    userSkillsDir: `${appRoot}/skills/user`,
    projectSkillsRelativePath: ".claude/skills",
  };
}

/**
 * 判断是否为有效的技能目录名
 * 技能目录名只能包含小写字母、数字、连字符
 */
export function isValidSkillDirName(name: string): boolean {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(name);
}

/**
 * 标准化技能 ID
 * 确保技能 ID 符合命名规范
 */
export function normalizeSkillId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * 技能路径类型
 */
export type SkillPathType = "builtin" | "user" | "project";

/**
 * 技能位置信息
 */
export interface SkillLocation {
  type: SkillPathType;
  basePath: string;
  fullPath: string;
  projectId?: string;
}
