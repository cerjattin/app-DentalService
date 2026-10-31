# Frontend — NEG-FUNC-03/04/05

Fecha: 2026-10-31. Responsable: Frontend. Implementación y recorrido real completados en QA local dedicado para los escenarios descritos. El cierre transversal de Negocio/Arquitectura y la aplicación a Supabase operativo siguen separados de esta entrega.

## Fuentes y entorno

Se contrastaron [encargos FE03/04/05](../../docs/negocio/ENCARGOS_ASISTENTES_FUNC03_05.md), [organización](../../docs/negocio/CONTRATO_ORGANIZACION_SVB.md), [candidatos](../../docs/negocio/CONTRATO_CANDIDATOS_DECLARACIONES.md), [casos](../../docs/negocio/CONTRATO_CASOS_TRATAMIENTO.md), [resolución Draft](../../docs/negocio/CONTRATO_FRONTEND_REFACTURACION_DRAFT.md), rutas montadas, OpenAPI, API freeze y handoff. El [informe Backend](../../backend/docs/NEG_FUNC_03_04_05.md) publica las rutas consumidas.

- Backend QA: `http://127.0.0.1:3406/api/v1`; Vite QA: `http://127.0.0.1:5175`.
- PostgreSQL 17 dedicado, loopback `55439`, base `odontho_neg_func_test`, con migraciones previamente aplicadas por Backend/Base de datos. Esta entrega no ejecutó migraciones ni seeds generales.
- Organización sintética `43`; pacientes `297`/`298`; facturas fixture `280`/`281`, ítems `297`/`298`; cita creada mediante UI `401`; caso creado mediante UI `48` (`0000123`); declaración `135`.
- Se prepararon fixtures únicamente en esa base. Las facturas CLOSED son fixtures sintéticos de elegibilidad: **no acreditan un recorrido nuevo de firma, cierre o PDF**. Se conservaron para reproducción. La primera preparación necesitó añadir `createdByUserId` a los casos; sus registros parciales QA se conservaron y se completó el entorno, sin limpiar datos existentes.
- Credenciales de QA fuera de Git, bajo caché local ignorada. Tokens de la aplicación en memoria. Sin credenciales de base en Frontend ni archivos de evidencia.
- La conexión loopback necesitó ejecución fuera del sandbox. Se usaron procesos QA propios; el Backend habitual y Supabase operativo no se modificaron.

## FE03 — Settings y autoridad fiscal

Implementado `GET/PATCH /organization`, lectura `organization.read`, edición `organization.update`. PATCH mínimo con razón y `expectedRevision` opaca recibida; campos anulables se envían como null al limpiarlos. Declarant ID es texto de 1–5 dígitos y exige confirmación de cambio o limpieza. Navegación, recarga y cierre de formularios con cambios pendientes están protegidos. El router usa el data router de React Router para bloquear navegación interna.

409 conserva campos, motivo y revisión original. Comparar consulta el servidor sin reemplazar lo editado. Adoptar esa revisión requiere descartar explícitamente; no hay reenvío automático. La creación de declaraciones ya no captura ni envía Declarant ID: Draft vacío muestra no asignado y el detalle muestra el snapshot del servidor. Se invalidan organización y listas afectadas, sin reescribir históricos.

| Escenario | Evidencia y resultado |
| --- | --- |
| Guardar Trade name con razón | UI + API real PASS; [captura](evidence/neg-func-03-05/fe03-settings.png) |
| Revisión obsoleta por edición de un segundo cliente | PATCH concurrente 200; UI rechaza guardado obsoleto y conserva `QA unsaved phone`, motivo y valores locales; comparación explícita PASS; [captura](evidence/neg-func-03-05/fe03-conflict.png) |
| Recepción con lectura sin actualización | Campos deshabilitados, sin guardar/razón editable PASS; [captura](evidence/neg-func-03-05/fe03-readonly.png) |
| Ceros iniciales, cambio/limpieza con confirmación, PATCH mínimo | Dobles HTTP explícitos en pruebas PASS |
| Salida con cambios pendientes | Test de navegación real de data router PASS; aviso beforeunload observado en navegador y descartado conservando edición |
| Draft sin override manual y primera vinculación | UI real muestra no asignado; al agregar ítem congela `00781`; permanece tras retirar la última línea PASS |

## FE04 — Candidatos y resolución Draft

