/**
 * Slash Command Types
 * 斜杠命令类型定义
 */

/**
 * Available slash command types
 */
export type SlashCommandType =
  | "plan" // Enter plan mode
  | "normal" // Exit plan mode, use normal execution
  | "help" // Show help
  | "clear" // Clear conversation
  | "save" // Save conversation
  | "export"; // Export conversation

/**
 * Slash command definition
 */
export interface SlashCommand {
  type: SlashCommandType;
  name: string;
  description: string;
  icon?: string;
  alias?: string[]; // Alternative names
  args?: SlashCommandArg[];
}

/**
 * Command argument definition
 */
export interface SlashCommandArg {
  name: string;
  description: string;
  required: boolean;
  type: "text" | "boolean" | "number";
}

/**
 * Available slash commands
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    type: "plan",
    name: "plan",
    description:
      "Enter plan mode - create implementation plan before execution",
    icon: "📋",
    alias: ["p"],
  },
  {
    type: "normal",
    name: "normal",
    description: "Use normal execution mode (exit plan mode)",
    icon: "⚡",
    alias: ["n"],
  },
  {
    type: "help",
    name: "help",
    description: "Show available commands and help",
    icon: "❓",
    alias: ["h", "?"],
  },
  {
    type: "clear",
    name: "clear",
    description: "Clear current conversation",
    icon: "🗑️",
    alias: ["c", "reset"],
  },
  {
    type: "save",
    name: "save",
    description: "Save current conversation",
    icon: "💾",
    alias: ["s"],
  },
  {
    type: "export",
    name: "export",
    description: "Export conversation to file",
    icon: "📤",
    alias: ["e"],
  },
];

/**
 * Find a command by name or alias
 */
export function findSlashCommand(input: string): SlashCommand | undefined {
  const normalizedInput = input.toLowerCase().trim().replace(/^\//, "");
  return SLASH_COMMANDS.find(
    (cmd) =>
      cmd.name === normalizedInput || cmd.alias?.includes(normalizedInput),
  );
}

/**
 * Get all command names and aliases for autocomplete
 */
export function getAllSlashCommandTriggers(): string[] {
  const triggers: string[] = [];
  for (const cmd of SLASH_COMMANDS) {
    triggers.push(`/${cmd.name}`);
    if (cmd.alias) {
      for (const alias of cmd.alias) {
        triggers.push(`/${alias}`);
      }
    }
  }
  return triggers.sort();
}

/**
 * Parse slash command from input text
 */
export interface ParsedSlashCommand {
  command: SlashCommand;
  args: Record<string, unknown>;
  hasArgs: boolean;
}

export function parseSlashCommand(input: string): ParsedSlashCommand | null {
  const trimmedInput = input.trim();
  if (!trimmedInput.startsWith("/")) {
    return null;
  }

  // Split by spaces to get command and potential arguments
  const parts = trimmedInput.split(/\s+/);
  const commandPart = parts[0];
  const command = findSlashCommand(commandPart);

  if (!command) {
    return null;
  }

  // Simple argument parsing (can be extended)
  const args: Record<string, unknown> = {};
  const hasArgs = parts.length > 1;

  if (hasArgs && command.args) {
    // Parse named arguments like --flag value or positional args
    let currentArg: string | null = null;
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith("--")) {
        currentArg = part.slice(2);
      } else if (currentArg) {
        args[currentArg] = part;
        currentArg = null;
      }
    }
  }

  return { command, args, hasArgs };
}

/**
 * Check if input is a potential slash command
 */
export function isPotentialSlashCommand(input: string): boolean {
  return input.trim().startsWith("/");
}
