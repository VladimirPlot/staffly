import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { useAuth } from "../providers/AuthProvider";
import Icon from "./Icon";

type Props = { className?: string };

export default function BackToHome({ className = "" }: Props) {
  const { token, user } = useAuth();
  if (!token || !user?.restaurantId) return null;

  return (
    <Link
      to="/app"
      title="Главная"
      className={
        "inline-flex shrink-0 items-center gap-1 rounded-2xl border border-zinc-200 " +
        "bg-white px-2 py-1 text-sm font-medium text-zinc-700 shadow-sm " +
        "whitespace-nowrap transition hover:bg-zinc-50 focus:outline-none " +
        "focus:ring-2 focus:ring-zinc-300 " +
        className
      }
    >
      <Icon icon={ArrowLeft} size="xs" decorative className="shrink-0" />
      {/* на мобилке короче, чтобы не раздувало */}
      <span className="sm:hidden">Главная</span>
      <span className="hidden sm:inline">На главную</span>
    </Link>
  );
}
