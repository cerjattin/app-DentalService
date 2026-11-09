# OPS-04 — Evaluación de usabilidad y aceptación operativa

Revisión realizada el **7 y 8 de noviembre de 2026**. Cierre del informe: 8 de noviembre. Alcance: repositorio y ejecución local sintética del [contrato OPS-04](../negocio/CONTRATO_OPS_04_DISENO.md) y del [flujo vigente de servicios y facturación](../negocio/CONTRATO_ATENCION_FACTURACION_DENTALINK_20261106.md).

## Dictamen

El recorrido principal funciona en el laboratorio observado: Recepción crea, reprograma y confirma; el profesional registra servicios sin precio ni cobertura y completa; Recepción recupera la facturación, obtiene firma y cierra; Admin corrige y refactura conservando factura e historial. El diseño actual de atención, centrado en servicios y cantidades, debe conservarse.

**Recomiendo mejoras puntuales antes de una aceptación operativa completa:** recuperar el foco después de guardar servicios, resolver el conflicto de Escape en la firma, orientar la recuperación de cobro y convertir la lista de citas completadas en una cola que muestre el trabajo pendiente. No hace falta un cambio global de colores, tipografía o componentes.

Esta evaluación no aprueba operación clínica ni aceptación del cliente. La matriz sigue parcial en zoom real 200%, red/concurrencia, dispositivos físicos y adjuntos. Las propuestas se entregan a Frontend mediante este informe; no se editaron sus componentes ni se enviaron mensajes externos.

## Entorno y procedencia

- HEAD base: `1828797be5abb6d97292dc298dafd6e3976ff9b8`, con cambios locales ajenos preservados. HEAD por sí solo no identifica las fuentes revisadas.
- PostgreSQL 17 exclusivo de Diseño, loopback `55474`, base `odontho_design_ops04_test`; API `3417`, Vite `5187`. Clúster y documentos en `backend/storage/design-ops04-20261107/`, sin compartir con otros chats. Siete migraciones existentes y seed aplicados únicamente a esta base nueva; ningún cambio de schema o migración escrito por Diseño.
- Cuentas sintéticas ADMIN, RECEPTION y PROVIDER con asignaciones canónicas del seed; autorización de UI/API por permisos. Paciente `QA Service Journey`, cita `DB-000001`, servicio `QA-OPS04-A`, factura `QA-000001`. Ningún dato de clínica o conexión Dentalink real.
- Cobertura y tarifa ficticias se incorporaron por fixture local, **no por formularios de mantenimiento**, después de observar cada bloqueo. El importe `12.30 ANG` es exclusivamente de prueba, no catálogo/tarifa SVB oficial.
- Navegador Chrome mediante Computer Use. Escritorio observado a 1536 px de ancho; tablet emulada `768×1024`. Esto no acredita tablet física, entrada táctil ni zoom 200%.
- [Huellas al inicio](evidence/ops04-20261107/source-start.json), [al reanudar](evidence/ops04-20261107/source-resume.json) y [al cierre](evidence/ops04-20261107/source-end.json). Entre inicio y reanudación cambió `clinical-encounter.service.ts`; el backend se reinició al reanudar. La corrección/refacturación se observó sobre las fuentes de la reanudación. Las huellas adicionales del cierre identifican archivos de soporte, sin fingir que todos tuvieron hash inicial.
- Durante la continuación cambió en disco `invoice.service.ts` respecto a la huella de reanudación. La API de QA se ejecutaba sin watch, con el módulo cargado al arrancar; ese cambio posterior no se declara probado por este recorrido. La aceptación de un candidato con esa edición requiere vincularlo y comprobar lo afectado. No se presenta el manifiesto final como un artefacto completo aprobado.
- No se ejecutaron suites generales de producto desde Diseño. Los conteos de otras áreas son históricos y no se presentan como validación nueva.

## Escenarios observados

