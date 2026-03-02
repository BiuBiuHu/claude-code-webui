/**
 * Slash Command Utilities
 * 斜杠命令工具函数
 */

import {
  findSlashCommand,
  SLASH_COMMANDS,
} from "../../../shared/types/slashCommands";

export interface SlashCommandHandlers {
  setPlanMode?: () => void;
  setNormalMode?: () => void;
  clearConversation?: () => void;
  saveConversation?: () => void;
  exportConversation?: () => void;
}

/**
 * Parse and execute slash command from input
 */
export function executeSlashCommand(
  input: string,
  handlers: SlashCommandHandlers,
): { handled: boolean; newInput?: string; message?: string } {
  const parsed = findSlashCommand(input.split(/\s+/)[0]);
  if (!parsed) {
    return { handled: false };
  }

  // Execute the command
  switch (parsed.type) {
    case "plan":
      handlers.setPlanMode?.();
      return {
        handled: true,
        message:
          "Entering plan mode - create implementation plan before execution",
      };
    case "normal":
      handlers.setNormalMode?.();
      return {
        handled: true,
        message: "Switched to normal execution mode",
      };
    case "help":
      return {
        handled: true,
        message: formatHelpMessage(),
      };
    case "clear":
      handlers.clearConversation?.();
      return {
        handled: true,
        message: "Conversation cleared",
      };
    case "save":
      handlers.saveConversation?.();
      return {
        handled: true,
        message: "Conversation saved",
      };
    case "export":
      handlers.exportConversation?.();
      return {
        handled: true,
        message: "Conversation exported",
      };
    default:
      return { handled: false };
  }
}

function formatHelpMessage(): string {
  const lines = [
    "Available slash commands:",
    "",
    ...SLASH_COMMANDS.map(
      (cmd) =>
        `  /${cmd.name.padEnd(12)} - ${cmd.description}${cmd.alias ? ` (alias: /${cmd.alias.join(", /")})` : ""}`,
    ),
    "",
    "Type / to see available commands, use arrow keys to navigate, Enter to select.",
  ];
  return lines.join("\n");
}
