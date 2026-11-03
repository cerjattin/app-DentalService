# DEP10/12 — entrega de Base de datos para el primer despliegue clínico

Fecha: 2026-11-03. Alcance vigente: [cierre del primer despliegue](../negocio/CIERRE_PRIMER_DESPLIEGUE_20261103.md), [DEP10](../negocio/CONTRATO_DESPLIEGUE_10_INTEGRIDAD_SVB.md) y [DEP12-B/C](../negocio/CONTRATO_DESPLIEGUE_12_ENTORNO_OPERACION.md). **SVB aplazado**: esta entrega no espera un archivo oficial, no desarrolla importadores SVB reales ni habilita nuevas presentaciones.

Estado de DB: herramientas y revisión independiente preparadas localmente y probadas en PostgreSQL sintético. Destino clínico sin cambios y todavía con bloqueos concretos. Los 434 de la entrega anterior son evidencia histórica; la comprobación de esta entrega se registra por separado abajo.

La [operación preparada en JSON](DEP12_OPERACION_PREPARADA.json) fija las seis migraciones/checksums, las cinco pendientes observadas, huellas de destino/política/diff, cambios de permisos y bloqueos de datos/objetos. No incluye credenciales ni valores fiscales. Actor/motivo/fuentes y artefacto de release siguen sin completar; el manifiesto no es un ejecutor ni una autorización de aplicación. Se debe regenerar/revisar si cambia el destino o la política.

## Archivos y propiedad

- [Sincronizador de permisos](../../backend/src/infrastructure/database/permission-sync.ts) y [CLI](../../backend/src/scripts/sync-pilot-permissions.ts).
- [Plan fiscal](../../backend/src/infrastructure/database/fiscal-reconciliation-plan.ts) y [CLI protegida](../../backend/src/scripts/plan-fiscal-reconciliation.ts), sin función de reparación.
- Pruebas nuevas: [permisos](../../backend/tests/integration/dep12-permission-sync.test.ts), [política/CLI](../../backend/tests/unit/dep12-permission-policy.test.ts), [plan fiscal](../../backend/tests/integration/dep12-fiscal-plan.test.ts), [factura/carreras DEP10](../../backend/tests/integration/dep10-invoice-integrity-db.test.ts).
- Se reutilizan inventario, diagnósticos y recuperación de [07/08/09](NEG_FINAL_07_09_HANDOFF.md). El test de recuperación admite root QA propio con QA_RECOVERY_TEST_ROOT. Se corrigió la herramienta de SQL06 para cargar readiness/configuración solo al diagnosticar, manteniendo `--sql` offline y sin credenciales.
- Backend conserva módulos/schema/cliente generado/migraciones/config/OpenAPI. DB no cambió esos archivos ni SQL aplicado. No hay migración nueva de este chat.

## DEP12-B: inventario actual y diff de permisos

Se repitió la inspección del `.env.supabase.local` explícito con TLS/CA y conexión READ ONLY. Reportes protegidos bajo `backend/storage/dep12-db-qa/`; no se guardan datos clínicos/credenciales en docs/Git.

| Verificación | Resultado observado |
| --- | --- |
| PostgreSQL | 17.11 |
| Migraciones | Baseline MATCH; cuatro NEG-FUNC + 20261103000000_manual_portal pendientes |
| Baseline físico | 40 tablas con RLS y 186 CHECK; sin drift/checksum desconocido/fallo de migración observado |
| Nuevos permisos | treatment_case.read y treatment_case.manage ausentes |
| Diff revisable | Crear 2 permisos, añadir 5 asignaciones, retirar 0 |
| Configuración fiscal | 2 organizaciones con Declarant ID inválido |
| Draft fiscal | 1 Draft con 2 líneas, fuente congelada inconsistente/inválida; 0 exports/submissions/reservas manuales activas |
| Documentos previos | 7 URI locales, 654296 bytes según metadata; no se copiaron ni se probaron como fixtures |

El resultado no se normalizó ni reparó. Una de las organizaciones afectadas tiene tres versiones congeladas; cambiar configuración actual no corrige esas versiones. El Draft no tiene una fuente histórica única válida que permita escoger una identidad automáticamente.

### Sincronización exclusiva de permisos

