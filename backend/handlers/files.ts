/**
 * File Upload Handlers
 *
 * Handles file uploads for PDF processing and other document types.
 */

import { Context } from "hono";
import { logger } from "../utils/logger.ts";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { exists, readTextFile } from "../utils/fs.ts";

// Upload directory for temporary files
const UPLOAD_DIR = join(tmpdir(), "claude-webui-uploads");

// Allowed file types and their MIME types
const ALLOWED_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt", ".md"],
  "text/markdown": [".md"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  // Images (for potential OCR use)
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/tiff": [".tiff", ".tif"],
};

// Maximum file size (50MB default)
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * File upload response
 */
interface UploadResponse {
  success: boolean;
  file?: {
    id: string;
    name: string;
    path: string;
    size: number;
    mimeType: string;
  };
  error?: string;
}

/**
 * List uploaded files response
 */
interface ListFilesResponse {
  files: Array<{
    id: string;
    name: string;
    path: string;
    size: number;
    mimeType: string;
    uploadedAt: number;
  }>;
}

/**
 * In-memory file registry (in production, use a database)
 * Maps file IDs to file metadata
 */
const fileRegistry = new Map<
  string,
  {
    name: string;
    path: string;
    size: number;
    mimeType: string;
    uploadedAt: number;
  }
>();

/**
 * Clean up old files (older than 1 hour)
 * Run this periodically
 */
export async function cleanupOldFiles(): Promise<number> {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour
  let cleaned = 0;

  const { unlink } = await import("node:fs/promises");

  for (const [id, file] of fileRegistry.entries()) {
    if (now - file.uploadedAt > maxAge) {
      try {
        await unlink(file.path).catch(() => {
          // Ignore errors if file doesn't exist
        });
        fileRegistry.delete(id);
        cleaned++;
      } catch (error) {
        logger.api.error("Error cleaning up file {fileId}: {error}", {
          fileId: id,
          error,
        });
      }
    }
  }

  if (cleaned > 0) {
    logger.api.info("Cleaned up {count} old files", { count: cleaned });
  }

  return cleaned;
}

// Run cleanup every 30 minutes
if (typeof setInterval !== "undefined") {
  setInterval(cleanupOldFiles, 30 * 60 * 1000);
}

/**
 * Validate file type
 */
function validateFileType(mimeType: string, fileName: string): boolean {
  // Check MIME type
  if (mimeType in ALLOWED_TYPES) {
    return true;
  }

  // Check file extension as fallback
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf("."));
  for (const extensions of Object.values(ALLOWED_TYPES)) {
    if (extensions.includes(ext)) {
      return true;
    }
  }

  return false;
}

/**
 * Generate safe filename
 */
function generateSafeFilename(originalName: string): string {
  const ext = originalName.substring(originalName.lastIndexOf("."));
  return `${randomUUID()}${ext}`;
}

/**
 * Ensure upload directory exists
 */
async function ensureUploadDir(): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  const { exists } = await import("../utils/fs.ts");

  if (!(await exists(UPLOAD_DIR))) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

/**
 * Handle POST /api/files/upload
 * Upload a file and return its path for use with Claude
 */
export async function handleFileUpload(c: Context): Promise<Response> {
  try {
    await ensureUploadDir();

    const contentType = c.req.header("content-type") || "";

    // Handle multipart form data
    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.formData();
      const file = formData.get("file") as File;

      if (!file) {
        const response: UploadResponse = {
          success: false,
          error: "No file provided",
        };
        return c.json(response, 400);
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        const response: UploadResponse = {
          success: false,
          error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        };
        return c.json(response, 400);
      }

      // Validate file type
      if (!validateFileType(file.type, file.name)) {
        const response: UploadResponse = {
          success: false,
          error: `File type not supported: ${file.type}`,
        };
        return c.json(response, 400);
      }

      // Generate safe filename
      const safeName = generateSafeFilename(file.name);
      const filePath = join(UPLOAD_DIR, safeName);

      // Save file
      const buffer = await file.arrayBuffer();
      const { writeFile } = await import("node:fs/promises");
      await writeFile(filePath, new Uint8Array(buffer));

      // Generate file ID
      const fileId = randomUUID();

      // Register file
      fileRegistry.set(fileId, {
        name: file.name,
        path: filePath,
        size: file.size,
        mimeType: file.type,
        uploadedAt: Date.now(),
      });

      logger.api.info("File uploaded: {fileName} -> {filePath}", {
        fileName: file.name,
        filePath,
      });

      const response: UploadResponse = {
        success: true,
        file: {
          id: fileId,
          name: file.name,
          path: filePath,
          size: file.size,
          mimeType: file.type,
        },
      };

      return c.json(response);
    }

    // Handle base64 encoded file (for simpler integration)
    const body = await c.req.json<{
      name: string;
      data: string; // base64
      mimeType?: string;
    }>();

    if (!body.name || !body.data) {
      const response: UploadResponse = {
        success: false,
        error: "Missing name or data field",
      };
      return c.json(response, 400);
    }

    const buffer = Buffer.from(body.data, "base64");

    // Validate file size
    if (buffer.length > MAX_FILE_SIZE) {
      const response: UploadResponse = {
        success: false,
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
      return c.json(response, 400);
    }

    // Validate file type
    const mimeType = body.mimeType || "application/octet-stream";
    if (!validateFileType(mimeType, body.name)) {
      const response: UploadResponse = {
        success: false,
        error: `File type not supported: ${mimeType}`,
      };
      return c.json(response, 400);
    }

    // Generate safe filename
    const safeName = generateSafeFilename(body.name);
    const filePath = join(UPLOAD_DIR, safeName);

    // Save file
    const { writeFile } = await import("node:fs/promises");
    await writeFile(filePath, buffer);

    // Generate file ID
    const fileId = randomUUID();

    // Register file
    fileRegistry.set(fileId, {
      name: body.name,
      path: filePath,
      size: buffer.length,
      mimeType,
      uploadedAt: Date.now(),
    });

    logger.api.info("File uploaded (base64): {fileName} -> {filePath}", {
      fileName: body.name,
      filePath,
    });

    const response: UploadResponse = {
      success: true,
      file: {
        id: fileId,
        name: body.name,
        path: filePath,
        size: buffer.length,
        mimeType,
      },
    };

    return c.json(response);
  } catch (error) {
    logger.api.error("Error uploading file: {error}", { error });

    const response: UploadResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return c.json(response, 500);
  }
}

