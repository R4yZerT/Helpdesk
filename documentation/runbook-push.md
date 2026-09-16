# Runbook — RF-23 push en producción

El código está completo (migraciones + Edge `send-push` + registro de token en móvil).
Solo falta la habilitación en el proyecto Supabase de producción. Pasos en orden:

## 1. Extensiones

En el dashboard de Supabase (Database → Extensions), habilitar:

- `pg_net`
- `pg_cron`

Verificar:

```sql
select extname from pg_extension where extname in ('pg_net', 'pg_cron');
```

## 2. Configuración del sender

```sql
alter database postgres set app.settings.functions_url = 'https://<ref>.supabase.co/functions/v1';
alter database postgres set app.settings.service_role_key = '<service_role>';
```

`<ref>` es la referencia del proyecto; `<service_role>` la service_role key
(nunca exponerla en el cliente).

## 3. Desplegar el Edge Function

```bash
supabase functions deploy send-push
```

## 4. Verificar el cron

La migración `20261001000000_rf23_send_push.sql` programa el job
`send_push_cada_5min` (`*/5 * * * *`) solo si `pg_cron` existe.
Si las extensiones se habilitaron después de aplicar migraciones,
re-ejecutar el bloque `cron.schedule` de esa migración.

Verificar:

```sql
select jobname, schedule from cron.job where jobname = 'send_push_cada_5min';
select public.send_push_disparo();
```

## 5. Prueba de despacho (sin enviar)

Con JWT de jefe/administrador:

```bash
curl -X POST 'https://<ref>.supabase.co/functions/v1/send-push' \
  -H "Authorization: Bearer <jwt_jefe>" \
  -H 'Content-Type: application/json' \
  -d '{"dryRun": true}'
```

Respuesta esperada: `{ pendientes, con_token, sin_token, muestra, dryRun: true }`.

## Notas

- Web = solo in-app por diseño (campana `NotificationBell` + realtime).
  Push remoto solo en móvil (Expo, device físico).
- Sin `pg_net`/config, el sistema degrada a in-app sin errores
  (`send_push_disparo()` retorna el motivo).