| Recorrido | Resultado y límite | Evidencia |
| --- | --- | --- |
| Recepción crea cita | Formulario con paciente, profesional, sede e inicio/fin; guardado con controles bloqueados; aviso de cita creada y retorno al disparador | [01](evidence/ops04-20261107/01-reception.jpg) |
| Reprograma y confirma | `14:00–14:30` → `14:15–14:45`, fecha de negocio Nov 7; estado CONFIRMED. Cancelación no ejecutada en esta ronda | Observación de detalle y cola; timestamp del estado final en el laboratorio |
| Profesional abre atención confirmada | Entrada desde Appointments → Services → Start attention; no diagnósticos, notas médicas, remisión ni autorización requeridos | [04](evidence/ops04-20261107/04-service-recorded.jpg) |
| Atención sin servicios | El backend rechaza completar sin líneas y muestra `Add at least one service before completing attention.`; diálogo recuperable, con fricción evitable | [03](evidence/ops04-20261107/03-empty-completion-error.jpg) |
| Captura sin precio/cobertura | Servicio con flags de autorización/remisión, sin tarifa ni cobertura; guarda `1.25`, se retira y se reagrega con `2`; solo quedan servicios PERFORMED en lista | [04](evidence/ops04-20261107/04-service-recorded.jpg) |
| Cierre conjunto / entrega | Atención y cita completas; desaparecen edición/cierre y aparece Ready for billing. Recepción encuentra la cita completada desde otro cliente | [05](evidence/ops04-20261107/05-ready-for-billing.jpg), [06](evidence/ops04-20261107/06-billing-queue.jpg) |
| Cobertura faltante | Creación rechazada; cita COMPLETED, servicio PERFORMED con cantidad `2.00`, importe/tarifa/cobertura `null`, sin factura. Mensaje poco contextual | [07](evidence/ops04-20261107/07-missing-insurance.jpg) |
| Tarifa faltante / recuperación | Tras añadir cobertura sintética aparece el error de tarifa; tras añadir tarifa se reintenta sin recapturar servicios y se crea una sola factura, `2.00 × 12.30 = 24.60 ANG` | [08](evidence/ops04-20261107/08-missing-tariff.jpg), [10](evidence/ops04-20261107/10-closed-invoice.jpg) |
| Firma y cierre por Recepción | Preparación, dibujo por teclado, confirmación del firmante, guardado, Confirm signed y cierre; versión 1 CLOSED | [09](evidence/ops04-20261107/09-signature-escape.jpg), [10](evidence/ops04-20261107/10-closed-invoice.jpg) |
| PDF de versión 1 | Generado desde UI, descargado; archivo de 285157 bytes coincide en SHA-256 con el almacenado. Render de una página conserva paciente, servicio, `2.00`, `ANG 24.60` y trazo de firma | [Render](evidence/ops04-20261107/11-invoice-pdf.png), [hash](evidence/ops04-20261107/pdf-download-check.json) |
| Admin devuelve y refactura | Motivo obligatorio; atención abierta, retira `2.00`, agrega `1.25`, completa y reconstruye misma factura ID/numero; versión 2 `ANG 15.38` con nueva firma y cierre; versión 1 SUPERSEDED conserva importe/firma/PDF | [14](evidence/ops04-20261107/14-tablet-correction.jpg), [15](evidence/ops04-20261107/15-rebuilt-version2.jpg), [16](evidence/ops04-20261107/16-original-version-history.jpg), [18](evidence/ops04-20261107/18-correction-closed.jpg) |
| Recepción de días anteriores | El Nov 8 la cola incluye cita completada Nov 7, incluso ya cerrada; no muestra estado de factura en la fila | [12](evidence/ops04-20261107/12-closed-still-in-queue.jpg), [13](evidence/ops04-20261107/13-tablet-reception.jpg) |
| Tablet emulada | Cola, servicios, corrección y firma utilizables a `768×1024`; navegación en panel; la tabla de factura requiere desplazamiento horizontal propio | [13](evidence/ops04-20261107/13-tablet-reception.jpg), [14](evidence/ops04-20261107/14-tablet-correction.jpg), [17](evidence/ops04-20261107/17-tablet-signature.jpg) |
| Reporte | Filtro Nov 7–8 y profesional QA: 1 atención, 1 paciente, 1 cita, 1.25 unidades, Production ANG 15.38, 1 factura cerrada. SVB Billed vacío para pagador sintético no SVB; no se probó mezcla de monedas | [19](evidence/ops04-20261107/19-report-provider-tablet.jpg), [texto](evidence/ops04-20261107/19-report.ax.txt) |
| Selector de archivos | Probe aislado `5188`, sin envío al backend, vuelve a fallar por permiso de la extensión. Esto revalida la barrera técnica, no la subida de adjuntos de la aplicación | [20](evidence/ops04-20261107/20-filechooser-probe.jpg) |