`GET /declarations/:id/candidates` con `declaration.read` + `invoice.read`, filtros `q/from/to`, página y tamaño del servidor. El diálogo muestra factura/versión, servicio, fecha, identidades congeladas, importe string, moneda e issues SVB. No deduce elegibilidad de los maestros ni mezcla monedas. Agrega un ítem por acción con `POST /declarations/:id/items`, `{invoiceItemId}`, `declaration.update`; deshabilita envío durante la petición. Un conflicto conserva diálogo/error y reconsulta disponibilidad sin reintento automático. Un cambio de estado concurrente deshabilita la selección.

La resolución del contrato anterior consume rutas reales: `DELETE /declarations/:id/items/:itemId`, donde itemId es **DeclarationItem.id**, y `POST /declarations/:id/cancel`, ambos con `{reason}`. Solo Draft y permiso de actualización. Los datos de `INVOICE_DECLARATION_ASSIGNED` se validan antes de construir enlaces a todos los lotes; el retorno a invoice es explícito, sin reapertura automática. El cierre de una versión CORRECTION exige también `invoice.apply_correction` además de `invoice.close`.

Agregar, retirar, cancelar y transiciones invalidan detalle/items/listas, candidatos de todos los lotes, invoices y Dashboard. No hay contadores ni disponibilidad reconstruidos desde una página del cliente.

| Escenario | Evidencia y resultado |
| --- | --- |
| Candidatos completos/incompletos reales | Ambas facturas aparecen con moneda/importe e issues; [captura](evidence/neg-func-03-05/fe04-candidates.png) PASS |
| Incompleto entra a Draft pero READY falla | Ítem `298` agregado; error SVB dentro del modal, lote sigue Draft; [captura](evidence/neg-func-03-05/fe04-incomplete.png) PASS |
| Retirar y volver a consultar | Retirado DeclarationItem `116` con motivo; invoice item `298` reaparece en candidatos; identidad del lote se conserva PASS |
| Cancelar con evidencia | Añadido ítem `297` con ordinal `2`; cancelado lote `135` con motivo; número, línea y snapshots permanecen visibles, sin acciones Draft; [captura](evidence/neg-func-03-05/fe04-cancelled.png) PASS |
| Filtros/página/empty/permisos | Dobles HTTP explícitos PASS; no petición de candidatos sin invoice.read |
| Carrera de asignación | Test UI con `DECLARATION_ITEM_ASSIGNED`: conserva modal, reconsulta candidatos y hace un solo POST PASS. La carrera simultánea PostgreSQL pertenece a la evidencia Backend/DB, no se atribuye a este test |
| Cuerpos y detalles de resolución | Tests verifican ID correcto en DELETE, razón JSON, cancelación sin status inventado, motivo retenido en conflicto y rechazo de detalles malformados PASS |

## FE05 — Casos y selector por paciente

Sección Treatment cases con búsqueda, estado, paginación, detalle, registro y edición. Consume `GET/POST /patients/:patientId/treatment-cases` y `GET/PATCH /patients/:patientId/treatment-cases/:caseId`. Lectura `treatment_case.read`; registro/edición `treatment_case.manage`. Solo se ofrece editar cuando Backend devuelve `isEditable`; no hay borrado ni transición de estado.

Selectores compartidos en creación y edición de citas: búsqueda/paginación por paciente, clave interna seleccionada automáticamente, referencia externa visible con ceros. Cambio de paciente limpia caso y búsqueda. Sin lectura no se consultan casos ni se solicita una clave manual. Lectura permite seleccionar sin gestionar. En actualización se envía tratamiento solo cuando cambió; borrar explícitamente envía null. `APPOINTMENT_CLINICAL_CONTEXT_LOCKED` conserva el resto de la edición, bloquea el selector y permite retener explícitamente la referencia registrada.

Se invalidan casos del paciente, detalle del paciente y citas afectados. Clinical identifica su clave interna y mantiene los Treatment ID externos históricos en los procedimientos como snapshots de lectura.