La política se obtiene del AST de los literales de `prisma/seed.ts`: **no se importa ni ejecuta el seed**. La herramienta de mantenimiento necesita las dependencias de desarrollo instaladas en el puesto autorizado (tsx/TypeScript); no se ejecuta como request/arranque del runtime productivo. Solo se crean los permisos faltantes y se agregan/retiran las asignaciones de ADMIN/PROVIDER/RECEPTION que indique el diff. Admin mantiene todos los permisos configurados, incluidos adicionales ya existentes; Provider/Reception conservan la matriz del contrato. Otros roles, membresías de usuarios, organizaciones, usuarios, contraseñas, configuraciones, maestros y datos clínicos no se escriben. No se crean roles ausentes/inactivos ni se normalizan códigos ambiguos por collation.

Dry-run usa RepeatableRead READ ONLY. Aplicación usa Serializable y locks de tablas de permisos/roles/asignaciones/membresías durante la breve operación; revalida el hash del estado/política/diff, exige actor activo con `role.manage` y motivo, comprueba postcondición y escribe auditoría en la misma transacción. La autorización se basa en permiso, no en el nombre del rol del actor. El ID identifica al responsable declarado por el operador de mantenimiento; la CLI no sustituye un login ni verifica por sí sola la identidad humana.

Se registra DEP12_PERMISSION_SYNC con diff antes/después y huella de política. Fallo de auditoría revierte permisos/asignaciones. Un reintento con el mismo diff ya aplicado devuelve replay solo si la auditoría acredita ese diff y el estado posterior coincide; otro cambio obliga a generar/revisar un diff nuevo. Una segunda ejecución convergente no duplica asignaciones ni eventos. No se reintenta silenciosamente una mutación clínica.

Desde backend:

```powershell
# SOLO LECTURA, ya ejecutado en el destino configurado:
node --import tsx src/scripts/sync-pilot-permissions.ts --env-file .env.supabase.local

# Plantilla para una operación futura revisada/autorizada; NO ejecutada en clínica:
node --import tsx src/scripts/sync-pilot-permissions.ts --env-file .env.supabase.local --apply --expected-target HUELLA_DESTINO_REVISADA --expected-diff HASH_DIFF_REVISADO --actor-id ID_ACTOR_ACTIVO --reason "Motivo aprobado de mantenimiento"
```

No hay fallback a DATABASE_URL operativo: sin archivo explícito solo se admite TEST_DATABASE_URL local `_test`. Se rechazan parámetros de conexión que redirijan host, flags desconocidos, target/diff distintos o actor no autorizado. El informe contiene códigos de permisos/roles, no pacientes ni cuentas. Exit 0: conforme/aplicado; 2: diff pendiente/precondiciones bloqueadas; 1: fallo. El comando apply anterior es una plantilla de operación concreta, no autorización para ejecutarlo.

## Plan fiscal protegido, sin valores inferidos

Artefacto: `backend/storage/dep12-db-qa/fiscal-plan-final.json`. Contiene IDs técnicos, valor actual de configuración, timestamps/huellas y referencias de versiones/líneas necesarias para revisión; no nombres de pacientes, notas clínicas ni credenciales. La CLI solo imprime conteos y escribe un archivo JSON **nuevo** bajo storage; rechaza sobreescribir un plan previo o salir de ese root mediante symlinks.

```powershell
node --import tsx src/scripts/plan-fiscal-reconciliation.ts --env-file .env.supabase.local --out storage/dep12-db-qa/OTRO_PLAN_NUEVO.json
```

| Caso | Fuente necesaria | Acción propuesta / precondición | Efecto y retorno |
| --- | --- | --- | --- |
| Dos organizaciones | Declarant ID correcto aprobado por clínica, por organización, con ceros conservados | Revisar IDs del artefacto, motivo y huella/updatedAt actuales; usar PATCH organización con actor de esa organización y expectedRevision fresco | Solo futuras capturas. Conservar valor inválido anterior como evidencia; no reintroducirlo como rollback. Ante error, suspender capturas afectadas y aplicar otra revisión válida auditada |
| Draft de dos líneas | Evidencia original de identidad de cada versión de factura y responsable que determine la corrección | La fuente observada es inconsistente/inválida: dejar intacto, revisar el histórico. No copiar identidad actual ni escoger la de una línea. Correcciones de factura requieren su flujo/versionado/firma | Conservar facturas, firmas y Draft originales. SVB está aplazado; no recrear/presentar automáticamente ni borrar para ocultar el hallazgo |

