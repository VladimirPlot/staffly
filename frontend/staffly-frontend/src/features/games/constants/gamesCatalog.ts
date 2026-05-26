import { MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type GameCatalogItem = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  to: string;
  statusLabel: string;
};

export const GAME_CATALOG: GameCatalogItem[] = [
  {
    id: "alias",
    title: "Алиас",
    description: "Командная игра на объяснение ресторанных терминов и ситуаций.",
    icon: MessageCircle,
    to: "/games/alias",
    statusLabel: "(Тест)",
  },
];