| Escenario | Evidencia y resultado |
| --- | --- |
| Crear/editar caso antes de vincular | UI real crea caso `48`, referencia `0000123`, edita descripción sin perder ceros; [captura](evidence/neg-func-03-05/fe05-case.png) PASS |
| Cambiar paciente | UI selecciona caso del paciente `297`, cambia a `298` y muestra selección vacía y solo su caso `0000002`; vuelve a `297` y selecciona el caso adecuado PASS |
| Persistir cita con caso | UI crea cita `401`; Edit appointment muestra el caso persistido; [captura](evidence/neg-func-03-05/fe05-appointment.png) PASS |
| Primera vinculación bloquea edición del caso | Al volver al paciente, el caso sigue PLANNED pero `isEditable=false`, sin editar; [captura](evidence/neg-func-03-05/fe05-linked-readonly.png) PASS |
| Permisos de Recepción | Caso sin utilizar muestra lectura y sin edición; [captura](evidence/neg-func-03-05/fe05-permissions.png) PASS. API real: listar 200, crear 403/PERMISSION_DENIED |
| IDs cruzados y estados no asignables | Test UI excluye opciones de otro paciente y deshabilita COMPLETED; autoridad Backend para rechazo efectivo preservada PASS |
| Fallo por primera utilización/bloqueo clínico | Tests mantienen edición/motivo, protegen cierre y conservan notas al retener referencia registrada PASS |
| Snapshots | Regresión Clinical/Billing/Declarations PASS; no escritura de históricos ni regeneración de documentos desde este flujo |

## Archivos de esta entrega

Rutas relativas a `frontend/src/`, salvo indicación:

- Integración común: `App.tsx`, `app/providers.tsx`, `components/forms/unsaved-changes.tsx`, `components/app-shell/navigation.ts`, `components/app-shell/app-shell.tsx`, `routes/router.tsx`, `routes/route-permissions.ts`, `api/error-messages.ts`.
- FE03: `types/administration.ts`; `features/administration/administration-api.ts`, `administration-model.ts`, `admin-settings-page.tsx`, `admin-page.tsx`; `types/declaration.ts`; `features/declarations/declaration-dialogs.tsx`, `declaration-model.ts`, `declarations-page.tsx`.
- FE04: `features/declarations/declaration-api.ts`, `declaration-candidate-dialog.tsx`, `declaration-cache.ts`, `declaration-draft-actions.tsx`, `declaration-detail-page.tsx`; `features/billing/declaration-assignment-model.ts`, `declaration-assignments.tsx`, `return-to-care.tsx`, `invoice-detail-page.tsx`.
- FE05: `types/treatment-case.ts`, `types/appointment.ts`; `features/treatment-cases/treatment-case-api.ts`, `treatment-case-model.ts`, `treatment-case-form.tsx`, `treatment-case-selector.tsx`, `treatment-cases-section.tsx`; `features/patients/patient-detail-page.tsx`; `features/appointments/appointment-create-dialog.tsx`, `appointment-create-model.ts`, `appointment-update-dialog.tsx`, `appointment-detail-page.tsx`; `features/clinical/clinical-appointment-page.tsx`.
- Pruebas: `test/neg-func-03-05.test.tsx`, `test/administration.test.tsx`, `test/declarations.test.tsx`.
- Documentación: este informe, [HTTP QA sin secretos](NEG_FUNC_03_04_05_HTTP_QA.json), capturas enlazadas, [gaps actuales](KNOWN_CONTRACT_GAPS.md) y [guía Frontend](../../docs/frontend/README.md).

## Comprobaciones frescas y límites

| Comprobación desde frontend | Resultado |
| --- | --- |
| `npm run lint` | PASS |
| `npm run build` (TypeScript + Vite) | PASS |
| `npm run test -- --run` | **12 archivos, 330 pruebas PASS** |
| Rutas/enlaces locales y `git diff --check` | PASS |
| Chrome contra Backend/PostgreSQL dedicado | PASS en escenarios reales indicados arriba |

Las expectativas anteriores que declaraban Settings inexistente y exigían copiar IDs se actualizaron al contrato publicado. Las primeras ejecuciones detectaron esas tres expectativas, una separación necesaria para Fast Refresh y un tipo de fixture; fueron corregidos antes de la pasada final. No se presentan esos fallos como aceptación.

Pendientes de aceptación transversal: matriz móvil/tablet y revisión de Diseño; regreso completo a Clinical tras resolver varios lotes con firmas/PDF reales y los dos permisos de cierre de corrección; carrera real de asignación y aislamiento de organizaciones revisados por Backend/DB; repetición de estas funciones en Supabase después de la aplicación controlada de sus migraciones/permisos por las áreas responsables. El recorrido de navegador actual no incluyó más de una página real de candidatos/casos, ni un nuevo ciclo completo de firma/PDF; la paginación y conflictos adicionales están cubiertos con dobles explícitos. Estos límites no autorizan declarar cerrados los contratos de todas las áreas.

No hubo commit, push, merge, despliegue, cambios de esquema, sincronización de roles operativos ni limpieza de datos clínicos. Se preservaron los cambios locales/staged existentes y los contratos fuente.
