# OPS-02 — Entrega Frontend

Validación local del 8 y 9 de noviembre de 2026. Alcance y criterios en el [contrato OPS-02](../negocio/CONTRATO_OPS_02_FRONTEND.md) y en el [handoff de API OPS-01](../../backend/docs/OPS_01_API.md). El trabajo completa y verifica la interfaz sobre los cambios locales de atención por servicios del 6 de noviembre.

## Resultado de la ronda

| Flujo | Resultado observado |
| --- | --- |
| Agenda y permisos | Recepción creó, reprogramó y confirmó `DB-000001`. Profesional inició la atención y Recepción tomó el cobro. Admin ejecutó ambos pasos por permisos efectivos durante la corrección y la prueba posterior. La auditoría previa a facturar contiene 23 comprobaciones, incluidas respuestas 403 de Recepción al inicio profesional y de Profesional al crear factura. |
| Captura mínima | Se registró, retiró y agregó nuevamente `QA-OPS-2` con cantidad `1.25` sin cobertura válida, tarifa, remisión ni autorización. El cierre vacío fue rechazado y recuperable. El cierre con servicio completó atención y cita. |
| Cola y cobro | La cola paginada encuentra citas completadas de días anteriores y abre el detalle para revisar el cobro. El servidor rechazó primero la cobertura y después la tarifa. Tras corregir las dos condiciones sintéticas se facturó el servicio que ya estaba guardado. El nuevo diálogo de cobro conserva la moneda, explica la fecha de servicio y permite refrescar opciones de cobertura. |
| Factura y corrección | `QAOPS-000001` versión 1, cantidad `1.25`, ANG `15.38`, fue firmada, cerrada y descargada. Admin devolvió la atención, retiró la línea facturada a historial, registró `2.00` y reconstruyó la misma factura. La versión 2, ANG `24.60`, quedó firmada, cerrada y descargada. |
| Reportes | El panel conserva indicadores, gráficos y monedas separadas. Los rótulos distinguen volumen de atención, unidades, importes valorados y facturación, con referencia al período. La comprobación HTTP previa al cobro verificó volumen y cantidad aun con importe pendiente. |
| Dentalink | La cuenta lógica deshabilitada pasó a `NOT_CONFIGURED` al habilitarla sin lector. La vista previa quedó deshabilitada y el historial vacío. El lector sintético leyó dos páginas y produjo dos filas elegibles y una con incidencias. Confirmar creó un paciente y una cita `SCHEDULED`. Ambos abren sus pantallas habituales. |

Recepción y Admin pueden consultar el módulo según sus permisos. En QA, Recepción obtuvo HTTP 200 al leer y 403 al modificar correspondencias. Profesional obtuvo 403 al intentar leer. La ruta y la navegación se rigen por `dentalink.read`. Las filas privadas requieren, además, permisos de lectura de pacientes y citas.

## Evidencia de las dos versiones

| Versión | Estado final | Cantidad | Total | Documento |
| --- | --- | --- | --- | --- |
| 1 | `SUPERSEDED` | `1.25` | ANG `15.38` | [PDF original](evidence/ops02-20261107/QAOPS-000001-v1.pdf) |
| 2 | `CLOSED` | `2.00` | ANG `24.60` | [PDF corregido](evidence/ops02-20261107/QAOPS-000001-v2.pdf) |

Las firmas sintéticas de ambas versiones fueron autorizadas por el usuario. Los PDF descargados por navegador coinciden en bytes con sus documentos privados y con el SHA-256 registrado. Tras cerrar la versión 2 se volvió a comprobar el importe, la firma, el hash firmado y el PDF de la versión 1. El formulario muestra `Aantal` como cantidad del procedimiento y la firma del paciente en su bloque, separado de `Paraaf`. Los campos sin datos permanecen vacíos. Los dos PDF se renderizaron y revisaron visualmente. Poppler informó avisos sobre fuentes del formulario durante la comprobación.

