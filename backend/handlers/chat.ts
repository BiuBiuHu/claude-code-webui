import { Context } from "hono";
import { query, type PermissionMode } from "@anthropic-ai/claude-code";
import type { ChatRequest, StreamResponse } from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";
import { expandHomeDir } from "../utils/os.ts";
import process from "node:process";
import { join } from "node:path";
import { exists } from "../utils/fs.ts";
import { tmpdir } from "node:os";

// Upload directory - same as in files.ts
const UPLOAD_DIR = join(tmpdir(), "claude-webui-uploads");

// Pattern to detect uploaded file paths in messages
// Dynamically matches the temp directory path (works on both Linux /tmp and macOS /var/folders/.../T)
const UPLOAD_FILE_PATTERN = new RegExp(
  `${UPLOAD_DIR.replace(/\\/g, "/")}[^\\s\\n\\]"']*`,
  "g",
);

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
): AsyncGenerator<StreamResponse> {
  let abortController: AbortController;

  try {
    // Process commands that start with '/'
    let processedMessage = message;
    if (message.startsWith("/")) {
      // Remove the '/' and send just the command
      processedMessage = message.substring(1);
    }

    // Create and store AbortController for this request
    abortController = new AbortController();
    requestAbortControllers.set(requestId, abortController);

    for await (const sdkMessage of query({
      prompt: processedMessage,
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
