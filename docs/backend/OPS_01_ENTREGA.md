# OPS-01 — Entrega Backend

Trabajo local del 8 de noviembre de 2026 para el [contrato OPS-01](../negocio/CONTRATO_OPS_01_BACKEND.md), sobre HEAD base `1828797be` y cambios compartidos preservados. El contrato HTTP consumible está en [OPS_01_API](../../backend/docs/OPS_01_API.md); prevalece sobre los apartados históricos del freeze y del handoff.

## Resultado

El flujo mínimo registra servicios y cantidades sin exigir seguro, tarifa, diagnóstico, nota médica, autorización ni remisión. La factura resuelve el contexto económico después de terminar la atención. Los servicios sin precio conservan importes null y participan en el volumen de atención. Los indicadores monetarios representan producción valorada o facturación, sin afirmar que hubo pago.

Se completó el inicio idempotente bajo concurrencia y la compatibilidad con citas CHECKED_IN/IN_PROGRESS y atenciones reabiertas sobre citas COMPLETED. Captura, retiro, entrega y creación de factura usan el mismo orden de bloqueo cita → atención. La cancelación posterior al inicio queda rechazada. Una falla de auditoría al entregar revierte conjuntamente atención y cita.

La refacturación mantiene factura lógica, número, seguro y moneda; admite una nueva línea sin precio después del retorno a atención, calcula con Decimal y exige otra firma. La prueba HTTP conserva el hash, contenido y PDF anteriores y descarga los PDF de ambas versiones.

Dentalink tiene un módulo interno montado con cuentas, correspondencias, vista previa paginada, incidencias, confirmación e idempotencia. El lector sustituible produce un DTO normalizado interno; no implementa ni supone el protocolo HTTP externo. El proveedor del lector queda sin configurar por defecto. Las cuentas nacen deshabilitadas y su activación lógica no acredita conexión. El adaptador sintético se inyecta exclusivamente en tests y se rechaza fuera de NODE_ENV=test con PostgreSQL local dedicado `_test`.

## Archivos y responsabilidades

| Grupo | Entrega Backend |
| --- | --- |
| `backend/src/modules/clinical-encounters/clinical-encounter.{controller,routes,repository,service}.ts`, `service-attention.openapi.ts` | Inicio/entrega por servicios, compatibilidad, bloqueos e idempotencia |
| `backend/src/modules/encounter-procedures/encounter-procedure.{controller,schemas,service,types}.ts` | DTO mínimo y captura/retiro serializados con la entrega |
| `backend/src/modules/appointments/appointment-status.ts`, `appointment.service.ts` | Cancelación previa al inicio; creación reutilizable dentro de la transacción de importación |
| `backend/src/modules/invoices/invoice.{controller,schemas,service}.ts` | Valoración diferida y preservación del contexto de refacturación |
| `backend/src/modules/patients/patient.{repository,service}.ts` | Creación transaccional reutilizada sin duplicar reglas ni numeración |
| `backend/src/modules/reports/dashboard.{service,openapi}.ts`, `svb-readiness/svb-readiness.openapi.ts` | Volumen sin precio y documentación del recorrido mínimo existente |
| `backend/src/modules/dentalink/` | Adaptador, DTO/validación HTTP, rutas, controladores, repositorio, reglas transaccionales y OpenAPI de doce operaciones |
| `backend/src/app.ts`, `backend/src/docs/openapi.ts` | Montaje y publicación de contratos |
| `backend/tests/integration/ops01-service-concurrency.test.ts`, `ops01-dentalink.test.ts`, `backend/tests/unit/ops01-dentalink.test.ts` | Nuevas regresiones propias |
| `backend/tests/integration/service-attention-flow.test.ts`, `declaration.test.ts`, `backend/tests/unit/encounter-procedure-removal.test.ts` | Flujo HTTP de perfiles, aislamiento de limpieza de fixtures y compatibilidad de mocks |
| `backend/docs/OPS_01_API.md`, `API_FREEZE_BACKEND.md`, `FRONTEND_HANDOFF.md`, `BACKEND_RELEASE_CHECKLIST.md`, esta entrega y README Backend | Contratos, evidencias y límites actuales |

La tabla incluye la base funcional local recibida el 7 de noviembre y sus correcciones en esta ronda; no atribuye todos esos cambios a una implementación nueva. Los cambios previos de integración en `encounter-procedure.test.ts`, `invoice.test.ts` y `operational-gaps.test.ts` se preservan y entran en la regresión.

Schema, migraciones, seed y cliente Prisma fueron entregados por DB en [OPS_03_ENTREGA](../base-de-datos/OPS_03_ENTREGA.md). DB mantuvo también `qa-recovery.ts`, sus pruebas y el diagnóstico del timeout. Backend no reescribió los SQL aplicados ni regeneró el cliente. Los archivos de Frontend, Arquitectura, Negocio y Diseño permanecen bajo sus responsables.

## Importación preparada

El navegador no envía credenciales, URLs ni listas de pacientes. Cada ruta exige JWT activo y permisos; los detalles privados requieren además patient.read y appointment.read. Las cuentas, correspondencias, ejecuciones y vínculos se aíslan por organización. ADMIN, RECEPTION y PROVIDER conservan su política efectiva sin atajos por nombres de rol. Los permisos Dentalink nuevos dependen de la migración/política acordadas con DB.

La lectura externa se realiza fuera de la transacción. Página inválida, incompleta o de otra cuenta no avanza cursor ni aplica sus filas. La confirmación bloquea cuenta/ejecución, verifica hash de vista, payloads y correspondencias, revalida reglas locales y procesa pacientes antes de citas. Entidad, identidad externa, consecutivo y auditoría se confirman juntos. Un fallo técnico revierte todo el intento; incidencias de negocio quedan para revisión sin importar esa fila.

