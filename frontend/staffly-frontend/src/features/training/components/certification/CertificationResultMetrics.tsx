type MetricsPreset = "sm" | "md";

type Props = {
  passedCount: number;
  failedCount: number;
  passedLabel?: string;
  failedLabel?: string;
  preset?: MetricsPreset;
};

function MetricPill({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={className}>
      <span>{label}: </span>
      <span className="font-medium text-default">{value}</span>
    </div>
  );
}

const PRESET_STYLES: Record<
  MetricsPreset,
  {
    wrapperClassName: string;
    pillClassName: string;
  }
> = {
  sm: {
    wrapperClassName: "w-[120px]",
    pillClassName: "rounded-lg bg-app px-2.5 py-1 text-[11px] text-muted",
  },
  md: {
    wrapperClassName: "w-[132px]",
    pillClassName: "rounded-lg bg-app px-3 py-1.5 text-xs text-muted",
  },
};

export default function CertificationResultMetrics({
  passedCount,
  failedCount,
  passedLabel = "Сдали",
  failedLabel = "Не сдали",
  preset = "md",
}: Props) {
  const styles = PRESET_STYLES[preset];

  return (
    <div className={`flex flex-col gap-1 ${styles.wrapperClassName}`}>
      <MetricPill
        label={passedLabel}
        value={passedCount}
        className={styles.pillClassName}
      />
      <MetricPill
        label={failedLabel}
        value={failedCount}
        className={styles.pillClassName}
      />
    </div>
  );
}
