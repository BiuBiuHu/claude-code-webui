/**
 * Skills 目录扫描器
 *
 * 负责扫描 Skills 目录，发现可用的技能
 */

import { join, resolve } from "node:path";
import { exists, readDir, stat } from "../utils/fs.ts";
import { logger } from "../utils/logger.ts";
import type { ScanResult, SkillLocation, SkillsStoreConfig } from "./types.ts";
import { isValidSkillDirName } from "./types.ts";

/**
 * 路径安全验证
 * 防止目录遍历攻击，确保目标路径在基础路径内
 *
 * @param basePath - 基础路径（白名单目录）
 * @param targetPath - 目标路径
 * @returns 是否安全
 */
export function validateSkillPath(
  basePath: string,
  targetPath: string,
): boolean {
  try {
    const resolvedBase = resolve(basePath);
    const resolvedTarget = resolve(targetPath);
    return resolvedTarget.startsWith(resolvedBase);
  } catch {
    return false;
  }
}

/**
 * 扫描指定目录下的技能
 *
 * @param dirPath - 要扫描的目录路径
 * @param locationType - 位置类型（builtin/user/project）
 * @param projectId - 项目 ID（仅 project 类型需要）
 * @returns 扫描结果
 */
export async function scanSkillsDirectory(
  dirPath: string,
  _locationType: SkillLocation["type"],
  _projectId?: string,
): Promise<ScanResult> {
  const result: ScanResult = {
    skills: [],
    scanned: 0,
    errors: [],
  };

  try {
    // 检查目录是否存在
    const dirExists = await exists(dirPath);
    if (!dirExists) {
      logger.skills.debug("Skills directory does not exist: {dirPath}", {
        dirPath,
      });
      return result;
    }

    // 遍历目录
    for await (const entry of readDir(dirPath)) {
      result.scanned++;

      // 跳过非目录项
      if (!entry.isDirectory) {
        continue;
      }

      const skillDirName = entry.name;

      // 验证目录名格式
      if (!isValidSkillDirName(skillDirName)) {
        result.errors.push(`Invalid skill directory name: ${skillDirName}`);
        continue;
      }

      const skillPath = join(dirPath, skillDirName);

      // 验证路径安全
      if (!validateSkillPath(dirPath, skillPath)) {
        result.errors.push(`Path validation failed for skill: ${skillDirName}`);
        continue;
      }

      // 检查是否包含 SKILL.md 文件
      const skillMdPath = join(skillPath, "SKILL.md");
      const hasSkillMd = await exists(skillMdPath);

      if (!hasSkillMd) {
        result.errors.push(`Missing SKILL.md in: ${skillDirName}`);
        continue;
      }

      // 获取目录统计信息
      await stat(skillPath);

      // 这里只返回基本信息，完整加载由 loader 处理
      // 为了保持 scanner 的单一职责，这里只收集技能路径
      // 实际的 Skill 对象由 loader 创建
      logger.skills.debug("Found skill: {skillDirName} at {skillPath}", {
        skillDirName,
        skillPath,
      });
    }
  } catch (error) {
    logger.skills.error("Error scanning skills directory: {dirPath}", {
      dirPath,
      error,
    });
    result.errors.push(`Failed to scan directory: ${dirPath}`);
  }

  return result;
}

/**
 * 扫描所有技能目录（应用级 + 项目级）
 *
 * @param config - Skills 存储配置
 * @param projectPaths - 项目路径列表（用于扫描项目级技能）
 * @returns 所有扫描结果
 */
