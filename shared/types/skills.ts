// Skills 作用域类型
export type SkillScope = "app" | "project";

// Skills 状态类型
export type SkillStatus = "enabled" | "disabled" | "error";

// Skills 来源类型
export type SkillSource = "builtin" | "user";

// Skill 元数据接口（从 YAML 前置数据解析）
export interface SkillMetadata {
  license?: string;
  compatibility?: string;
  author?: string;
  version?: string;
  allowedTools?: string[];
}

// Skill 接口
export interface Skill {
  id: string; // 技能唯一标识（目录名）
  name: string; // 技能名称（从 YAML 解析）
  description: string; // 技能描述
  scope: SkillScope; // 作用域
  enabled: boolean; // 是否启用
  path: string; // 技能目录绝对路径
  metadata: SkillMetadata; // YAML 前置数据
  dependencies?: string[]; // 依赖的 MCP 服务
  projectId?: string; // 关联项目 ID（project 级技能）
  createdAt: number; // 创建时间
}

// Skills 列表响应
export interface SkillsListResponse {
  appSkills: Skill[];
  projectSkills: Skill[];
}

// Skill 详情响应
export interface SkillDetailResponse {
  skill: Skill;
  content: string; // SKILL.md 内容
  hasScripts: boolean;
  scriptFiles?: string[];
}

// 安装源类型
export type InstallSource = "github" | "zip";

// 安装技能请求
export interface InstallSkillRequest {
  source: InstallSource;
  url?: string; // GitHub 仓库 URL
  scope: SkillScope;
  projectId?: string; // project 级技能必需
}

// 切换技能请求
export interface ToggleSkillRequest {
  skillId: string;
  enabled: boolean;
  scope: SkillScope;
  projectId?: string;
}

// 扫描技能响应
export interface ScanSkillsResponse {
  skills: Skill[];
  scanned: number;
  errors: string[];
}

// 删除技能请求
export interface DeleteSkillRequest {
  skillId: string;
  scope: SkillScope;
  projectId?: string;
}