Se conservan IDs externos textuales con ceros, fechas con zona y numeración existente. Una identidad conocida se omite sin actualizar datos locales. Coincidencias de nombre/documento generan incidencia y no fusión. Citas nuevas entran SCHEDULED. La confirmación repetida con la misma clave/hash devuelve el resultado sin duplicados. Un cambio de correspondencias o contenido revisado exige otra vista previa. Auditorías y errores técnicos no incluyen payloads personales ni tokens; el DTO privado normalizado sí se guarda para revisar la importación.

Las pruebas cubren origen sin configurar, permisos, recursos ajenos, filas inválidas, coincidencias dudosas, página parcial/fallida y reanudación, hash alterado, correspondencias cambiadas, confirmación concurrente y rollback posterior a crear entidades/vínculos. Límites y DTO exactos están en el contrato HTTP.

## Verificación local

Cluster PostgreSQL 17.11 propio en `127.0.0.1:55471`, directorio `backend/storage/ops01-backend-qa/data`. Todas las bases terminan en `_test`; documentos y reportes se guardan bajo `backend/storage/ops01-backend-qa/`. Las ocho migraciones y el seed mínimo se aplicaron únicamente a fuentes QA nuevas. No se utilizó el cluster de otro chat ni la base clínica.

La suite general usa `ops01_full_20261108_test` y `full-documents`. Los ensayos optativos usan `ops01_recovery_source_20261108_test`, destinos nuevos `ops01_recovery_target_20261108_test` y `ops01_lock_target_20261108_test`, y bases vacías de actualización `ops01_upgrade_20261108_test` / `ops01_legacy_20261108_test`. No se restaura sobre los fixtures funcionales. SVB_MANUAL_RECORDING_ENABLED=true se usa solo en QA sintético para verificar historia/registro; el valor por defecto de runtime sigue false.

La primera regresión detectó una colisión de declarant_id fijo en un test repetido y un borrado antiguo de seguros por prefijo que alcanzaba fixtures ajenos. Se sustituyó por identificador del fixture, limpieza por organización/IDs propios y alcance del paciente de declaraciones. La corrida focalizada posterior aprobó 26/26. Estos fallos de QA no justificaron cambiar integridad ni datos clínicos.

| Comprobación propia final | Resultado | Evidencia local privada |
| --- | --- | --- |
| Typecheck y build | PASS, después de las correcciones finales | `npm run typecheck` y `npm run build` |
| Suite general, 68 archivos | 509 PASS, 4 optativas omitidas deliberadamente; cero fallos. Incluye 181 unitarias | `backend/storage/ops01-backend-qa/release-results.json` |
| Recuperación, bloqueo y actualizaciones separadas | 6/6 PASS en cuatro archivos; incluye las cuatro optativas y repite dos comprobaciones de inventario | `backend/storage/ops01-backend-qa/recovery-results.json` |
| Atención/refacturación concurrente e importación sintética | 12/12 PASS, incluidos otra vez en la suite final | `ops01-service-concurrency.test.ts` y `ops01-dentalink.test.ts` |
| Aislamiento de fixtures tras las correcciones | 26/26 PASS, incluidos otra vez en la suite final | `backend/storage/ops01-backend-qa/isolation-results.json` |
| Enlaces locales y whitespace del diff | PASS | Documentación y archivos Backend afectados |

Los dos reportes finales cubren **513 casos únicos aprobados**; no se suman los inventarios repetidos ni los conteos históricos. La suite general duró 114,33 segundos. La recuperación completa con documentos pasó en unos 4,2 segundos y el bloqueo deliberado informó su fase/liberó la conexión en unos 5,2 segundos. Se comprobaron filas, secuencias, estructura, contenido firmado, cuatro archivos y su lectura en un proceso nuevo sobre el destino restaurado.

El cluster propio fue detenido al terminar, después de verificar directorio y puerto 55471; las bases, documentos y reportes se conservan.

Una corrida intermedia registró una duración anómala de unos 456 segundos en un caso de DEP10, sin un diagnóstico útil en su error. No se reprodujo en la repetición aislada (8/8 PASS) ni en la suite completa final. No se cambiaron límites de las pruebas para ocultarlo; se conservan los reportes intermedios como diagnóstico. Esto es independiente del timeout de recuperación anterior investigado por DB.

## Entrega entre áreas y pendientes

Frontend puede consumir ahora las doce rutas y sus estados desde [OPS_01_API](../../backend/docs/OPS_01_API.md), incluidas listas paginadas para recuperar una ejecución tras recargar y errores recuperables de configuración. DB puede contrastar las transacciones con el [modelo acordado](../base-de-datos/OPS_03_MODELO_DENTALINK.md). Arquitectura dispone de esta entrega para integrar el candidato y su aceptación.

La revisión automática rechazó el aviso adicional al chat de DB por falta de autorización explícita reconocida para ese envío. No se reintentó; esta entrega en el repositorio constituye el traspaso, sin atribuir recepción o aceptación al otro chat.

Pendientes reales: acceso Dentalink y documentación oficial verificable de autenticación, recursos, campos, zonas/estados, paginación, límites y muestras; implementación y validación posterior del lector HTTP; aceptación integrada de UI/cliente; identificación y validación del candidato/despliegue y almacenamiento del destino. No hay importación real ni escritura hacia Dentalink. La prueba de recuperación local no certifica recuperación del host/bucket operativo. SVB continúa aplazado y no se inventa plantilla, catálogo ni semántica pendiente.

No se realizó commit, push, despliegue, migración remota, importación o limpieza sobre clínica. Se preservaron los cambios compartidos y los archivos ajenos de deployment. Los datos sintéticos y reportes son privados e ignorados por Git.
