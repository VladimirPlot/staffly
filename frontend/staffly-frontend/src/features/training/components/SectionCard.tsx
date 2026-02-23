import { Link } from "react-router-dom";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";

type Props = {
  title: string;
  description: string;
  countLabel: string;
  countValue: number;
  to: string;
};

export default function SectionCard({ title, description, countLabel, countValue, to }: Props) {
  return (
    <Card className="space-y-3">
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm text-muted">{description}</div>
      <div className="text-sm">{countLabel}: {countValue}</div>
      <Link to={to}>
        <Button variant="outline">Открыть</Button>
      </Link>
    </Card>
  );
}
