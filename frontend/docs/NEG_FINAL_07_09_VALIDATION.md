# NEG-FINAL-07/08/09 — entrega Frontend y validación QA

Fecha: 2026-11-03. Árbol local sobre `0bff419bd`, sin commit, push ni despliegue. Se preservaron los cambios de otros chats. Esta entrega implementa Frontend; **no acredita preparación operativa ni aceptación del cliente**.

## Decisión aplicada

El usuario confirmó entrada manual **una por factura**, sin plantilla de archivo aceptada. La pantalla separa revisar expediente, descargar JSON interno, abrir portal, preparar reserva, registrar comprobante y registrar respuesta. Abrir/descargar/preparar no marca SUBMITTED. No se guardan credenciales SVB ni se transmite al portal. Los exportadores anteriores siguen siendo técnicos.

La [propuesta de campos](PROPUESTA_REGISTRO_MANUAL_SVB.md) describe snapshots por factura/versión/línea, cantidades y Decimal strings, evidencia, fecha externa, referencia o ausencia motivada, idempotencia e incertidumbre. La futura automatización agrupa presentaciones por factura y añade transporte/layout versionado cuando exista una fuente aprobada. No define un formato oficial.

## Implementación

- Integración de las siete rutas montadas y publicadas en [OpenAPI](../../backend/src/modules/declarations/manual-entry.openapi.ts) y [handoff Backend](../../backend/docs/NEG_FINAL_07_09.md). Los documentos se suben como OTHER por el endpoint binario existente; el operador no escribe IDs internos ni hashes.
- Reserva con clave estable, estado UNCERTAIN, liberación con motivo/confirmación y evidencia obligatoria cuando hay incertidumbre. Las confirmaciones fallidas conservan el mismo payload, clave y documento para reintentar; la edición queda bloqueada hasta revisar el resultado. Se invalida declaración, candidatos, facturas y Dashboard.
- Registro exige fecha/hora externa de Curaçao, comprobante, referencia o ausencia explícita con motivo y confirmación. La respuesta exige documento, resultado global coherente y un resultado explícito para cada línea. No hay aceptación predeterminada, inferencia de pago ni reenvío automático.
- Expediente enlaza la versión exacta, muestra cantidades/tarifas/importes/totales del servidor y SHA-256. Su descarga verifica los bytes contra el hash revisado. Se bloquean dossiers con varias facturas o sin todos los ítems de la versión CLOSED consultada. Esta comprobación de UX **no sustituye la integridad transaccional Backend pendiente**.
- Entorno/versión visibles en login y aplicación; configuración SPA Vercel preparada. La firma permite trazo por teclado con captureMethod OTHER admitido por Backend, revisión explícita y protección al descartar cambios. No se modifica Auth ni se persisten tokens en navegador.

Archivos de producto propios de esta entrega: [contexto de despliegue](../src/app/deployment-context.ts), [aviso visible](../src/components/app-shell/environment-notice.tsx), integración en AppShell/Login, [recorrido manual](../src/features/declarations/manual-portal-workflow.tsx), [panel](../src/features/declarations/manual-entry-panel.tsx), [diálogo](../src/features/declarations/manual-entry-dialog.tsx), [API](../src/features/declarations/manual-entry-api.ts), [tipos](../src/types/manual-entry.ts), DeclarationDetailPage, SignatureDialog, mensajes de error y aviso/tipos/parser de readiness. Configuración: [.env.example](../.env.example), [vercel.json](../vercel.json). Pruebas: manual-entry, neg-final-07-09, neg-final-06, billing y declarations. Los cambios previos 03/04/05/06 siguen en el árbol y no se atribuyen como nuevos aquí.

## Entornos y evidencias

