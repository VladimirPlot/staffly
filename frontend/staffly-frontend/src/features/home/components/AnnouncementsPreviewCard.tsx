import { Link } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import ContentText from "../../../shared/ui/ContentText";
import type { InboxMessageDto } from "../../inbox/api";

function formatNotificationDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(d);
}

type AnnouncementsPreviewCardProps = {
  announcements: InboxMessageDto[];
  onHide: () => void;
};

export default function AnnouncementsPreviewCard({
  announcements,
  onHide,
}: AnnouncementsPreviewCardProps) {
  return (
    <Card className="mb-4 border-emerald-200 bg-emerald-50/70">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-3">
          <div className="text-sm font-medium uppercase tracking-wide text-emerald-700">
            Новые объявления
          </div>
          <ul className="space-y-3 text-sm text-emerald-900">
            {announcements.map((item) => (
              <li
                key={item.id}
                className="rounded-2xl border border-emerald-100 bg-white/60 p-3 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-700">
                  <span>{item.createdBy?.name ?? "Руководство"}</span>
                  <span>до {formatNotificationDate(item.expiresAt)}</span>
                </div>
                <ContentText className="mt-2 text-base text-emerald-900">
                  {item.content}
                </ContentText>
              </li>
            ))}
          </ul>
          <Link to="/inbox" className="inline-flex text-xs text-emerald-700 underline">
            Перейти во входящие
          </Link>
        </div>
        <Button variant="ghost" className="text-sm text-emerald-700" onClick={onHide}>
          Скрыть
        </Button>
      </div>
    </Card>
  );
}
