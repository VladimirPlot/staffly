import { Trash2 } from "lucide-react";
import IconButton from "../../../../../shared/ui/IconButton";
import Input from "../../../../../shared/ui/Input";
import ChoiceIndicator from "./ChoiceIndicator";

type Props = {
  index: number;
  label: string;
  value: string;
  checked: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
  onRemove?: () => void;
  removeDisabled?: boolean;
  error?: string;
  toggleAriaLabel: string;
  className?: string;
};

export default function QuestionOptionRow({
  index,
  label,
  value,
  checked,
  onToggle,
  onChange,
  onRemove,
  removeDisabled,
  error,
  toggleAriaLabel,
  className = "",
}: Props) {
  return (
    <div
      className={[
        "flex min-w-0 items-start gap-3",
        index > 0 ? "border-subtle border-t pt-3" : "",
        className,
      ].join(" ")}
    >
      <ChoiceIndicator
        checked={checked}
        ariaLabel={toggleAriaLabel}
        className="mt-9"
        onClick={onToggle}
      />

      <div className="min-w-0 flex-1">
        <Input label={label} value={value} onChange={(e) => onChange(e.target.value)} error={error} />
      </div>

      {onRemove && (
        <div className="shrink-0 pt-9">
          <IconButton disabled={removeDisabled} onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      )}
    </div>
  );
}
