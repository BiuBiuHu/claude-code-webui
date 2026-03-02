/**
 * FileDownloadButton Component
 *
 * Detects file paths in text and displays download buttons.
 * Supports files from the file registry and local file paths.
 */

import { useEffect, useState } from "react";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { getApiUrl } from "../../config/api";

interface DetectedFile {
  path: string;
  name: string;
}

interface FileDownloadButtonProps {
  content: string;
  workingDirectory?: string;
}

// Regular expressions to detect file paths and file creation messages
const FILE_PATTERNS = [
  // Created/saved file paths - matches "created xxx.pdf", "saved to ./xxx.pdf", etc.
  // Support Unicode characters in filenames (including Chinese)
  /(?:created?|saved?|wrote?|generated?|output(?:ted)?|wrote)\s+(?:to\s+)?["`']?([^\s"'\`]+\.(?:pdf|txt|md|docx?|xlsx?|csv|json|xml|html?|png|jpe?g|gif|tiff?|bmp))["`'?]/gi,
  // File paths in quotes or backticks (with Unicode support)
  /["'`]([^\s"'`]+\.(?:pdf|txt|md|docx?|xlsx?|csv|json|xml|html?|png|jpe?g|gif|tiff?|bmp))["'`]/g,
  // Relative paths like ./xxx.pdf or ../xxx.pdf (with Unicode support)
  /(?:[\s(])(\.\.?\/*[^\s\])"']+\.(?:pdf|txt|md|docx?|xlsx?|csv|json|xml|html?|png|jpe?g|gif|tiff?|bmp))/g,
  // Absolute paths (with Unicode support)
  /(?:[\s(])(\/[^\s\])"']+\.(?:pdf|txt|md|docx?|xlsx?|csv|json|xml|html?|png|jpe?g|gif|tiff?|bmp))/g,
  // Match "文件名：xxx.pdf" or "文件: xxx.pdf" format (with Unicode support)
  /(?:文件名|file|document)[:\s]+["`']([^\s"'`]+\.(?:pdf|txt|md|docx?|xlsx?|csv|json|xml|html?|png|jpe?g|gif|tiff?|bmp))["`']/gi,
];

// Pattern to detect directory location like "位置：`/path/to/dir/`" or "位置：/path/to/dir/"
const DIR_PATTERN =
  /(?:位置|location|dir(?:ectory)?)[:：\s]*["`']?([^"'`\s]*?)[`'"]?\s*(?:$|\n)/m;

// Common upload directory pattern
const UPLOAD_DIR_PATTERN = /\/claude-webui-uploads\//;

export function FileDownloadButton({
  content,
  workingDirectory,
}: FileDownloadButtonProps) {
  const [files, setFiles] = useState<DetectedFile[]>([]);

  useEffect(() => {
    detectFiles(content);
  }, [content]);

  function detectFiles(text: string) {
    const detected: DetectedFile[] = [];
    const seen = new Set<string>();

    // First, extract directory location if present
    let dirPath = "";
    const dirMatch = text.match(DIR_PATTERN);
    if (dirMatch && dirMatch[1]) {
      dirPath = dirMatch[1].replace(/`|"'/g, "").trim();
      // Remove trailing slash if present
      dirPath = dirPath.replace(/\/$/, "");
    }

    for (const pattern of FILE_PATTERNS) {
      let match;
      // Reset regex state
      pattern.lastIndex = 0;
      while ((match = pattern.exec(text)) !== null) {
        let filePath = match[1] || match[0];
        const trimmedPath = filePath.trim().replace(/^[`'"]|[`'"]$/g, ""); // Remove quotes

        if (trimmedPath && !seen.has(trimmedPath)) {
          seen.add(trimmedPath);

          // Extract filename from path
          const name = trimmedPath.substring(trimmedPath.lastIndexOf("/") + 1);

          // If path is relative and we have a directory, combine them
          let fullPath = trimmedPath;
          if (dirPath && !trimmedPath.startsWith("/")) {
            fullPath = `${dirPath}/${trimmedPath}`;
          }
          // If path is just a filename (no directory separator), add ./ prefix
          // so backend can resolve it from current working directory
          if (!fullPath.includes("/") && !fullPath.startsWith(".")) {
            fullPath = `./${fullPath}`;
          }

          detected.push({
            path: fullPath,
            name,
          });
        }
      }
    }

    setFiles(detected);
  }

  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 my-2">
      {files.map((file, index) => (
        <FileChip
          key={`${file.path}-${index}`}
          file={file}
          workingDirectory={workingDirectory}
        />
      ))}
    </div>
  );
}

interface FileChipProps {
  file: DetectedFile;
  workingDirectory?: string;
}

function FileChip({ file, workingDirectory }: FileChipProps) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  const isUploadFile = UPLOAD_DIR_PATTERN.test(file.path);

  async function handleDownload() {
    setDownloading(true);
    setError(null);

    try {
      // Register file and download
      await registerAndDownload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
      setDownloading(false);
    }
  }

  async function registerAndDownload() {
    try {
      const requestData = {
        path: file.path,
        name: file.name,
        ...(workingDirectory && { workingDirectory }),
      };

      // Register the file and get a download URL
      const response = await fetch(getApiUrl("/api/files/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to register file: ${response.statusText}`,
        );
      }

      const result = await response.json();
      if (!result.success || !result.file) {
        throw new Error(result.error || "Failed to register file");
      }

      const fileId = result.file.id;

      // Now download the file
      const downloadUrl = getApiUrl(`/api/files/${fileId}/download`);
      const downloadResponse = await fetch(downloadUrl);

      if (!downloadResponse.ok) {
        throw new Error(
          `Failed to download file: ${downloadResponse.statusText}`,
        );
      }

      const blob = await downloadResponse.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setRegistered(true);
      setDownloading(false);
    } catch (err) {
      console.error("[FileDownloadButton] Error:", err);
      setError(err instanceof Error ? err.message : "Download failed");
      setDownloading(false);
    }
  }

  function getFileIcon() {
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    if (ext === ".pdf") return "📄";
    if (ext === ".txt" || ext === ".md") return "📝";
    if (ext.match(/\.(doc|docx)/)) return "📄";
    if (ext.match(/\.(xls|xlsx)/)) return "📊";
    if (ext.match(/\.(png|jpg|jpeg|gif)/)) return "🖼️";
    return "📎";
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg group">
      <span className="text-sm" title={`路径: ${file.path}`}>
        {getFileIcon()} {file.name}
      </span>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="p-1 rounded hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors disabled:opacity-50"
        title={downloading ? "下载中..." : registered ? "再次下载" : "下载文件"}
      >
        <ArrowDownTrayIcon
          className={`w-4 h-4 text-green-600 dark:text-green-400 ${downloading ? "animate-bounce" : ""}`}
        />
      </button>
      {error && (
        <span
          className="text-xs text-red-600 dark:text-red-400 max-w-[200px] truncate"
          title={error}
        >
          ⚠️ {error}
        </span>
      )}
    </div>
  );
}
