import SelectField from "../../../shared/ui/SelectField";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

type TimeSelectProps = {
  label?: string;
  hour: number | "";
  minute: number | "";
  onHourChange: (value: number | "") => void;
  onMinuteChange: (value: number | "") => void;
};

const TimeSelect = ({
  label,
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: TimeSelectProps) => {
  return (
    <div>
      {label && <div className="mb-1 text-sm font-medium text-default">{label}</div>}
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Часы"
          value={hour === "" ? "" : String(hour)}
          onChange={(event) => {
            const value = event.target.value;
            onHourChange(value === "" ? "" : Number(value));
          }}
        >
          <option value="">--</option>
          {HOURS.map((value) => (
            <option key={value} value={value}>
              {String(value).padStart(2, "0")}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Минуты"
          value={minute === "" ? "" : String(minute)}
          onChange={(event) => {
            const value = event.target.value;
            onMinuteChange(value === "" ? "" : Number(value));
          }}
        >
          <option value="">--</option>
          {MINUTES.map((value) => (
            <option key={value} value={value}>
              {String(value).padStart(2, "0")}
            </option>
          ))}
        </SelectField>
      </div>
    </div>
  );
};

export default TimeSelect;
