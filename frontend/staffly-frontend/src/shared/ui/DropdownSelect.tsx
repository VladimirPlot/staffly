import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import DropdownMenu from "./DropdownMenu";

type Option = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  label?: string;
  error?: string;
  children?: React.ReactNode;
  triggerClassName?: string;
  menuClassName?: string;
  placeholder?: React.ReactNode;
  renderValue?: (option: Option | undefined) => React.ReactNode;
  renderOption?: (option: Option, state: { selected: boolean; active: boolean }) => React.ReactNode;
  matchTriggerWidth?: boolean;
};

function parseOptions(children: React.ReactNode): Option[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) return [];
    const optionChild = child as React.ReactElement<{
      value?: string | number;
      disabled?: boolean;
      children?: React.ReactNode;
    }>;

    if (optionChild.type === React.Fragment) {
      return parseOptions(optionChild.props.children);
    }
    if (optionChild.type !== "option") return [];

    const valueProp = optionChild.props.value;
    return [
      {
        value: valueProp == null ? "" : String(valueProp),
        label: optionChild.props.children,
        disabled: Boolean(optionChild.props.disabled),
      },
    ];
  });
}

function createChangeEvent(value: string) {
  return {
    target: { value },
    currentTarget: { value },
  } as React.ChangeEvent<HTMLSelectElement>;
}

function findNextEnabledIndex(options: Option[], startIndex: number, direction: 1 | -1) {
  if (options.length === 0) return -1;

  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (startIndex + offset * direction + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }

  return -1;
}

export default function DropdownSelect({
  label,
  error,
  className = "",
  triggerClassName = "",
  menuClassName = "",
  children,
  value,
  defaultValue,
  onChange,
  disabled = false,
  placeholder,
  renderValue,
  renderOption,
  "aria-label": ariaLabel,
  id,
  style,
  matchTriggerWidth = true,
}: Props) {
  const options = useMemo(() => parseOptions(children), [children]);
  const isControlled = value != null;
  const [internalValue, setInternalValue] = useState(defaultValue == null ? "" : String(defaultValue));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listId = useId();

  const selectedValue = isControlled ? String(value ?? "") : internalValue;
  const selectedOption = options.find((option) => option.value === selectedValue);
  const selectedIndex = options.findIndex((option) => option.value === selectedValue && !option.disabled);
  const enabledOptionsCount = options.filter((option) => !option.disabled).length;
  const placeholderOption = options.find((option) => option.value === "");
  const triggerLabel = selectedOption?.label ?? placeholder ?? placeholderOption?.label ?? "";
  const renderedValue = renderValue?.(selectedOption) ?? triggerLabel;
  const isPlaceholder =
    selectedOption == null ||
    selectedValue === "" ||
    (selectedOption.disabled && selectedOption.value === "");

  useEffect(() => {
    if (!open) return;

    const nextIndex = selectedIndex >= 0 ? selectedIndex : findNextEnabledIndex(options, 0, 1);
    setActiveIndex(nextIndex);
  }, [open, options, selectedIndex]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    itemRefs.current[activeIndex]?.focus();
  }, [activeIndex, open]);

  const commitValue = (nextValue: string, shouldRestoreFocus = true) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onChange?.(createChangeEvent(nextValue));
    setOpen(false);

    if (shouldRestoreFocus) {
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || enabledOptionsCount === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen(true);
    }
  };

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, close: () => void) => {
    if (options.length === 0) return;

    if (event.key === "Tab") {
      setOpen(false);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      close();
      window.requestAnimationFrame(() => triggerRef.current?.focus());
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const baseIndex = activeIndex >= 0 ? activeIndex + 1 : 0;
      setActiveIndex(findNextEnabledIndex(options, baseIndex, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const baseIndex = activeIndex >= 0 ? activeIndex - 1 : options.length - 1;
      setActiveIndex(findNextEnabledIndex(options, baseIndex, -1));
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(findNextEnabledIndex(options, 0, 1));
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(findNextEnabledIndex(options, options.length - 1, -1));
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && activeIndex >= 0) {
      event.preventDefault();
      const option = options[activeIndex];
      if (!option?.disabled) {
        commitValue(option.value);
      }
    }
  };

  return (
    <label className="block min-w-0">
      {label && <span className="mb-1 block text-sm font-medium text-muted">{label}</span>}

      <DropdownMenu
        open={open}
        onOpenChange={setOpen}
        disabled={disabled || enabledOptionsCount === 0}
        triggerWrapperClassName="relative flex w-full"
        menuClassName={`max-w-[calc(100vw-16px)] ${menuClassName}`.trim()}
        alignClassName="left-0"
        matchTriggerWidth={matchTriggerWidth}
        trigger={(triggerProps) => (
          <button
            {...triggerProps}
            ref={triggerRef}
            id={id}
            type="button"
            aria-label={ariaLabel}
            aria-haspopup="listbox"
            aria-controls={listId}
            onKeyDown={handleTriggerKeyDown}
            style={style}
            className={[
              "border-subtle bg-surface focus:ring-default relative h-10 w-full rounded-2xl border px-4 pr-10 text-left text-sm outline-none transition",
              "disabled:cursor-not-allowed disabled:bg-app disabled:text-muted focus:ring-2",
              error ? "border-red-500 ring-red-200" : "",
              className,
              triggerClassName,
            ].join(" ")}
            disabled={disabled}
          >
            <span className={`block truncate ${isPlaceholder ? "text-muted" : "text-default"}`}>{renderedValue}</span>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </button>
        )}
      >
        {({ close }) => (
          <div
            id={listId}
            role="listbox"
            aria-label={label ?? ariaLabel}
            aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
            className="space-y-1 p-1"
            onKeyDown={(event) => handleMenuKeyDown(event, close)}
          >
            {options.map((option, index) => {
              const selected = option.value === selectedValue;
              const active = index === activeIndex;

              return (
                <button
                  key={`${option.value}-${index}`}
                  id={`${listId}-option-${index}`}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={option.disabled}
                  tabIndex={active ? 0 : -1}
                  className={[
                    "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm",
                    option.disabled ? "cursor-not-allowed text-muted/60" : "text-default hover:bg-app",
                    active ? "bg-app" : "",
                  ].join(" ")}
                  onMouseEnter={() => {
                    if (!option.disabled) setActiveIndex(index);
                  }}
                  onClick={() => {
                    if (option.disabled) return;
                    commitValue(option.value);
                  }}
                >
                  <div className="min-w-0 flex-1 truncate">
                    {renderOption?.(option, { selected, active }) ?? option.label}
                  </div>
                  {selected && <Check className="ml-3 h-4 w-4 shrink-0 text-default" />}
                </button>
              );
            })}
          </div>
        )}
      </DropdownMenu>

      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
