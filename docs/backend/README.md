# Backend

## NEG-DEP-10/12 — primer despliegue con SVB aplazado

Se corrige FE-07-01 en prepare/registro: una invoice/versión CLOSED con conjunto exacto completo de invoiceItemId, en transacción con locks. Capacidad SVB_MANUAL_RECORDING_ENABLED false por defecto, true solo en QA test local _test. Nuevo registro/preparación rechaza SVB_PRESENTATION_DEFERRED; conserva historia/replays/resolución. Se añade inventario de documentos de solo lectura/manifiesto protegido y prueba de persistencia HTTP tras reinicio de proceso. **482/482 pruebas en 59 archivos, sin omitidos; typecheck/build PASS** en QA exclusivo55447. [Entrega, errores, configuración, manifiesto y pendientes remotos](../../backend/docs/NEG_DEP_10_12.md). Sin schema/SQL nuevo ni cambios operativos. Bucket remoto y smoke del destino NO EJECUTADOS.

## NEG-FINAL-07/08/09 — 2026-11-03

Implementado registro de captura campo por campo en portal: expediente interno congelado, reserva/incertidumbre, comprobante, idempotencia, auditoría y respuesta por línea. No requiere archivo ni transmite a SVB. Se añaden almacenamiento privado externo compatible con URI locales y preparación Express/Vercel; faltan smoke del bucket/destino final. [API, modelo, archivos e impacto](../../backend/docs/NEG_FINAL_07_09.md), [451 pruebas frescas y matriz Backend](../../backend/docs/NEG_FINAL_09_BACKEND_VALIDATION.md). Migración07 aplicada solo en QA; destino clínico y aceptación cliente pendientes.

## NEG-FINAL-06 — 2026-11-02

Se implementan los controles que no dependen de una fuente SVB aprobada: piloto real explícitamente bloqueado, distinción de validación técnica, lectura de policlinicCode, captura estricta, bloqueo de remisión no soportada y aislamiento de contexto de accidentes. El usuario confirmó que la ficha clínica no existe; no se implementa su captura/valores ni se certifica un formato o servicio real. [API publicada, procedencia por campo, archivos, pruebas y bloqueos](../../backend/docs/NEG_FINAL_06.md). Se prueban los cambios en una base local dedicada nueva y se conservan los contratos 03/04/05.

## NEG-FUNC-03/04/05 — 2026-10-31

Se implementan B03 (organización/revisión y autoridad fiscal de declaraciones), B04 (candidatos, exclusividad y retiro/cancelación Draft) y B05 (casos/selección validada en citas), manteniendo Express/Prisma/JWT/RBAC. Incluye soporte de integridad y permisos reproducible; las migraciones/seed se ejecutan solo en PostgreSQL local dedicado de QA. [Rutas, errores, archivos, impacto de modelo, handoff y validación](../../backend/docs/NEG_FUNC_03_04_05.md). Frontend, navegador y aplicación a Supabase operativo continúan pendientes de entrega coordinada.

## Responsabilidad y ubicación

API HTTP, autenticación, autorización por permisos, aislamiento por organización, validación, orquestación transaccional, persistencia, auditoría e integraciones. Código en `backend/`.

Leer el [contexto](../CONTEXTO_PROYECTO.md), [contrato API](../../backend/docs/API_FREEZE_BACKEND.md), [handoff](../../backend/docs/FRONTEND_HANDOFF.md) y [checklist](../../backend/docs/BACKEND_RELEASE_CHECKLIST.md). Las adiciones MASTER-02R y operational corrections actualizan partes de la descripción inicial del freeze.

## Separación interna

- `*.routes.ts`: montaje, autenticación y permisos.
- `*.schemas.ts` y controllers: validación y adaptación HTTP.
- `*.service.ts`: casos de uso, reglas del negocio y transacciones.
- `*.repository.ts`: acceso a datos.
- `src/infrastructure/`: adaptadores y dependencias externas.
- `src/shared/`: errores, serialización, middleware y utilidades comunes.

## Prioridades

Preparación PostgreSQL del 30 de octubre de 2026: adaptador `PrismaPg` y configuración compartida por runtime/seeds/scripts, SQL del Dashboard convertido, búsquedas normalizadas sin perder textos originales, fixtures y CI preparados para PostgreSQL 17. Verificados typecheck/build y 298 tests en una base local dedicada. Supabase solo se comprobó en lectura: baseline/seed/Postman siguen pendientes. Seguir el [procedimiento de migración](../base-de-datos/MIGRACION_POSTGRESQL.md).

1. Repetir inventario del destino Supabase y resolver las cinco migraciones posteriores al baseline, permisos e inconsistencias fiscales reportadas en noviembre. Aplicación controlada tras revisión; nunca seeds/cleanup de QA en clínica. Continuar con JWT/RBAC propios.
2. Completar aceptación Postman/navegador en destino, incluyendo Dashboard y límites de fecha de Curaçao.
3. Mantener la validación de locks, numeración/rollback y tarifas sobre una base PostgreSQL dedicada; los tests rechazan conexiones remotas y no recurren al `.env` operativo.
4. Organización/revisión fiscal y contratos 03/04/05 ya están implementados; conservar su autoridad y snapshots, sin ampliar a CRUD multi-organización.
5. Adaptador privado y entrada Express/Vercel preparados en NEG-FINAL-07/08/09. Completar configuración/bucket reales, transición de documentos locales, smoke y aceptación del entorno antes de publicación.

## Límites

No sustituir JWT/RBAC por Supabase Auth como efecto secundario de la migración. No inventar refresh/logout revocable mientras DBR-001 siga pendiente. No reescribir el catálogo compartido, formatos SVB o reglas históricas para acomodar infraestructura.

## Validación y entrega

Desde `backend`: `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test:unit`. Después, integración con `TEST_DATABASE_URL` apuntando a una base PostgreSQL local dedicada cuyo nombre termine en `_test`: `npm.cmd run test:integration`. Para conectar la aplicación local a Supabase: `npm.cmd run dev:supabase`. Postman usa la [guía local](../../backend/postman/README.md).

Entregar contratos modificados, códigos de error, permisos, impacto en datos, comprobaciones realizadas y pendientes de integración. No tomar los conteos históricos como una ejecución actual.

## Corrección operativa y PDF SVB — 2026-10-30

Con autorización del usuario se corrigió el límite diario de `appointments?date` para America/Curacao y se adaptó el PDF al formulario suministrado, con la imagen de firma verificada y snapshots históricos. El nuevo layout tiene su propia clave idempotente y conserva los PDFs anteriores. No cambian rutas, permisos, esquema ni contenido firmado. Se añadió Sharp para mantener PNG/JPEG/WebP al incrustar la firma.

Verificación fresca: typecheck/build y 80 pruebas unitarias pasan; API local/Supabase y navegador confirman el filtro corregido y el PDF QA. No se ejecutaron integraciones de base contra Supabase. [Contrato, archivos y evidencia](../../backend/docs/SVB_FORM_AND_OPERATIONAL_FIXES.md).

## Corrección clínica y refacturación — 2026-10-30

Se añadió el regreso autorizado de invoice a atención con motivo, control de versión y transacción serializable. Se conserva una sola factura/número y sus snapshots anteriores; servicios históricamente facturados retirados pasan a VOID y la nueva versión exige otra firma. El endpoint existente de crear factura reconstruye exclusivamente la versión clínica vacía. No hay migración ni seed. [Contrato, archivos, aceptación y validación](../../backend/docs/CLINICAL_REBILLING.md).
