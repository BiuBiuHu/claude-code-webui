import { useState, useEffect } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useApiConfig } from "../../hooks/useApiConfig";

export function ApiSettings() {
    const { config, systemConfig, loading, testing, saveConfig, testConfig } =
        useApiConfig();

    const [useSystemDefaults, setUseSystemDefaults] = useState(true);
    const [apiKey, setApiKey] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [model, setModel] = useState("");
    const [showApiKey, setShowApiKey] = useState(false);
    const [testResult, setTestResult] = useState<{
        success: boolean;
        message: string;
    } | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Load config into form
    useEffect(() => {
        if (config) {
            setUseSystemDefaults(config.useSystemDefaults);
            setApiKey(config.apiKey || "");
            setBaseUrl(config.baseUrl || "");
            setModel(config.model || "");
        }
    }, [config]);

    const handleSave = async () => {
        setIsSaving(true);
        setTestResult(null);

        const result = await saveConfig({
            useSystemDefaults,
            apiKey: useSystemDefaults ? undefined : apiKey,
            baseUrl: useSystemDefaults ? undefined : baseUrl,
            model: useSystemDefaults ? undefined : model,
        });

        setIsSaving(false);

        if (result.success) {
            setTestResult({ success: true, message: "Configuration saved successfully!" });
        } else {
            setTestResult({
                success: false,
                message: result.error || "Failed to save configuration",
            });
        }
    };

    const handleTestConnection = async () => {
        setTestResult(null);

        if (!apiKey && !useSystemDefaults) {
            setTestResult({ success: false, message: "API Key is required" });
            return;
        }

        const result = await testConfig(
            useSystemDefaults ? "" : apiKey,
            baseUrl,
            model,
        );

        setTestResult({
            success: result.success,
            message: result.success
                ? "Connection test successful!"
                : result.error || "Connection test failed",
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    API Configuration
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                    Configure Anthropic API settings for Claude Code
                </p>
            </div>

            {/* Use System Defaults Toggle */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div>
                    <label
                        htmlFor="useSystemDefaults"
                        className="text-sm font-medium text-slate-900 dark:text-slate-100"
                    >
                        Use System Defaults
                    </label>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        Use settings from{" "}
                        <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-xs">
                            ~/.claude/settings.json
                        </code>
                    </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        id="useSystemDefaults"
                        checked={useSystemDefaults}
                        onChange={(e) => setUseSystemDefaults(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {/* System Config Info */}
            {useSystemDefaults && systemConfig && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-2">
                        {systemConfig.hasSystemConfig
                            ? "✓ System configuration found"
                            : "⚠ No system configuration found"}
                    </p>
                    {systemConfig.hasSystemConfig && (
                        <div className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                            {systemConfig.baseUrl && (
                                <p>
                                    Base URL:{" "}
                                    <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">
                                        {systemConfig.baseUrl}
                                    </code>
                                </p>
                            )}
                            {systemConfig.model && (
                                <p>
                                    Model:{" "}
                                    <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900 rounded">
                                        {systemConfig.model}
                                    </code>
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Custom Configuration Form */}
            {!useSystemDefaults && (
                <div className="space-y-4">
                    {/* API Key */}
                    <div>
                        <label
                            htmlFor="apiKey"
                            className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2"
                        >
                            API Key <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showApiKey ? "text" : "password"}
                                id="apiKey"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="sk-ant-..."
                                className="w-full px-3 py-2 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                            >
                                {showApiKey ? (
                                    <EyeSlashIcon className="w-5 h-5" />
                                ) : (
                                    <EyeIcon className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Base URL */}
                    <div>
                        <label
                            htmlFor="baseUrl"
                            className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2"
                        >
                            Base URL
                        </label>
                        <input
                            type="text"
                            id="baseUrl"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="https://api.anthropic.com"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Model */}
                    <div>
                        <label
                            htmlFor="model"
                            className="block text-sm font-medium text-slate-900 dark:text-slate-100 mb-2"
                        >
                            Model
                        </label>
                        <input
                            type="text"
                            id="model"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="claude-sonnet-4-20250514"
                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                </div>
            )}

            {/* Test Result */}
            {testResult && (
                <div
                    className={`p-3 rounded-lg ${testResult.success
                            ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-900 dark:text-green-100"
                            : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100"
                        }`}
                >
                    <p className="text-sm font-medium">{testResult.message}</p>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                    onClick={handleTestConnection}
                    disabled={testing || isSaving}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {testing ? "Testing..." : "Test Connection"}
                </button>
                <button
                    onClick={handleSave}
                    disabled={isSaving || testing}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                    {isSaving ? "Saving..." : "Save Configuration"}
                </button>
            </div>
        </div>
    );
}
