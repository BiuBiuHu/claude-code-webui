/**
 * Skills 加载器
 *
 * 负责解析和加载 Skills，从 SKILL.md 文件中提取元数据和内容
 */

import { join } from "node:path";
import { readTextFile, exists, readDir } from "../utils/fs.ts";
import { logger } from "../utils/logger.ts";
import type {
  ParsedSkillFile,
  SkillDirectoryStructure,
  SkillLocation,
  SkillsStoreConfig,
} from "./types.ts";
import type {
  Skill,
  SkillMetadata,
  SkillScope,
} from "../../shared/types/skills.ts";

/**
 * YAML 前置数据正则表达式
 * 匹配 SKILL.md 文件中的 YAML 前置数据块
 */
const YAML_FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;

/**
 * 解析 SKILL.md 文件
 *
 * @param filePath - SKILL.md 文件路径
 * @returns 解析后的内容，包含元数据和正文
 */
export async function parseSkillFile(
  filePath: string,
): Promise<ParsedSkillFile | null> {
  try {
    const content = await readTextFile(filePath);
    const match = content.match(YAML_FRONTMATTER_REGEX);

    if (!match) {
      logger.skills.warning("No YAML frontmatter found in {filePath}", {
        filePath,
      });
      // 没有 YAML 前置数据时，使用默认值
      return {
        metadata: {},
        content,
        name: "",
        description: "",
      };
    }

    const yamlContent = match[1];
    const markdownContent = match[2];

    // 解析 YAML 前置数据
    const parsed = parseYamlFrontmatter(yamlContent);

    return {
      metadata: parsed.metadata,
      content: markdownContent.trim(),
      name: parsed.name || "",
      description: parsed.description || "",
    };
  } catch (error) {
    logger.skills.error("Error parsing skill file: {filePath}", {
      filePath,
      error,
    });
    return null;
  }
}

/**
 * YAML 前置数据解析结果
 */
interface YamlParseResult {
  metadata: SkillMetadata;
  name: string;
  description: string;
}

/**
 * 解析 YAML 前置数据
 * 简单的 YAML 解析器，支持 Skills 规范中的字段
 *
 * @param yamlContent - YAML 内容字符串
 * @returns 解析后的元数据对象
 */
function parseYamlFrontmatter(yamlContent: string): YamlParseResult {
  const metadata: SkillMetadata = {};
  let name = "";
  let description = "";

  for (const line of yamlContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, colonIndex).trim();
    let value = trimmed.slice(colonIndex + 1).trim();

    // 去除引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // 处理常见字段
    switch (key) {
      case "name":
        name = value;
        break;
      case "description":
        description = value;
        break;
      case "license":
        metadata.license = value;
        break;
      case "compatibility":
        metadata.compatibility = value;
        break;
      case "author":
        metadata.author = value;
        break;
      case "version":
        metadata.version = value;
        break;
      case "allowed-tools":
        // 解析工具列表
        metadata.allowedTools = value
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        break;
      case "metadata":
        // metadata 嵌套对象需要更复杂的解析
        // 这里简化处理，实际应用可能需要完整的 YAML 解析器
        break;
    }
  }

  return { metadata, name, description };
}

/**
 * 获取技能目录结构
 * 检查是否存在 scripts、references、assets 等目录
 *
 * @param skillPath - 技能目录路径
 * @returns 目录结构信息
 */
export async function getSkillDirectoryStructure(
  skillPath: string,
): Promise<SkillDirectoryStructure> {
  const structure: SkillDirectoryStructure = {
    hasSkillMd: false,
    hasScriptsDir: false,
    hasReferencesDir: false,
    hasAssetsDir: false,
    scriptFiles: [],
  };

  try {
    const skillMdPath = join(skillPath, "SKILL.md");
    structure.hasSkillMd = await exists(skillMdPath);

    const scriptsDir = join(skillPath, "scripts");
    if (await exists(scriptsDir)) {
      structure.hasScriptsDir = true;
      // 获取脚本文件列表
      structure.scriptFiles = [];
      try {
        for await (const entry of readDir(scriptsDir)) {
          if (entry.isFile) {
            structure.scriptFiles.push(entry.name);
          }
        }
      } catch {
        // 忽略读取错误
      }
    }

    structure.hasReferencesDir = await exists(join(skillPath, "references"));
    structure.hasAssetsDir = await exists(join(skillPath, "assets"));
  } catch (error) {
    logger.skills.error("Error getting skill directory structure: {path}", {
      path: skillPath,
      error,
    });
  }

  return structure;
}

/**
 * 加载单个技能
 *
 * @param skillId - 技能 ID（目录名）
 * @param location - 技能位置信息
 * @returns 加载的技能对象，失败时返回 null
 */
export async function loadSkill(
  skillId: string,
  location: SkillLocation,
): Promise<Skill | null> {
  try {
    const skillMdPath = join(location.fullPath, "SKILL.md");

    const parsed = await parseSkillFile(skillMdPath);
    if (!parsed) {
      logger.skills.warning("Failed to parse skill file: {skillMdPath}", {
        skillMdPath,
      });
      return null;
    }

    // 如果 YAML 中没有 name，使用目录名
    const name = parsed.name || skillId;

    // 如果 YAML 中没有 description，使用默认值
    const description = parsed.description || `Skill: ${name}`;

    // 获取目录结构
    await getSkillDirectoryStructure(location.fullPath);

    // 确定技能来源
    location.type === "builtin" ? "builtin" : "user";

    // 确定技能作用域
    const scope: SkillScope = location.type === "project" ? "project" : "app";

    // 构建 Skill 对象
    const skill: Skill = {
      id: skillId,
      name,
      description,
      scope,
      enabled: true, // 默认启用
      path: location.fullPath,
      metadata: parsed.metadata,
      dependencies: parsed.metadata.allowedTools,
      projectId: location.projectId,
      createdAt: Date.now(),
    };

    logger.skills.debug("Loaded skill: {skillId} from {locationType}", {
      skillId,
      locationType: location.type,
    });

    return skill;
  } catch (error) {
    logger.skills.error("Error loading skill: {skillId}", {
      skillId,
      error,
    });
    return null;
  }
}

