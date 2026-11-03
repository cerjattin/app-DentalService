# NEG-FINAL-06 — Entrega Frontend

Fecha: 2026-11-02. **Alcance Frontend publicado implementado y verificado en QA local; presentación real bloqueada por fuentes pendientes.** No equivale al cierre del contrato completo ni a aceptación clínica del archivo.

Fuentes: [contrato 06](../../docs/negocio/CONTRATO_FINAL_06_DATOS_SVB.md), [API/handoff Backend 06](../../backend/docs/NEG_FINAL_06.md), API Freeze, Frontend Handoff, checklist y rutas/OpenAPI realmente montados. Durante esta entrega Backend publicó cambios concurrentes; se integraron sus DTO/rutas nuevos sin modificar archivos de esa área.

## Funciones implementadas

| Responsabilidad Frontend | Resultado |
| --- | --- |
| Mostrar campos publicados y fuente disponible | Tipos para estado del piloto y policlinicCode almacenado; sin captura nueva de NumberOfTreatments/Assistance, ni valores por defecto |
| Seleccionar recursos reales | Se conservan selectores de sede/caso y catálogo compartido. La sede muestra su código almacenado en lectura; no se ofrecen claves internas ni formularios de accidente/remitente inexistentes |
| Diagnóstico por línea antes de READY | Candidatos muestran los issues técnicos exactos del servidor con ayuda sobre el origen. Cada línea ya agregada ofrece revisión completa de snapshots, sin edición. Ver limitación de diagnóstico del lote abajo |
| Distinguir técnico/piloto real | Clinical y Declarations muestran el estado, motivos y alcance que publica Backend; los servicios/casos habilitados están vacíos. COMPLETE/READY/export no se presentan como aprobación real |
| Correcciones e históricos | Enlace del candidato a la versión exacta de factura; query versionId preservada al navegar. Versiones históricas permanecen de lectura. Se explica el flujo correctivo con nueva firma |
| Guardado/caché | Corrección de ítems y transiciones de factura invalidan candidatos y Dashboard además de recursos de factura existentes. No se calculan importes/tarifas en el navegador |

`GET /api/v1/svb-pilot/readiness` usa `svb_procedure.read`, Query y validación de respuesta Zod conforme al contrato publicado. La pantalla muestra `BLOCKED`, motivos SourceSheet/DestinationFormat, listas habilitadas y requisitos sin resolver. Sin permiso no consulta la ruta; puede mostrar el `realPresentationReadiness` recibido legítimamente con la declaración. Sin estado autoritativo muestra indisponibilidad, sin inventar aprobación ni una lista vacía. Fallos permiten reintento explícito y 403 conserva la sesión.

`GET /api/v1/clinic-locations?isActive=true` conserva `clinic_location.read`; `policlinicCode` es lectura del maestro, no certificación del valor para el portal. No se implementa PATCH de configuración: sigue sin publicarse.

READY/export envían explícitamente `presentationPurpose: "TECHNICAL"` a sus rutas existentes. La confirmación aclara que READY técnico no autoriza presentación real. No hay selector ni envío REAL_SVB desde la UI. Los errores `SVB_REAL_PRESENTATION_NOT_ENABLED`, `SVB_REFERRAL_FLOW_NOT_SUPPORTED`, `ACCIDENT_CASE_NOT_FOUND` y `ACCIDENT_INSURANCE_CONTEXT_MISMATCH` están mapeados a inglés, sin inferir reglas de textos Backend.

La revisión de snapshots muestra los valores recibidos, incluidos ceros iniciales, Decimal strings y fechas date-only. Null permanece «Not recorded»; un cero registrado se muestra sin juzgar su validez. No se deducen NumberOfTreatments/Assistance de quantity ni de un regex. La ayuda en correcciones técnicas existentes tampoco convierte esos campos en reglas aprobadas.

## Pruebas frescas

| Comprobación desde frontend | Resultado |
| --- | --- |
| `npm run lint` | PASS |
| `npm run build` — TypeScript y Vite | PASS |
| `npm run test -- --run` | **13 archivos, 351 pruebas PASS** |
| Enlaces, archivos de evidencia, JSON y diff whitespace | PASS |

La suite incluye estado del piloto/permisos/reintento, rechazo de respuesta no soportada, propósito técnico de READY/export, conservación de campos y sesión tras errores de captura, referencias exactas de versión, snapshots sin edición/defaults y lectura del código de sede. Mantiene la regresión Clinical/Services/casos/Billing/Declarations/Dashboard. Las primeras pasadas detectaron dobles sin la nueva ruta y una expectativa de método GET explícito; se corrigieron antes de la pasada final. Los conteos de Backend/DB son evidencia de esas áreas y no se suman a esta suite.

## Recorrido real de QA

Backend `127.0.0.1:3406`, Vite `127.0.0.1:5175`, PostgreSQL dedicado `odontho_neg_func_test` en loopback 55439. Se reutilizaron organización `43`, pacientes y facturas **sintéticos** de la validación anterior. No se ejecutaron migraciones, seeds generales, limpieza ni importación de maestros. Las facturas CLOSED son fixtures técnicos; este recorrido no acredita nueva firma/PDF ni servicio clínico real.

