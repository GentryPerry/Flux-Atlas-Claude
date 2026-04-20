import { useState, useRef, useEffect, useCallback } from 'react';
import { CaretDown } from '@phosphor-icons/react';

/**
 * CustomSelect — a fully styled dropdown that replaces native <select>.
 * Matches the app's dark theme; the popup renders in --bg-elevated.
 *
 * Props:
 *   value        — current value string
 *   onChange     — (value: string) => void
 *   options      — [{ value, label }] OR [string, ...]
 *   placeholder  — string shown when value is empty
 *   style        — extra style on the trigger button
 *   className    — extra class on the trigger button
 *   disabled     — bool
 */
export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  style,
  className = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);

  // Normalize options to { value, label }
  const normalized = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  );

  const current = normalized.find((o) => o.value === value);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, close]);

  const handleSelect = (val) => {
    onChange(val);
    close();
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!open) {
      // Detect if the dropdown would clip below the viewport; if so, open upward
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        const spaceBelow = window.innerHeight - rect.bottom;
        setOpenUp(spaceBelow < 260); // 260 = max-height of dropdown
      }
    }
    setOpen((v) => !v);
  };

  return (
    <div
      ref={containerRef}
      className={`custom-select-wrap ${className}`}
      style={{ position: 'relative', ...style }}
    >
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        className="custom-select-trigger"
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={current ? 'custom-select-value' : 'custom-select-placeholder'}>
          {current ? current.label : placeholder}
        </span>
        <CaretDown
          size={12}
          style={{
            flexShrink: 0,
            transition: 'transform 0.15s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Dropdown — flips upward when near the bottom of the viewport */}
      {open && (
        <div
          className="custom-select-dropdown"
          role="listbox"
          style={openUp ? { top: 'auto', bottom: 'calc(100% + 4px)' } : undefined}
        >
          {normalized.map((opt) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              className={`custom-select-option ${opt.value === value ? 'selected' : ''}`}
              onMouseDown={() => handleSelect(opt.value)}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
