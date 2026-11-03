# NEG-FINAL-07/08/09 — entrega Backend

Actualización DEP10/12 (2026-11-03): **primer despliegue con SVB aplazado**. La disponibilidad manual descrita en esta entrega anterior se reemplaza por capacidad false por defecto; nuevos prepare/registro bloqueados salvo QA sintético explícito. Una factura/versión completa se exige transaccionalmente. [Contrato vigente, historia/resolución y evidencia](NEG_DEP_10_12.md). No tomar los conteos anteriores como prueba de esta corrección.

Fecha: 2026-11-03. Versión: árbol local sin commit/despliegue. Canal confirmado por el usuario: **captura campo por campo en el portal**, sin archivo de entrada ni API SVB contratada.

## Flujo manual implementado

El operador prepara una reserva persistente con un expediente congelado de versiones CLOSED vigentes. Después introduce los datos en el portal y registra el hecho realizado con comprobante. Preparar/descargar no marca SUBMITTED. Backend no abre sesiones en SVB ni transmite. Confirmación, contador, estados, líneas y auditoría se guardan en una transacción; fallo de auditoría revierte todo.

Campos externos sin fuente permanecen null y visibles como pendientes. Registrar un hecho externo no certifica reglas clínicas/fiscales ni NumberOfTreatments/Assistance. REAL_SVB sigue bloqueado en ready/export para archivo oficial. El nuevo registro manual no necesita archivo: readiness distingue `manualPortalRecordingEnabled: true`, `manualEntryRequiresFile: false` y `realSubmissionEnabled: false` para entrega certificada/automatizada pendiente. [Adenda del contrato](../../docs/negocio/ADENDA_PORTAL_MANUAL_20261103.md).

## API montada

Base `/api/v1/declarations/:id`. JWT vigente, usuario activo y organización correcta. IDs/Decimal strings, envelope success/data, errores con código/correlación.

| Método/ruta | Permisos efectivos | Respuesta |
| --- | --- | --- |
| GET `/manual-entry` | declaration.read + invoice.read | `{content, contentHash, entry}` |
| GET `/manual-entry/download` | declaration.read + invoice.read | JSON canónico interno; X-Content-SHA256; private/no-store |
| POST `/manual-entry/prepare` | declaration.submit + declaration.read + invoice.read | ManualEntry; 201 inicial, 200 replay |
| POST `/manual-entry/:entryId/uncertain` | declaration.submit | UNCERTAIN |
| POST `/manual-entry/:entryId/release` | declaration.submit | RELEASED |
| POST `/submissions/manual` | declaration.submit | Submission + ManualEntry; 201 inicial, 200 replay |
| POST `/submissions/:submissionId/official-result` | declaration.submit | ManualEntry con resultado; 201 inicial, 200 replay |

Resolver incertidumbre, liberar y registrar exigen ser preparador o tener además `declaration.update`. Resultado requiere `declaration.submit`. Evidencia usa las rutas existentes con `document.upload`/`document.read`; nunca autorización por nombre de rol.

1. Crear DRAFT/agregar ítems actuales CLOSED. GET entrega snapshots, totales por moneda y diagnóstico; no reserva ni exige READY/export.
2. Prepare: `{ "idempotencyKey": "<UUID nuevo>" }`. Guarda `ODONTHO_MANUAL_ENTRY_V1`, hash SHA-256 canónico y operador. Una preparación activa por lote. Ante fallo de red conservar clave y recuperar GET antes de repetir una acción externa.
3. Uncertain: `{ "reason": "..." }`. Mantiene reserva sin marcar presentación ni vencer automáticamente. Tras verificar NO presentación, release: `{ "reason": "...", "confirmation": "NOT_PRESENTED_VERIFIED", "resolutionDocumentId": "..." }`. Evidencia obligatoria para UNCERTAIN; PREPARED también exige motivo/confirmación. RECORDED no se libera.
4. Tras introducir efectivamente los datos en portal, subir comprobante como OTHER: POST `/documents?documentType=OTHER&originalFilename=receipt.pdf`, body binario con MIME. Admite PDF/PNG/JPEG/WebP; verifica organización, MIME/magic, size/hash y lectura. Registrar con el cuerpo siguiente.

