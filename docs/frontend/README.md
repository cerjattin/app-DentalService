# Frontend

## Responsabilidad y ubicación

Pantallas, navegación, formularios, permisos de interfaz, estado remoto, caché y manejo centralizado de errores. Código en `frontend/`; instrucciones específicas en [frontend/AGENTS.md](../../frontend/AGENTS.md).

## Organización actual

- `src/features/`: Auth, Reception, Patients, Appointments, Clinical, Billing, Declarations, Administration y Dashboard.
- `src/api/`: transporte HTTP y errores.
- `src/auth/`: sesión en memoria y permisos.
- `src/features/svb-catalog/`: API y query keys compartidos por Clinical y Services.
- `src/components/` y `src/index.css`: componentes y estilos compartidos.

## Contrato con otras áreas

Consumir exclusivamente endpoints reales del backend bajo `/api/v1`. Mantener `EntityId` y `DecimalString` como strings. TanStack Query administra estado de servidor; React Hook Form/Zod administra formularios. El backend conserva la autoridad de permisos y reglas.

La migración Supabase debe ser transparente para las pantallas cuando el contrato HTTP no cambie. No añadir acceso directo a tablas, credenciales de base ni claves privilegiadas en variables `VITE_*`.

## Prioridades

1. Conservar la creación compartida de citas y los siete indicadores del Dashboard existentes. Preservar los cambios locales de filtros Provider/período.
2. Comprobar cuáles hallazgos de la auditoría siguen vigentes: notas sin guardar, frescura entre puestos, selectores paginados, respuestas malformadas y accesibilidad de firma.
3. Settings consume el contrato de organización publicado, con revisión opaca, motivo y permisos independientes. La aceptación local está en el informe NEG-FUNC-03/04/05; la aplicación a Supabase requiere las migraciones/permisos coordinados por Backend/Base de datos.
4. Ejecutar regresión de Clinical, Services, Billing y Declarations tras PostgreSQL.
5. Preparar URLs de API y navegación directa de SPA para Vercel durante la etapa final.

## Validación y entrega

Desde `frontend`: `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd test`. QA de navegador con backend de pruebas para flujos autenticados y resoluciones operativas.

Coordinar experiencia y componentes con Diseño; reglas con Negocio; campos y errores con Backend. Entregar archivos, pruebas y estados pendiente/bloqueado; documentar gaps en vez de simular funcionalidades sin contrato.

Fuentes: [gaps](../../frontend/docs/KNOWN_CONTRACT_GAPS.md) y [correcciones operativas](../../frontend/docs/OPERATIONAL_CORRECTIONS.md).

## Validación local contra Supabase — 2026-10-30

El usuario confirmó PostgreSQL aplicado y Postman aprobado. Se ejecutó la validación frontend con el backend local disponible: lint/build y 301 pruebas en 11 archivos pasan. En navegador se recorrieron paciente/seguro, citas desde ambas entradas, atención con dos procedimientos, catálogo compartido, factura única de ANG 177.60, firma QA autorizada, cierre y PDF descargado. Declaración QA creada con sus dos ítems; permanece Draft por snapshots SVB incompletos.

Dos incidencias abiertas: **FEV-01 (Backend, P1)**, el filtro `appointments?date` usa medianoche UTC y omite citas de 20:00–23:59 Curaçao en Reception; **FEV-02 (Frontend, P2)**, el error de validación SVB queda detrás del diálogo modal. No se modificó código de producto ni los cambios locales existentes. Corrección/reemplazo completo, exportación con fixture SVB completo, aislamiento entre organizaciones y matriz responsive siguen pendientes de aceptación contra Supabase.

Detalle, reproducciones, registros sintéticos conservados y evidencia: [validación frontend](../../frontend/docs/SUPABASE_VALIDATION_20261030.md), [comprobaciones HTTP](../../frontend/docs/SUPABASE_VALIDATION_20261030.json). Esta entrega no cambia contratos ni los estados históricos de las guías de otras áreas.

## Correcciones posteriores y formato de factura — 2026-10-30