/**
 * Handle GET /api/files
 * List all uploaded files
 */
export async function handleListFiles(c: Context): Promise<Response> {
  const files = Array.from(fileRegistry.entries()).map(([id, file]) => ({
    id,
    ...file,
  }));

  const response: ListFilesResponse = { files };

  return c.json(response);
}

/**
 * Handle GET /api/files/:fileId
 * Get file metadata by ID
 */
export async function handleGetFile(c: Context): Promise<Response> {
  const fileId = c.req.param("fileId");

  if (!fileId) {
    return c.json({ error: "File ID required" }, 400);
  }

  const file = fileRegistry.get(fileId);

  if (!file) {
    return c.json({ error: "File not found" }, 404);
  }

  return c.json({
    id: fileId,
    ...file,
  });
}

/**
 * Handle DELETE /api/files/:fileId
 * Delete a file
 */
export async function handleDeleteFile(c: Context): Promise<Response> {
  const fileId = c.req.param("fileId");

  if (!fileId) {
    return c.json({ error: "File ID required" }, 400);
  }

  const file = fileRegistry.get(fileId);

  if (!file) {
    return c.json({ error: "File not found" }, 404);
  }

  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(file.path).catch(() => {
      // Ignore errors if file doesn't exist
    });
  } catch (error) {
    logger.api.error("Error deleting file: {error}", { error });
  }

  fileRegistry.delete(fileId);

  logger.api.info("File deleted: {fileId}", { fileId });

  return c.json({ success: true });
}

/**
 * Handle POST /api/files/register
 * Register a file created externally (e.g., by a skill)
 */
export async function handleRegisterFile(c: Context): Promise<Response> {
  try {
    const body = await c.req.json<{
      path: string;
      name?: string;
      mimeType?: string;
    }>();

    const { path: filePath, name, mimeType } = body;

    if (!filePath) {
      const response: UploadResponse = {
        success: false,
        error: "File path is required",
      };
      return c.json(response, 400);
    }

    // Resolve relative paths to absolute paths
    // For relative paths like ./xxx.pdf, resolve them from current working directory
    let resolvedPath = filePath;
    if (filePath.startsWith("./") || filePath.startsWith("../")) {
      const { resolve } = await import("node:path");
      const { cwd } = await import("node:process");
      resolvedPath = resolve(cwd(), filePath);
      logger.api.debug("Resolved relative path {relative} to {absolute}", {
        relative: filePath,
        absolute: resolvedPath,
      });
    }

    // Validate the file exists
    const { exists } = await import("../utils/fs.ts");
    if (!(await exists(resolvedPath))) {
      const response: UploadResponse = {
        success: false,
        error: "File does not exist",
      };
      return c.json(response, 404);
    }

    // Get file stats
    const { stat } = await import("node:fs/promises");
    const stats = await stat(resolvedPath);

    // Generate file ID
    const fileId = randomUUID();

    // Extract name from path if not provided
    const fileName =
      name || resolvedPath.substring(resolvedPath.lastIndexOf("/") + 1);

    // Register file with absolute path
    fileRegistry.set(fileId, {
      name: fileName,
      path: resolvedPath,
      size: stats.size,
      mimeType: mimeType || "application/octet-stream",
      uploadedAt: Date.now(),
    });

    logger.api.info("File registered: {fileName} -> {filePath}", {
      fileName,
      filePath: resolvedPath,
    });

    const response: UploadResponse = {
      success: true,
      file: {
        id: fileId,
        name: fileName,
        path: resolvedPath,
        size: stats.size,
        mimeType: mimeType || "application/octet-stream",
      },
    };

    return c.json(response);
  } catch (error) {
    logger.api.error("Error registering file: {error}", { error });

    const response: UploadResponse = {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };

    return c.json(response, 500);
  }
}

/**
 * Handle GET /api/files/:fileId/download
 * Download a file by ID
 */
export async function handleDownloadFile(c: Context): Promise<Response> {
  const fileId = c.req.param("fileId");

  if (!fileId) {
    return c.json({ error: "File ID required" }, 400);
  }

  const file = fileRegistry.get(fileId);

  if (!file) {
    return c.json({ error: "File not found" }, 404);
  }

  try {
    const { readFile } = await import("node:fs/promises");
    const fileContent = await readFile(file.path);

    // Determine content type
    const contentType = file.mimeType || "application/octet-stream";

    // Return file as downloadable attachment
    // Convert Buffer to Uint8Array for Response compatibility
    const uint8Array = new Uint8Array(fileContent);
    return new Response(uint8Array, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${file.name}"`,
        "Content-Length": uint8Array.byteLength.toString(),
      },
    });
  } catch (error) {
    logger.api.error("Error downloading file: {error}", { error });
    return c.json({ error: "Failed to read file" }, 500);
  }
}