[Descarga de v1](evidence/ops02-20261107/invoice-v1-download.json) · [Descarga de v2](evidence/ops02-20261107/invoice-v2-download.json) · [Verificación del historial](evidence/ops02-20261107/preservation-checks.json) · [Imagen de v2](evidence/ops02-20261107/invoice-v2-render.png)

## Preparación Dentalink

`/integrations/dentalink` consume las doce operaciones publicadas bajo `/api/v1/integrations/dentalink`. La pantalla permite configurar una cuenta lógica, elegir profesional y sede activos, revisar historial paginado, leer páginas y confirmar las filas elegibles de un contenido revisado. La consulta de historial permite retomar una ejecución tras salir del módulo. Los reintentos mantienen la clave y el contenido de la solicitud durante la revisión abierta. Si la respuesta de confirmación se pierde, la UI vuelve a consultar el resultado registrado y refresca las listas operativas. El proveedor, las credenciales y el cursor se resuelven en el servidor.

La ejecución sintética `#1` confirmó `000-QA-PATIENT` y `000-QA-APPOINTMENT`. Los totales locales pasaron de un paciente y una cita a dos de cada uno solamente tras confirmar. La fila `000-QA-ISSUE` quedó con `UNSUPPORTED_SOURCE_STATUS` y `PROVIDER_MAPPING_MISSING`. La primera confirmación encontró que faltaba la secuencia `PATIENT` en la organización sintética. Se configuró esa secuencia en la base QA y el reintento de la misma vista previa terminó con las dos altas esperadas. Se añadió un mensaje de recuperación en inglés para ese código de numeración.

[Vista previa deshabilitada sin lector](evidence/ops02-20261107/dentalink-not-configured.jpg) · [Vista previa antes de confirmar](evidence/ops02-20261107/dentalink-before.json) · [Diálogo de confirmación](evidence/ops02-20261107/dentalink-confirm-dialog.jpg) · [Resultado confirmado](evidence/ops02-20261107/dentalink-after.json)

## Hallazgos de Diseño y dependencias

| Hallazgo | Estado en Frontend |
| --- | --- |
| DES-OPS-01 | Corregido. Tras guardar con Enter y actualizar los servicios, el foco volvió a **Add service** en navegador. [Evidencia](evidence/ops02-20261107/service-focus-restored.jpg) |
| DES-OPS-02 | Corregido. Escape levanta el lápiz cuando el foco está en el lienzo y mantiene abierto el diálogo con el trazo capturado. Se verificó en navegador y con una regresión que conserva la confirmación de descarte al cancelar. [Evidencia](evidence/ops02-20261107/qa-signature-v2-review.jpg) |
| DES-OPS-03 | Corregido. El error de cobertura muestra cita y fecha, mantiene `ANG` y ofrece actualizar opciones y revisar cobertura o tarifas según permisos. [Diálogo de opciones](evidence/ops02-20261107/billing-choices-dialog.jpg) · [Observación del error](evidence/ops02-20261107/browser-observations.md) |
| DES-OPS-04 | Pendiente de contrato Backend. El listado paginado de citas completadas incluye las ya facturadas y deja la resolución del estado al detalle. Para mostrar estado y próxima acción por fila, filtrar pendientes antes de paginar y actualizar conteos, se necesita una consulta agregada con cita, estado de facturación/corrección y paginación. [Observación de la cola](evidence/ops02-20261107/browser-observations.md) |

La conexión real con Dentalink queda pendiente de acceso autorizado y documentación de su API. La radicación SVB permanece aplazada hasta conocer la estructura oficial. La aceptación del cliente y la validación del destino publicado corresponden a la siguiente etapa coordinada. El alcance de esta entrega es QA local con datos sintéticos.

## Archivos y comprobaciones

