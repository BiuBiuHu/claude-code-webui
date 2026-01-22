import { Context } from "hono";
import {
    getConfigManager,
    type UserConfig,
} from "../utils/config-manager.ts";
import type {
    UserConfigResponse,
    SystemConfigResponse,
    SaveConfigRequest,
    ConfigTestRequest,
    ConfigTestResponse,
} from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";

/**
 * GET /api/config
 * Returns current user configuration with masked API key
 */
export async function handleGetConfig(c: Context) {
    try {
        const configManager = getConfigManager();
        const userConfig = await configManager.getUserConfig();
        const systemConfig = await configManager.getSystemConfig();

        if (!userConfig) {
            // No user config, return system defaults
            const response: UserConfigResponse = {
                useSystemDefaults: true,
                apiKey: configManager.maskApiKey(systemConfig.apiKey),
                baseUrl: systemConfig.baseUrl,
                model: systemConfig.model,
            };
            return c.json(response);
        }

        // Return user config with masked API key
        const response: UserConfigResponse = {
            useSystemDefaults: userConfig.useSystemDefaults,
            apiKey: configManager.maskApiKey(userConfig.apiKey),
            baseUrl: userConfig.baseUrl,
            model: userConfig.model,
        };

        return c.json(response);
    } catch (error) {
        logger.api.error("Failed to get config: {error}", { error });
        return c.json({ error: "Failed to get configuration" }, 500);
    }
}

/**
 * POST /api/config
 * Saves user configuration
 */
export async function handleSaveConfig(c: Context) {
    try {
        const body = (await c.req.json()) as SaveConfigRequest;
        const configManager = getConfigManager();

        // Validate required fields if not using system defaults
        if (!body.useSystemDefaults) {
            if (!body.apiKey || body.apiKey.trim() === "") {
                return c.json({ error: "API key is required" }, 400);
            }
        }

        const userConfig: UserConfig = {
            useSystemDefaults: body.useSystemDefaults,
            apiKey: body.apiKey,
            baseUrl: body.baseUrl,
            model: body.model,
        };

        await configManager.saveUserConfig(userConfig);

        // Return saved config with masked API key
        const response: UserConfigResponse = {
            useSystemDefaults: userConfig.useSystemDefaults,
            apiKey: configManager.maskApiKey(userConfig.apiKey),
            baseUrl: userConfig.baseUrl,
            model: userConfig.model,
        };

        return c.json(response);
    } catch (error) {
        logger.api.error("Failed to save config: {error}", { error });
        return c.json({ error: "Failed to save configuration" }, 500);
    }
}

/**
 * GET /api/config/system
 * Returns system default configuration info (without API key)
 */
export async function handleGetSystemConfig(c: Context) {
    try {
        const configManager = getConfigManager();
        const systemConfig = await configManager.getSystemConfig();

        const response: SystemConfigResponse = {
            hasSystemConfig: !!systemConfig.apiKey,
            baseUrl: systemConfig.baseUrl,
            model: systemConfig.model,
            // Never expose API key
        };

        return c.json(response);
    } catch (error) {
        logger.api.error("Failed to get system config: {error}", { error });
        return c.json({ error: "Failed to get system configuration" }, 500);
    }
}

/**
 * POST /api/config/test
 * Tests if provided API configuration is valid
 */
export async function handleTestConfig(c: Context) {
    try {
        const body = (await c.req.json()) as ConfigTestRequest;
        const configManager = getConfigManager();

        const isValid = await configManager.testConfig({
            apiKey: body.apiKey,
            baseUrl: body.baseUrl,
            model: body.model,
        });

        const response: ConfigTestResponse = {
            success: isValid,
            error: isValid ? undefined : "Invalid API configuration",
        };

        return c.json(response);
    } catch (error) {
        logger.api.error("Failed to test config: {error}", { error });
        return c.json(
            { success: false, error: "Failed to test configuration" },
            500,
        );
    }
}
