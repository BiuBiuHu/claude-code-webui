import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { logger } from "./logger.ts";

export interface UserConfig {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    useSystemDefaults: boolean;
}

export interface SystemConfig {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
}

export interface EffectiveConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
}

const DEFAULT_CONFIG: Partial<SystemConfig> = {
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-20250514",
};

export class ConfigManager {
    private userConfigPath: string;
    private systemConfigPath: string;
    private configDir: string;

    constructor() {
        this.configDir = path.join(os.homedir(), ".claude-webui");
        this.userConfigPath = path.join(this.configDir, "config.json");
        this.systemConfigPath = path.join(os.homedir(), ".claude", "settings.json");
    }

    /**
     * Ensure config directory exists
     */
    private async ensureConfigDir(): Promise<void> {
        try {
            await fs.mkdir(this.configDir, { recursive: true, mode: 0o700 });
        } catch (error) {
            logger.api.error("Failed to create config directory: {error}", { error });
            throw error;
        }
    }

    /**
     * Read user configuration from ~/.claude-webui/config.json
     */
    async getUserConfig(): Promise<UserConfig | null> {
        try {
            const data = await fs.readFile(this.userConfigPath, "utf-8");
            const config = JSON.parse(data) as UserConfig;
            logger.api.info("Loaded user config from {path}", {
                path: this.userConfigPath,
            });
            return config;
        } catch (error: any) {
            if (error.code === "ENOENT") {
                logger.api.info("No user config found");
                return null;
            }
            logger.api.warn("Failed to read user config: {error}", { error });
            return null;
        }
    }

    /**
     * Save user configuration to ~/.claude-webui/config.json
     */
    async saveUserConfig(config: UserConfig): Promise<void> {
        try {
            await this.ensureConfigDir();

            // Write atomically by writing to temp file first
            const tempPath = `${this.userConfigPath}.tmp`;
            await fs.writeFile(tempPath, JSON.stringify(config, null, 2), {
                mode: 0o600,
            });
            await fs.rename(tempPath, this.userConfigPath);

            logger.api.info("Saved user config to {path}", { path: this.userConfigPath });
        } catch (error) {
            logger.api.error("Failed to save user config: {error}", { error });
            throw error;
        }
    }

    /**
     * Read system configuration from ~/.claude/settings.json
     */
    async getSystemConfig(): Promise<SystemConfig> {
        try {
            const data = await fs.readFile(this.systemConfigPath, "utf-8");
            const settings = JSON.parse(data);

            // Extract relevant environment variables
            const env = settings.env || {};
            const config: SystemConfig = {
                apiKey: env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_API_KEY,
                baseUrl: env.ANTHROPIC_BASE_URL,
                model: env.ANTHROPIC_MODEL || env.ANTHROPIC_DEFAULT_SONNET_MODEL,
            };

            logger.api.info("Loaded system config from {path}", {
                path: this.systemConfigPath,
            });
            return config;
        } catch (error: any) {
            if (error.code === "ENOENT") {
                logger.api.warn("No system config found at {path}", {
                    path: this.systemConfigPath,
                });
                return {};
            }
            logger.api.warn("Failed to read system config: {error}", { error });
            return {};
        }
    }

    /**
     * Get effective configuration (user config or system fallback)
     */
    async getEffectiveConfig(): Promise<EffectiveConfig> {
        const userConfig = await this.getUserConfig();
        const systemConfig = await this.getSystemConfig();

        // If user explicitly wants system defaults, use system config
        if (userConfig?.useSystemDefaults) {
            return {
                apiKey: systemConfig.apiKey || "",
                baseUrl: systemConfig.baseUrl || DEFAULT_CONFIG.baseUrl!,
                model: systemConfig.model || DEFAULT_CONFIG.model!,
            };
        }

        // If user has custom config, use it
        if (userConfig && !userConfig.useSystemDefaults) {
            return {
                apiKey: userConfig.apiKey || systemConfig.apiKey || "",
                baseUrl: userConfig.baseUrl || DEFAULT_CONFIG.baseUrl!,
                model: userConfig.model || DEFAULT_CONFIG.model!,
            };
        }

        // No user config, fall back to system config
        return {
            apiKey: systemConfig.apiKey || "",
            baseUrl: systemConfig.baseUrl || DEFAULT_CONFIG.baseUrl!,
            model: systemConfig.model || DEFAULT_CONFIG.model!,
        };
    }

    /**
     * Test if configuration is valid by checking if API key is present
     */
    async testConfig(config: Partial<SystemConfig>): Promise<boolean> {
        // Basic validation: API key must be present and non-empty
        if (!config.apiKey || config.apiKey.trim() === "") {
            return false;
        }

        // Could add more sophisticated testing here:
        // - Make actual API call to verify credentials
        // - Check if base URL is reachable
        // For now, just basic validation

        return true;
    }

    /**
     * Mask API key for security (show only first/last few characters)
     */
    maskApiKey(apiKey: string | undefined): string | undefined {
        if (!apiKey) return undefined;
        if (apiKey.length <= 10) return "***";

        const start = apiKey.substring(0, 7);
        const end = apiKey.substring(apiKey.length - 3);
        return `${start}...${end}`;
    }
}

// Singleton instance
let configManager: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
    if (!configManager) {
        configManager = new ConfigManager();
    }
    return configManager;
}
