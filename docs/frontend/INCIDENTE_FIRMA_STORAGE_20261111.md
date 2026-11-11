# Firma: POST documents devuelve 503 — 2026-11-11

Estado: credencial de tipo incorrecto identificada por confirmación del usuario; corrección y reensayo remotos pendientes. Mejora Frontend local, sin publicar.

## Evidencia observada

- Render `odontho-clinical-api`, workspace confirmado `My Workspace`: a las 17:58:02 y 17:58:29 UTC, POST `/api/v1/documents?documentType=SIGNATURE&originalFilename=signature-v5.png` devuelve 503 `DOCUMENT_STORAGE_UNAVAILABLE`. Correlaciones `25b9b9cc-1ac1-41fd-8e42-2eef41602c2b` y `224fd027-5146-4b76-baf9-5fc80d5e52cf`.
- Consulta PostgreSQL de solo lectura al proyecto confirmado `tlfdwmaofwpwlcgrhfps`, 18:02:57 UTC: existe un único bucket `bkclinicadocs`, `public=false`, sin restricciones de MIME/tamaño por bucket. Esto acredita metadatos, no conectividad HTTP ni acceso desde Render.
- En esa consulta, versión interna `5`: `PENDING_SIGNATURE`, bloqueo desde 17:57:40 UTC, cero firmas, sin `signed_at` ni `closed_at`. No se cambió la factura.
- El usuario confirma `SUPABASE_STORAGE_BUCKET=bkclinicadocs` y la URL del proyecto en Render. En la continuación confirma que `SUPABASE_SERVICE_ROLE_KEY` contiene una clave con prefijo `sb_publishable_`. No se solicitaron ni registraron valores secretos.

## Causa identificada y corrección de configuración

`sb_publishable_` identifica una clave pública con permisos `anon` cuando no hay una sesión Supabase Auth; no proporciona la identidad privilegiada requerida por este adaptador de documentos. El login de la aplicación usa el Backend existente y no convierte esa clave en `service_role`. Esta configuración incorrecta explica el rechazo de acceso normalizado como 503; el status concreto del proveedor no se conserva en los logs actuales.

Para recuperar el servicio con el adaptador actualmente desplegado, obtener del mismo proyecto, Settings > API Keys > claves Legacy, la clave **service_role** JWT vigente y colocarla únicamente en `SUPABASE_SERVICE_ROLE_KEY` de `odontho-clinical-api`. Conservar URL y bucket confirmados. Aplicar la configuración mediante el despliegue correspondiente de Render y verificar nuevamente; no se ejecutó ese cambio desde este chat.

La documentación recomienda claves nuevas `sb_secret_` para servidores. El adaptador actual envía la misma credencial en `apikey` y `Authorization: Bearer`; la migración a claves nuevas debe revisar ese uso porque dichas claves no son JWT y la documentación indica enviarlas en `apikey`. No basta sustituir el prefijo ni renombrar una variable. Esta incidencia no modifica el adaptador Backend ni publica una migración de claves.

### Reintento posterior: configuración activa aún sin acreditar

Nuevos logs del 11 de noviembre, 18:35:38 y 18:36:01 UTC (13:35 y 13:36 de Bogotá), vuelven a registrar `DOCUMENT_STORAGE_UNAVAILABLE` 503 en la subida. Correlaciones `3cf95187-aab1-40d9-8b8e-6773c927d69c` y `12e9f636-f3c3-43c8-8c99-c385455ebe05`.

La consulta de los últimos despliegues sigue mostrando como último `dep-dbpn8gec6qcc73e0vr50`, creado el 10 de noviembre 19:45:05 UTC y finalizado `live` a las 19:47:14 UTC, commit `04a8cf55c9d6e7991a0a0c754bc248e518910dde`. Hay un arranque del proceso el 11 a las 18:34 UTC; esto no acredita que se hayan incorporado variables guardadas posteriormente. No se puede inferir desde estos logs qué clave efectiva utiliza el proceso.

