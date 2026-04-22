import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";

import { useAuth } from "../../../shared/providers/AuthProvider";
import BackToHome from "../../../shared/ui/BackToHome";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Icon from "../../../shared/ui/Icon";
import {
  createDishwareInventory,
  deleteDishwareInventory,
  listDishwareInventories,
  type CreateDishwareInventoryRequest,
  type DishwareInventorySummaryDto,
} from "../api";
import CreateDishwareInventoryModal from "../components/CreateDishwareInventoryModal";
import InventoryAccessGuard from "../components/InventoryAccessGuard";
import { formatInventoryLossAmount, formatInventoryLossCount, getInventoryStatusBadgeClass } from "../utils";
import { formatDateFromIso } from "../../../shared/utils/date";

function formatDate(value: string): string {
  return formatDateFromIso(value);
}

function AuthorizedDishwareInventoriesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const restaurantId = user?.restaurantId ?? null;

  const [inventories, setInventories] = useState<DishwareInventorySummaryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DishwareInventorySummaryDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadInventories = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listDishwareInventories(restaurantId);
      setInventories(data);
    } catch (e) {
      console.error("Failed to load dishware inventories", e);
      setError("Не удалось загрузить инвентаризации");
      setInventories([]);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadInventories();
  }, [loadInventories]);

  const sourceOptions = useMemo(
    () => inventories.filter((inventory) => inventory.status === "COMPLETED"),
    [inventories],
  );

  const handleCreate = useCallback(async (payload: CreateDishwareInventoryRequest) => {
    if (!restaurantId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createDishwareInventory(restaurantId, payload);
      setCreateOpen(false);
      await loadInventories();
      navigate(`/inventories/dishware/${created.id}`);
    } catch (e: any) {
      console.error("Failed to create dishware inventory", e);
      setCreateError(e?.friendlyMessage || "Не удалось создать инвентаризацию");
    } finally {
      setCreating(false);
    }
  }, [loadInventories, navigate, restaurantId]);

  const handleDelete = useCallback(async () => {
    if (!restaurantId || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDishwareInventory(restaurantId, deleteTarget.id);
      setDeleteTarget(null);
      await loadInventories();
    } catch (e) {
      console.error("Failed to delete inventory", e);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, loadInventories, restaurantId]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <BackToHome />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Инвентаризации посуды</h2>
          <div className="text-sm text-muted">Список документов по посуде.</div>
        </div>
        <div className="inline-flex flex-col gap-2 rounded-[1.75rem] border border-[var(--staffly-border)] bg-[color:var(--staffly-control)]/45 p-1.5 shadow-[var(--staffly-shadow)] sm:flex-row sm:items-center">
          <Button
            size="sm"
            variant="outline"
            className="shadow-none"
            onClick={() => navigate("/inventories")}
          >
            Все инвентаризации
          </Button>
          <Button size="sm" className="shadow-none" onClick={() => setCreateOpen(true)}>
            Новая инвентаризация
          </Button>
        </div>
      </div>

      {loading ? <Card className="text-sm text-muted">Загружаем инвентаризации…</Card> : null}
      {!loading && error ? <Card className="text-sm text-red-600">{error}</Card> : null}

      {!loading && !error && inventories.length === 0 ? (
        <Card className="space-y-3">
          <div className="font-medium">Инвентаризаций пока нет</div>
          <div className="text-sm text-muted">
            Создай первый документ с нуля или подтяни позиции из предыдущей инвентаризации.
          </div>
          <div>
            <Button onClick={() => setCreateOpen(true)}>Создать первую</Button>
          </div>
        </Card>
      ) : null}

      {!loading && !error ? (
        <div className="space-y-3">
          {inventories.map((inventory) => (
            <Card key={inventory.id} className="rounded-[1.75rem] p-3 sm:p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/inventories/dishware/${inventory.id}`} className="text-lg font-semibold hover:underline">
                      {inventory.title}
                    </Link>
                    <span className={getInventoryStatusBadgeClass(inventory.status)}>
                      {inventory.status === "COMPLETED" ? "Завершена" : "Черновик"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    Дата: {formatDate(inventory.inventoryDate)}
                    {inventory.sourceInventoryTitle ? ` • На основе: ${inventory.sourceInventoryTitle}` : ""}
                  </div>
                  {inventory.comment ? <div className="mt-2 text-sm text-default">{inventory.comment}</div> : null}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:min-w-[260px] xl:grid-cols-3">
                  <div className="rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/45 px-3 py-2">
                    <div className="text-[11px] font-medium text-muted">Позиции</div>
                    <div className="mt-1 font-semibold tabular-nums">{inventory.itemsCount}</div>
                  </div>
                  <div className="rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/45 px-3 py-2">
                    <div className="text-[11px] font-medium text-muted">Потери, шт</div>
                    <div className="mt-1 font-semibold tabular-nums">{formatInventoryLossCount(inventory.totalLossQty)}</div>
                  </div>
                  <div className="rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/45 px-3 py-2">
                    <div className="text-[11px] font-medium text-muted">Сумма потерь</div>
                    <div className="mt-1 font-semibold tabular-nums">{formatInventoryLossAmount(inventory.totalLossAmount)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Icon icon={Pencil} size="sm" decorative />}
                  onClick={() => navigate(`/inventories/dishware/${inventory.id}`)}
                >
                  Открыть
                </Button>
                {inventory.status === "DRAFT" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                    onClick={() => setDeleteTarget(inventory)}
                  >
                    Удалить
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <CreateDishwareInventoryModal
        open={createOpen}
        sourceOptions={sourceOptions}
        submitting={creating}
        error={createError}
        onClose={() => {
          if (creating) return;
          setCreateOpen(false);
          setCreateError(null);
        }}
        onSubmit={handleCreate}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Удалить инвентаризацию"
        description="Документ будет удален полностью. Уже созданные на его основе инвентаризации не пострадают."
        confirming={deleting}
        confirmText={deleting ? "Удаляем…" : "Удалить"}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function DishwareInventoriesPage() {
  return (
    <InventoryAccessGuard>
      <AuthorizedDishwareInventoriesPage />
    </InventoryAccessGuard>
  );
}
