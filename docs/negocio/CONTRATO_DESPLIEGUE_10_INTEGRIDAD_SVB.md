# NEG-DEP-10 — Integridad de factura y aplazamiento SVB

Fecha: 2026-11-03. Estado inicial: PENDIENTE. Responsable de implementación: Backend. Revisión independiente: Base de datos. Integración: Frontend. [Alcance vigente](CIERRE_PRIMER_DESPLIEGUE_20261103.md).

## DEP10-A — Corregir FE-07-01

Disparador: preparar expediente o registrar una presentación manual por las rutas ya montadas. La unidad confirmada por el usuario es **una factura completa**, no una selección de sus procedimientos. Frontend ya bloquea el caso; falta la regla autoritativa Backend.

Antes de crear una reserva nueva, Backend valida dentro de la transacción:

1. Todos los ítems pertenecen a una sola invoice y una sola versión actual CLOSED de esa organización/payer; firma/hash e identidad fiscal son coherentes.
2. El conjunto de invoiceItemId coincide exactamente con **todos** los ítems de esa versión CLOSED, sin faltantes, repetidos ni extras. No basta comparar el total de filas o importes. Consultar persistencia; no recibir la lista autoritativa desde el cliente ni deducir integridad del PDF.
3. Se conservan locks, exclusividad de asignación, protección contra corrección y cambios de lote, idempotencia y rollback de auditoría. Lecturas y validación deben usar el mismo estado transaccional; carreras no pueden reservar dos partes como presentaciones independientes.
4. Al registrar, se comprueba el contenido contra la reserva congelada. Replays válidos devuelven el resultado original, sin mutar documentos, fechas o hashes. No reescribir reservas/historia antiguas inconsistentes; diagnosticarlas y resolverlas explícitamente.

Publicar 409 con códigos `MANUAL_ENTRY_SINGLE_INVOICE_REQUIRED` para mezcla de factura/versión y `MANUAL_ENTRY_INCOMPLETE_INVOICE` para conjunto incompleto. Detalles con IDs string/counts propios solo si el actor tiene permiso de lectura; ninguna fuga entre organizaciones. Mantener los errores existentes de fuente no vigente, permisos o idempotencia cuando corresponda. Si se adopta un código equivalente existente, actualizar OpenAPI/handoff y Frontend juntos.

Permisos actuales se conservan: preparar requiere declaration.submit/read e invoice.read; registrar requiere declaration.submit y validaciones de contexto del servidor. Admin actúa por permisos, sin excepciones por nombre de rol.

Pruebas mínimas en QA dedicado: factura completa de varias líneas PASS; una de 22 líneas 409 sin reserva/auditoría parcial; mezcla de facturas/versiones 409; dos lotes con partes de la misma factura ambos rechazados; conjunto completo concurrente con un solo ganador; corrección concurrente no invalida snapshots; registro/replay y fallo de auditoría conservan historia. Reutilizar la [reproducción Frontend](../../docs/frontend/evidence/uat-20261103/manual-invoice-contract-probe.json) como evidencia histórica, sin modificar su resultado original.

## DEP10-B — Primer despliegue con SVB pendiente

El envío/presentación real queda aplazado. No fabricar archivo, adaptador, fuente o respuesta externa. Conservar los bloqueos REAL_SVB existentes y el diagnóstico de fuentes pendientes. Los estados técnicos READY/EXPORTED no significan presentación.

Backend publica una capacidad autoritativa en GET `/api/v1/svb-pilot/readiness` para el alcance de despliegue, reutilizando `manualPortalRecordingEnabled`: **false cuando se aplaza el flujo SVB**. Control por configuración validada del servidor, seguro por defecto; habilitación explícita solo en QA sintético para probar el recorrido existente. El cliente no puede habilitarla con body/query/header, permiso Admin o VITE. Publicar el nombre exacto de configuración en .env.example y handoff.

Cuando está aplazado, ninguna preparación nueva ni registro nuevo puede avanzar a presentación: POST `/:id/manual-entry/prepare` y `/:id/submissions/manual` rechazan con 409 `SVB_PRESENTATION_DEFERRED`, después de autenticar/autorizar sin filtrar recursos ajenos. Mantener consulta de historia/expediente interno y las operaciones necesarias para resolver reservas existentes, incertidumbre y respuestas de hechos ya registrados. Replays de una operación confirmada devuelven su evidencia original sin crear otra; Backend documenta y prueba el orden de estas comprobaciones. No dejar una reserva antigua imposible de resolver ni borrar un hecho existente al apagar la capacidad.

Frontend consume esta capacidad y muestra en inglés **“SVB submission pending — file specification not confirmed.”** junto al diagnóstico. No habilita preparar/registrar nuevas presentaciones en este alcance. Conserva lectura histórica y descarga interna con su advertencia. Falta de readiness o error de red no se interpreta como habilitado. No agregar una promesa de envío al completar una factura.

Pruebas: modo aplazado rechaza API directa por Admin y los otros permisos; no crea reservas/submissions ni cambia contadores/estados; REAL_SVB permanece bloqueado; replays e historial anterior íntegros; QA explícito permite probar DEP10-A; UI respeta capacidad false/ausente/error y protege formularios. Rehabilitar presentación real posteriormente requiere contrato de fuente/formato y aceptación, no solo cambiar una bandera.

## Entregas y propiedad

Backend: cambios en módulos de declaraciones/readiness/config, pruebas, .env.example, OpenAPI y documentos API_FREEZE_BACKEND/FRONTEND_HANDOFF y entrega propia. Mantener repositorios para persistencia y servicios para reglas. DB revisa carreras/integridad y añade pruebas independientes en archivos nuevos; no altera SQL ya aplicado. Si hace falta esquema nuevo, acordar editor único y una migración nueva, nunca modificar checksums anteriores.

Backend ejecuta typecheck/build/unitarias y la integración pertinente en DB dedicada; DB documenta su revisión; Frontend ejecuta lint/build/tests y prueba ambas capacidades en QA. Cierre: FE-07-01 resuelto también por API, código y contratos sincronizados, ninguna presentación real realizada.