El planificador también distingue un Draft meramente distinto de una fuente histórica válida única: solo entonces propone revisar cancelación auditada si sigue sin exports/submissions/reservas y crear otro Draft posteriormente, conservando el original. **Ese no es el caso observado actual.** No existe un ejecutor automático de esas propuestas. Releer huellas antes de una operación autorizada y detenerse si cambiaron filas/evidencia.

Dato externo pendiente: la clínica debe aportar por canal protegido la fuente/valores de las dos organizaciones y el criterio autorizado sobre las versiones afectadas. No enviarlos como ejemplos ni inventarlos a partir del catálogo. Esto no detiene la preparación independiente del despliegue, pero sí impide afirmar que la identidad fiscal operativa quedó resuelta.

Confirmación del usuario del 3 de noviembre: **aún no existe una fuente validada** para esos casos. Su estado se mantiene SOURCE_REQUIRED/REVIEW_REQUIRED; ninguna identidad o acción sobre el Draft está aprobada. Se conservan intactos los registros y el informe protegido. La confirmación no cambia el alcance de SVB aplazado ni autoriza a habilitar los casos fiscales afectados; la preparación técnica restante puede avanzar.

## DEP12-C: objetos, transición y recuperación

El plan protegido inventaría id/organización, proveedor, URI, tamaño, SHA-256 y huella por documento. No cambia URI ni descarga/copia objetos clínicos. Configurar Supabase Storage no traslada esos siete archivos locales. Una futura transición debe copiar a un destino privado autorizado, verificar cada hash/tamaño, conservar los originales y publicar un mapeo ID/URI revisable antes de cualquier actualización de metadata. Nunca hacer overwrite ni reemplazar contenido firmado/PDF para adaptar el proveedor.

En el overlay seleccionado faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y SUPABASE_STORAGE_BUCKET. No hay bucket/credenciales de QA con los que acreditar la recuperación remota; tampoco se verificó el root documental del host clínico como fuente autoritativa. **Pendiente exacto:** acceso a un bucket privado QA/destino persistente autorizado y al root real de esos archivos, seguido de copia/restauración/smoke con archivos sintéticos. Backend posee la validación del adaptador real. No se pide ni imprime service_role en el chat/VITE.

Se repitió la recuperación conjunta en un laboratorio nuevo, con 4 documentos sintéticos locales: snapshot PG compartido con pg_dump, restore transaccional en DB vacía, comparación de todas las filas/secuencias, expediente/resultado y hashes; otro proceso descargó los 4 documentos desde DB/root restaurados mediante Backend. No es evidencia de bucket remoto. El motor rechaza proveedores externos sin un adaptador verificado; no los omite para hacer pasar el ensayo.

