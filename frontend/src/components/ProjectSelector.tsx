import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FolderIcon } from "@heroicons/react/24/outline";
import type { ProjectsResponse, ProjectInfo } from "../types";
import { getProjectsUrl } from "../config/api";
import { SettingsButton } from "./SettingsButton";
import { SettingsModal } from "./SettingsModal";

export function ProjectSelector() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customPath, setCustomPath] = useState("");
  const [pathError, setPathError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(getProjectsUrl());
      if (!response.ok) {
        throw new Error(`Failed to load projects: ${response.statusText}`);
      }
      const data: ProjectsResponse = await response.json();
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (projectPath: string) => {
    const normalizedPath = projectPath.startsWith("/")
      ? projectPath
      : `/${projectPath}`;
    navigate(`/projects${normalizedPath}`);
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  const handleCustomPathSubmit = () => {
    if (!customPath.trim()) {
      setPathError("Please enter a path");
      return;
    }
    // Pass path as-is, backend will handle ~ expansion
    handleProjectSelect(customPath);
  };

  const handleCustomPathKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCustomPathSubmit();
    }
  };

  const handleBrowseFolder = async () => {
    try {
      // Check if we're in Tauri
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          directory: true,
          multiple: false,
          title: 'Select Project Folder',
        });

        if (selected && typeof selected === 'string') {
          setCustomPath(selected);
          setPathError(null);
          // Auto-navigate after selection
          handleProjectSelect(selected);
        }
      } else {
        // Fallback for web version
        setPathError('Folder picker is only available in desktop app. Please enter path manually.');
      }
    } catch (error) {
      console.error('Failed to open folder picker:', error);
      setPathError('Failed to open folder picker');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600 dark:text-slate-400">
          Loading projects...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-slate-800 dark:text-slate-100 text-3xl font-bold tracking-tight">
            Select a Project
          </h1>
          <SettingsButton onClick={handleSettingsClick} />
        </div>

        <div className="space-y-6">
          {projects.length > 0 && (
            <div>
              <h2 className="text-slate-700 dark:text-slate-300 text-lg font-medium mb-4">
                Recent Projects
              </h2>
              <div className="space-y-3">
                {projects.map((project) => (
                  <button
                    key={project.path}
                    onClick={() => handleProjectSelect(project.path)}
                    className="w-full flex items-center gap-3 p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors text-left"
                  >
                    <FolderIcon className="h-5 w-5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                    <span className="text-slate-800 dark:text-slate-200 font-mono text-sm">
                      {project.path}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Path Input */}
          <div>
            <h2 className="text-slate-700 dark:text-slate-300 text-lg font-medium mb-4">
              Open Directory
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={customPath}
                onChange={(e) => {
                  setCustomPath(e.target.value);
                  setPathError(null);
                }}
                onKeyDown={handleCustomPathKeyDown}
                placeholder="~/Downloads or /Users/xxx/Downloads"
                className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 font-mono text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleBrowseFolder}
                className="px-4 py-3 bg-slate-600 hover:bg-slate-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                <FolderIcon className="h-5 w-5" />
                Browse
              </button>
              <button
                onClick={handleCustomPathSubmit}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Open
              </button>
            </div>
            {pathError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {pathError}
              </p>
            )}
          </div>
        </div>

        {/* Settings Modal */}
        <SettingsModal isOpen={isSettingsOpen} onClose={handleSettingsClose} />
      </div>
    </div>
  );
}
