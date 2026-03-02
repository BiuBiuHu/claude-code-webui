/**
 * Skills 格式验证器
 *
 * 验证技能目录结构和 SKILL.md 文件格式是否符合规范
 */

import { join } from "node:path";
import { readTextFile, exists } from "../utils/fs.ts";
import { logger } from "../utils/logger.ts";
import type { ParsedSkillFile, SkillDirectoryStructure } from "./types.ts";
import type { SkillMetadata } from "../../shared/types/skills.ts";

/**
 * 验证错误类型
 */
export type ValidationErrorSeverity = "error" | "warning";

/**
 * 验证错误
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: ValidationErrorSeverity;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * 技能目录结构验证结果
 */
export interface StructureValidationResult extends ValidationResult {
  structure: SkillDirectoryStructure;
}

/**
 * SKILL.md 规范要求
 */
const SKILL_SPEC_REQUIREMENTS = {
  // 必需字段
  requiredFields: ["name", "description"],
  // 字符串字段最大长度
  maxLengths: {
    name: 64,
    description: 1024,
  },
  // 可选字段
  optionalFields: [
    "license",
    "compatibility",
    "author",
    "version",
    "allowed-tools",
  ],
  // 许可证建议值
  suggestedLicenses: [
    "MIT",
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "ISC",
    "GPL-3.0",
  ],
} as const;

/**
 * 验证技能目录结构
 *
 * @param skillPath - 技能目录路径
 * @returns 验证结果
 */
export async function validateSkillStructure(
  skillPath: string,
): Promise<StructureValidationResult> {
  const errors: ValidationError[] = [];
  const structure: SkillDirectoryStructure = {
    hasSkillMd: false,
    hasScriptsDir: false,
    hasReferencesDir: false,
    hasAssetsDir: false,
  };

  try {
    // 检查目录是否存在
    const dirExists = await exists(skillPath);
    if (!dirExists) {
      errors.push({
        field: "path",
        message: "Skill directory does not exist",
        severity: "error",
      });
      return { valid: false, errors, structure };
    }

    // 检查 SKILL.md 文件
    const skillMdPath = join(skillPath, "SKILL.md");
    structure.hasSkillMd = await exists(skillMdPath);

    if (!structure.hasSkillMd) {
      errors.push({
        field: "SKILL.md",
        message: "Required SKILL.md file is missing",
        severity: "error",
      });
    }

    // 检查 scripts 目录（可选）
    const scriptsDir = join(skillPath, "scripts");
    structure.hasScriptsDir = await exists(scriptsDir);

    // 检查 references 目录（可选）
    const referencesDir = join(skillPath, "references");
    structure.hasReferencesDir = await exists(referencesDir);

    // 检查 assets 目录（可选）
    const assetsDir = join(skillPath, "assets");
    structure.hasAssetsDir = await exists(assetsDir);

    // 验证 SKILL.md 是否可读
    if (structure.hasSkillMd) {
      try {
        await readTextFile(skillMdPath);
      } catch {
        errors.push({
          field: "SKILL.md",
          message: "SKILL.md file exists but is not readable",
          severity: "error",
        });
      }
    }
  } catch (error) {
    logger.skills.error("Error validating skill structure: {path}", {
      path: skillPath,
      error,
    });
    errors.push({
      field: "path",
      message: `Failed to validate directory structure: ${error}`,
      severity: "error",
    });
  }

  const hasErrors = errors.some((e) => e.severity === "error");

  return {
    valid: !hasErrors,
    errors,
    structure,
  };
}

/**
 * 验证技能元数据
 *
 * @param metadata - 技能元数据
 * @param name - 技能名称（从 YAML 解析）
 * @param description - 技能描述（从 YAML 解析）
 * @returns 验证结果
 */
