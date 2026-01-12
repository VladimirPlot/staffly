# Staffly

## Web Push уведомления (PWA)

### Настройка VAPID
1. Сгенерировать ключи:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Заполнить `infra/.env`:
   ```
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:admin@example.com
   ```
3. Убедиться, что переменные проброшены в backend через `env_file`/`environment` в `infra/docker-compose.*.yml`.

### Требования
- Push работает только по HTTPS (исключение — localhost).
- На iOS push доступны только после “Add to Home Screen” (standalone режим PWA).

### Troubleshooting
- Проверить разрешение на уведомления в браузере.
- Проверить наличие подписок в таблице `push_devices`.
- Проверить очередь доставок `push_deliveries` и логи воркера (profile `worker`).
- Убедиться, что `VAPID_*` значения доступны backend и не пустые.
