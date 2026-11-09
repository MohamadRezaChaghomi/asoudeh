'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SelectProps {
  id: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

export function Select({
  id,
  value,
  options,
  onChange,
  className = '',
  disabled = false,
  required = false,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
}: SelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selectedOption = options[selectedIndex];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function focusOption(index: number) {
    const enabled = options
      .map((option, optionIndex) => ({ option, optionIndex }))
      .filter(({ option }) => !option.disabled);
    if (!enabled.length) return;
    const boundedIndex = Math.max(0, Math.min(index, options.length - 1));
    const nextIndex = options[boundedIndex]?.disabled
      ? enabled.reduce((closest, item) =>
          Math.abs(item.optionIndex - boundedIndex) < Math.abs(closest.optionIndex - boundedIndex)
            ? item
            : closest,
        ).optionIndex
      : boundedIndex;
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => optionRefs.current[nextIndex]?.focus());
  }

  function openListbox(index = selectedIndex >= 0 ? selectedIndex : 0) {
    setOpen(true);
    focusOption(index);
  }

  function closeListbox(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function chooseOption(option: SelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    closeListbox(true);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (open && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) chooseOption(option);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!open) {
        openListbox(event.key === 'ArrowUp' ? options.length - 1 : undefined);
      } else {
        const step = event.key === 'ArrowUp' ? -1 : 1;
        focusOption(activeIndex + step);
      }
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeListbox(true);
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeListbox(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const enabled = options
        .map((option, index) => ({ option, index }))
        .filter(({ option }) => !option.disabled);
      focusOption(event.key === 'Home' ? enabled[0]?.index ?? 0 : enabled.at(-1)?.index ?? 0);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) chooseOption(option);
    } else if (event.key === 'Tab') {
      closeListbox(false);
    }
  }

  return (
    <div className="relative min-w-0" dir="rtl" ref={rootRef}>
      <button
        aria-controls={`${id}-listbox`}
        aria-describedby={ariaDescribedBy}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={ariaInvalid}
        aria-required={required || undefined}
        className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-start text-[var(--text)] shadow-sm hover:border-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
        data-value={value}
        disabled={disabled}
        id={id}
        onClick={() => (open ? closeListbox(false) : openListbox())}
        onKeyDown={handleTriggerKeyDown}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        <span className="truncate">{selectedOption?.label ?? ''}</span>
        <ChevronDown aria-hidden="true" className="shrink-0 text-[var(--text-muted)]" size={18} />
      </button>
      {open && (
        <div
          className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-[120] max-h-64 overflow-y-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-1.5 text-[var(--text)] shadow-[var(--shadow-float)]"
          onKeyDown={handleOptionKeyDown}
        >
          <ul
            aria-labelledby={id}
            className="m-0 list-none p-0"
            id={`${id}-listbox`}
            role="listbox"
            aria-activedescendant={`${id}-option-${activeIndex}`}
          >
            {options.map((option, index) => (
              <li key={option.value} role="presentation">
                <button
                  aria-selected={option.value === value}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start hover:bg-[var(--surface-muted)] focus-visible:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                  data-value={option.value}
                  disabled={option.disabled}
                  id={`${id}-option-${index}`}
                  onClick={() => chooseOption(option)}
                  onFocus={() => setActiveIndex(index)}
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  role="option"
                  tabIndex={activeIndex === index ? 0 : -1}
                  type="button"
                >
                  <span>{option.label}</span>
                  {option.value === value && (
                    <Check aria-hidden="true" className="shrink-0 text-[var(--brand-700)]" size={18} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
