/**
 * InstallSkillDialog Component
 * 安装技能对话框组件
 * 支持 GitHub 仓库安装和 ZIP 文件上传
 */

import { useState, useCallback, useEffect } from "react";
import {
  XMarkIcon,
  CloudArrowDownIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
import type { SkillScope } from "../../../../shared/types/skills";
import { getInstallSkillUrl } from "../../config/api";

export interface InstallSkillDialogProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 安装成功回调 */
  onSuccess?: () => void;
  /** 默认作用域 */
  defaultScope?: SkillScope;
  /** 项目 ID（project 级技能需要） */
  projectId?: string;
}

export interface SkillPreview {
  name: string;
  description: string;
  version?: string;
  author?: string;
  valid: boolean;
  error?: string;
}

/**
 * 安装方式类型
 */
type InstallMethod = "github" | "zip";

/**
 * 安装技能对话框组件
 */
export function InstallSkillDialog({
  isOpen,
  onClose,
  onSuccess,
  defaultScope = "app",
  projectId,
}: InstallSkillDialogProps) {
  const [installMethod, setInstallMethod] = useState<InstallMethod>("github");
  const [githubUrl, setGithubUrl] = useState("");
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<SkillPreview | null>(null);

  // 重置状态
  useEffect(() => {
    if (isOpen) {
      setInstallMethod("github");
      setGithubUrl("");
      setError(null);
      setPreview(null);
    }
  }, [isOpen]);

  /**
   * 验证 GitHub URL 并预览技能信息
   */
  const validateGitHubUrl = useCallback((url: string) => {
    // 简单的 GitHub URL 验证
    const githubRegex = /^https?:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/;
    return githubRegex.test(url);
  }, []);

  /**
   * 处理 URL 输入变化
   */
  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const url = e.target.value;
      setGithubUrl(url);
      setError(null);

      if (url && validateGitHubUrl(url)) {
        // 从 URL 提取仓库名作为预览
        const match = url.match(/github\.com\/([\w.-]+\/[\w.-]+)/);
        if (match) {
          setPreview({
            name: match[1].split("/")[1],
            description: "从 GitHub 仓库安装",
            valid: true,
          });
        }
      } else if (url) {
        setPreview({
          name: "无效的 URL",
          description: "请输入有效的 GitHub 仓库 URL",
          valid: false,
          error: "无效的 GitHub URL",
        });
      } else {
        setPreview(null);
      }
    },
    [validateGitHubUrl],
  );

  /**
   * 安装技能
   */
  const handleInstall = useCallback(async () => {
    if (installMethod === "github" && !githubUrl.trim()) {
      setError("请输入 GitHub 仓库 URL");
      return;
    }

    if (installMethod === "github" && !validateGitHubUrl(githubUrl)) {
      setError("请输入有效的 GitHub 仓库 URL");
      return;
    }

    setIsInstalling(true);
    setError(null);

    try {
      const response = await fetch(getInstallSkillUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: installMethod,
          url: installMethod === "github" ? githubUrl : undefined,
          scope: defaultScope,
          projectId,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "Installation failed" }));
        throw new Error(errorData.message || "安装失败");
      }

      // 安装成功
      onSuccess?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "安装失败";
      setError(message);
    } finally {
      setIsInstalling(false);
    }
  }, [
    installMethod,
    githubUrl,
    validateGitHubUrl,
    defaultScope,
    projectId,
    onSuccess,
    onClose,
  ]);

  /**
   * 处理背景点击关闭
   */
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  if (!isOpen) return null;

  const isValid = preview?.valid && githubUrl.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div
        className="
          bg-white dark:bg-slate-800
          rounded-xl
          border border-slate-200 dark:border-slate-700
          shadow-xl
          max-w-lg w-full max-h-[90vh]
          overflow-hidden flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2
            id="dialog-title"
            className="text-xl font-semibold text-slate-800 dark:text-slate-100"
          >
            安装技能
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="关闭"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          {/* 安装方式选择 */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                setInstallMethod("github");
                setPreview(null);
              }}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all
                ${
                  installMethod === "github"
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                }
              `}
            >
              <CloudArrowDownIcon className="w-5 h-5" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                GitHub 仓库
              </span>
            </button>
            <button
              onClick={() => setInstallMethod("zip")}
              className={`
                flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all
                ${
                  installMethod === "zip"
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-400"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300"
                }
              `}
            >
              <ArrowUpTrayIcon className="w-5 h-5" />
              <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                ZIP 文件
              </span>
            </button>
          </div>

          {/* GitHub URL 输入 */}
          {installMethod === "github" ? (
            <div>
              <label
                htmlFor="github-url"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
              >
                GitHub 仓库 URL
              </label>
              <input
                id="github-url"
                type="text"
                value={githubUrl}
                onChange={handleUrlChange}
                placeholder="https://github.com/user/skill-repo"
                className="
                  w-full px-4 py-3
                  bg-white dark:bg-slate-900
                  border border-slate-200 dark:border-slate-700
                  rounded-lg
                  focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  text-sm text-slate-800 dark:text-slate-100
                  placeholder-slate-400
                  transition-all
                "
                disabled={isInstalling}
              />
            </div>
          ) : (
            /* ZIP 文件上传区 */
            <div
              className="
                border-2 border-dashed border-slate-300 dark:border-slate-600
                rounded-lg p-8 text-center
                hover:border-blue-400 dark:hover:border-blue-500
                transition-colors cursor-pointer
              "
            >
              <ArrowUpTrayIcon className="w-12 h-12 mx-auto mb-3 text-slate-400" />
              <p className="text-sm text-slate-600 dark:text-slate-400">
                拖拽文件到此处，或点击上传
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                支持 .zip 格式（暂未实现）
              </p>
            </div>
          )}

          {/* 预览信息 */}
          {preview && installMethod === "github" && (
            <div className="mt-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-1">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">名称:</span> {preview.name}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium">描述:</span> {preview.description}
              </p>
              {preview.author && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-medium">作者:</span> {preview.author}
                </p>
              )}
            </div>
          )}

          {/* 错误信息 */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={isInstalling}
            className="
              px-4 py-2
              border border-slate-300 dark:border-slate-600
              rounded-lg
              hover:bg-slate-50 dark:hover:bg-slate-700
              transition-colors
              text-slate-700 dark:text-slate-300
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            取消
          </button>
          <button
            onClick={handleInstall}
            disabled={!isValid || isInstalling}
            className="
              px-4 py-2
              bg-blue-600 hover:bg-blue-700
              disabled:bg-slate-400
              text-white
              rounded-lg
              transition-colors
              disabled:cursor-not-allowed
              flex items-center gap-2
            "
          >
            {isInstalling ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                安装中...
              </>
            ) : (
              "安装技能"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
