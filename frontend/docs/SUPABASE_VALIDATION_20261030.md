# Frontend contra backend local / Supabase — 2026-10-30

Resultado: **recorrido principal validado con dos incidencias abiertas; aceptación completa del MVP pendiente**.

El usuario confirmó PostgreSQL aplicado en Supabase y Postman aprobado. En disco se comprobó Prisma PostgreSQL/PrismaPg; el backend local responde con base disponible. No se reaplicaron migraciones, seeds ni pruebas de integración de base de datos. La guía común de migración todavía conserva estados históricos pendientes; esta entrega no modifica los documentos de Arquitectura/Base de datos.

## Entorno y validación real

- Frontend: `http://localhost:5173`; `VITE_API_BASE_URL=http://localhost:3000/api/v1`.
- Backend local iniciado con `npm run dev:supabase`, según el usuario; `/health/live` y `/health/ready` devolvieron 200.
- Navegador: Chrome, viewport de escritorio existente. No se simularon respuestas del backend.
- `npm.cmd run lint`: PASS, salida 0.
- `npm.cmd run build`: PASS, TypeScript y Vite, salida 0.
- `npm.cmd test`: PASS, 301 pruebas / 11 archivos. Estas pruebas usan mocks; la evidencia contra el backend real se registra por separado.
- [Comprobaciones HTTP complementarias](SUPABASE_VALIDATION_20261030.json): sesiones QA existentes, lecturas y descarga de PDF. Sin mutaciones de dominio ni acceso directo a Supabase. Script local reproducible: `frontend/qa/supabase-20261030/verify-readonly.mjs`, excluido por la regla existente `qa/`.

## Recorrido observado en navegador

| Flujo | Resultado comprobado |
| --- | --- |
| Login | Admin y Provider QA ingresan; Reception QA se autentica también en la comprobación HTTP |
| Permisos | Provider puede leer Services; no ve Create service ni Users. API Users devuelve 403 `PERMISSION_DENIED`; `/auth/me` sigue funcionando con el mismo token |
| Paciente/seguro | Creación de paciente sintético, seguro primario y registro de fuente de verificación; búsqueda `Jose` encuentra `José` conservando el texto original |
| Citas | Creación desde Appointments y Reception con selección explícita de paciente/profesional/sede; numeración QAA-000002 / QAA-000003 |
| Zona horaria | 2026-10-30 20:00 Curaçao se almacena como 2026-10-31T00:00:00.000Z; la agenda sin filtro muestra el horario correcto |
| Reception | FAIL: las dos citas nocturnas no aparecen en el worklist del día; incidencia FEV-01 |
| Clinical | Check-in, inicio de cita, apertura de encounter, guardado de notas; Complete encounter se deshabilita con notas pendientes |
| Catálogo compartido | Servicio y tarifa sintéticos creados desde Services aparecen en Clinical; dos procedimientos de ANG 88.80 |
| Factura | Una factura QAI-000002, una versión original, dos ítems y total exacto ANG 177.60; estados y cantidades son strings donde corresponde |
| Firma/cierre | Preparación, revisión de contenido, trazo QA, guardado de evidencia, Confirm signed y Close invoice; autorización explícita del usuario obtenida antes del guardado permanente |
| PDF | Generado, obtenido mediante diálogo Invoice PDF y enlace Download PDF; archivo local de 8.133 bytes, MIME `application/pdf`, cabecera `%PDF-` |
| Histórico | Factura cerrada previa QAI-000001 se muestra como solo lectura; no se modificó |
| Declaración | Creación QAD-000001 y adición de los ítems 3 y 4 obtenidos de la API, sin IDs inferidos. La validación rechaza snapshots SVB incompletos y conserva Draft |
| Error de declaración | Mensaje centralizado en inglés correcto, pero queda detrás del diálogo modal: incidencia FEV-02 |
| Dashboard | Siete indicadores; selección de profesional conservada al buscar; fechas invertidas rechazadas; actualiza al volver a la pantalla después de las operaciones |

Las comprobaciones HTTP verifican IDs string, quantities/importes string, versión CLOSED, firma asociada, descarga autenticada y agrupación monetaria. En esa captura Production era ANG 378.10, Appointments 2, Pending Signatures 0 y Closed Invoices 1. El pagador QA tiene código QA-POSTMAN-SVB; no se espera que incremente SVB Billed, reservado al código real SVB.

## Incidencias reproducibles

