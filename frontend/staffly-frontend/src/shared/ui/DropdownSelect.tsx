import * as React from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

const DROPDOWN_SELECT_OPEN_EVENT = "staffly:dropdown-select-open";
const EMPTY_OPTION_VALUE = "__staffly_select_empty__";

type Option = {
  value: string;
  rawValue: string;
  label: React.ReactNode;
  disabled?: boolean;
  hidden?: boolean;
  textValue: string;
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
  triggerVariant?: "default" | "plain";
};

function getNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join(" ").trim();
  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return getNodeText(element.props.children);
  }
  return "";
}

function parseOptions(children: React.ReactNode): Option[] {
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) return [];

    const optionChild = child as React.ReactElement<{
      value?: string | number;
      disabled?: boolean;
      hidden?: boolean;
      children?: React.ReactNode;
    }>;

    if (optionChild.type === React.Fragment) {
      return parseOptions(optionChild.props.children);
    }

    if (optionChild.type !== "option") return [];

    const valueProp = optionChild.props.value;
    const label = optionChild.props.children;
    const rawValue = valueProp == null ? "" : String(valueProp);

    return [
      {
        value: rawValue === "" ? EMPTY_OPTION_VALUE : rawValue,
        rawValue,
        label,
        disabled: Boolean(optionChild.props.disabled),
        hidden: Boolean(optionChild.props.hidden),
        textValue: getNodeText(label),
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
  triggerVariant = "default",
  name,
  required,
}: Props) {
  const instanceId = React.useId();
  const labelId = React.useId();
  const options = React.useMemo(() => parseOptions(children), [children]);
  const isControlled = value != null;
  const [internalValue, setInternalValue] = React.useState(defaultValue == null ? "" : String(defaultValue));
  const [open, setOpen] = React.useState(false);
  const [highlightedValue, setHighlightedValue] = React.useState<string | null>(null);

  const rawSelectedValue = isControlled ? String(value ?? "") : internalValue;
  const hasEmptyOption = options.some((option) => option.rawValue === "");
  const selectedValue = rawSelectedValue === "" && hasEmptyOption ? EMPTY_OPTION_VALUE : rawSelectedValue;
  const selectedOption = options.find((option) => option.rawValue === rawSelectedValue);
  const placeholderOption = options.find((option) => option.rawValue === "");
  const selectableOptions = options.filter((option) => !option.hidden);
  const enabledOptionsCount = selectableOptions.filter((option) => !option.disabled).length;
  const triggerLabel = selectedOption?.label ?? placeholder ?? placeholderOption?.label ?? "";
  const renderedValue = renderValue?.(selectedOption) ?? triggerLabel;
  const isPlaceholder =
    selectedOption == null ||
    (rawSelectedValue === "" && !hasEmptyOption) ||
    (selectedOption.disabled && selectedOption.rawValue === "");
  const triggerBaseClassName =
    triggerVariant === "plain"
      ? [
          "relative flex h-10 w-full items-center text-left text-sm outline-none transition",
          "disabled:cursor-not-allowed disabled:text-muted data-[placeholder]:text-muted",
        ].join(" ")
      : [
          "border-subtle bg-surface focus:ring-default relative flex h-10 w-full items-center rounded-2xl border px-4 pr-10 text-left text-sm outline-none transition",
          "disabled:cursor-not-allowed disabled:bg-app disabled:text-muted data-[placeholder]:text-muted focus:ring-2",
        ].join(" ");

  const handleValueChange = React.useCallback((nextValue: string) => {
    const nextRawValue = nextValue === EMPTY_OPTION_VALUE ? "" : nextValue;

    if (!isControlled) {
      setInternalValue(nextRawValue);
    }

    onChange?.(createChangeEvent(nextRawValue));
  }, [isControlled, onChange]);

  React.useEffect(() => {
    if (!open) {
      setHighlightedValue(null);
      return;
    }

    setHighlightedValue(selectedOption?.value ?? selectableOptions.find((option) => !option.disabled)?.value ?? null);
  }, [open, selectableOptions, selectedOption]);

  React.useEffect(() => {
    const handleAnotherSelectOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ instanceId: string }>;

      if (customEvent.detail.instanceId !== instanceId) {
        setOpen(false);
      }
    };

    window.addEventListener(DROPDOWN_SELECT_OPEN_EVENT, handleAnotherSelectOpen);
    return () => window.removeEventListener(DROPDOWN_SELECT_OPEN_EVENT, handleAnotherSelectOpen);
  }, [instanceId]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        window.dispatchEvent(
          new CustomEvent(DROPDOWN_SELECT_OPEN_EVENT, {
            detail: { instanceId },
          }),
        );
      }

      setOpen(nextOpen);
    },
    [instanceId],
  );

  return (
    <div className="block min-w-0">
      {label && (
        <span id={labelId} className="mb-1 block text-sm font-medium text-muted">
          {label}
        </span>
      )}

      <RadixSelect.Root
        value={selectedValue}
        onValueChange={handleValueChange}
        open={open}
        onOpenChange={handleOpenChange}
        disabled={disabled || enabledOptionsCount === 0}
        required={required}
      >
        <RadixSelect.Trigger
          id={id}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : label ? labelId : undefined}
          style={style}
          className={[
            triggerBaseClassName,
            error ? "border-red-500 ring-red-200" : "",
            className,
            triggerClassName,
          ].join(" ")}
        >
          <span className={`block min-w-0 flex-1 truncate ${isPlaceholder ? "text-muted" : "text-default"}`}>
            {renderedValue}
          </span>

          <RadixSelect.Icon asChild>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content
            position="popper"
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={8}
            className={[
              "border-subtle bg-surface z-[1010] overflow-hidden rounded-[1.5rem] border shadow-[var(--staffly-shadow)]",
              "data-[side=bottom]:animate-in data-[side=top]:animate-in",
              menuClassName,
            ].join(" ")}
            style={
              matchTriggerWidth
                ? {
                    minWidth: "var(--radix-select-trigger-width)",
                    width: "max-content",
                    maxHeight: "min(24rem, calc(100vh - 16px))",
                    maxWidth: "min(24rem, calc(100vw - 16px))",
                  }
                : {
                  maxHeight: "min(24rem, calc(100vh - 16px))",
                }
            }
          >
            <RadixSelect.Viewport className="no-scrollbar max-h-[inherit] overflow-y-auto p-1">
              {selectableOptions.map((option) => {
                const selected = option.value === selectedValue;
                const active = option.value === highlightedValue;

                return (
                  <RadixSelect.Item
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                    textValue={option.textValue}
                    className={[
                      "text-default relative flex w-full cursor-default items-center justify-between rounded-xl px-3 py-2 text-left text-sm outline-none",
                      "data-[disabled]:cursor-not-allowed data-[disabled]:text-muted/60",
                      "data-[highlighted]:bg-app",
                    ].join(" ")}
                    onFocus={() => setHighlightedValue(option.value)}
                    onPointerMove={() => setHighlightedValue(option.value)}
                  >
                    <RadixSelect.ItemText asChild>
                      <div className="min-w-0 flex-1 whitespace-nowrap">
                        {renderOption?.(option, { selected, active }) ?? option.label}
                      </div>
                    </RadixSelect.ItemText>

                    <RadixSelect.ItemIndicator asChild>
                      <Check className="ml-3 h-4 w-4 shrink-0 text-default" />
                    </RadixSelect.ItemIndicator>
                  </RadixSelect.Item>
                );
              })}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

      {name && <input type="hidden" name={name} value={rawSelectedValue} disabled={disabled} />}

      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  );
}