/**
 * 批量加载技能
 *
 * @param skillPaths - 技能路径列表
 * @param locationType - 位置类型
 * @param projectId - 项目 ID（可选）
 * @returns 加载的技能列表
 */
export async function loadSkillsFromPaths(
  skillPaths: string[],
  locationType: SkillLocation["type"],
  projectId?: string,
): Promise<Skill[]> {
  const skills: Skill[] = [];

  for (const skillPath of skillPaths) {
    const skillId = skillPath.split("/").pop() || "";
    if (!skillId) {
      continue;
    }

    const location: SkillLocation = {
      type: locationType,
      basePath: skillPath.replace(`/${skillId}`, ""),
      fullPath: skillPath,
      projectId,
    };

    const skill = await loadSkill(skillId, location);
    if (skill) {
      skills.push(skill);
    }
  }

  return skills;
}

/**
 * 加载所有技能（应用级 + 项目级）
 *
 * @param config - Skills 存储配置
 * @param projectPaths - 项目路径列表
 * @returns 应用级技能和项目级技能
 */
export async function loadAllSkills(
  config: SkillsStoreConfig,
  projectPaths: string[] = [],
): Promise<{
  appSkills: Skill[];
  projectSkills: Skill[];
}> {
  const appSkills: Skill[] = [];
  const projectSkills: Skill[] = [];

  // 加载内置技能
  try {
    const builtinSkillsPath = await discoverSkillPaths(config.builtinSkillsDir);
    for (const skillPath of builtinSkillsPath) {
      const skillId = skillPath.split("/").pop() || "";
      const skill = await loadSkill(skillId, {
        type: "builtin",
        basePath: config.builtinSkillsDir,
        fullPath: skillPath,
      });
      if (skill) {
        appSkills.push(skill);
      }
    }
  } catch (error) {
    logger.skills.error("Error loading builtin skills", { error });
  }

  // 加载用户技能
  try {
    const userSkillsPath = await discoverSkillPaths(config.userSkillsDir);
    for (const skillPath of userSkillsPath) {
      const skillId = skillPath.split("/").pop() || "";
      const skill = await loadSkill(skillId, {
        type: "user",
        basePath: config.userSkillsDir,
        fullPath: skillPath,
      });
      if (skill) {
        appSkills.push(skill);
      }
    }
  } catch (error) {
    logger.skills.error("Error loading user skills", { error });
  }

  // 加载项目技能
  for (const projectPath of projectPaths) {
    const projectSkillsDir = join(
      projectPath,
      config.projectSkillsRelativePath,
    );

    try {
      const skillPaths = await discoverSkillPaths(projectSkillsDir);
      for (const skillPath of skillPaths) {
        const skillId = skillPath.split("/").pop() || "";
        const projectId = projectPath.split("/").pop() || projectPath;
        const skill = await loadSkill(skillId, {
          type: "project",
          basePath: projectSkillsDir,
          fullPath: skillPath,
          projectId,
        });
        if (skill) {
          projectSkills.push(skill);
        }
      }
    } catch (error) {
      logger.skills.error("Error loading project skills for {projectPath}", {
        projectPath,
        error,
      });
    }
  }

  logger.skills.info(
    "Loaded {appCount} app skills, {projectCount} project skills",
    {
      appCount: appSkills.length,
      projectCount: projectSkills.length,
    },
  );

  return {
    appSkills,
    projectSkills,
  };
}

/**
 * 发现指定目录下的所有技能路径
 *
 * @param dirPath - 要扫描的目录
 * @returns 技能路径列表
 */
async function discoverSkillPaths(dirPath: string): Promise<string[]> {
  const paths: string[] = [];

  try {
    const dirExists = await exists(dirPath);
    if (!dirExists) {
      return paths;
    }

    for await (const entry of readDir(dirPath)) {
      if (!entry.isDirectory) {
        continue;
      }

      const skillPath = join(dirPath, entry.name);
      const skillMdPath = join(skillPath, "SKILL.md");

      if (await exists(skillMdPath)) {
        paths.push(skillPath);
      }
    }
  } catch (error) {
    logger.skills.error("Error discovering skill paths in {dirPath}", {
      dirPath,
      error,
    });
  }

  return paths;
}

/**
 * 重新加载技能
 * 用于技能更新后刷新
 *
 * @param skill - 要重新加载的技能
 * @returns 重新加载的技能，失败时返回 null
 */
export async function reloadSkill(skill: Skill): Promise<Skill | null> {
  const location: SkillLocation = {
    type:
      skill.scope === "project"
        ? "project"
        : skill.projectId
          ? "user"
          : "builtin",
    basePath: skill.path.replace(`/${skill.id}`, ""),
    fullPath: skill.path,
    projectId: skill.projectId,
  };

  return await loadSkill(skill.id, location);
}