### FEV-01 — P1 — Día UTC en el filtro de citas (Backend)

1. Crear citas para 2026-10-30 a las 20:00 y 21:00 en America/Curacao, como los IDs 6 y 7.
2. La agenda sin filtro y el detalle muestran las citas correctamente.
3. `GET /appointments?date=2026-10-30&page=1&pageSize=100` devuelve una lista vacía.
4. La lectura con `from=2026-10-30T00:00:00-04:00` y `to=2026-10-31T00:00:00-04:00` devuelve ambas.

La causa se encuentra en `backend/src/modules/appointments/appointment.service.ts`, filtro `query.date`: utiliza `parseDateOnly` más 86.400.000 ms; `backend/src/shared/utils/date-only.ts` interpreta el inicio como medianoche UTC. Reception consume ese contrato. El Dashboard usa límites explícitos de Curaçao y sí cuenta ambas citas.

Handoff: Backend debe convertir el día de negocio a intervalo de instantes `[inicio, día siguiente)`, conservando el contrato HTTP. Verificar límites 00:00, 19:59, 20:00 y 23:59 en Curaçao y regresión de Appointments/Reception. No se aplicó un parche frontend que cambie la semántica del contrato.

### FEV-02 — P2 — Error detrás del diálogo de validación (Frontend)

1. En QAD-000001, con los ítems 3 y 4, pulsar Validate and mark ready y confirmar.
2. Backend rechaza los snapshots incompletos; el lote sigue Draft.
3. El mensaje “Required SVB snapshot data is missing. Review the source invoice version.” se renderiza en la página detrás del modal, fuera del árbol accesible activo. Solo se lee al cancelar/cerrar el diálogo.

La página `frontend/src/features/declarations/declaration-detail-page.tsx` muestra `mutationError` fuera del `ConfirmDialog`; `frontend/src/components/ui/confirm-dialog.tsx` no admite un error dentro del diálogo. Próximo cambio frontend: mostrar el error en el modal activo y verificar con una prueba de accesibilidad/alcance del diálogo. Revisar también la confirmación de envío que comparte el patrón. Esta entrega registra la incidencia sin modificar código de producto.

## Datos sintéticos conservados

Prefijo de esta pasada: `QA-FE-20261030-1831`. No son datos clínicos ni catálogo/tarifas SVB oficiales.

| Recurso | Identificador / estado final |
| --- | --- |
| Paciente | 3 / QAP-000002 |
| Cita principal | 6 / QAA-000002 / COMPLETED |
| Cita de Reception | 7 / QAA-000003 / SCHEDULED |
| Encounter | 2 / COMPLETED |
| Servicio | 3 / QA-FE-20261030-1831 / ACTIVE; tarifa QA ANG 88.80 desde 2026-10-01 |
| Factura/versión | 2 / QAI-000002 / versión ID 2 / CLOSED |
| Ítems de factura | 3 y 4 |
| PDF | Documento 4; QAI-000002-v1.pdf |
| Declaración | 1 / QAD-000001 / DRAFT; dos ítems con snapshots incompletos |

No se ejecutó cleanup. No se modificaron registros QA previos, permisos, snapshots firmados ni datos clínicos. El backend generó firma/PDF con su almacenamiento local vigente.

## Límites y próximos pasos

- Corregir FEV-01 con Backend y FEV-02 en Frontend, luego repetir sus reproducciones.
- Exportación de la nueva declaración bloqueada por snapshots incompletos; no se inventaron TreatmentId, NumberOfTreatments ni Assistance. Negocio/Backend deben acordar un fixture completo para probar READY/exportación.
- No se probó en navegador esta pasada el ciclo completo de corrección/reemplazo, la asignación de diagnósticos/autorizaciones, aislamiento entre organizaciones ni una matriz tablet/móvil. Las pruebas automatizadas que cubren partes de esos flujos no sustituyen dicha aceptación contra Supabase.
- No se intentó envío real SVB ni se alteró el contrato de organización/Settings, auth o sesión.
- Archivos de producto y correcciones locales del Dashboard preservados. Esta entrega añade evidencias y actualiza la guía del área; no hay commit, push o despliegue.

Evidencia visual local: [factura cerrada](qa/supabase-20261030/invoice-closed.png), [error detrás del diálogo](qa/supabase-20261030/declaration-error-behind-dialog.png). Las capturas están excluidas de Git por la regla existente `qa/`.
