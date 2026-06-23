import Textarea from "../../../../shared/ui/Textarea";

type InfoContentFieldProps = {
  content: string;
  submitting: boolean;
  onChange: (content: string) => void;
};

export default function InfoContentField({ content, submitting, onChange }: InfoContentFieldProps) {
  return (
    <Textarea
      label="Чек-лист"
      value={content}
      onChange={(event) => onChange(event.target.value)}
      rows={10}
      disabled={submitting}
      className="resize-y"
    />
  );
}
