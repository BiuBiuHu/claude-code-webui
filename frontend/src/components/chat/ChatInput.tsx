import React, { useRef, useEffect, useState, useCallback } from "react";
import { StopIcon } from "@heroicons/react/24/solid";
import { UI_CONSTANTS, KEYBOARD_SHORTCUTS } from "../../utils/constants";
import { useEnterBehavior } from "../../hooks/useSettings";
import { PermissionInputPanel } from "./PermissionInputPanel";
import { PlanPermissionInputPanel } from "./PlanPermissionInputPanel";
import { SlashCommandPalette } from "./SlashCommandPalette";
import { FileUploadButton, FileAttachments } from "./FileUploadButton";
import {
  executeSlashCommand,
  type SlashCommandHandlers,
} from "../../utils/slashCommands";
import {
  isPotentialSlashCommand,
  type SlashCommand,
} from "../../../../shared/types/slashCommands";
import type { PermissionMode } from "../../types";

interface AttachedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType: string;
}

interface PermissionData {
  patterns: string[];
  onAllow: () => void;
  onAllowPermanent: () => void;
  onDeny: () => void;
  getButtonClassName?: (
    buttonType: "allow" | "allowPermanent" | "deny",
    defaultClassName: string,
  ) => string;
  onSelectionChange?: (selection: "allow" | "allowPermanent" | "deny") => void;
  externalSelectedOption?: "allow" | "allowPermanent" | "deny" | null;
}

interface PlanPermissionData {
  onAcceptWithEdits: () => void;
  onAcceptDefault: () => void;
  onKeepPlanning: () => void;
  getButtonClassName?: (
    buttonType: "acceptWithEdits" | "acceptDefault" | "keepPlanning",
    defaultClassName: string,
  ) => string;
  onSelectionChange?: (
    selection: "acceptWithEdits" | "acceptDefault" | "keepPlanning",
  ) => void;
  externalSelectedOption?:
    | "acceptWithEdits"
    | "acceptDefault"
    | "keepPlanning"
    | null;
}

interface ChatInputProps {
  input: string;
  isLoading: boolean;
  currentRequestId: string | null;
  onInputChange: (value: string) => void;
  onSubmit: (attachedFiles?: AttachedFile[]) => void;
  onAbort: () => void;
  // Permission mode props
  permissionMode: PermissionMode;
  onPermissionModeChange: (mode: PermissionMode) => void;
  showPermissions?: boolean;
  permissionData?: PermissionData;
  planPermissionData?: PlanPermissionData;
  // Slash command handlers
  onClearConversation?: () => void;
  onSaveConversation?: () => void;
  onExportConversation?: () => void;
}

