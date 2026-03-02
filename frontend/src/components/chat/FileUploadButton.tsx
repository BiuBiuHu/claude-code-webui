/**
 * FileUploadButton Component
 *
 * A button that opens a file picker for uploading documents (PDF, images, etc.)
 * Displays upload progress and attaches the file to the chat input.
 */

import { useState, useRef, useCallback } from "react";
import {
  DocumentIcon,
  PhotoIcon,
  XMarkIcon,
  CloudArrowUpIcon,
} from "@heroicons/react/24/outline";
import {
  uploadFile,
  formatFileSize,
  isSupportedFile,
} from "../../services/filesApi";

interface AttachedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
  local?: boolean; // If true, not yet uploaded
}

interface FileUploadButtonProps {
  onFileAttached: (file: AttachedFile) => void;
  onFileRemoved: (fileId: string) => void;
  attachedFiles: AttachedFile[];
  disabled?: boolean;
}

export function FileUploadButton({
  onFileAttached,
  onFileRemoved,
  attachedFiles,
  disabled = false,
}: FileUploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  }, [disabled]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset state
      setError(null);
      setUploadProgress(0);

      // Check if file is supported
      if (!isSupportedFile(file)) {
        setError(`Unsupported file type: ${file.name}`);
        return;
      }

      // Check file size (50MB limit)
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        setError(`File too large: ${formatFileSize(file.size)} (max 50MB)`);
        return;
      }

      setUploading(true);

      try {
        // Upload file
        const uploadedFile = await uploadFile(file, (progress) => {
          setUploadProgress(progress);
        });

        console.log(
          "[FileUploadButton] File uploaded successfully:",
          uploadedFile,
        );

        // Notify parent
        const attachedFile = {
          ...uploadedFile,
          local: false,
        };
        console.log(
          "[FileUploadButton] Calling onFileAttached with:",
          attachedFile,
        );
        onFileAttached(attachedFile);

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [onFileAttached],
  );

  const handleRemoveFile = useCallback(
    (fileId: string) => {
      onFileRemoved(fileId);
    },
    [onFileRemoved],
  );

  const getFileIcon = (file: AttachedFile) => {
    // Check by mime type
    if (
      file.mimeType === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      return (
        <DocumentIcon className="w-5 h-5 text-red-500 dark:text-red-400" />
      );
    }
    if (file.mimeType.startsWith("image/")) {
      return <PhotoIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" />;
    }
    return (
      <DocumentIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
    );
  };

  return (
    <div className="relative">
      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".pdf,.txt,.md,.doc,.docx,.png,.jpg,.jpeg,.tiff,.tif,image/*"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
      />

      {/* Upload Button */}
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || uploading}
        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={uploading ? "上传中..." : "上传文件"}
      >
        {uploading ? (
          <div className="w-5 h-5 border-2 border-slate-400 border-t-blue-600 rounded-full animate-spin" />
        ) : (
          <CloudArrowUpIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        )}
      </button>

      {/* Upload Progress */}
      {uploading && uploadProgress > 0 && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 min-w-[150px]">
          <div className="text-xs text-slate-600 dark:text-slate-400 mb-1">
            上传中... {uploadProgress}%
          </div>
          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-lg max-w-[200px]">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="mt-1 text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            关闭
          </button>
        </div>
      )}

      {/* Attached Files List */}
      {attachedFiles.length > 0 && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 min-w-[250px] max-w-[350px]">
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
            已附加 {attachedFiles.length} 个文件
          </div>
          <div className="space-y-1.5">
            {attachedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 p-1.5 rounded bg-slate-50 dark:bg-slate-900/50 group"
              >
                {getFileIcon(file)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFile(file.id)}
                  className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="移除文件"
                >
                  <XMarkIcon className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * File Attachment Pills Component
 * Displays attached files as pills below the input
 */
interface FileAttachmentsProps {
  files: AttachedFile[];
  onRemove: (fileId: string) => void;
}

export function FileAttachments({ files, onRemove }: FileAttachmentsProps) {
  if (files.length === 0) return null;

  const getFileIcon = (file: AttachedFile) => {
    // Check by mime type
    if (
      file.mimeType === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      return (
        <DocumentIcon className="w-4 h-4 text-red-500 dark:text-red-400" />
      );
    }
    if (file.mimeType.startsWith("image/")) {
      return <PhotoIcon className="w-4 h-4 text-blue-500 dark:text-blue-400" />;
    }
    return (
      <DocumentIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
    );
  };

  return (
    <div className="flex flex-wrap gap-2 px-3 pb-2">
      {files.map((file) => (
        <div
          key={file.id}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full group"
        >
          {getFileIcon(file)}
          <span className="text-sm text-slate-700 dark:text-slate-300 max-w-[150px] truncate">
            {file.name}
          </span>
          <button
            type="button"
            onClick={() => onRemove(file.id)}
            className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <XMarkIcon className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
      ))}
    </div>
  );
}