Los [backups de PostgreSQL de Supabase no contienen los bytes de Storage](https://supabase.com/docs/guides/platform/backups). Se requiere archivo/manifiesto de objetos además de la base y preaprovisionar roles/ACL/claves necesarios. Mantener [acceso privado mediado por Backend](https://supabase.com/docs/guides/storage/security/access-control). Responsable/suplente, frecuencia, retención, custodia y RPO/RTO siguen pendientes de acuerdo de Arquitectura/clínica; no se inventó una política aceptada.

## DEP10: revisión independiente

Pruebas propias ejecutan servicios reales sobre PostgreSQL y una factura sintética de **22 líneas**: una línea se rechaza; dos mitades 11+11 en lotes separados concurrentes se rechazan sin reserva/auditoría parcial; conjunto exacto completo concurrente tiene un ganador; mezcla de facturas se rechaza. Se verifica hash/total histórico sin cambios, sin dinero en floats. Se habilita SVB_MANUAL_RECORDING_ENABLED=true **solo en este QA local/test** antes de importar configuración; no se modifica la capacidad del destino. Backend conserva las pruebas de modo aplazado/replays/corrección y su entrega autoritativa.

## Evidencia fresca y secuencia de operación

Laboratorio exclusivo de DB: PostgreSQL 17.11, loopback 55445; fuente `odontho_dep12_20261103_test`, almacenamiento propio `backend/storage/dep12-db-qa/`. Se aplicaron allí las seis migraciones inmutables y seed únicamente para crear ese QA vacío. Backend usa otro puerto/root; no se limpió su laboratorio.

Al cerrar se detuvo solo ese PostgreSQL 55445, conservando bases/reportes. Para reanudarlo: `pg_ctl -D C:/workspace/app-DentalService/backend/storage/dep12-db-qa/data -l C:/workspace/app-DentalService/backend/storage/dep12-db-qa/server.log -o "-h 127.0.0.1 -p 55445" -w start`. Los ensayos de restauración/legado exigen otra base vacía nueva; no resetear los destinos ya verificados.

Resultados: diez pruebas nuevas de DEP10/12 aprobadas en cuatro archivos; tres de inventario/recuperación conjunta aprobadas al repetir el ensayo. **482 pruebas aprobadas en 59 archivos, sin omitidas**, en la regresión completa actual de 129.09 s. Reporte `backend/storage/dep12-db-qa/acceptance-results.json`; source QA 55445, restauración vacía `odontho_dep12_restore_accept_test` y legado vacío `odontho_dep12_legacy_accept_test`. Typecheck y build correctos. No se sumaron los 434/451 históricos a esta evidencia.

En la primera regresión actual hubo 481/482 aprobadas: el SQL06 offline importaba indirectamente la configuración de runtime añadida por DEP10. Se corrigió en el módulo propio mediante importación diferida de readiness solo para diagnóstico conectado; `--sql` sigue sin importar env ni abrir conexiones. La suite completa se repitió después del arreglo con destinos vacíos nuevos. No se debilitó la configuración de producción ni se modificaron credenciales o fuente SVB para aprobarla.

Reportes protegidos concretos: `target-inventory-final.json`, `permission-dry-run-final.json`, `fiscal-plan-final.json` y `storage-access-presence.json`, todos bajo `backend/storage/dep12-db-qa/`. La consulta remota sigue mostrando 5 pendientes/2 permisos/3 hallazgos; el dry-run final sigue aplicado=false, 7 cambios propuestos. Las URI/valores actuales solo aparecen en el plan protegido, no en esta documentación.

Antes de publicar:

1. Arquitectura fija artefacto/configuración/target/ventana/responsables. Mantener SVB aplazado por defecto y validar DEP10/11; falta un artefacto publicado, no se hizo commit/push/deploy aquí.
2. Repetir inventario/diagnósticos y dry-run protegido. Detener ante checksum diferente, migración desconocida/fallida/en curso o cambio del diff/filas esperadas; MATCH/PENDING conocidos no equivalen a un error de SQL, pero la aplicación nueva necesita sus seis migraciones confirmadas.
3. Resolver las fuentes fiscales y aprobar las acciones concretas, preservar evidencia y respaldar base+objetos. Verificar restauración y accesos en la topología de destino; no restaurar encima de clínica como test.
4. Detener escritores. Responsable único aplica las cinco migraciones pendientes en orden mediante CLI explícita, nunca en arranque/request. No reescribir SQL/checksum, no reset ni seed general. Las migraciones son transacciones individuales; si una falla, conservar las previas confirmadas y revisar el fallo antes de resolver/reintentar.
5. Revisar y aplicar la sincronización **solo permisos** con huellas/actor/motivo vigentes; repetir inventario y diff. No ejecutar fixtures/core seed/bootstrap de QA sobre clínica.
6. Publicar el artefacto autorizado y smoke del destino con cuentas individuales, permisos/aislamiento, factura/firma/PDF/corrección, documentos tras actualización y Dashboard. SVB sigue aplazado. Registrar observación/aceptación del cliente separada de QA.
7. Retorno: suspender capturas si hay incidencia; conservar datos/auditoría. No volver a código incompatible ni borrar tablas/contadores para aparentar rollback. Restaurar primero en otro destino validado y reconciliar hechos posteriores al corte, incluidos hechos SVB históricos aunque no se habiliten nuevos. Nunca reenviar por efecto de restauración.

Estado de cierre: **PREPARADO LOCAL** en el alcance verificado; **QA DESPLEGADO / OPERACIÓN CLÍNICA PREPARADA / CLIENTE ACEPTÓ** continúan pendientes de URL, Storage real, datos y evidencia de sus responsables.
