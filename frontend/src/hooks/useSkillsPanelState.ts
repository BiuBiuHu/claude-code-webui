import { useState, useEffect, useCallback } from "react";

const SKILLS_PANEL_OPEN_KEY = "claude-webui-skills-panel-open";
const SKILLS_PANEL_COLLAPSED_KEY = "claude-webui-skills-panel-collapsed";

export function useSkillsPanelState() {
  const [isOpen, setIsOpen] = useState(() => {
    // Load initial state from localStorage
    const saved = localStorage.getItem(SKILLS_PANEL_OPEN_KEY);
    return saved !== "false"; // Default to open
  });

  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Load initial state from localStorage
    const saved = localStorage.getItem(SKILLS_PANEL_COLLAPSED_KEY);
    return saved === "true";
  });

  // Persist state to localStorage
  useEffect(() => {
    localStorage.setItem(SKILLS_PANEL_OPEN_KEY, String(isOpen));
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem(SKILLS_PANEL_COLLAPSED_KEY, String(isCollapsed));
  }, [isCollapsed]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const collapse = useCallback(() => {
    setIsCollapsed(true);
  }, []);

  const expand = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  return {
    isOpen,
    isCollapsed,
    toggleOpen,
    toggleCollapse,
    open,
    close,
    collapse,
    expand,
  };
}