export function validateSkillMetadata(
  metadata: SkillMetadata,
  name: string,
  description: string,
): ValidationResult {
  const errors: ValidationError[] = [];

  // 验证必需字段
  if (!name || name.trim() === "") {
    errors.push({
      field: "name",
      message: "Name is required",
      severity: "error",
    });
  } else {
    // 验证 name 长度
    if (name.length > SKILL_SPEC_REQUIREMENTS.maxLengths.name) {
      errors.push({
        field: "name",
        message: `Name exceeds maximum length of ${SKILL_SPEC_REQUIREMENTS.maxLengths.name} characters`,
        severity: "error",
      });
    }

    // 验证 name 格式（只能包含小写字母、数字、连字符）
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) {
      errors.push({
        field: "name",
        message:
          "Name must contain only lowercase letters, numbers, and hyphens",
        severity: "error",
      });
    }
  }

  if (!description || description.trim() === "") {
    errors.push({
      field: "description",
      message: "Description is required",
      severity: "error",
    });
  } else if (
    description.length > SKILL_SPEC_REQUIREMENTS.maxLengths.description
  ) {
    errors.push({
      field: "description",
      message: `Description exceeds maximum length of ${SKILL_SPEC_REQUIREMENTS.maxLengths.description} characters`,
      severity: "error",
    });
  }

  // 验证可选字段
  if (metadata.version) {
    // 简单的版本号格式验证
    if (!/^\d+\.\d+(\.\d+)?([+-].*)?$/.test(metadata.version)) {
      errors.push({
        field: "version",
        message: "Version should follow semantic versioning (e.g., 1.0.0)",
        severity: "warning",
      });
    }
  }

  if (metadata.license) {
    // 检查是否为推荐的许可证
    const normalizedLicense = metadata.license.trim();
    const isSuggested = SKILL_SPEC_REQUIREMENTS.suggestedLicenses.some((lic) =>
      normalizedLicense.toLowerCase().includes(lic.toLowerCase()),
    );

    if (!isSuggested) {
      errors.push({
        field: "license",
        message: `License is not one of the suggested values: ${SKILL_SPEC_REQUIREMENTS.suggestedLicenses.join(", ")}`,
        severity: "warning",
      });
    }
  }

  if (metadata.allowedTools) {
    if (!Array.isArray(metadata.allowedTools)) {
      errors.push({
        field: "allowed-tools",
        message: "allowed-tools must be an array",
        severity: "error",
      });
    } else {
      // 验证每个工具名称格式
      for (const tool of metadata.allowedTools) {
        if (typeof tool !== "string" || tool.trim() === "") {
          errors.push({
            field: "allowed-tools",
            message: `Invalid tool name in allowed-tools: ${tool}`,
            severity: "error",
          });
        }
      }
    }
  }

  const hasErrors = errors.some((e) => e.severity === "error");

  return {
    valid: !hasErrors,
    errors,
  };
}

/**
 * 验证完整的技能文件
 *
 * @param parsed - 解析后的技能文件
 * @returns 验证结果
 */
export function validateSkillFile(parsed: ParsedSkillFile): ValidationResult {
  const errors: ValidationError[] = [];

  // 验证元数据
  const metadataResult = validateSkillMetadata(
    parsed.metadata,
    parsed.name,
    parsed.description,
  );
  errors.push(...metadataResult.errors);

  // 验证内容不为空
  if (!parsed.content || parsed.content.trim() === "") {
    errors.push({
      field: "content",
      message: "Skill content is empty",
      severity: "warning",
    });
  }

  // 检查内容长度（过长的内容可能影响性能）
  if (parsed.content.length > 50000) {
    errors.push({
      field: "content",
      message: "Skill content is very long and may affect performance",
      severity: "warning",
    });
  }

  const hasErrors = errors.some((e) => e.severity === "error");

  return {
    valid: !hasErrors,
    errors,
  };
}

/**
 * 验证技能 ID 格式
 *
 * @param skillId - 技能 ID
 * @returns 是否有效
 */
export function isValidSkillId(skillId: string): boolean {
  // 技能 ID 必须是非空字符串，只包含小写字母、数字、连字符
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(skillId);
}

/**
 * 验证技能作用域
 *
 * @param scope - 技能作用域
 * @returns 是否有效
 */
export function isValidSkillScope(scope: string): scope is "app" | "project" {
  return scope === "app" || scope === "project";
}

/**
 * 验证项目 ID
 *
 * @param projectId - 项目 ID
 * @returns 是否有效
 */
export function isValidProjectId(projectId: string | undefined): boolean {
  if (!projectId) {
    return true; // 可选字段
  }
  return projectId.length > 0 && projectId.trim() !== "";
}

/**
 * 获取验证错误的友好消息
 *
 * @param errors - 验证错误列表
 * @returns 格式化的错误消息
 */
export function formatValidationErrors(errors: ValidationError[]): string[] {
  return errors.map((error) => {
    const prefix = error.severity === "error" ? "[ERROR]" : "[WARNING]";
    return `${prefix} ${error.field}: ${error.message}`;
  });
}

/**
 * 创建技能验证器类
 * 提供便捷的验证方法
 */
export class SkillValidator {
  /**
   * 验证技能目录
   */
  static async validateDirectory(
    skillPath: string,
  ): Promise<StructureValidationResult> {
    return await validateSkillStructure(skillPath);
  }

  /**
   * 验证技能元数据
   */
  static validateMetadata(
    metadata: SkillMetadata,
    name: string,
    description: string,
  ): ValidationResult {
    return validateSkillMetadata(metadata, name, description);
  }

  /**
   * 验证技能文件
   */
  static validateFile(parsed: ParsedSkillFile): ValidationResult {
    return validateSkillFile(parsed);
  }

  /**
   * 验证技能 ID
   */
  static validateId(skillId: string): boolean {
    return isValidSkillId(skillId);
  }

  /**
   * 验证作用域
   */
  static validateScope(scope: string): boolean {
    return isValidSkillScope(scope);
  }
}
