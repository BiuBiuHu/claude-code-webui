import { Context } from "hono";
import { query, type PermissionMode } from "@anthropic-ai/claude-code";
import type { ChatRequest, StreamResponse } from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";
import { expandHomeDir } from "../utils/os.ts";
import process from "node:process";
import { join } from "node:path";
import { exists, readTextFile } from "../utils/fs.ts";
import { tmpdir } from "node:os";
import { getSkillsStore } from "../skills/store.ts";
import type { Skill } from "../../shared/types/skills.ts";

// Upload directory - same as in files.ts
const UPLOAD_DIR = join(tmpdir(), "claude-webui-uploads");

// Pattern to detect uploaded file paths in messages
// Dynamically matches the temp directory path (works on both Linux /tmp and macOS /var/folders/.../T)
const UPLOAD_FILE_PATTERN = new RegExp(
  `${UPLOAD_DIR.replace(/\\/g, "/")}[^\\s\\n\\]"']*`,
  "g",
);

/**
 * Collect content from all enabled skills
 * Returns formatted skill instructions for the system prompt
 */
async function collectEnabledSkillsContent(
  projectId?: string,
): Promise<string> {
  try {
    const store = getSkillsStore();

    // Ensure store is initialized
    if (!store.isInitialized()) {
      await store.initialize();
    }

    const appSkills = store.getAppSkills();
    const projectSkills = projectId ? store.getProjectSkills(projectId) : [];

    // Combine app and project skills, filter only enabled ones
    const allSkills = [...appSkills, ...projectSkills].filter(
      (skill) => skill.enabled,
    );

    if (allSkills.length === 0) {
      return "";
    }

    // Read SKILL.md content for each enabled skill
    const skillContents: string[] = [];

    for (const skill of allSkills) {
      try {
        const skillMdPath = join(skill.path, "SKILL.md");
        if (await exists(skillMdPath)) {
          const content = await readTextFile(skillMdPath);
          // Extract the content after the YAML frontmatter
          const contentStart = content.indexOf("---");
          if (contentStart !== -1) {
            const secondSeparator = content.indexOf("---", contentStart + 3);
            if (secondSeparator !== -1) {
              skillContents.push(
                `# Skill: ${skill.name}\n\n${content.substring(secondSeparator + 3).trim()}`,
              );
            } else {
              skillContents.push(`# Skill: ${skill.name}\n\n${content.trim()}`);
            }
          } else {
            skillContents.push(`# Skill: ${skill.name}\n\n${content.trim()}`);
          }
        }
      } catch (error) {
        logger.chat.warn("Failed to read skill content: {skillId}", {
          skillId: skill.id,
          error,
        });
      }
    }

    if (skillContents.length === 0) {
      return "";
    }

    // Combine all skill contents into a single block
    return `
# Available Skills

You have access to the following skills. Follow their instructions when relevant:

${skillContents.join("\n\n---\n\n")}
`;
  } catch (error) {
    logger.chat.error("Failed to collect enabled skills content: {error}", {
      error,
    });
    return "";
  }
}

/**
 * Copy uploaded files to working directory and update message with new paths
 * This ensures Claude can access the files from its working directory
 */
async function copyUploadedFilesToWorkingDir(
  message: string,
  workingDir: string | undefined,
): Promise<{ message: string; copiedFiles: string[] }> {
  if (!workingDir) {
    logger.chat.debug("No working directory, skipping file copy");
    return { message, copiedFiles: [] };
  }

  const uploadedFiles = message.match(UPLOAD_FILE_PATTERN);
  logger.chat.info("Looking for upload file paths in message, found: {count}", {
    count: uploadedFiles?.length || 0,
    files: uploadedFiles || [],
  });

  if (!uploadedFiles) {
    return { message, copiedFiles: [] };
  }

  const copiedFiles: string[] = [];
  let updatedMessage = message;

  const { copyFile, mkdir } = await import("node:fs/promises");

  for (const uploadedPath of uploadedFiles) {
    try {
      // Check if uploaded file exists
      if (!(await exists(uploadedPath))) {
        logger.chat.warn("Uploaded file does not exist: {path}", {
          path: uploadedPath,
        });
        continue;
      }

      // Extract filename from path
      const fileName = uploadedPath.substring(
        uploadedPath.lastIndexOf("/") + 1,
      );
      const targetPath = join(workingDir, fileName);

      // Copy file to working directory
      await copyFile(uploadedPath, targetPath);
      copiedFiles.push(targetPath);

      // Replace the path in the message
      updatedMessage = updatedMessage.replace(uploadedPath, `./${fileName}`);

      logger.chat.info("Copied uploaded file from {src} to {dest}", {
        src: uploadedPath,
        dest: targetPath,
      });
    } catch (error) {
      logger.chat.error("Failed to copy uploaded file: {error}", { error });
    }
  }

  return { message: updatedMessage, copiedFiles };
}

/**
 * Executes a Claude command and yields streaming responses
 * @param message - User message or command
 * @param requestId - Unique request identifier for abort functionality
 * @param requestAbortControllers - Shared map of abort controllers
 * @param cliPath - Path to actual CLI script (detected by validateClaudeCli)
 * @param sessionId - Optional session ID for conversation continuity
 * @param allowedTools - Optional array of allowed tool names
 * @param workingDirectory - Optional working directory for Claude execution
 * @param permissionMode - Optional permission mode for Claude execution
 * @param additionalDirectories - Optional additional directories for file access
 * @param skillsContent - Optional skills content to inject as system prompt
 * @returns AsyncGenerator yielding StreamResponse objects
 */
