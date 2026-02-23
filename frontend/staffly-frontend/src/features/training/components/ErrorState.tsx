import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";

type Props = {
  message: string;
  onRetry?: () => void;
  actionLabel?: string;
};

export default function ErrorState({ message, onRetry, actionLabel = "Повторить" }: Props) {
  return (
    <Card className="space-y-3 border-red-200 bg-red-50 text-red-700">
      <div className="text-sm font-medium">{message}</div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          {actionLabel}
        </Button>
      )}
    </Card>
  );
}
