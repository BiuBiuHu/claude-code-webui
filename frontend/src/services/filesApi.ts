/**
 * Files API Service
 *
 * Handles file uploads and management for PDF processing and other document types.
 */

import { getApiUrl } from "../config/api";

/**
 * Uploaded file information
 */
export interface UploadedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
}

/**
 * File upload response
 */
export interface FileUploadResponse {
  success: boolean;
  file?: UploadedFile;
  error?: string;
}

/**
 * File list response
 */
export interface FileListResponse {
  files: Array<
    UploadedFile & {
      uploadedAt: number;
    }
  >;
}

/**
 * Files API error
 */
export class FilesApiError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "FilesApiError";
    this.statusCode = statusCode;
  }
}

/**
 * Upload a file using FormData (multipart)
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append("file", file);

  const xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response: FileUploadResponse = JSON.parse(xhr.responseText);
          if (response.success && response.file) {
            resolve(response.file);
          } else {
            reject(
              new FilesApiError(response.error || "Upload failed", xhr.status),
            );
          }
        } catch (error) {
          reject(new FilesApiError("Invalid response", xhr.status));
        }
      } else {
        reject(
          new FilesApiError(`Upload failed: ${xhr.statusText}`, xhr.status),
        );
      }
    });

    xhr.addEventListener("error", () => {
      reject(new FilesApiError("Network error"));
    });

    xhr.addEventListener("abort", () => {
      reject(new FilesApiError("Upload cancelled"));
    });

    xhr.open("POST", getApiUrl("/api/files/upload"));
    xhr.send(formData);
  });
}

/**
 * Upload a file using base64 encoding (alternative method)
 */
export async function uploadFileBase64(
  name: string,
  base64Data: string,
  mimeType?: string,
): Promise<UploadedFile> {
  const response = await fetch(getApiUrl("/api/files/upload"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      data: base64Data,
      mimeType,
    }),
  });

  if (!response.ok) {
    throw new FilesApiError(
      `Upload failed: ${response.statusText}`,
      response.status,
    );
  }

  const result: FileUploadResponse = await response.json();

  if (!result.success || !result.file) {
    throw new FilesApiError(result.error || "Upload failed");
  }

  return result.file;
}

/**
 * List all uploaded files
 */
export async function listFiles(): Promise<FileListResponse> {
  const response = await fetch(getApiUrl("/api/files"));

  if (!response.ok) {
    throw new FilesApiError(
      `Failed to list files: ${response.statusText}`,
      response.status,
    );
  }

  return response.json();
}

/**
 * Get file metadata by ID
 */
export async function getFile(fileId: string): Promise<
  UploadedFile & {
    uploadedAt: number;
  }
> {
  const response = await fetch(getApiUrl(`/api/files/${fileId}`));

  if (!response.ok) {
    throw new FilesApiError(
      `Failed to get file: ${response.statusText}`,
      response.status,
    );
  }

  return response.json();
}

/**
 * Download a file by ID
 */
export async function downloadFile(fileId: string): Promise<void> {
  const response = await fetch(getApiUrl(`/api/files/${fileId}/download`));

  if (!response.ok) {
    throw new FilesApiError(
      `Failed to download file: ${response.statusText}`,
      response.status,
    );
  }

  // Get filename from Content-Disposition header
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = `download-${fileId}`;
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }

  // Create blob and download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Get download URL for a file (for direct links)
 */
export function getDownloadUrl(fileId: string): string {
  return getApiUrl(`/api/files/${fileId}/download`);
}

/**
 * Register a file created externally (e.g., by a skill)
 */
export async function registerFile(
  path: string,
  name?: string,
  mimeType?: string,
): Promise<UploadedFile> {
  const response = await fetch(getApiUrl("/api/files/register"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path, name, mimeType }),
  });

  if (!response.ok) {
    throw new FilesApiError(
      `Failed to register file: ${response.statusText}`,
      response.status,
    );
  }

  const result: FileUploadResponse = await response.json();

  if (!result.success || !result.file) {
    throw new FilesApiError(result.error || "Failed to register file");
  }

  return result.file;
}

/**
 * Delete a file
 */
export async function deleteFile(fileId: string): Promise<void> {
  const response = await fetch(getApiUrl(`/api/files/${fileId}`), {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new FilesApiError(
      `Failed to delete file: ${response.statusText}`,
      response.status,
    );
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Check if file is a PDF
 */
export function isPdfFile(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
}

/**
 * Check if file is an image (for OCR)
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

/**
 * Check if file is supported
 */
export function isSupportedFile(file: File): boolean {
  const supportedTypes = [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "image/tiff",
  ];

  return (
    supportedTypes.includes(file.type) ||
    /\.(pdf|txt|md|doc|docx|png|jpg|jpeg|tiff|tif)$/i.test(file.name)
  );
}
