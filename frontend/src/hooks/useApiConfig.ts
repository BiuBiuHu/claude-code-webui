import { useState, useEffect } from "react";
import type {
    UserConfigResponse,
    SystemConfigResponse,
    SaveConfigRequest,
    ConfigTestResponse,
} from "../../../shared/types";

const API_BASE = "";

export function useApiConfig() {
    const [config, setConfig] = useState<UserConfigResponse | null>(null);
    const [systemConfig, setSystemConfig] = useState<SystemConfigResponse | null>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [testing, setTesting] = useState(false);

    // Load config on mount
    useEffect(() => {
        loadConfig();
        loadSystemConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/api/config`);
            if (!response.ok) {
                throw new Error("Failed to load configuration");
            }
            const data = await response.json();
            setConfig(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load config");
        } finally {
            setLoading(false);
        }
    };

    const loadSystemConfig = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/config/system`);
            if (!response.ok) {
                throw new Error("Failed to load system configuration");
            }
            const data = await response.json();
            setSystemConfig(data);
        } catch (err) {
            console.error("Failed to load system config:", err);
        }
    };

    const saveConfig = async (newConfig: SaveConfigRequest) => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE}/api/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newConfig),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to save configuration");
            }

            const data = await response.json();
            setConfig(data);
            setError(null);
            return { success: true };
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save config";
            setError(message);
            return { success: false, error: message };
        } finally {
            setLoading(false);
        }
    };

    const testConfig = async (
        apiKey: string,
        baseUrl?: string,
        model?: string,
    ): Promise<ConfigTestResponse> => {
        try {
            setTesting(true);
            const response = await fetch(`${API_BASE}/api/config/test`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apiKey, baseUrl, model }),
            });

            if (!response.ok) {
                throw new Error("Failed to test configuration");
            }

            const data: ConfigTestResponse = await response.json();
            return data;
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : "Failed to test config",
            };
        } finally {
            setTesting(false);
        }
    };

    return {
        config,
        systemConfig,
        loading,
        error,
        testing,
        saveConfig,
        testConfig,
        reload: loadConfig,
    };
}
