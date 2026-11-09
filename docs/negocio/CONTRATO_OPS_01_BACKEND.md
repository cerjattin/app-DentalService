# OPS-01 Backend

Iniciar implementación local sobre los cambios existentes. Leer el [contrato común](CONTRATOS_OPERACION_20261107.md), el [contrato de API y reglas](CONTRATO_ATENCION_FACTURACION_DENTALINK_20261106.md), AGENTS.md, la guía Backend, API_FREEZE_BACKEND, FRONTEND_HANDOFF y BACKEND_RELEASE_CHECKLIST.

## Entrega de atención y factura

Verificar las rutas montadas de inicio `POST /appointments/:appointmentId/clinical-encounter/start`, registro `POST /clinical-encounters/:id/procedures`, retiro DELETE y entrega `POST /clinical-encounters/:id/finish-services`. Completar cualquier defecto de transacción, idempotencia de inicio, aislamiento, permisos o compatibilidad con atenciones existentes. Revisar carreras entre agregar/retirar, cierre, cambio de cita y creación de factura. Validar el comportamiento de citas históricas CHECKED_IN/IN_PROGRESS y de una cita COMPLETED con atención reabierta por corrección.

Mantener el cuerpo mínimo `{ svbProcedureId, quantity? }` y los importes pendientes como null. Verificar que la búsqueda de catálogo permita registrar servicios activos sin tarifa. El cliente anterior que envía seguro mantiene un contrato compatible, sin convertirlo en requisito del nuevo recorrido.

Revisar `priceRecordedServices` dentro de la transacción de factura. Una cobertura y una moneda elegibles únicas permiten selección automática. La ambigüedad produce un error accionable. La ausencia de tarifa o datos administrativos revierte solo el intento de factura. Los servicios permanecen registrados. Respetar redondeo Decimal por línea, histórico y moneda/cobertura de refacturación. Verificar una nueva línea sin valorar después de retorno a atención y una nueva firma sobre la versión reconstruida.

Verificar los permisos efectivos de Profesional, Recepción y Admin. La UI no determina autorización. Coordinar cambios del seed o de permisos persistidos con DB. Revisar reportes para que atenciones/unidades sin precio se contabilicen y sus totales monetarios no atribuyan ingresos cobrados a servicios pendientes de cobro.

## Entrega del módulo Dentalink

Preparar ahora el módulo interno de importación con adaptador inyectable de lectura, validación de datos normalizados, vista previa de incidencias, confirmación e idempotencia. Reutilizar reglas y numeración existentes de pacientes y citas. Mantener la identidad externa y la operación local en una transacción. DB acuerda primero modelo/índices/migración. El adaptador sintético de pruebas debe estar confinado a pruebas.

Antes de publicar rutas, documentar en OpenAPI y FRONTEND_HANDOFF sus DTO, paginación, permisos, organización, estados, errores y comportamiento de reintento. Conexión deshabilitada o falta de configuración debe producir estado explícito y recuperable. La interfaz normalizada conserva IDs externos como strings y fechas con zona. Cada campo obligatorio del modelo local necesita dato verificable o incidencia.

El acceso Dentalink no está habilitado y su referencia técnica no pudo verificarse en esta ronda. El adaptador HTTP real queda pendiente de autentificación, recursos, paginación, límites y muestras oficiales. No se debe deducir esa interfaz a partir de ejemplos de terceros. El módulo solo puede anunciar importación real después de completar esa validación.

La primera importación es de pacientes y citas nuevos, en lectura hacia esta aplicación. Resolver mapeos de profesional/sede por organización. Coincidencia por nombre o documento no basta para fusionar automáticamente. Una cita importada entra SCHEDULED y pasa por confirmación local. Registrar conteos, vínculos y errores técnicos sin tokens ni datos personales en logs.

## Verificación y entrega

Ejecutar typecheck, build, unitarias y las integraciones afectadas en PostgreSQL sintético propio. Cubrir flujo por HTTP, retorno/refacturación, permisos y organización, fallos a mitad, captura/cierre concurrentes y reintentos de importación. La recuperación optativa se ejecuta en bases separadas de los fixtures de producto.

Actualizar docs/backend/README.md y entregar `docs/backend/OPS_01_ENTREGA.md` con archivos, checks, límites reales y contrato consumible por Frontend. Backend mantiene sus servicios, repositorios y backend/docs. Schema, SQL y generación Prisma pertenecen a OPS-03. El envío SVB y la operación del despliegue tienen su alcance pendiente propio.