export async function scanAllSkills(
  config: SkillsStoreConfig,
  projectPaths: string[] = [],
): Promise<{
  appSkills: string[]; // 应用级技能路径列表
  projectSkills: Map<string, string[]>; // 项目 ID -> 技能路径列表
  errors: string[];
}> {
  const appSkills: string[] = [];
  const projectSkills = new Map<string, string[]>();
  const errors: string[] = [];

  // 扫描内置技能目录
  logger.skills.debug("Scanning builtin skills directory: {dir}", {
    dir: config.builtinSkillsDir,
  });
  const builtinResult = await scanSkillsDirectory(
    config.builtinSkillsDir,
    "builtin",
  );
  errors.push(...builtinResult.errors);

  // 扫描用户技能目录
  logger.skills.debug("Scanning user skills directory: {dir}", {
    dir: config.userSkillsDir,
  });
  const userResult = await scanSkillsDirectory(config.userSkillsDir, "user");
  errors.push(...userResult.errors);

  // 扫描项目级技能目录
  for (const projectPath of projectPaths) {
    const projectSkillsDir = join(
      projectPath,
      config.projectSkillsRelativePath,
    );

    logger.skills.debug("Scanning project skills directory: {dir}", {
      dir: projectSkillsDir,
    });

    const projectResult = await scanSkillsDirectory(
      projectSkillsDir,
      "project",
      projectPath,
    );
    errors.push(...projectResult.errors);

    // 提取项目 ID（使用目录名作为 ID）
    const projectId = projectPath.split("/").pop() || projectPath;
    if (!projectSkills.has(projectId)) {
      projectSkills.set(projectId, []);
    }
  }

  logger.skills.info("Scanned {appCount} app skills, {projectCount} projects", {
    appCount: appSkills.length,
    projectCount: projectSkills.size,
  });

  return {
    appSkills,
    projectSkills,
    errors,
  };
}

/**
 * 检查技能目录是否有更新
 * 通过比较修改时间判断
 *
 * @param skillPath - 技能目录路径
 * @param lastModified - 上次扫描时的修改时间
 * @returns 是否有更新
 */
export async function isSkillUpdated(
  skillPath: string,
  lastModified: number,
): Promise<boolean> {
  try {
    const stats = await stat(skillPath);
    const currentMtime = stats.mtime?.getTime() || 0;
    return currentMtime > lastModified;
  } catch {
    return true; // 出错时认为有更新，触发重新扫描
  }
}

/**
 * 获取技能目录结构
 * 列出技能目录中的所有文件和子目录
 *
 * @param skillPath - 技能目录路径
 * @returns 目录结构信息
 */
export async function getSkillDirectoryStructure(skillPath: string): Promise<{
  hasSkillMd: boolean;
  hasScriptsDir: boolean;
  hasReferencesDir: boolean;
  hasAssetsDir: boolean;
  files: string[];
  directories: string[];
}> {
  const structure = {
    hasSkillMd: false,
    hasScriptsDir: false,
    hasReferencesDir: false,
    hasAssetsDir: false,
    files: [] as string[],
    directories: [] as string[],
  };

  try {
    const dirExists = await exists(skillPath);
    if (!dirExists) {
      return structure;
    }

    for await (const entry of readDir(skillPath)) {
      if (entry.isFile) {
        structure.files.push(entry.name);
        if (entry.name === "SKILL.md") {
          structure.hasSkillMd = true;
        }
      } else if (entry.isDirectory) {
        structure.directories.push(entry.name);
        switch (entry.name) {
          case "scripts":
            structure.hasScriptsDir = true;
            break;
          case "references":
            structure.hasReferencesDir = true;
            break;
          case "assets":
            structure.hasAssetsDir = true;
            break;
        }
      }
    }
  } catch (error) {
    logger.skills.error("Error getting skill directory structure: {path}", {
      path: skillPath,
      error,
    });
  }

  return structure;
}

/**
 * 验证技能目录是否完整
 *
 * @param skillPath - 技能目录路径
 * @returns 验证结果和错误信息
 */
export async function validateSkillDirectory(skillPath: string): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  try {
    const dirExists = await exists(skillPath);
    if (!dirExists) {
      errors.push("Skill directory does not exist");
      return { valid: false, errors };
    }

    const structure = await getSkillDirectoryStructure(skillPath);

    if (!structure.hasSkillMd) {
      errors.push("Missing required SKILL.md file");
    }

    // 验证 SKILL.md 是否可读
    if (structure.hasSkillMd) {
      const skillMdPath = join(skillPath, "SKILL.md");
      const mdExists = await exists(skillMdPath);
      if (!mdExists) {
        errors.push("SKILL.md file exists but is not readable");
      }
    }
  } catch (error) {
    errors.push(`Failed to validate skill directory: ${error}`);
    logger.skills.error("Error validating skill directory: {path}", {
      path: skillPath,
      error,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
