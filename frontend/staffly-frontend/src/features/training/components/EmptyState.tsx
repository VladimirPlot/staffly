import Card from "../../../shared/ui/Card";

type Props = {
  title: string;
  description?: string;
};

export default function EmptyState({ title, description }: Props) {
  return (
    <Card className="space-y-1">
      <div className="text-sm font-semibold text-strong">{title}</div>
      {description && <div className="text-sm text-muted">{description}</div>}
    </Card>
  );
}
