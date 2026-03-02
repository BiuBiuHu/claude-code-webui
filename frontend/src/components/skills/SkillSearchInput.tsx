/**
 * SkillSearchInput Component
 * 技能搜索输入框组件
 * 支持实时搜索和清除功能
 */

import { forwardRef, useState, useCallback, useEffect } from "react";
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";

export interface SkillSearchInputProps {
  /** 搜索值 */
  value: string;
  /** 值变化回调 */
  onChange: (value: string) => void;
  /** 占位符文本 */
  placeholder?: string;
  /** 防抖延迟（毫秒） */
  debounceMs?: number;
  /** 是否禁用 */
  disabled?: boolean;
  /** 额外的类名 */
  className?: string;
  /** 自动聚焦 */
  autoFocus?: boolean;
}

/**
 * 技能搜索输入框
 * 实时搜索，带防抖，支持清除按钮
 */
export const SkillSearchInput = forwardRef<
  HTMLInputElement,
  SkillSearchInputProps
>(
  (
    {
      value,
      onChange,
      placeholder = "搜索技能...",
      debounceMs = 150,
      disabled = false,
      className = "",
      autoFocus = false,
    },
    ref,
  ) => {
    const [localValue, setLocalValue] = useState(value);

    // 同步外部 value 变化
    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    // 防抖处理
    useEffect(() => {
      if (localValue === value) return;

      const timer = setTimeout(() => {
        onChange(localValue);
      }, debounceMs);

      return () => clearTimeout(timer);
    }, [localValue, onChange, debounceMs, value]);

    /**
     * 处理输入变化
     */
    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
      },
      [],
    );

    /**
     * 清除搜索
     */
    const handleClear = useCallback(() => {
      setLocalValue("");
      onChange("");
    }, [onChange]);

    /**
     * 处理键盘事件
     * Escape 键清空搜索
     */
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
          handleClear();
        }
      },
      [handleClear],
    );

    return (
      <div className={className}>
        <div className="relative">
          {/* 搜索图标 */}
          <MagnifyingGlassIcon
            className="
              absolute left-3 top-1/2 -translate-y-1/2
              w-4 h-4 text-slate-400 dark:text-slate-500
              pointer-events-none
            "
            aria-hidden="true"
          />

          {/* 输入框 */}
          <input
            ref={ref}
            type="text"
            value={localValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            className="
              w-full pl-10 pr-8 py-2
              bg-slate-100 dark:bg-slate-900/50
              border border-slate-200 dark:border-slate-700
              rounded-lg
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
              text-sm text-slate-800 dark:text-slate-100
              placeholder-slate-400 dark:placeholder-slate-500
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            "
            aria-label="搜索技能"
          />

          {/* 清除按钮 */}
          {localValue && (
            <button
              type="button"
              onClick={handleClear}
              className="
                absolute right-2 top-1/2 -translate-y-1/2
                p-1 rounded
                hover:bg-slate-200 dark:hover:bg-slate-700
                transition-colors
                text-slate-400 hover:text-slate-600
                dark:hover:text-slate-300
              "
              aria-label="清除搜索"
            >
              <XMarkIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  },
);

SkillSearchInput.displayName = "SkillSearchInput";