Render distingue **Save and deploy**, que usa el build existente con nuevas variables, de **Save only** y **Restart service**: guardar sin desplegar deja variables pendientes y reiniciar conserva la configuración del despliegue en ejecución. Se solicitó al usuario confirmar cómo aplicó la sustitución. La acción recomendada es aplicar la variable corregida mediante **Save and deploy** en la API y esperar a que el nuevo despliegue esté `live`, preservando la pestaña de firma. No se inició ningún despliegue desde este chat.

Fuente de comportamiento de configuración: [variables de Render](https://render.com/docs/configure-environment-variables#setting-environment-variables) y [reinicio de servicios](https://render.com/docs/deploys#restarting-a-service).

## Punto de fallo y límite del diagnóstico

El adaptador [SupabaseDocumentStorage](../../backend/src/modules/documents/supabase-document.storage.ts) comprueba que el bucket sea privado, sube bytes sin sobrescritura y vuelve a leerlos para verificar su hash. Un fallo de red o una respuesta HTTP no satisfactoria se normaliza a `DOCUMENT_STORAGE_UNAVAILABLE`; el log actual no distingue fase ni status del proveedor. Por tanto, el 503 no demuestra por sí mismo que la clave sea incorrecta, que el bucket falte o que haya una caída de Supabase.

[DocumentService](../../backend/src/modules/documents/document.service.ts) espera a que termine Storage antes de insertar el documento; la asociación como firma es una segunda petición. La verificación de cero firmas corresponde a la hora indicada; no garantiza ausencia de objetos huérfanos tras respuestas ambiguas.

El conector Render disponible permite consultar logs y actualizar variables, pero no leer sus valores. No se modificó configuración, clave, bucket, RLS ni almacenamiento clínico. Tampoco se guardó, firmó o cerró la factura por el usuario.

## Corrección Frontend local

- [Mensajes centralizados](../../frontend/src/api/error-messages.ts): traducción por código de `DOCUMENT_STORAGE_UNAVAILABLE` y `DOCUMENT_STORAGE_NOT_PRIVATE`, sin mostrar respuestas del proveedor.
- [Diálogo](../../frontend/src/features/billing/signature-dialog.tsx): avisa que el dibujo permanece en el diálogo y que cerrar/recargar lo pierde. Se conserva el flujo explícito de reintento y la reconciliación con Backend.
- [Regresiones](../../frontend/src/test/billing.test.tsx): ambos códigos 503 conservan dibujo/checkbox, no llaman a captura después de fallar la subida y permiten completar un reintento explícito tras restaurar el mock de Storage. No son pruebas de conexión real a Supabase.

Validación fresca: lint PASS; build PASS; suite de billing 59/59 PASS; suite general 362/362 PASS en 18 archivos.

## Cierre remoto pendiente

1. URL y bucket contrastados por el usuario. Sustituir la clave pública incorrecta por la credencial de servidor compatible descrita arriba; verificar su pertenencia al mismo proyecto. No trasladar secretos al Frontend.
2. Verificar con la configuración efectiva del servidor el GET autenticado de metadatos del bucket. Si falla, conservar únicamente fase, status y código del proveedor; nunca cabeceras, cuerpos, claves ni firmas en logs.
3. Si ese GET pasa, aislar la fase de subida y lectura de verificación con evidencia sintética autorizada y separada de documentos clínicos. No habilitar bucket público ni usar disco efímero como solución.
4. Tras corregir y verificar la causa, el operador puede reintentar desde el diálogo abierto. No se publicó el cambio Frontend ni se efectuaron cambios remotos en esta incidencia.

Fuentes consultadas: [observabilidad Supabase](https://supabase.com/docs/guides/observability), [errores Storage](https://supabase.com/docs/guides/storage/debugging/error-codes), [claves API](https://supabase.com/docs/guides/getting-started/api-keys). Los datos de la incidencia provienen de logs y consulta de solo lectura, no de esas guías.
