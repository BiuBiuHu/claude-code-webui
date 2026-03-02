/**
 * Skills API 处理器
 *
 * 处理所有 Skills 相关的 API 请求
 */

import type { Context } from "hono";
import type {
  SkillsListResponse,
  SkillDetailResponse,
  InstallSkillRequest,
  ToggleSkillRequest,
  ScanSkillsResponse,
} from "../../shared/types/skills.ts";
import { getSkillsStore } from "../skills/store.ts";
import { getSkillDirectoryStructure } from "../skills/loader.ts";
import { readTextFile } from "../utils/fs.ts";
import { join } from "node:path";
import { logger } from "../utils/logger.ts";
import { exists } from "../utils/fs.ts";

/**
 * 确保 SkillsStore 已初始化
 */
async function ensureStoreInitialized(): Promise<void> {
  const store = getSkillsStore();
  if (!store.isInitialized()) {
    await store.initialize();
  }
}

/**
 * GET /api/skills
 * 获取技能列表
 */
export async function handleGetSkills(c: Context): Promise<Response> {
  try {
    await ensureStoreInitialized();

    const store = getSkillsStore();
    const projectId = c.req.query("projectId");

    const appSkills = store.getAppSkills();
    const projectSkills = projectId
      ? store.getProjectSkills(projectId)
      : store.getAllProjectSkills();

    const response: SkillsListResponse = {
      appSkills,
      projectSkills,
    };

    logger.skills.debug(
      "Returned skills list: {appCount} app, {projectCount} project",
      {
        appCount: appSkills.length,
        projectCount: projectSkills.length,
      },
    );

    return c.json(response);
  } catch (error) {
    logger.skills.error("Error getting skills list", { error });
    return c.json({ error: "Failed to get skills list" }, 500);
  }
}

/**
 * GET /api/skills/:skillId
 * 获取技能详情
 */
export async function handleGetSkillDetail(c: Context): Promise<Response> {
  try {
    const skillId = c.req.param("skillId");
    const scope = (c.req.query("scope") as "app" | "project") || "app";
    const projectId = c.req.query("projectId");

    if (!skillId) {
      return c.json({ error: "Skill ID is required" }, 400);
    }

    await ensureStoreInitialized();

    const store = getSkillsStore();
    const skill = store.getSkill(skillId, scope, projectId);

    if (!skill) {
      return c.json({ error: "Skill not found" }, 404);
    }

    // 读取 SKILL.md 内容
    let content = "";
    try {
      const skillMdPath = join(skill.path, "SKILL.md");
      if (await exists(skillMdPath)) {
        content = await readTextFile(skillMdPath);
      }
    } catch {
      content = "Unable to read skill content";
    }

    // 获取目录结构
    const dirStructure = await getSkillDirectoryStructure(skill.path);

    const response: SkillDetailResponse = {
      skill,
      content,
      hasScripts: dirStructure.hasScriptsDir,
      scriptFiles: dirStructure.scriptFiles,
    };

    return c.json(response);
  } catch (error) {
    logger.skills.error("Error getting skill detail: {skillId}", {
      skillId: c.req.param("skillId"),
      error,
    });
    return c.json({ error: "Failed to get skill detail" }, 500);
  }
}

/**
 * POST /api/skills/install
 * 安装技能
 */
export async function handleInstallSkill(c: Context): Promise<Response> {
  try {
    const body = await c.req.json<InstallSkillRequest>();

    // 验证请求
    if (!body.source) {
      return c.json({ error: "Source is required" }, 400);
    }

    if (body.source === "github" && !body.url) {
      return c.json({ error: "URL is required for GitHub source" }, 400);
    }

    if (body.scope === "project" && !body.projectId) {
      return c.json(
        { error: "Project ID is required for project skills" },
        400,
      );
    }

    await ensureStoreInitialized();

    // 目前仅支持占位实现
    // 实际安装需要 Git 操作或文件解压
    logger.skills.info("Install skill request: {source}, {scope}", {
      source: body.source,
      scope: body.scope,
      url: body.url,
    });

    // TODO: 实现实际的安装逻辑
    // 1. 从 GitHub 克隆或下载 ZIP
    // 2. 验证技能格式
    // 3. 复制到目标目录
    // 4. 刷新技能缓存

    return c.json(
      {
        error: "Skill installation is not yet implemented",
        message: "Please manually place skills in the appropriate directory",
      },
      501,
    );
  } catch (error) {
    logger.skills.error("Error installing skill", { error });
    return c.json({ error: "Failed to install skill" }, 500);
  }
}

