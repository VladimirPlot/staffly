import Card from "../../../shared/ui/Card";

type Props = { label?: string };

export default function LoadingState({ label = "Загрузка данных…" }: Props) {
  return <Card className="text-sm text-muted">{label}</Card>;
}
