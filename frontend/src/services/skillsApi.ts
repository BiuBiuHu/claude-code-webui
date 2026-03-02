/**
 * Skills API Service
 * 技能管理相关的 API 服务
 */

import type {
  Skill,
  SkillsListResponse,
  SkillDetailResponse,
  InstallSkillRequest,
  ToggleSkillRequest,
  ScanSkillsResponse,
  DeleteSkillRequest,
} from "../../../shared/types/skills";
import {
  getSkillsUrl,
  getSkillDetailUrl,
  getInstallSkillUrl,
  getDeleteSkillUrl,
  getToggleSkillUrl,
  getScanSkillsUrl,
} from "../config/api";

/**
 * API 错误类
 */
class SkillsApiError extends Error {
  statusCode?: number;
  response?: unknown;

  constructor(message: string, statusCode?: number, response?: unknown) {
    super(message);
    this.name = "SkillsApiError";
    this.statusCode = statusCode;
    this.response = response;
  }
}

export { SkillsApiError };

/**
 * 获取技能列表
 * @param params 查询参数
 * @returns 技能列表响应
 */
export async function getSkills(params?: {
  scope?: string;
  projectId?: string;
}): Promise<SkillsListResponse> {
  const response = await fetch(getSkillsUrl(params));

  if (!response.ok) {
    throw new SkillsApiError(
      "Failed to fetch skills list",
      response.status,
      await response.json().catch(() => undefined),
    );
  }

  return response.json();
}

/**
 * 获取技能详情
 * @param skillId 技能 ID
 * @param params 查询参数
 * @returns 技能详情响应
 */
export async function getSkill(
  skillId: string,
  params?: { scope?: string; projectId?: string },
): Promise<SkillDetailResponse> {
  const response = await fetch(getSkillDetailUrl(skillId, params));

  if (!response.ok) {
    throw new SkillsApiError(
      "Failed to fetch skill details",
      response.status,
      await response.json().catch(() => undefined),
    );
  }

  return response.json();
}

/**
 * 安装技能
 * @param request 安装请求
 * @returns 安装的技能
 */
export async function installSkill(
  request: InstallSkillRequest,
): Promise<Skill> {
  const response = await fetch(getInstallSkillUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Installation failed" }));
    throw new SkillsApiError(
      error.message || "Failed to install skill",
      response.status,
      error,
    );
  }

  return response.json();
}

/**
 * 删除技能
 * @param request 删除请求
 * @returns 删除结果
 */
export async function deleteSkill(
  request: DeleteSkillRequest,
): Promise<{ success: boolean }> {
  const response = await fetch(getDeleteSkillUrl(), {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new SkillsApiError(
      "Failed to delete skill",
      response.status,
      await response.json().catch(() => undefined),
    );
  }

  return response.json();
}

/**
 * 切换技能启用/禁用状态
 * @param request 切换请求
 * @returns 更新后的技能
 */
export async function toggleSkill(request: ToggleSkillRequest): Promise<Skill> {
  const response = await fetch(getToggleSkillUrl(), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new SkillsApiError(
      "Failed to toggle skill",
      response.status,
      await response.json().catch(() => undefined),
    );
  }

  return response.json();
}

/**
 * 扫描技能目录
 * @returns 扫描结果
 */
export async function scanSkills(): Promise<ScanSkillsResponse> {
  const response = await fetch(getScanSkillsUrl(), {
    method: "POST",
  });

  if (!response.ok) {
    throw new SkillsApiError(
      "Failed to scan skills",
      response.status,
      await response.json().catch(() => undefined),
    );
  }

  return response.json();
}

/**
 * Skills API 服务对象
 * 导出统一的服务接口
 */
export const skillsApi = {
  getSkills,
  getSkill,
  installSkill,
  deleteSkill,
  toggleSkill,
  scanSkills,
} as const;
