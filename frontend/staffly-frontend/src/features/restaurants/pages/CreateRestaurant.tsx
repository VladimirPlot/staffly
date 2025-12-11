import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Input from "../../../shared/ui/Input";
import Button from "../../../shared/ui/Button";
import { createRestaurant } from "../api";
import { switchRestaurant } from "../../auth/api";
import { useAuth } from "../../../shared/providers/AuthProvider";

export default function CreateRestaurant() {
  const navigate = useNavigate();
  const { user, refreshMe } = useAuth();

  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // простая защита в UI: только CREATOR
  const isCreator = !!user?.roles?.includes("CREATOR");

  if (!isCreator) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <div className="text-red-600">Недостаточно прав (нужна роль CREATOR).</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Создать ресторан</h2>
          <Button variant="ghost" onClick={() => navigate("/restaurants")}>
            Отмена
          </Button>
        </div>

        <div className="grid gap-4">
          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Напр. “Basilico”"
          />
          <Input
            label="Код (опционально)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Если пусто — сгенерируется"
          />
        </div>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

        <div className="mt-4 flex gap-2">
          <Button
            disabled={!name.trim() || busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
              const created = await createRestaurant({
                name: name.trim(),
                code: code.trim() || undefined,
              });
              // сразу "проваливаемся" в ресторан (новый токен c restaurantId)
              await switchRestaurant(created.id);
              await refreshMe();
              navigate("/app", { replace: true });
            } catch (e: any) {
              setError(e?.friendlyMessage || "Не удалось создать ресторан");
            } finally {
              setBusy(false);
            }
            }}
          >
            {busy ? "Создаём…" : "Создать"}
          </Button>

          <Button variant="outline" onClick={() => navigate("/restaurants")}>
            Отмена
          </Button>
        </div>
      </Card>
    </div>
  );
}