| Escenario | Resultado y evidencia |
| --- | --- |
| Estado real del piloto | GET 200, BLOCKED, realSubmissionEnabled=false, listas vacías; [pantalla](../../docs/frontend/evidence/neg-final-06/pilot-blocked.png) |
| Diagnóstico antes de agregar | Candidato invoiceItem `298`: faltan NumberOfTreatments/Assistance; ayuda de origen sin sugerir defaults; [pantalla](../../docs/frontend/evidence/neg-final-06/candidate-diagnostics.png) |
| Origen exacto | Enlace abre `/invoices/281?versionId=298`, versión 1 CLOSED de lectura; campos siguen vacíos; [pantalla](../../docs/frontend/evidence/neg-final-06/source-invoice-version.png) |
| Revisión del lote | Creado Draft QA `136`, agregado ítem `298`; revisión de línea 1 mantiene `00781`, `012345678`, `000001`, importe `88.80` y nulls; [pantalla](../../docs/frontend/evidence/neg-final-06/frozen-line.png) |
| READY técnico incompleto | Rechazo SVB visible dentro del modal; Draft conservado; [pantalla](../../docs/frontend/evidence/neg-final-06/technical-ready-rejected.png) |
| Solicitud real rechazada | Segundo cliente HTTP envía REAL_SVB: 409/SVB_REAL_PRESENTATION_NOT_ENABLED, Draft e ítems intactos, NumberOfTreatments/Assistance siguen null; [resultado sin secretos](NEG_FINAL_06_HTTP_QA.json) |
| Sede | Selección de sede existente muestra código almacenado P sin campo editable. Formulario descartado sin crear cita; [pantalla](../../docs/frontend/evidence/neg-final-06/location-code.png) |
| Histórico | Lote cancelado `135` revisado en lectura, sin reescribir sus valores ni su resultado histórico. El estado del piloto describe la habilitación actual |

Draft `136` queda conservado con el ítem incompleto para reproducción; no se exportó ni presentó. Las capturas se guardan fuera del directorio vigilado por Vite para evitar recargas durante QA; la recarga requiere login porque el token sigue en memoria. Procesos QA propios cerrados al terminar; no se detuvo el entorno habitual ni el cluster compartido.

## Dependencias que impiden cerrar operación real

1. **Negocio/clínica:** ficha versionada aprobada, reglas de origen/captura por clase, valores/obligatoriedad y formato destino verificado. Backend confirma que la ficha no existe; UI no sustituye esa fuente.
2. **Backend:** captura autorizada de nuevos campos SVB, PATCH de sedes y registro/lookup de accidente/remitente siguen sin publicar. No se habilitan llamadas propuestas ni IDs manuales. Nuevos servicios con remisión reciben su bloqueo efectivo en Backend.
3. **Diagnóstico del lote agregado:** el API actual entrega issues por candidato, pero los ítems ya asignados no incluyen un diagnóstico por línea y READY devuelve un error de campo sin identificar todas las líneas. UI ofrece revisión de valores; **la prevalidación exhaustiva por línea del lote requiere un contrato de lectura de diagnósticos de Backend**. No se duplicó el validador fiscal en Frontend ni se inventó una ruta dry-run.
4. **Aceptación:** captura ordinaria real → snapshot → READY real → archivo aceptado, autorizaciones/remisión/accidente reales y matriz responsive requieren fuentes y recorrido clínico. Los escenarios sintéticos aquí descritos no cierran esas casillas. Publicación en Supabase/portal y contratos 07–09 continúan separados.

## Archivos Frontend modificados

Rutas bajo `frontend/src/`:

- Nuevos: `types/svb-readiness.ts`, `features/svb-readiness/svb-readiness-api.ts`, `features/svb-readiness/svb-pilot-notice.tsx`, `features/declarations/svb-data-guidance.ts`, `features/declarations/svb-data-review.tsx`, `test/neg-final-06.test.tsx`.
- Integración: `api/error-messages.ts`, `types/appointment.ts`, `types/declaration.ts`, `features/appointments/appointment-create-dialog.tsx`, `features/clinical/procedure-section.tsx`, `features/declarations/declaration-api.ts`, `declaration-candidate-dialog.tsx`, `declaration-detail-page.tsx`, `features/billing/invoice-detail-page.tsx`, `correction-item-dialog.tsx`.
- Regresión: `test/billing.test.tsx`, `test/clinical.test.tsx`, `test/declarations.test.tsx`, `test/operational-gaps.test.tsx`.
- Documentación: este informe, HTTP QA, capturas, [gaps](KNOWN_CONTRACT_GAPS.md), [guía Frontend](../../docs/frontend/README.md).

Sin dependencias nuevas, cambios de Backend/base de datos, commit, push, merge o despliegue. Se preservaron los cambios concurrentes de otras áreas y los contratos fuente.