/**
 * DELETE /api/skills/:skillId
 * 删除技能
 */
export async function handleDeleteSkill(c: Context): Promise<Response> {
  try {
    const skillId = c.req.param("skillId");
    const scope = (c.req.query("scope") as "app" | "project") || "app";
    const projectId = c.req.query("projectId");

    if (!skillId) {
      return c.json({ error: "Skill ID is required" }, 400);
    }

    await ensureStoreInitialized();

    const store = getSkillsStore();
    const skill = store.getSkill(skillId, scope, projectId);

    if (!skill) {
      return c.json({ error: "Skill not found" }, 404);
    }

    // 内置技能不允许删除
    if (skill.path.includes("/builtin/")) {
      return c.json({ error: "Cannot delete builtin skills" }, 403);
    }

    // TODO: 实现实际的文件删除
    // 目前只从缓存中移除
    store.removeSkill(skillId, scope, projectId);

    logger.skills.info("Deleted skill: {skillId} with scope {scope}", {
      skillId,
      scope,
    });

    return c.json({ success: true });
  } catch (error) {
    logger.skills.error("Error deleting skill: {skillId}", {
      skillId: c.req.param("skillId"),
      error,
    });
    return c.json({ error: "Failed to delete skill" }, 500);
  }
}

/**
 * PUT /api/skills/:skillId/toggle
 * 启用/禁用技能
 */
export async function handleToggleSkill(c: Context): Promise<Response> {
  try {
    const skillId = c.req.param("skillId");
    const body = await c.req.json<ToggleSkillRequest>();

    if (!skillId) {
      return c.json({ error: "Skill ID is required" }, 400);
    }

    if (typeof body.enabled !== "boolean") {
      return c.json({ error: "Enabled field must be a boolean" }, 400);
    }

    await ensureStoreInitialized();

    const store = getSkillsStore();
    const scope = body.scope || "app";

    const success = store.toggleSkill(
      skillId,
      body.enabled,
      scope,
      body.projectId,
    );

    if (!success) {
      return c.json({ error: "Skill not found" }, 404);
    }

    logger.skills.info("Toggled skill {skillId}: {enabled}", {
      skillId,
      enabled: body.enabled,
    });

    // 返回更新后的技能
    const updatedSkill = store.getSkill(skillId, scope, body.projectId);
    return c.json({ success: true, skill: updatedSkill });
  } catch (error) {
    logger.skills.error("Error toggling skill: {skillId}", {
      skillId: c.req.param("skillId"),
      error,
    });
    return c.json({ error: "Failed to toggle skill" }, 500);
  }
}

/**
 * POST /api/skills/scan
 * 重新扫描技能目录
 */
export async function handleScanSkills(c: Context): Promise<Response> {
  try {
    await ensureStoreInitialized();

    const store = getSkillsStore();

    // TODO: 从请求中获取项目路径列表
    // 目前使用空列表
    await store.refresh();

    const appSkills = store.getAppSkills();
    const projectSkills = store.getAllProjectSkills();

    const response: ScanSkillsResponse = {
      skills: [...appSkills, ...projectSkills],
      scanned: appSkills.length + projectSkills.length,
      errors: [],
    };

    logger.skills.info("Scanned {total} skills", {
      total: response.scanned,
    });

    return c.json(response);
  } catch (error) {
    logger.skills.error("Error scanning skills", { error });
    return c.json({ error: "Failed to scan skills" }, 500);
  }
}

/**
 * GET /api/skills/global
 * 获取全局 MCP Skills 列表
 */
export async function handleGetGlobalSkills(c: Context): Promise<Response> {
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) {
      return c.json({ skills: [] });
    }

    const globalSkillsPath = join(homeDir, ".claude", "skills");

    // 检查全局 Skills 目录是否存在
    if (!(await exists(globalSkillsPath))) {
      return c.json({ skills: [] });
    }

    // TODO: 实现全局 Skills 扫描
    // 目前返回空列表
    return c.json({
      skills: [],
      path: globalSkillsPath,
    });
  } catch (error) {
    logger.skills.error("Error getting global skills", { error });
    return c.json({ error: "Failed to get global skills" }, 500);
  }
}