**FEV-01 y FEV-02 corregidas y verificadas en navegador.** Backend interpreta `appointments?date` como día de Curaçao; Reception vuelve a mostrar las citas nocturnas. Los errores de validación/envío de declaraciones se anuncian dentro del modal activo y se limpian al cancelar. Frontend: lint/build y 303 pruebas pasan.

El usuario aportó el formulario SVB y confirmó Aantal como cantidad del procedimiento. El backend genera el nuevo PDF con snapshots y firma guardada visible, sin sustituir los documentos históricos. QAI-000002 tiene documento SVB 5 y conserva su documento técnico 4. Backend: typecheck/build y 80 pruebas unitarias pasan. Sin cambios de endpoints, permisos ni esquema. Los campos sin snapshot siguen vacíos.

Archivos, mapeo, dependencias, comprobaciones y pendientes: [entrega coordinada](../../backend/docs/SVB_FORM_AND_OPERATIONAL_FIXES.md), [evidencia HTTP actual](../../frontend/docs/SUPABASE_FIXES_20261030.json). El informe de la pasada anterior sigue siendo evidencia histórica, no el estado actual de esas incidencias.

## Regreso de factura a Clinical — 2026-10-30

Invoice detail ofrece **Return to clinical care** por permisos, con motivo obligatorio y errores dentro del diálogo. Tras corregir y completar la atención, Billing ofrece **Rebuild invoice from corrected services**. La nueva versión vacía muestra el siguiente paso y oculta preparación de firma hasta reconstruirse. Clinical explica cómo retirar/agregar un servicio antes de completar; el historial facturado se conserva. Las regresiones cubren permisos, navegación, conflictos, refacturación y retiro/reingreso por profesionales. [Contrato y validación](../../backend/docs/CLINICAL_REBILLING.md).

## Preparación NEG-FE-REBILL-02 — 2026-10-31

Se contrastó el [nuevo contrato de Negocio](../negocio/CONTRATO_FRONTEND_REFACTURACION_DRAFT.md) con las rutas y el código actuales. Retiro de ítems Draft, cancelación Draft y `error.details.assignments` siguen pendientes de publicación Backend; no se habilitan rutas inexistentes. Se prepararon entregables, permisos/estados, diálogos con motivo, caché, retorno seguro a la invoice y matriz de aceptación. Se identificó además el ajuste frontend del cierre de correcciones: exigir `invoice.close` e `invoice.apply_correction`.

[Plan preparado y dependencias](PREPARACION_NEG_FE_REBILL_02.md). Esta pasada es documental: no modifica producto ni acredita aceptación PostgreSQL/navegador. Se conservaron el contrato fuente y los cambios locales existentes.

## Integración NEG-FUNC-03/04/05 — 2026-10-31

Implementados Settings y revisión/conflicto sin perder edición; retirada la captura manual de Declarant ID; candidatos reales con filtros/paginación/diagnóstico; retiro y cancelación Draft con motivo; enlaces seguros a lotes que bloquean Clinical; casos del paciente y selector compartido de citas por permisos. Los snapshots permanecen de lectura y el caso vinculado se vuelve no editable según Backend. El cierre de correcciones exige invoice.close e invoice.apply_correction.

Comprobaciones frescas: lint/build PASS y **330 pruebas en 12 archivos PASS**. Recorrido Chrome contra Backend 3406/PostgreSQL 17 dedicado odontho_neg_func_test: guardado y conflicto real de Settings, lectura de Recepción, creación/edición/vinculación de caso, cambio de paciente, candidato incompleto y bloqueo READY, retiro/liberación y cancelación con histórico conservado. Sin migraciones ni cambios a Supabase operativo; no acredita cierre transversal ni un ciclo nuevo de firma/PDF.

[Archivos, rutas, permisos, evidencias y pendientes](../../frontend/docs/NEG_FUNC_03_04_05_VALIDATION.md). El estado documental de preparación anterior es histórico; las rutas publicadas por Backend ya se integraron en esta entrega.
