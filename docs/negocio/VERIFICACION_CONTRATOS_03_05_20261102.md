# Verificación local de NEG-FUNC-03/04/05

Fecha: 2026-11-02. Referencia Git inspeccionada: `0bff419bd` — contratos 03 al 05 en backend y frontend con los cambios a supabase. El árbol estaba limpio al iniciar la revisión. La revisión no aplica migraciones/seeds ni opera sobre datos clínicos.

## Resultado

Los tres contratos tienen implementación local en Backend, soporte PostgreSQL y Frontend. Ya no corresponde volver a encargar su implementación desde cero. Se conserva una distinción entre código comprobado, pruebas ejecutadas hoy, evidencia histórica de integración y aceptación del entorno donde se utilizarán datos reales.

| Contrato | Comprobado en código local | Evidencia |
| --- | --- | --- |
| 03 — Organización | GET/PATCH montados; permisos, revisión SHA-256, lock, auditoría y rechazo de override fiscal; primer ítem congela identidad de factura y siguientes deben coincidir | [rutas](../../backend/src/modules/organization/organization.routes.ts), [servicio](../../backend/src/modules/organization/organization.service.ts), [identidad](../../backend/src/modules/declarations/declaration-identity.ts), [Settings](../../frontend/src/features/administration/admin-settings-page.tsx) |
| 04 — Candidatos/asignaciones | Candidatos por payer/organización/versión, diagnóstico compartido; retiro/cancelación Draft montados; tabla de propiedad activa, contador persistente y cuatro migraciones posteriores al baseline | [rutas](../../backend/src/modules/declarations/declaration.routes.ts), [candidatos](../../backend/src/modules/declarations/declaration-candidates.service.ts), [Draft](../../backend/src/modules/declarations/declaration-draft.service.ts), [migraciones](../../backend/prisma/postgresql/migrations) |
| 05 — Casos de tratamiento | CRUD limitado montado, isEditable, permisos, primera vinculación persistida y comprobación paciente/organización/estado en citas; formulario y selector por paciente | [rutas](../../backend/src/modules/treatment-cases/treatment-case.routes.ts), [servicio](../../backend/src/modules/treatment-cases/treatment-case.service.ts), [selector](../../frontend/src/features/treatment-cases/treatment-case-selector.tsx) |

Los cambios se apoyan en los módulos existentes; no hay una segunda aplicación independiente de reglas. IDs y Decimal se conservan como strings. La página Settings dejó de ser informativa. Las nuevas rutas Draft del contrato anterior también están publicadas e integradas.

## Comprobaciones ejecutadas hoy

| Comprobación | Resultado fresco |
| --- | --- |
| Backend `npm.cmd run typecheck` | PASS |
| Backend `npm.cmd run build` | PASS |
| Backend `npm.cmd run test:unit` | PASS: 124 pruebas / 14 archivos |
| Frontend `npm.cmd run lint` | PASS |
| Frontend `npm.cmd run build` | PASS |
| Frontend `npm.cmd test` | PASS: 330 pruebas / 12 archivos |

Las unitarias HTTP se ejecutaron con acceso loopback de Supertest fuera del sandbox; no utilizan la base clínica. No se ejecutó `test:integration` hoy: no hay TEST_DATABASE_URL configurada en esta sesión ni `.env.test`. No se usó la URL operativa como sustituto. No se inició navegador ni se repitió el recorrido clínico en esta revisión.

## Evidencia existente, distinta de la ejecución de hoy

- [Backend](../../backend/docs/NEG_FUNC_03_04_05.md): entrega del 31 de octubre con 371 pruebas/38 archivos en su pasada seleccionada; no se suma a las pruebas actuales.
- [Base de datos](../base-de-datos/NEG_FUNC_03_04_05.md): revisión independiente y regresión histórica de 384 pruebas/41 archivos en PostgreSQL local dedicado; propiedad activa, ordinales, bloqueos y migraciones.
- [Frontend](../../frontend/docs/NEG_FUNC_03_04_05_VALIDATION.md): Chrome contra Backend 3406/PostgreSQL dedicado; Settings/conflicto, candidatos incompletos, retiro/cancelación y casos/selector. Incluye capturas y [evidencia HTTP](../../frontend/docs/NEG_FUNC_03_04_05_HTTP_QA.json).

La entrega de navegador declara expresamente que no completó un ciclo nuevo de firma/PDF ni toda la matriz móvil/tablet/paginación real. La aplicación de las cuatro migraciones/permisos al entorno operativo tampoco queda acreditada por un commit o por una conexión al baseline. Este chat no inspeccionó el destino operativo para afirmar si ya se aplicaron; corresponde comprobarlo en la preparación del piloto.

## Lo que aún impide cerrar el MVP para el alcance solicitado

El usuario confirmó hoy: **datos reales de la clínica y presentación real mediante carga manual en el portal oficial SVB**.

1. `declarationService` mantiene el adaptador en null y `/submit` devuelve `SUBMISSION_ADAPTER_NOT_CONFIGURED`. No hay un flujo completo que registre comprobante del upload manual y su resultado externo sin simular envío.
2. NumberOfTreatments y Assistance siguen sin semántica productiva autorizada. El mapper los exige para READY y el flujo clínico no los completa. Los formatos genéricos implementados no acreditan compatibilidad con el portal real.
3. Storage sigue siendo `local://documents/`; su persistencia, respaldo y restauración en el entorno elegido para datos reales deben demostrarse. Un filesystem local puede ser persistente en un despliegue local controlado, pero no se debe asumir que lo será en Vercel.
4. Continúa access-token sin sesión/revocación por sesión. Deben quedar comprobadas expiración, desactivación real del usuario y gestión de acceso para el piloto; refresh/sesiones persistidas siguen siendo una decisión dedicada DBR-001, sin cambio automático a Supabase Auth.
5. Falta la aceptación transversal completa en el entorno exacto del piloto: firma/documentos, varios lotes, roles, aislamiento, restauración y presentación manual con evidencia externa.

Los [contratos finales](CONTRATOS_FINALES_MVP_CLIENTE.md) convierten estos puntos en encargos. No se certifica aún el uso con datos reales ni la presentación SVB por la sola aprobación de pruebas unitarias.