La lectura SQL final del laboratorio confirmó cita COMPLETED, una sola factura lógica ID `1`, versión 1 SUPERSEDED `24.60`, versión 2 CLOSED `15.38`, y línea vigente PERFORMED `1.25`. Las cantidades e importes se conservaron como strings. La inspección SQL de esta ronda no demuestra por sí sola atomicidad bajo concurrencia.

## Incidencias reproducidas para Frontend

### DES-OPS-01 · P2 · El foco se pierde después de guardar un servicio

**Pantalla:** `/clinical/1`, Profesional y Admin; escritorio y tablet. **Fuentes:** [ProcedureSection](../../frontend/src/features/clinical/procedure-section.tsx), [Dialog](../../frontend/src/components/ui/dialog.tsx).

**Reproducción:** abrir Add service, seleccionar un resultado, introducir cantidad y activar Save service mediante Enter. Esperar a que desaparezca el diálogo y se vea la línea guardada. `document.activeElement` queda en BODY; se repitió en la corrección con Admin. No se trata solo del instante transitorio al cerrar: una observación posterior con tabla cargada conserva BODY.

**Impacto:** obliga a recuperar el punto de trabajo al añadir varios servicios mediante teclado. **Propuesta:** devolver foco a Add service una vez terminadas mutación y actualización; si se retira una fila, usar un control que siga existiendo. Revisar el momento de restauración cuando el disparador está deshabilitado por la mutación, sin atribuir esa hipótesis como causa probada.

**Aceptación:** guardar con teclado y cancelar con Escape devuelven foco visible al disparador; el siguiente Tab continúa en su entorno lógico. Repetir con latencia, cantidad inválida y retirada de la última fila. No cambiar la lógica de persistencia.

### DES-OPS-02 · P2 · Escape abre descarte mientras se dibuja la firma

**Pantalla:** firma de factura, `/invoices/1`. **Fuentes:** [SignatureDialog](../../frontend/src/features/billing/signature-dialog.tsx), [Dialog](../../frontend/src/components/ui/dialog.tsx). [Evidencia](evidence/ops04-20261107/09-signature-escape.jpg).

**Reproducción:** Capture signature → Draw using keyboard → Space → flechas → Escape sobre el canvas. Las instrucciones dicen `Escape lifts it`, pero se abre Discard unsaved signature?. Keep reviewing conserva el trazo.

**Impacto:** una tecla documentada como parte del dibujo interrumpe la tarea con una acción de descarte. **Propuesta:** mientras el canvas tiene foco, Escape solo levanta el lápiz; interceptar el cierre en la capa del diálogo que recibe Escape. Mantener el aviso de descarte para cierre explícito y navegación con una firma sin guardar.

**Aceptación:** Escape en canvas con y sin tinta no abre descarte y mantiene foco/dibujo. Close/Cancel siguen protegiendo cambios. Tab y Shift+Tab permanecen contenidos; el guardado sigue asociado a la versión exacta.

### DES-OPS-03 · P2 · La recuperación de cobro requiere adivinar la siguiente pantalla

**Pantalla:** Create invoice? en detalle de cita. **Fuentes:** [AppointmentBilling](../../frontend/src/features/billing/appointment-billing.tsx), [errores](../../frontend/src/api/error-messages.ts), [resolución del backend](../../backend/src/modules/invoices/invoice.service.ts). [Sin cobertura](evidence/ops04-20261107/07-missing-insurance.jpg), [sin tarifa](evidence/ops04-20261107/08-missing-tariff.jpg).

**Reproducción:** completar un servicio de paciente sin cobertura/tarifa → Create invoice → Confirm creation. Aparece `This insurance is not valid for the procedure service date.` aunque no existe cobertura. Después de añadir cobertura, el siguiente intento descubre la tarifa faltante. El diálogo conserva datos, pero solo ofrece Cancel/Confirm creation para resolver la situación.

**Propuesta inmediata:** mensaje de facturación contextual (`No valid coverage was found for this appointment's service date.`), paciente y fecha visibles, acceso a revisar cobertura y servicio/tarifas según permisos, retorno a la misma cita. Para quien no tenga permisos de mantenimiento, indicar qué dato debe corregir un administrador. Conservar selección, cantidades y posibilidad de reintento.