1. Primer ensayo: PostgreSQL QA `odontho_neg_func_test`, loopback 55439, Backend 3407/Vite 5176, organización sintética 43. Cita 402, factura 282 `QA-UAT-000001`, v1 ANG 177.60: notas, dos procedimientos, firma autorizada y cierre reales dentro de QA. El fixture carecía de numeración INVOICE; se agregó únicamente esa fila sintética, sin MAX+1 ni cambios de schema. PDF falló por archivo de firma 161 ausente. Las pruebas de integración Backend limpian el root documental por defecto; no se reconstruyó ni reemplazó esa firma histórica. La base también carecía de la migración manual nueva. **Ensayo conservado como fallo de entorno**, no aprobación.
2. Ensayo aislado: copia nueva `odontho_frontend0709_20261103_test` de la base QA ya migrada por DB, loopback 55443, Backend 3408/Vite 5177, versión visible `uat-20261103-0709`, organización 84. No se aplicaron migraciones, seeds generales ni operaciones en Supabase operativo desde Frontend. Root propio `backend/storage/frontend0709-documents`, separado del root que limpian las suites. El usuario autorizó expresamente tres cuentas sintéticas ADMIN/RECEPTION/PROVIDER; las credenciales permanecen en cache QA ignorada por Git. Un fixture anterior quedó parcialmente creado y se completó sin borrarlo ni cambiar contraseñas existentes.

Factura aislada **232 / FEc32b1c3e-000001**, cita 340, encuentro 313:

| Versión | Resultado | Evidencia |
| --- | --- | --- |
| 1 / ID 246 | 22 ítems, ANG 1953.60; firma y cierre autorizados por el usuario; luego SUPERSEDED | [PDF original](../../docs/frontend/evidence/uat-20261103/isolated-invoice-v1.pdf), [hash/firma](../../docs/frontend/evidence/uat-20261103/isolated-invoice-v1.json) |
| 2 / ID 247 | Mismo ID/número de factura; procedimiento anterior VOID, reemplazo quantity 2.00; 22 ítems, ANG 2042.40; firma independiente y cierre autorizados | [PDF corregido](../../docs/frontend/evidence/uat-20261103/isolated-invoice-v2.pdf), [hash/firma](../../docs/frontend/evidence/uat-20261103/isolated-invoice-v2.json), [render final](../../docs/frontend/evidence/uat-20261103/isolated-invoice-v2-6.png) |

Ambos PDF tienen seis páginas según el paginado actual del generador Backend. Se renderizaron con Poppler; primera/última página original y última corregida inspeccionadas visualmente. La última página corregida muestra Aantal 2.00, ANG 177.60, total ANG 2042.40 y trazo QA separado de Paraaf. Los campos sin snapshot permanecen vacíos. El ensayo no aprueba las reglas externas SVB.

Drafts 132 y 133 bloquearon el regreso a Clinical. Retirar el ítem 95 dejó el segundo bloqueo; cancelar 133 conservando snapshots permitió reabrir. [Dos bloqueos](../../docs/frontend/evidence/uat-20261103/two-blocking-drafts.png), [uno restante](../../docs/frontend/evidence/uat-20261103/one-remaining-blocking-draft.png). Los candidatos mostraron 20 registros en página 1 y dos en página 2, incluidos issues NumberOfTreatments/Assistance: [segunda página](../../docs/frontend/evidence/uat-20261103/candidates-page-2.png). Dos POST concurrentes por el mismo candidato produjeron 201/409 DECLARATION_ITEM_ASSIGNED; los Drafts 136/137 fueron cancelados con motivo, sin borrar historia: [concurrencia](../../docs/frontend/evidence/uat-20261103/candidate-concurrency.json).

## Matriz UAT de esta pasada

PASS significa el alcance sintético descrito; no aceptación clínica. Los escenarios incompletos se mantienen expresamente abiertos.

