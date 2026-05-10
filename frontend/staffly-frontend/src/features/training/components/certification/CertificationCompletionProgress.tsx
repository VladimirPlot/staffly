type ProgressPreset = "sm" | "md" | "lg";

type Props = {
  completed: number;
  assigned: number;
  size?: number;
  preset?: ProgressPreset;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

const PRESET_STYLES: Record<
  ProgressPreset,
  {
    percentClassName: string;
    ratioClassName: string;
  }
> = {
  sm: {
    percentClassName: "text-2xl",
    ratioClassName: "text-xs",
  },
  md: {
    percentClassName: "text-3xl",
    ratioClassName: "text-sm",
  },
  lg: {
    percentClassName: "text-3xl",
    ratioClassName: "text-sm",
  },
};

export default function CertificationCompletionProgress({
  completed,
  assigned,
  size = 88,
  preset = "lg",
}: Props) {
  const normalizedCompleted = Math.max(0, completed);
  const normalizedAssigned = Math.max(0, assigned);
  const percentRaw =
    normalizedAssigned > 0 ? (normalizedCompleted / normalizedAssigned) * 100 : 0;
  const percent = clampPercent(percentRaw);

  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percent / 100);

  const styles = PRESET_STYLES[preset];

  return (
    <div
      className="flex flex-col items-center justify-center"
      aria-label="Прогресс завершения аттестации"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--staffly-border)"
            className="opacity-70"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--staffly-text-strong)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: "stroke-dashoffset 420ms ease" }}
            className="motion-reduce:transition-none"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div
            className={`font-semibold leading-none text-strong ${styles.percentClassName}`}
          >
            {Math.round(percent)}%
          </div>
          <div
            className={`mt-1 leading-none text-muted ${styles.ratioClassName}`}
          >
            {normalizedCompleted}/{normalizedAssigned}
          </div>
        </div>
      </div>
    </div>
  );
}
