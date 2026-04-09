import * as React from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";

type Option = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
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
      children?: React.ReactNode;
    }>;

    if (optionChild.type === React.Fragment) {
      return parseOptions(optionChild.props.children);
    }

    if (optionChild.type !== "option") return [];

    const valueProp = optionChild.props.value;
    const label = optionChild.props.children;

    return [
      {
        value: valueProp == null ? "" : String(valueProp),
        label,
        disabled: Boolean(optionChild.props.disabled),
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
  name,
  required,
}: Props) {
  const options = React.useMemo(() => parseOptions(children), [children]);
  const isControlled = value != null;
  const [internalValue, setInternalValue] = React.useState(defaultValue == null ? "" : String(defaultValue));
  const [open, setOpen] = React.useState(false);
  const [highlightedValue, setHighlightedValue] = React.useState<string | null>(null);

  const selectedValue = isControlled ? String(value ?? "") : internalValue;
  const selectedOption = options.find((option) => option.value === selectedValue);
  const placeholderOption = options.find((option) => option.value === "");
  const selectableOptions = options.filter((option) => option.value !== "");
  const enabledOptionsCount = selectableOptions.filter((option) => !option.disabled).length;
  const triggerLabel = selectedOption?.label ?? placeholder ?? placeholderOption?.label ?? "";
  const renderedValue = renderValue?.(selectedOption) ?? triggerLabel;
  const isPlaceholder =
    selectedOption == null ||
    selectedValue === "" ||
    (selectedOption.disabled && selectedOption.value === "");

  const handleValueChange = React.useCallback((nextValue: string) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onChange?.(createChangeEvent(nextValue));
  }, [isControlled, onChange]);

  React.useEffect(() => {
    if (!open) {
      setHighlightedValue(null);
      return;
    }

    setHighlightedValue(selectedOption?.value ?? selectableOptions.find((option) => !option.disabled)?.value ?? null);
  }, [open, selectableOptions, selectedOption]);

  return (
    <label className="block min-w-0">
      {label && <span className="mb-1 block text-sm font-medium text-muted">{label}</span>}

      <RadixSelect.Root
        value={selectedValue}
        onValueChange={handleValueChange}
        open={open}
        onOpenChange={setOpen}
        disabled={disabled || enabledOptionsCount === 0}
        name={name}
        required={required}
      >
        <RadixSelect.Trigger
          id={id}
          aria-label={ariaLabel}
          style={style}
          className={[
            "border-subtle bg-surface focus:ring-default relative flex h-10 w-full items-center rounded-2xl border px-4 pr-10 text-left text-sm outline-none transition",
            "disabled:cursor-not-allowed disabled:bg-app disabled:text-muted data-[placeholder]:text-muted focus:ring-2",
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
                    width: "var(--radix-select-trigger-width)",
                    maxHeight: "min(24rem, calc(100vh - 16px))",
                  }
                : {
                    maxHeight: "min(24rem, calc(100vh - 16px))",
                  }
            }
          >
            <RadixSelect.ScrollUpButton className="bg-surface/96 text-muted flex h-7 items-center justify-center border-b">
              <ChevronUp className="h-4 w-4" />
            </RadixSelect.ScrollUpButton>

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
                      <div className="min-w-0 flex-1 truncate">
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

            <RadixSelect.ScrollDownButton className="bg-surface/96 text-muted flex h-7 items-center justify-center border-t">
              <ChevronDown className="h-4 w-4" />
            </RadixSelect.ScrollDownButton>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
