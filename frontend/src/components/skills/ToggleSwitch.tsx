/**
 * ToggleSwitch Component
 * 开关组件
 * 用于切换技能启用/禁用状态
 */

import { forwardRef } from "react";

export interface ToggleSwitchProps {
  /** 是否启用 */
  enabled: boolean;
  /** 状态变化回调 */
  onChange?: (enabled: boolean) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 组件名称（用于无障碍） */
  name?: string;
  /** ARIA 标签 */
  ariaLabel?: string;
  /** 额外的类名 */
  className?: string;
}

/**
 * 开关组件
 * 完全遵循 UI 规范的样式和 ARIA 属性
 */
export const ToggleSwitch = forwardRef<HTMLButtonElement, ToggleSwitchProps>(
  (
    { enabled, onChange, disabled = false, name, ariaLabel, className = "" },
    ref,
  ) => {
    const handleClick = () => {
      if (!disabled && onChange) {
        onChange(!enabled);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) return;

      // 支持 Space 和 Enter 键切换
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleClick();
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={ariaLabel}
        aria-disabled={disabled}
        name={name}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full
          transition-colors duration-200 focus:outline-none
          focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          dark:focus:ring-offset-slate-900
          ${enabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          ${className}
        `}
      >
        <span
          className={`
            inline-block h-5 w-5 transform rounded-full bg-white
            transition-transform duration-200
            ${enabled ? "translate-x-6" : "translate-x-1"}
          `}
          aria-hidden="true"
        />
        <span className="sr-only">{enabled ? "已启用" : "已禁用"}</span>
      </button>
    );
  },
);

ToggleSwitch.displayName = "ToggleSwitch";