- Agenda y caché. `appointment-workflow-cache.ts`, acciones y detalle de cita, reprogramación, `reception-page.tsx` y `billing-review-queue.tsx`.
- Atención y cobro. `clinical-appointment-page.tsx`, `procedure-section.tsx`, `appointment-billing.tsx`, `return-to-care.tsx`, `signature-dialog.tsx`, `dialog.tsx`, `button.tsx` y mensajes centralizados. Se conserva la API y caché compartida del catálogo SVB.
- Reportes. `dashboard-report.tsx` y sus rótulos de período, volumen, unidades e importes.
- Dentalink. `frontend/src/features/dentalink/` y sus entradas en router, permisos, navegación, Administración y Agenda.
- Pruebas. `ops-02.test.tsx`, `dentalink.test.tsx` y casos actualizados de citas, atención, facturación y NEG-FUNC-03/05. Los nuevos casos cubren paginación real, edición ante cambios remotos, recuperación de cobro, foco y Escape, permisos, privacidad y confirmación con clave y hash estables.

El 9 de noviembre aprobaron `npm run lint`, `npm run build` y `npm test` desde `frontend`, con **360 pruebas en 18 archivos**. La evidencia [HTTP previa al cobro](evidence/ops02-20261107/prebilling-checks.json) pertenece al estado anterior a la factura. Los documentos de esta ronda se enlazan desde la [guía de Frontend](README.md).

## Guion de navegador para Diseño

Usar el Frontend QA `http://127.0.0.1:5197`, la API `http://127.0.0.1:3427/api/v1` y exclusivamente `odontho_frontend_ops_20261107_test` en `127.0.0.1:55473`. Las ocho migraciones existentes están aplicadas ahí. El entorno incluye perfiles sintéticos Admin, Recepción y Profesional. El archivo local de acceso se conserva fuera de Git. El punto de entrada privado `backend/storage/frontend-ops-20261107-qa/synthetic-server.mts` arranca la API sin lector por defecto. Con `--synthetic` usa la fuente interna de dos páginas. Coordinar el puerto con quien opera ese entorno antes de iniciarlo.

1. Entrar como Recepción. Crear una cita QA con paciente, profesional y sede sintéticos. Reprogramarla antes del inicio, confirmar y verificar que puede cancelarse antes de empezar en una cita separada. Buscar citas previas en **Completed / billing review**.
2. Entrar como Profesional. Abrir una cita confirmada, iniciar la atención y comprobar que completar sin servicios da un aviso recuperable. Agregar `QA-OPS-2` con cantidad decimal, retirar y volver a agregar. Guardar con Enter y comprobar foco en **Add service** al terminar la actualización. Completar y verificar la entrega a cobro.
3. Entrar como Recepción. Abrir una cita sin cobertura o tarifa. Revisar la fecha en el error, los enlaces administrativos y la persistencia de la moneda. Para comparar estados conservados, abrir `DB-000001` en `/appointments/1` y `DB-000002` en `/appointments/34`. La segunda conserva servicios pendientes de valoración.
4. Abrir `/invoices/1` y comparar v1 y v2. Descargar ambos PDF y revisar cantidad, firma, total y versión. Para repetir captura por teclado, usar una factura QA nueva. Escape debe levantar el lápiz. La evidencia guardada requiere aprobación específica para una nueva firma de prueba.
5. Abrir `/integrations/dentalink`. Con el lector desactivado verificar el estado `NOT_CONFIGURED`. Revisar la ejecución confirmada `#1` de `QA-OPS-LOCAL-0001`, su incidencia y enlaces a `/patients/2` y `/appointments/34`. Para repetir el alta completa, preparar una fixture nueva con identidades externas únicas, numeración de pacientes y citas, y dos correspondencias activas. Una nueva lectura de las mismas identidades debe reconocer las ya importadas. Comparar Admin, Recepción y Profesional y comprobar que una ejecución sintética se etiqueta como QA.

El [informe independiente de Diseño](../diseno/OPS_04_ENTREGA.md) conserva sus reproducciones y criterios para la revisión posterior.