**Mejora coordinada posterior:** checklist previo con todos los bloqueos conocidos, si Backend publica un contrato de diagnóstico. No deducir elegibilidad ni tarifas en Frontend ni prometer una revisión previa infalible frente a cambios concurrentes.

**Aceptación:** distinguir ausencia, caducidad y selección ambigua con datos/errores publicados; llegar a la acción reparadora sin perder la cita; reintentar produce una sola factura y conserva servicios. Cambiar semántica o códigos exige actualizar Backend/OpenAPI/handoff con Frontend.

### DES-OPS-04 · P2 · La cola de cobro no permite distinguir pendientes de cerradas

**Pantalla:** Reception → Completed / billing review. **Fuente:** [BillingReviewQueue](../../frontend/src/features/reception/billing-review-queue.tsx). [Evidencia al día siguiente](evidence/ops04-20261107/12-closed-still-in-queue.jpg).

**Reproducción:** cerrar la factura y volver a la cola, incluso al día siguiente. La misma fila sigue mostrando Review billing, sin estado de factura ni indicación del paso pendiente. El texto informa que incluye citas ya facturadas, pero cada registro requiere abrirse para saber si hay trabajo.

**Propuesta:** estado y próxima acción por fila: Ready to invoice / Billing details missing / Awaiting signature / Ready to close / Closed / Correction in progress. Vista inicial de pendientes, con filtro explícito para historial cerrado, búsqueda y rango de fechas. Mantener las citas de días anteriores.

**Aceptación:** dos citas con estados distintos se reconocen sin abrir detalles; cerrar una factura actualiza conteos/cola; error de carga no se muestra como cero pendientes; permisos siguen definiendo acciones. Backend debe publicar estado agregado/paginación y filtros antes de integrarlos; evitar una petición por factura de cada fila o filtrar solo la página actual en el navegador.

## Simplificaciones propuestas

| Prioridad | Cambio concreto | Criterio de aceptación / dependencia |
| --- | --- | --- |
| Siguiente, esfuerzo pequeño | Ante lista vacía, mostrar `Add at least one service to complete attention.` junto al cierre y evitar abrir una confirmación destinada a fallar | Usar estado cargado de líneas PERFORMED; backend conserva validación final. Error de lectura no equivale a lista vacía. Fuente: [ServiceAttention](../../frontend/src/features/clinical/clinical-appointment-page.tsx) |
| Siguiente, esfuerzo medio | Guía persistente Review → Signature → Close, con una sola acción principal contextual y nombres específicos en lugar de Confirm | Hoy hay tres confirmaciones genéricas además de la confirmación del firmante. Mostrar con claridad firma guardada, estado confirmado y cierre pendiente. Reutilizar componentes actuales. Mantener bloqueo del contenido, endpoints, permisos, firma/versionado y cierre irreversible; cualquier unificación transaccional requiere contrato de Negocio/Backend |
| Posterior, esfuerzo medio | Inicio y navegación organizados por tareas disponibles: agenda/atención/cobro; administración secundaria | Derivar capacidades de permisos efectivos y configuración de puesto, no del nombre de rol. Conservar acceso al Dashboard y búsquedas. Validar con personal real antes de cambiar la página inicial |
| Posterior, esfuerzo pequeño | Ayuda breve por indicador del Dashboard y explicación cercana a cada cifra | El período/moneda ya están presentes y deben conservarse. Acercar definiciones de Production, SVB Billed y fecha de atención/performance evita depender de tres párrafos al pie. No cambiar cálculo ni convertir importes a floating point |

Orden recomendado: DES-OPS-01/02 → DES-OPS-03 → DES-OPS-04 → guía de facturación. La cola y el diagnóstico de cobro tienen impacto en API; los ajustes de foco, Escape y ayuda son de Frontend. Diseño no modifica componentes compartidos hasta la asignación concreta prevista por OPS-04.

## Puertas pendientes y guion de aceptación