export function ChatInput({
  input,
  isLoading,
  currentRequestId,
  onInputChange,
  onSubmit,
  onAbort,
  permissionMode,
  onPermissionModeChange,
  showPermissions = false,
  permissionData,
  planPermissionData,
  onClearConversation,
  onSaveConversation,
  onExportConversation,
}: ChatInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);
  const { enterBehavior } = useEnterBehavior();

  // File attachment state
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  // Slash command state
  const [showSlashPalette, setShowSlashPalette] = useState(false);

  // Check if input is a potential slash command
  const isSlashCommand = isPotentialSlashCommand(input);

  // Show/hide slash palette based on input
  useEffect(() => {
    if (input === "/" && !showSlashPalette) {
      setShowSlashPalette(true);
    } else if (!input.startsWith("/") && showSlashPalette) {
      setShowSlashPalette(false);
    }
  }, [input, showSlashPalette]);

  const slashCommandHandlers: SlashCommandHandlers = {
    setPlanMode: useCallback(() => {
      onPermissionModeChange("plan");
      setShowSlashPalette(false);
      onInputChange("");
    }, [onPermissionModeChange, onInputChange]),
    setNormalMode: useCallback(() => {
      onPermissionModeChange("default");
      setShowSlashPalette(false);
      onInputChange("");
    }, [onPermissionModeChange, onInputChange]),
    clearConversation: useCallback(() => {
      onClearConversation?.();
      setShowSlashPalette(false);
      onInputChange("");
    }, [onClearConversation, onInputChange]),
    saveConversation: useCallback(() => {
      onSaveConversation?.();
      setShowSlashPalette(false);
      onInputChange("");
    }, [onSaveConversation, onInputChange]),
    exportConversation: useCallback(() => {
      onExportConversation?.();
      setShowSlashPalette(false);
      onInputChange("");
    }, [onExportConversation, onInputChange]),
  };

  // Focus input when not loading and not in permission mode
  useEffect(() => {
    if (!isLoading && !showPermissions && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading, showPermissions]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const computedStyle = getComputedStyle(textarea);
      const maxHeight =
        parseInt(computedStyle.maxHeight, 10) ||
        UI_CONSTANTS.TEXTAREA_MAX_HEIGHT;
      const scrollHeight = Math.min(textarea.scrollHeight, maxHeight);
      textarea.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Handle slash command execution
    if (isSlashCommand) {
      const result = executeSlashCommand(input, slashCommandHandlers);
      if (result.handled) {
        setShowSlashPalette(false);
        onInputChange("");
        return;
      }
    }

    // Pass attached files to submit handler
    onSubmit(attachedFiles.length > 0 ? attachedFiles : undefined);
    // Clear attached files after submit
    setAttachedFiles([]);
  };

  // Handle file attachment
  const handleFileAttached = useCallback((file: AttachedFile) => {
    setAttachedFiles((prev) => [...prev, file]);
  }, []);

  // Handle file removal
  const handleFileRemoved = useCallback((fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  const handleSlashCommandSelect = (command: SlashCommand) => {
    setShowSlashPalette(false);
    // Insert the command into input (can be further edited)
    onInputChange(`/${command.name} `);
    // Focus back on input
    inputRef.current?.focus();
  };

  const closeSlashPalette = () => {
    setShowSlashPalette(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Permission mode toggle: Ctrl+Shift+M (all platforms)
    if (
      e.key === KEYBOARD_SHORTCUTS.PERMISSION_MODE_TOGGLE &&
      e.shiftKey &&
      e.ctrlKey &&
      !e.metaKey && // Avoid conflicts with browser shortcuts on macOS
      !isComposing
    ) {
      e.preventDefault();
      onPermissionModeChange(getNextPermissionMode(permissionMode));
      return;
    }

    // Handle slash palette keyboard shortcuts
    if (showSlashPalette) {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSlashPalette(false);
        return;
      }
      // Arrow keys and Enter are handled by the palette component
      if (["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) {
        return; // Let the palette handle it
      }
    }

    if (e.key === KEYBOARD_SHORTCUTS.SUBMIT && !isComposing) {
      if (enterBehavior === "newline") {
        handleNewlineModeKeyDown(e);
      } else {
        handleSendModeKeyDown(e);
      }
    }
  };

  const handleNewlineModeKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    // Newline mode: Enter adds newline, Shift+Enter sends
    if (e.shiftKey) {
      e.preventDefault();
      // Pass attachedFiles when submitting via keyboard
      onSubmit(attachedFiles.length > 0 ? attachedFiles : undefined);
    }
    // Enter is handled naturally by textarea (adds newline)
  };

  const handleSendModeKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    // Send mode: Enter sends, Shift+Enter adds newline
    if (!e.shiftKey) {
      e.preventDefault();
      // Pass attachedFiles when submitting via keyboard
      onSubmit(attachedFiles.length > 0 ? attachedFiles : undefined);
    }
    // Shift+Enter is handled naturally by textarea (adds newline)
  };
  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = () => {
    // Add small delay to handle race condition between composition and keydown events
    setTimeout(() => setIsComposing(false), 0);
  };

  // Get permission mode status indicator (CLI-style)
  const getPermissionModeIndicator = (mode: PermissionMode): string => {
    switch (mode) {
      case "default":
        return "🔧 normal mode";
      case "plan":
        return "⏸ plan mode";
      case "acceptEdits":
        return "⏵⏵ accept edits";
    }
  };

  // Get clean permission mode name (without emoji)
  const getPermissionModeName = (mode: PermissionMode): string => {
    switch (mode) {
      case "default":
        return "normal mode";
      case "plan":
        return "plan mode";
      case "acceptEdits":
        return "accept edits";
    }
  };

  // Get next permission mode for cycling
  const getNextPermissionMode = (current: PermissionMode): PermissionMode => {
    const modes: PermissionMode[] = ["default", "plan", "acceptEdits"];
    const currentIndex = modes.indexOf(current);
    return modes[(currentIndex + 1) % modes.length];
  };

  // If we're in plan permission mode, show the plan permission panel instead
  if (showPermissions && planPermissionData) {
    return (
      <PlanPermissionInputPanel
        onAcceptWithEdits={planPermissionData.onAcceptWithEdits}
        onAcceptDefault={planPermissionData.onAcceptDefault}
        onKeepPlanning={planPermissionData.onKeepPlanning}
        getButtonClassName={planPermissionData.getButtonClassName}
        onSelectionChange={planPermissionData.onSelectionChange}
        externalSelectedOption={planPermissionData.externalSelectedOption}
      />
    );
  }

  // If we're in regular permission mode, show the permission panel instead
  if (showPermissions && permissionData) {
    return (
      <PermissionInputPanel
        patterns={permissionData.patterns}
        onAllow={permissionData.onAllow}
        onAllowPermanent={permissionData.onAllowPermanent}
        onDeny={permissionData.onDeny}
        getButtonClassName={permissionData.getButtonClassName}
        onSelectionChange={permissionData.onSelectionChange}
        externalSelectedOption={permissionData.externalSelectedOption}
      />
    );
  }

  return (
    <div className="flex-shrink-0" ref={containerRef}>
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          placeholder={
            isLoading && currentRequestId
              ? "Processing..."
              : attachedFiles.length > 0
                ? "添加消息描述... (Type / for commands)"
                : "Type message... (Type / for commands)"
          }
          rows={1}
          className={`w-full px-4 py-3 pr-28 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 backdrop-blur-sm shadow-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 resize-none overflow-hidden min-h-[48px] max-h-[${UI_CONSTANTS.TEXTAREA_MAX_HEIGHT}px]`}
          disabled={isLoading}
        />
        <div className="absolute right-2 bottom-3 flex gap-2">
          {/* File Upload Button */}
          <FileUploadButton
            onFileAttached={handleFileAttached}
            onFileRemoved={handleFileRemoved}
            attachedFiles={attachedFiles}
            disabled={isLoading}
          />
          {isLoading && currentRequestId && (
            <button
              type="button"
              onClick={onAbort}
              className="p-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
              title="Stop (ESC)"
            >
              <StopIcon className="w-4 h-4" />
            </button>
          )}
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 text-sm"
          >
            {isLoading ? "..." : permissionMode === "plan" ? "Plan" : "Send"}
          </button>
        </div>

        {/* Slash Command Palette */}
        {showSlashPalette && (
          <SlashCommandPalette
            input={input}
            onSelect={handleSlashCommandSelect}
            onClose={closeSlashPalette}
          />
        )}
      </form>

      {/* File Attachments */}
      {attachedFiles.length > 0 && (
        <FileAttachments files={attachedFiles} onRemove={handleFileRemoved} />
      )}

      {/* Permission mode status bar */}
      <button
        type="button"
        onClick={() =>
          onPermissionModeChange(getNextPermissionMode(permissionMode))
        }
        className="w-full px-4 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-mono text-left transition-colors cursor-pointer"
        title={`Current: ${getPermissionModeName(permissionMode)} - Click to cycle (Ctrl+Shift+M)`}
      >
        {getPermissionModeIndicator(permissionMode)}
        <span className="ml-2 text-slate-400 dark:text-slate-500 text-[10px]">
          - Click to cycle (Ctrl+Shift+M)
        </span>
      </button>
    </div>
  );
}
