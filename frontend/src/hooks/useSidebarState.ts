import { useState, useEffect, useCallback } from "react";

const SIDEBAR_COLLAPSED_KEY = "claude-webui-sidebar-collapsed";

export function useSidebarState() {
    const [isCollapsed, setIsCollapsed] = useState(() => {
        // Load initial state from localStorage
        const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        return saved === "true";
    });

    // Persist state to localStorage
    useEffect(() => {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isCollapsed));
    }, [isCollapsed]);

    const toggleSidebar = useCallback(() => {
        setIsCollapsed((prev) => !prev);
    }, []);

    const collapseSidebar = useCallback(() => {
        setIsCollapsed(true);
    }, []);

    const expandSidebar = useCallback(() => {
        setIsCollapsed(false);
    }, []);

    return {
        isCollapsed,
        toggleSidebar,
        collapseSidebar,
        expandSidebar,
    };
}