| ID | Estado | Observación/evidencia |
| --- | --- | --- |
| UAT-01 | NO EJECUTADO | Login API de los tres roles, 401 y permiso efectivo comprobados; navegador Admin. Falta recorrido visual completo de Recepción/Profesional. [HTTP](../../docs/frontend/evidence/uat-20261103/isolated-http-checks.json) |
| UAT-02 | NO EJECUTADO | Peticiones a recursos ajenos o inexistentes dieron 404 y sin sesión 401; no basta para acreditar toda la matriz contra IDs ajenos existentes. Pruebas de componentes/permisos pasan. |
| UAT-03 | NO EJECUTADO | Se consumieron paciente/seguro sintéticos existentes; no se repitió alta/edición/verificación integral en navegador. |
| UAT-04 | PASS | Cita/ubicación, check-in/inicio/completado; solapamiento contra cita activa 409 y fecha de Curaçao excluye/incluye correctamente la cita de 00:30. [Operación](../../docs/frontend/evidence/uat-20261103/operational-checks.json) |
| UAT-05 | PASS | Caso correcto, referencia externa 0000001 congelada, isEditable false y PATCH 409 tras vincular. Cambio de paciente cubierto por regresión automatizada, no por una nueva ronda visual de todos los roles. |
| UAT-06 | PASS | Notas conservadas, múltiples procedimientos, tarifa string 88.80, reemplazo de línea facturada y VOID. Alta inicial de las 22 líneas por API; corrección por navegador. |
| UAT-07 | NO EJECUTADO | Fuentes y alcance externo de autorización/remisión/accidente aún requieren cierre de Negocio. No se inventaron reglas ni valores. |
| UAT-08 | PASS | Encuentro y cita se completan por separado; completar la corrección no reabre la cita ni pierde notas. |
| UAT-09 | PASS | Una invoice por cita; creación duplicada 409, lista total 1, número/ID conservados y totales exactos. |
| UAT-10 | PASS | Dos ciclos de captura real de trazo QA por teclado, hash firmado, firmado y cerrado, con autorización específica del usuario. |
| UAT-11 | PASS | En entorno aislado: firmas/PDF de ambas versiones descargados y SHA-256 verificado después de reiniciar Backend. El fallo del primer entorno sigue documentado. [Persistencia](../../docs/frontend/evidence/uat-20261103/persistence-after-restart.json) |
| UAT-12 | PASS | Segunda página real, diagnóstico visible y exclusividad concurrente 201/409 en dos lotes. Fixtures antiguos CLOSED usados para candidatos técnicos no se presentan como firma real. |
| UAT-13 | PASS | Dos lotes: liberar uno no bastó; liberar ambos permitió el regreso, conservando el Draft cancelado. |
| UAT-14 | PASS | VOID anterior, servicio corregido, reconstrucción, nueva firma/cierre/PDF. Original SUPERSEDED, imagen/PDF anteriores conservados con hash. |
| UAT-15 | NO EJECUTADO | No existe layout aceptado. El archivo oficial queda fuera del recorrido manual confirmado; no se acredita READY/archivo oficial por una descarga técnica. |
| UAT-16 | FAIL | API de comprobante/idempotencia funciona, pero falta regla Backend de factura completa (incidencia abajo). Carga por navegador interrumpida antes de adjuntar. |
| UAT-17 | NO EJECUTADO | API: respuesta parcial con 22 resultados, prueba de replay y rechazo de ruta legada pasan. Componentes validan cada línea. Falta completar adjunto/registro y refresco visual en navegador. |
| UAT-18 | PASS | Dashboard observado y API posterior: producción ANG 2042.40, un paciente-día, una invoice cerrada, cero firmas pendientes; no duplica versión sustituida. Payer sintético no tiene code SVB: svbBilled vacío es correcto. Monedas separadas cubiertas por regresión automatizada. [Datos](../../docs/frontend/evidence/uat-20261103/dashboard-after-correction.json) |
| UAT-19 | NO EJECUTADO | Firma por teclado real, confirmaciones y cambios sin guardar cubiertos. Faltan resoluciones/puestos acordados y carga/descarga visual final. |
| UAT-20 | NO EJECUTADO | Reinicio local con seis documentos verificados PASS. Restauración y permisos tienen evidencia propia de DB/Backend; faltan smoke y responsables del entorno operativo/cliente. |

## Registro manual probado por API y límite del navegador