```json
{
  "manualEntryId": "123",
  "expectedContentHash": "<SHA-256 de prepare>",
  "submittedAt": "2026-11-03T10:00:00-04:00",
  "externalReference": "0000123",
  "receiptDocumentId": "456",
  "idempotencyKey": "<UUID estable de confirmación>",
  "confirmation": "ALREADY_ENTERED_IN_OFFICIAL_PORTAL"
}
```

Referencia string preserva ceros; ausencia: `externalReference: null` + `reason`. Hora externa con offset, separada de `recordedAt` servidor; futuro fuera de cinco minutos se rechaza. Submission usa MANUAL, `declarationExportId: null` y metadata de atestación; no infiere aceptación/pago.

5. Respuesta final: `status` ACCEPTED/PARTIALLY_REJECTED/REJECTED, `externalReference` o null+reason, `respondedAt`, `resultDocumentId`, `idempotencyKey`, `lines: [{ declarationItemId, status: ACCEPTED|REJECTED, responseCode?, responseMessage? }]`. Todas las líneas exactamente una vez; rechazadas con código/explicación; parcial con mezcla aceptada/rechazada. Resultado/evidencia inmutables, importes intactos. Ruta genérica anterior rechaza manuales con MANUAL_RESULT_EVIDENCE_REQUIRED.

Aceptación parcial por cantidad/importe dentro de una línea requiere contrato posterior, sin aproximaciones. No hay reenvío automático de rechazados. Asignación histórica permanece reservada, incluidos aceptados; conciliación posterior necesita flujo explícito.

## Persistencia e integridad

Modelos `DeclarationManualEntry` y `DeclarationManualResult`: snapshots/evidencia/hash, claves binarias C, actores y tiempos. `lastSubmissionAttempt` incrementa transaccionalmente; no MAX+1 en runtime. Migración `20261103000000_manual_portal`, seis migraciones locales totales, aplicadas solo en QA durante esta entrega. Mantiene RLS/CHECK/triggers anteriores.

Reserva PREPARED/UNCERTAIN/RECORDED bloquea editar/agregar/retirar/cancelar lote, nuevos exports, ready, transporte anterior y corrección de factura fuente. SQL congela identidad/valores e impide modificar/eliminar evidencia final. Claves por organización: reusar con distinto contenido da 409. [Pruebas DB/recuperación](../../docs/base-de-datos/NEG_FINAL_07_09_HANDOFF.md).

Errores 400: VALIDATION_ERROR, INVALID_EXTERNAL_TIMESTAMP, MANUAL_EVIDENCE_TYPE_INVALID. 401/403: autenticación/permisos. 404: declaración/preparación/submission/documento inexistente o ajeno. 409: MANUAL_ENTRY_LOCKED, MANUAL_ENTRY_UNCERTAIN, MANUAL_ENTRY_NOT_ALLOWED, MANUAL_ENTRY_CONCURRENT_CONFLICT, MANUAL_CONTENT_CHANGED, IDEMPOTENCY_KEY_CONFLICT, MANUAL_SOURCE_NOT_CURRENT, MANUAL_SOURCE_INCONSISTENT, MANUAL_EVIDENCE_INVALID, MANUAL_ENTRY_RESOLUTION_EVIDENCE_REQUIRED, DECLARATION_ALREADY_SUBMITTED, MANUAL_RESULT_LINES_MISMATCH, MANUAL_RESULT_STATUS_MISMATCH, MANUAL_RESULT_REJECTION_REASON_REQUIRED, DECLARATION_SUBMISSION_RESULT_NOT_ALLOWED, INVOICE_MANUAL_PRESENTATION_LOCKED, DOCUMENT_INTEGRITY_MISMATCH, MANUAL_RESULT_EVIDENCE_REQUIRED. 503: DOCUMENT_STORAGE_UNAVAILABLE/NOT_PRIVATE.

OpenAPI `/api/openapi.json` publica siete operaciones/cuerpos. [Postman](../postman/NEG_FINAL_07_MANUAL.postman_collection.json) preparado para fixtures; no ejecutado en clínica. [Campos propuestos para futura carga/API](../../docs/base-de-datos/CAMPOS_PROPUESTOS_SVB_MANUAL_API.md), sin inventar layout ni credenciales SVB.

