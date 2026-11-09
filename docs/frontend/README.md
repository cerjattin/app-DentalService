# Frontend

## Responsabilidad y ubicación

Pantallas, navegación, formularios, permisos de interfaz, estado remoto, caché y manejo centralizado de errores. Código en `frontend/`; instrucciones específicas en [frontend/AGENTS.md](../../frontend/AGENTS.md).

## Organización actual

- `src/features/`: Auth, Reception, Patients, Appointments, Clinical, Billing, Declarations, Administration, Dashboard y preparación Dentalink.
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

## Entrega OPS-02 — 2026-11-09

La validación local abarca cita, atención por servicios, cobro, firma y corrección de la misma factura con PDF por versión. La preparación Dentalink consume la API interna publicada y se verificó con un lector sintético de dos páginas. Se documentan las evidencias, el guion para Diseño y las dependencias de la cola por estado, la conexión real y el destino publicado. [Entrega OPS-02](OPS_02_ENTREGA.md)

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

## NEG-FINAL-06 — datos SVB y alcance real, 2026-11-02

Frontend consume el nuevo GET `/svb-pilot/readiness` y `realPresentationReadiness`, mostrando bloqueo real, motivos y listas habilitadas vacías desde Backend. Las sedes muestran policlinicCode en lectura. Candidatos explican sus issues por línea y enlazan a la versión exacta de factura; los ítems agregados ofrecen revisión de snapshots sin edición/defaults. READY/export envían propósito TECHNICAL explícito y la interfaz distingue revisión técnica de autorización real. Se amplía invalidación de candidatos/Dashboard al guardar correcciones o cambiar estado de factura.

Comprobaciones frescas: lint/build y **351 pruebas en 13 archivos PASS**. Navegador/HTTP contra QA dedicado: piloto bloqueado, diagnóstico, origen de factura, nulls conservados, READY técnico incompleto rechazado y REAL_SVB rechazado con 409 sin cambiar snapshots. Se conserva Draft sintético `136` para reproducción; sin presentación ni exportación real.

La operación real no está cerrada: faltan ficha clínica/formato aprobados y las APIs de captura/configuración dependientes de ellos. El diagnóstico exhaustivo de líneas ya agregadas necesita publicación Backend; la revisión de snapshots no lo simula. [Entrega, evidencias, archivos y dependencias](../../frontend/docs/NEG_FINAL_06_VALIDATION.md). No se modificaron Backend, schema, seeds o Supabase operativo desde Frontend.

## NEG-FINAL-07/08/09 — registro manual y preparación, 2026-11-03

Integradas las rutas publicadas de expediente/reserva, incertidumbre/liberación, comprobante y respuesta por línea. Usuario confirmó una presentación por factura, sin plantilla de carga: [campos propuestos y futura agrupación/API](../../frontend/docs/PROPUESTA_REGISTRO_MANUAL_SVB.md). La pantalla exige factura completa, evidencia y referencia o ausencia motivada; conserva la misma solicitud al reintentar. Entorno/versión visibles, firma por teclado y configuración SPA preparados.

Checks frescos: lint/build y **370 pruebas en 15 archivos PASS**. En copia PostgreSQL sintética aislada: firma/cierre/PDF de v1 y corrección completa v2 con VOID histórico; dos páginas de candidatos; dos lotes bloqueantes; concurrencia 201/409; evidencia/idempotencia/resultado parcial por API; seis documentos con hash verificado tras reinicio. No se atribuye la API como aprobación del adjunto desde navegador, cuyo control terminó al no poder confirmar la URL activa.

**Piloto pendiente:** Backend aceptó preparar solo 1 de 22 líneas de una factura (FE-07-01); Frontend lo bloquea, pero hace falta integridad en servidor. La matriz conserva un FAIL y ocho NO EJECUTADO, además de fuentes/operación/smoke pendientes. [Entrega completa y evidencias](../../frontend/docs/NEG_FINAL_07_09_VALIDATION.md), [preparación Vercel](../../frontend/docs/PREPARACION_DESPLIEGUE_CLIENTE.md). Se preservaron cambios locales y no se hizo commit, push, deploy ni presentación SVB real.

## NEG-DEP-10/11/12 — avance local 2026-11-03

Integrados readiness autoritativo y errores de SVB aplazado; factura incompleta rechazada 409 y completa preparada en QA explícito. Corregidos guard de notas Clinical, foco de Dialog, actualización manual de Reception, errores accesibles de adjunto, validación inglesa de paciente y retorno de login al destino/versión. Tres perfiles en navegador parcial; aislamiento con IDs ajenos existentes pasa por API; paciente/seguro CRUD-verificación completo en navegador. Firmas/PDF previos preservados.

Propios: lint/build PASS, regresión enfocada 53+2 PASS. Negocio verificó independientemente lint y 379/379 tests en 16 archivos sobre la huella indicada en la entrega. **DEP11 sigue parcial:** adjunto/descarga visual bloqueados por extensión/URL no verificable, UAT07, matriz de roles/aislamiento visual, zoom/sesión/desconexión y reensayos pendientes. SVB externo APLAZADO POR ALCANCE; solo QA local por decisión vigente. [Matriz nueva, DES, evidencias, hashes y pendientes](../../frontend/docs/NEG_DEP_11_12_VALIDATION.md). Los informes anteriores conservan su estado histórico; FE-07-01 tiene reensayo PASS nuevo, sin borrar su FAIL original. Arquitectura necesita capturar un nuevo candidato tras las correcciones.

Continuación documental DEP11: [criterio UAT07 de Negocio](../negocio/CONTRATO_DESPLIEGUE_11_ACEPTACION_CLINICA.md#criterio-de-negocio-para-uat-07-en-qa-local) ya definido; pendiente ejecución/evidencia y aceptación del alcance real por clínica. [Pasos manuales de adjunto/descarga](../../frontend/docs/MANUAL_QA_DEP11.md), no ejecutados. Comparación de lectura: inputs del build Frontend y173 archivos Frontend del candidato `dep12-092a67db50d812ff` sin cambios; esta aclaración no requiere nueva suite ni compilación. Arquitectura valida el conjunto y vincula informes manteniendo DEP11 parcial y SVB aplazado.