Draft completo 135, sin exportación: preparación 53 → UNCERTAIN → liberación con evidencia; nueva preparación 54, submission sintética 23 y respuesta PARTIALLY_REJECTED (una línea rechazada, 21 aceptadas). No hubo entrada ni respuesta reales de SVB. Referencias, motivos y filenames están rotulados QA. Comprobantes 156/157 son capturas de la aplicación sintética, **no recibos oficiales**. [Trece comprobaciones API](../../docs/frontend/evidence/uat-20261103/manual-api-checks.json): documento obligatorio 400, replays 200/mismos IDs, nueva clave duplicada 409, ruta de resultado antigua 409, 22 resultados y corrección posterior bloqueada 409.

Navegador comprobó preparar sin archivo, UNCERTAIN conservando reserva y rechazo de liberar sin evidencia. FileChooser no pudo adjuntar porque la extensión no tiene acceso a file URLs; después Computer Use terminó al no poder determinar con confianza la URL activa de Chrome en Windows. No se modificaron permisos de la extensión. El diálogo quedó abierto antes de subir. Las operaciones API posteriores son pruebas separadas; al retomar, descartar el formulario antiguo y volver a cargar el estado del servidor. No reintentar una presentación externa.

La captura de evento download tampoco completó la automatización. Se comprobó la descarga autenticada de bytes por API; eso no se informa como descarga de navegador aprobada.

## Incidencia que requiere Backend antes del piloto

**FE-07-01, prioridad alta, ABIERTA:** POST `/declarations/134/manual-entry/prepare` devolvió **201** con una sola línea de las 22 de invoice 232/v247. [Reproducción conservada](../../docs/frontend/evidence/uat-20261103/manual-invoice-contract-probe.json). Se liberó la reserva y canceló el Draft con motivo; no se presentó nada. El contrato confirmado es una presentación por factura, con sus procedimientos.

Frontend consulta la versión exacta y bloquea este caso y los dossiers con varias facturas. Backend debe imponer transaccionalmente una sola invoice/version y el conjunto completo de sus ítems, rechazando agrupaciones parciales/cruzadas incluso por API directa o concurrencia. Revisar `packet()` en manual-entry.service y añadir regresión de preparación/registro con dos lotes sobre la misma factura. La guardia de pantalla no cierra esta incidencia ni permite afirmar integridad completa del MVP.

## Checks y despliegue

Comprobaciones finales de Frontend: **lint PASS; build/TypeScript PASS; 370 pruebas en 15 archivos PASS; diff --check PASS**. Los ensayos fallidos anteriores (tipo Node en un test, expectativas de permisos/ruta/cita finalizada y MIME PNG para bytes JPEG) se corrigieron y no se contabilizan como ejecuciones aprobadas. Backend rechazó correctamente ese MIME inconsistente.

No se agregaron dependencias. No se ejecutaron suites/migraciones/cleanup sobre clínica. El root documental aislado conserva firma/PDF/comprobantes y la copia QA se conserva para reproducción. [Preparación del despliegue](PREPARACION_DESPLIEGUE_CLIENTE.md): root frontend, variables públicas, SPA, CORS/HTTPS/Storage y smoke pendientes. [Entrega DB](../../docs/base-de-datos/NEG_FINAL_07_09_HANDOFF.md) contiene su propia restauración y los bloqueos del destino; sus conteos no se atribuyen como tests Frontend frescos.

Se detuvieron únicamente los procesos antiguos propios 3407/5176. El laboratorio aislado 3408/5177 permanece en loopback para revisión, con PostgreSQL QA 55443 reanudado según la guía DB. No se detuvo el backend operativo del usuario ni el cluster 55439. Los archivos de sesión y scripts del laboratorio están bajo `frontend/node_modules/.cache/neg-func-qa`, ignorados por Git; no son credenciales para clientes ni una configuración de producción.

Pendiente antes de clientes: resolver FE-07-01, completar ocho filas NO EJECUTADO y repetir las afectadas, fijar versión candidata/URLs/Storage/operadores/recuperación con Arquitectura, cerrar fuentes/alcance con clínica y ejecutar el smoke del destino. No hubo deploy ni carga real SVB desde este chat.