## Preparación operativa 08

Mantiene Express/Prisma/JWT/RBAC. Pruebas verifican expiración, organización, desactivación y permisos en petición siguiente, límite de carga y errores correlacionados sin bytes/secretos. Logout descarta token del cliente, no revoca JWT individualmente; DBR-001 separado. Ante compromiso desactivar cuenta; esperar expiración anterior antes de reactivar. Responsable con `user.update` administra cuentas individuales, TTL y entrega protegida.

LOCAL conserva URI `local://documents/` en host persistente respaldado. SUPABASE habilita adaptador privado: comprueba bucket privado en cada operación, crea sin upsert, lee autenticado y verifica hash tras escritura, sin URLs públicas/secretos en DTO. Persiste enum existente OTHER y URI interna `supabase://documents/<bucket>/<key>`. Fallo remoto no cae a local. Escrituras nuevas usan proveedor configurado; lectura según URI. **No traslada archivos antiguos** ni modifica firmas/snapshots. Vercel con registros locales requiere transferencia/reconciliación verificada antes de habilitar, o mantener host persistente en transición.

Variables en `.env.example`: DOCUMENT_STORAGE_PROVIDER, SUPABASE_URL origen HTTPS, SUPABASE_SERVICE_ROLE_KEY solo servidor, SUPABASE_STORAGE_BUCKET privado. Vercel exige externo y DOCUMENT_MAX_UPLOAD_BYTES <=4194304. Producción requiere CORS_ALLOWED_ORIGINS HTTPS exactos. [Límite Vercel](https://vercel.com/docs/functions/limitations); referencias del adaptador: [buckets oficial](https://github.com/supabase/storage-js/blob/master/src/packages/StorageBucketApi.ts), [uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [REST](https://supabase.com/docs/reference/self-hosting-storage/retrieve-an-object).

`src/app.ts` exporta app por defecto; vercel.json declara Express/build/asset PDF, .vercelignore excluye env/storage/QA. `vercel-build` genera Prisma/compila, sin migrar/seed. [Entrada Express soportada](https://vercel.com/docs/frameworks/backend/express). Comprobado localmente; no equivale a `vercel build` ni publicación. Bucket, reinicio/actualización remotos, HTTPS y URLs finales aún requieren smoke.

Arquitectura fija host/URLs/versión/operadores; DB aplica migraciones controladas tras diagnóstico y prueba backup/restore conjunto; sincronizar permisos revisados sin core seed/QA; Backend verifica storage/accesos; Frontend/Diseño prueban navegador/puestos. No integración/cleanup/seed de QA en clínica, ni migraciones en arranque/request.

Incidente: responsable suspende uso/presentación, desactiva usuarios o detiene servicio según impacto, preserva registros. Restore aislado verifica hashes/vínculos antes de cambio controlado; no deshace SVB. Reconciliar evidencia externa antes de reanudar, sin repetir entrada por timeout/restore. Arquitectura/clínica completan responsable nominal, frecuencia/retención/contactos.

## Aceptación 09 e impacto

[Matriz fresca Backend](NEG_FINAL_09_BACKEND_VALIDATION.md). QA PostgreSQL 17.11 local, tres bases `_test`, datos sintéticos. Supabase usa HTTP simulado para privacidad/colisiones/hash/reinicio de adaptador, sin aceptación de bucket remoto. La suite no certifica reglas externas ni ronda clínica.

DB revisa seis migraciones/recuperación/permisos; Frontend consume DTO/errores, incertidumbre/evidencia por línea; Negocio confirma fuentes/alcance; Arquitectura despliegue/operación. Backend no editó pantallas ni aceptó navegador/cliente.

Archivos: `modules/declarations/manual-entry.{schemas,controller,service,repository,openapi}.ts`, rutas/DTO/repositorio/guardas de declaraciones/factura; schema/client/migración; `modules/documents/{document.storage,supabase-document.storage,document.service,document.controller}.ts`, env/logger/app/build/Vercel. Pruebas `manual-entry-backend`, `pilot-access-backend`, `private-document-storage`, OpenAPI y regresión/DB/restore. Diff compartido conserva cambios previos y de otras áreas.