| Puerta | Ejecución pendiente y resultado exigido |
| --- | --- |
| Cancelación y conflictos de agenda | En otra cita sintética, cancelar/reprogramar antes del inicio; rechazar tras inicio; mostrar conflicto de horario y conservar entradas. Se verificaron creación/reprogramación/confirmación, no toda esta matriz |
| Zoom real 200% | En Chrome del puesto real, establecer 200% mediante controles del navegador; capturar indicador y comprobar cola, modal, firma, errores y acción final sin cortes. El viewport emulado no acredita este resultado; no se dispone de una capacidad documentada de zoom real en el control de navegador usado |
| Dispositivos y cliente | Confirmar tamaños reales, táctil/lápiz, impresión, tiempos y términos con Recepción/Profesional/Admin; registrar persona, fecha, dispositivo y aceptación. Esta inspección no sustituye UAT |
| Red y doble envío | Introducir latencia/corte antes y después de la respuesta de guardar, completar y facturar; recuperar estado sin duplicados. UI pendiente deshabilitada observada; revisión estática muestra reconciliación y aviso de save incierto. No se inyectaron fallos ni se ensayó doble clic rápido |
| Dos puestos simultáneos | Editar/completar/corregir sobre versiones concurrentes; uno prevalece y el otro obtiene conflicto, conserva entrada y actualiza contexto. Se observaron dos perfiles en clientes distintos en secuencia; eso no acredita una carrera |
| Caducidad y recarga | Se requirió reautenticación intermitente durante el desarrollo; causa sin aislar, no clasificada como defecto de producción. Probar versión congelada sin HMR, expiración real y retorno conservando trabajo permitido. Tokens siguen en memoria; no proponer persistirlos en almacenamiento del navegador |
| Varias monedas y volumen sin precio | Reporte observado con ANG y servicios inicialmente sin precio, pero no se capturó el reporte entre captura y valoración ni con dos monedas. Añadir esos dos escenarios y verificar que volumen no depende del precio |
| Adjuntos de aplicación | El selector de archivos falla por permiso de la extensión, revalidado Nov 8 en probe separado. No se habilitó SVB ni se guardó un recibo. Tras habilitación decidida por el usuario, probar tipos/tamaño/error/subida/descarga efectivos en el flujo autorizado |
| Dentalink | En Appointments se informa que no está conectado y se ofrece creación manual. No había módulo de importación publicado para aceptar estados configured/preview/issues/import. Ensayar DTO/rutas cuando Backend los publique; sin acceso de clínica a API real, no acreditar sincronización |

El probe de archivos solo comprobó selección local: no subió datos ni probó validaciones de adjuntos. La extensión indicó: `To enable file upload, open chrome://extensions, click Details under the ChatGPT browser extension, and enable "Allow access to file URLs."` [Instrucción oficial enlazada por la herramienta](https://developers.openai.com/codex/app/chrome-extension#upload-files). No se cambiaron permisos del navegador ni se intentó eludir el bloqueo.

Los eventos automatizados de descarga agotaron su espera el Nov 7; eso no demostró un fallo del producto. Al reanudar se observó el diálogo con enlace Download PDF y se verificó el archivo local sintético con hash igual al almacenado. El render se obtuvo del documento del laboratorio mediante la guía PDF; Poppler emitió avisos de fuentes de la plantilla, sin recorte observado en esa página. Un nombre largo, muchas líneas y PDF de la corrección requieren casos adicionales.

## Archivos y verificación de esta entrega

Cambios propios: este informe, actualización de [guía de Diseño](README.md), imágenes/textos/JSON bajo `evidence/ops04-20261107/`. Helpers, clúster y credenciales de QA quedaron en almacenamiento local ignorado; no se incorporan al informe ni al control de versiones. Sin cambios de UI, reglas, contratos de API, schema, Git remoto o despliegue.

Checks propios: enlaces locales y rutas, JSON legible, búsqueda de secretos en evidencia textual, `git diff --check` y huellas de fuentes al cierre. No se atribuyen lint/build/tests de otras áreas. Los procesos exclusivos de Diseño se detuvieron tras las comprobaciones; datos sintéticos conservados para reproducibilidad, sin limpiar laboratorios ajenos.

Resultado del check documental: sin destinos locales ausentes; cinco JSON de evidencia parseados, sin espacios al final de línea ni patrones de credenciales/tokens en los archivos textuales revisados. Véase [registro del cierre](evidence/ops04-20261107/verification.json).