async function* executeClaudeCommand(
  message: string,
  requestId: string,
  requestAbortControllers: Map<string, AbortController>,
  cliPath: string,
  sessionId?: string,
  allowedTools?: string[],
  workingDirectory?: string,
  permissionMode?: PermissionMode,
  additionalDirectories?: string[],
  skillsContent?: string,
): AsyncGenerator<StreamResponse> {
  let abortController: AbortController;

  try {
    // Process commands that start with '/'
    let processedMessage = message;
    if (message.startsWith("/")) {
      // Remove the '/' and send just the command
      processedMessage = message.substring(1);
    }

    // Inject skills content as system prompt if provided
    const finalPrompt = skillsContent
      ? `${skillsContent}\n\n---\n\nUser message:\n${processedMessage}`
      : processedMessage;

    // Create and store AbortController for this request
    abortController = new AbortController();
    requestAbortControllers.set(requestId, abortController);

    for await (const sdkMessage of query({
      prompt: finalPrompt,
      options: {
        abortController,
        executable: process.execPath as "bun" | "deno" | "node",
        executableArgs: [],
        pathToClaudeCodeExecutable: cliPath,
        ...(sessionId ? { resume: sessionId } : {}),
        ...(allowedTools ? { allowedTools } : {}),
        ...(workingDirectory ? { cwd: workingDirectory } : {}),
        ...(permissionMode ? { permissionMode } : {}),
        ...(additionalDirectories && additionalDirectories.length > 0
          ? { additionalDirectories }
          : {}),
      },
    })) {
      // Debug logging of raw SDK messages with detailed content
      logger.chat.debug("Claude SDK Message: {sdkMessage}", { sdkMessage });

      yield {
        type: "claude_json",
        data: sdkMessage,
      };
    }

    yield { type: "done" };
  } catch (error) {
    // Check if error is due to abort
    // TODO: Re-enable when AbortError is properly exported from Claude SDK
    // if (error instanceof AbortError) {
    //   yield { type: "aborted" };
    // } else {
    {
      logger.chat.error("Claude Code execution failed: {error}", { error });
      yield {
        type: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } finally {
    // Clean up AbortController from map
    if (requestAbortControllers.has(requestId)) {
      requestAbortControllers.delete(requestId);
    }
  }
}

/**
 * Handles POST /api/chat requests with streaming responses
 * @param c - Hono context object with config variables
 * @param requestAbortControllers - Shared map of abort controllers
 * @returns Response with streaming NDJSON
 */
export async function handleChatRequest(
  c: Context,
  requestAbortControllers: Map<string, AbortController>,
) {
  const chatRequest: ChatRequest = await c.req.json();
  const { cliPath } = c.var.config;

  logger.chat.debug(
    "Received chat request {*}",
    chatRequest as unknown as Record<string, unknown>,
  );
  logger.chat.info("Received message: {message}", {
    message: chatRequest.message.substring(0, 200),
  });

  // Expand ~ in working directory path
  const expandedWorkingDir = chatRequest.workingDirectory
    ? expandHomeDir(chatRequest.workingDirectory)
    : undefined;

  logger.chat.info("Working directory: {dir}", {
    dir: expandedWorkingDir || "none",
  });

  // Copy uploaded files to working directory and update message paths
  const { message: processedMessage, copiedFiles } =
    await copyUploadedFilesToWorkingDir(
      chatRequest.message,
      expandedWorkingDir,
    );

  logger.chat.info("Processed message: {message}, copied files: {files}", {
    message: processedMessage.substring(0, 200),
    files: copiedFiles.length,
  });

  if (copiedFiles.length > 0) {
    logger.chat.info("Copied {count} uploaded file(s) to working directory", {
      count: copiedFiles.length,
      files: copiedFiles,
    });
  }

  // Merge additionalDirectories with UPLOAD_DIR
  // This ensures Claude can access uploaded files even if not copied to working dir
  const mergedAdditionalDirs = [
    ...(chatRequest.additionalDirectories || []),
    UPLOAD_DIR,
  ].filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

  // Collect enabled skills content to inject as system prompt
  // For now, we only use app-level skills. Project-level skills could be added later.
  const skillsContent = await collectEnabledSkillsContent(undefined);

  if (skillsContent) {
    logger.chat.info("Injected {count} skills into context", {
      count: skillsContent.length,
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of executeClaudeCommand(
          processedMessage,
          chatRequest.requestId,
          requestAbortControllers,
          cliPath, // Use detected CLI path from validateClaudeCli
          chatRequest.sessionId,
          chatRequest.allowedTools,
          expandedWorkingDir,
          chatRequest.permissionMode,
          mergedAdditionalDirs,
          skillsContent, // Inject skills content
        )) {
          const data = JSON.stringify(chunk) + "\n";
          controller.enqueue(new TextEncoder().encode(data));
        }
        controller.close();
      } catch (error) {
        const errorResponse: StreamResponse = {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
        controller.enqueue(
          new TextEncoder().encode(JSON.stringify(errorResponse) + "\n"),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
