/**
 * Slash Command Palette
 * 斜杠命令自动完成面板
 */

import React, { useEffect, useRef, useMemo } from "react";
import {
  SLASH_COMMANDS,
  type SlashCommand,
} from "../../../../shared/types/slashCommands";

interface SlashCommandPaletteProps {
  input: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

export function SlashCommandPalette({
  input,
  onSelect,
  onClose,
  position,
}: SlashCommandPaletteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  // Filter commands based on input
  const filteredCommands = useMemo(() => {
    const searchInput = input.slice(1).toLowerCase().trim(); // Remove leading /
    if (!searchInput) {
      return SLASH_COMMANDS;
    }

    return SLASH_COMMANDS.filter((cmd) => {
      const matchesName = cmd.name.toLowerCase().startsWith(searchInput);
      const matchesAlias = cmd.alias?.some((a) =>
        a.toLowerCase().startsWith(searchInput),
      );
      return matchesName || matchesAlias;
    });
  }, [input]);

  // Close if no commands match
  useEffect(() => {
    if (filteredCommands.length === 0) {
      onClose();
    }
  }, [filteredCommands, onClose]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [input]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) =>
            i < filteredCommands.length - 1 ? i + 1 : i,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => (i > 0 ? i - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            onSelect(filteredCommands[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onSelect, onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (filteredCommands.length === 0) {
    return null;
  }

  const containerStyle: React.CSSProperties = position
    ? {
        position: "absolute",
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 50,
      }
    : {
        position: "absolute",
        bottom: "100%",
        left: 0,
        marginBottom: 8,
        zIndex: 50,
      };

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className="w-full max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden"
    >
      <div className="p-2 border-b border-slate-200 dark:border-slate-700">
        <p className="text-xs text-slate-500 dark:text-slate-400 px-2">
          Slash commands
        </p>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {filteredCommands.map((cmd, index) => {
          const isSelected = index === selectedIndex;
          const aliases = cmd.alias
            ? ` (${cmd.alias.map((a) => `/${a}`).join(", ")})`
            : "";

          return (
            <button
              key={cmd.name}
              ref={isSelected ? selectedItemRef : null}
              type="button"
              onClick={() => onSelect(cmd)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                isSelected
                  ? "bg-blue-50 dark:bg-blue-900/20"
                  : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
              }`}
            >
              <span className="text-xl flex-shrink-0">{cmd.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-medium ${
                      isSelected
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-800 dark:text-slate-100"
                    }`}
                  >
                    /{cmd.name}
                  </span>
                  {cmd.alias && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {aliases}
                    </span>
                  )}
                </div>
                <p
                  className={`text-xs truncate ${
                    isSelected
                      ? "text-blue-500 dark:text-blue-400"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {cmd.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
