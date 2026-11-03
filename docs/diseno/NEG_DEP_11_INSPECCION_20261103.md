# NEG-DEP-11 — Inspección de Diseño

Fecha: 2026-11-03. Estado vigente: REENSAYO INDEPENDIENTE R2, DES-01/02/03 corregidos en los recorridos probados; DES-04 verificado para error obligatorio/foco, con selección/subida pendiente. NEG-DEP-11 NO APROBADO globalmente. [Contrato](../negocio/CONTRATO_DESPLIEGUE_11_ACEPTACION_CLINICA.md). Diseño registra hallazgos; Frontend implementa componentes. No se editan archivos de producto desde esta entrega.

Las secciones de hallazgos y matriz R1 conservan la reproducción histórica. El estado actual y sus límites están en **Reensayo R2** al final; no se borran los FAIL de la primera pasada ni se presentan como defectos todavía reproducidos después del arreglo.

## Laboratorio aislado

Instancia exclusiva de Diseño: frontend `http://127.0.0.1:5179`, backend `http://127.0.0.1:3411`, PostgreSQL loopback 55443, base nueva `odontho_design_dep11_20261103_test`, documentos `backend/storage/design-dep11-20261103/documents`. Copia sintética de `odontho_frontend0709_20261103_test`; sin reset, migración, seed general, limpieza ni escritura en la fuente o en clínica. Se reutilizan cuentas sintéticas existentes sin publicar credenciales. No limpiar este root desde otras suites.

El laboratorio anterior 5177 no respondió. Se reanudó únicamente el cluster QA documentado y se creó una copia nueva mediante dump/restore, con documentos propios. Fuente, huellas y límites en [manifest inicial](evidence/dep11-20261103/source-start.json). Las fuentes compartidas pueden cambiar durante la revisión: se registrará la huella final y los reensayos.

## Hallazgo alto disponible para Frontend

### DES-DEP11-01 — P1 — Pérdida de notas clínicas al navegar — R1 FAIL / R2 CORREGIDO EN RECORRIDO PROBADO

- Entorno/permiso: QA aislado, Admin con encounter.update; escritorio 1440×900.
- Fixture nuevo exclusivo: cita 343, encounter 314, organización sintética 84. [Fixture](evidence/dep11-20261103/fixture.json).
- Pasos: abrir cita → Open clinical workspace → cambiar Clinical notes por `SYNTHETIC UNSAVED DESIGN DEP11 — must survive navigation`, sin guardar → Appointment details → Open clinical workspace.
- Esperado: advertencia con conservar edición o descarte explícito antes de salir; cancelar mantiene la nota y foco.
- Actual en R1: navega sin diálogo; al volver aparece `SYNTHETIC BASELINE SAVED NOTE`. La edición desaparece. Complete encounter sí estaba deshabilitado mientras la nota estaba dirty.
- Evidencia: [antes](evidence/dep11-20261103/notes-dirty.ax.txt), [después](evidence/dep11-20261103/notes-after-navigation.ax.txt), [captura antes](evidence/dep11-20261103/02-notes-dirty-desktop1440.jpg), [captura regreso](evidence/dep11-20261103/03-notes-lost-return.jpg).
- Fuente de R1: `frontend/src/features/clinical/clinical-appointment-page.tsx`, EncounterNotes, entonces no integraba el guard disponible en `components/forms/unsaved-changes.tsx`; Frontend lo incorporó antes de R2.
- Criterios de corrección: bloquear salida por enlace/sidebar/Back; Keep editing conserva contenido y foco; guardar exitoso elimina aviso; error mantiene edición; recarga avisa; no persistir notas ni tokens en almacenamiento del navegador por inferencia. Sesión expirada requiere criterio explícito de recuperación.
- Responsable de corrección/reensayo: Frontend. Diseño no marca resuelto hasta probar el cambio.

## Otros hallazgos

### DES-DEP11-02 — P2 — Escape no devuelve foco al disparador — R1 FAIL / R2 CORREGIDO EN RECORRIDO PROBADO

- Entorno: QA Admin, tablet 768×1024, Clinical 343.
- Pasos: Add procedure → seleccionar el servicio sintético FEc32b1c3e → introducir cantidad 0 y dejar seguro sin seleccionar → Save procedure → Escape.
- Esperado: errores dentro del diálogo, foco en el primer control inválido; al cerrar, foco en Add procedure.
- Actual: errores y foco inicial funcionan; después de Escape, `document.activeElement` es BODY. El operador de teclado pierde el punto de trabajo.
- Evidencia: [errores visibles](evidence/dep11-20261103/05-procedure-validation-tablet768.jpg), [foco después de Escape](evidence/dep11-20261103/modal-escape-focus.json).
- Criterios: Enter/Space abren desde el botón; Tab/Shift+Tab permanecen en el modal; Escape o Cancel regresan al disparador; el disparador queda visible; si desapareció por transición, usar un destino lógico explícito. Repetir también en firma, corrección y confirmación anidada.
- Responsable: Frontend. La ausencia de Trigger en el wrapper Dialog es una pista de inspección, no un diagnóstico único de causa.

### DES-DEP11-03 — P2 — Cola sin actualización visible entre puestos — R1 FAIL PARCIAL / R2 REFRESCO MANUAL VERIFICADO

- Entorno: QA Admin, recepción 1440×900.
- Pasos: abrir Reception; desde otro cliente QA crear la cita sintética 343, check-in/iniciar; volver a observar la misma cola sin cambiar filtro ni recargar; abrir All appointments.
- Actual: Reception conserva dos citas; Appointments muestra además la nueva cita 343. No hay Refresh ni indicador de última actualización. El cliente independiente es el script propio de Diseño en la copia exclusiva, no el laboratorio de Frontend.
- Evidencia: [cola previa sin la nueva cita](evidence/dep11-20261103/01-reception-desktop1440.jpg), [comparación y secuencia](evidence/dep11-20261103/check-results.json). El código no configura refetchInterval y desactiva refetchOnWindowFocus.
- Esperado/aceptación: actualización manual accesible y/o plazo acordado para cola visible, indicador de carga/frescura, conservación de filtros, ninguna sobrescritura de formularios. No se exige introducir Realtime. No se midió hoy una garantía de latencia ni se atribuye un SLA.
- Responsable: Frontend; Backend acuerda frecuencia/carga. Es fricción operativa, no evidencia de pérdida en el servidor.

### DES-DEP11-04 — P2 — Errores de adjunto/manual sin asociación al control — R1 ESTÁTICO / R2 ERROR OBLIGATORIO Y FOCO VERIFICADOS

- Fuente: `frontend/src/features/declarations/manual-entry-dialog.tsx`.
- Observación estática: el formulario usa labels envolventes, pero imprime los errores de form y fileError al final con role=alert. A diferencia de FormField, no conecta aria-invalid/aria-describedby a cada control ni enfoca explícitamente el primer error de submit().
- Criterios: tipo/tamaño/vacío y error de upload anunciados en el modal activo y asociados al input; selección válida y motivo retenidos tras fallo; reintento conserva la misma clave/documento; foco visible en la recuperación. No habilitar nuevas presentaciones para probar esto en el modo aplazado; usar exclusivamente QA explícitamente habilitado o resolución de historia conforme al contrato.
- Estado: revisión estática, no reproducción visual de subida/descarga. Frontend confirma/corrige y Diseño reensaya cuando se recupere control fiable.

## Matriz R1 y alcance entonces comprobado

Resoluciones requeridas: escritorio 1440×900, portátil 1280×720 y tablet 768×1024. Son cobertura técnica propuesta; puestos clínicos y dispositivos reales siguen POR CONFIRMAR. No constituyen una matriz completa solo por haber capturado una pantalla en cada tamaño.

| Comprobación | Estado de esta inspección | Evidencia/límite |
| --- | --- | --- |
| Entorno/versión QA visibles | COMPROBADO | QA · design-dep11-r1 en login/shell; no configura por sí mismo capacidad de servidor |
| Reception escritorio 1440×900 | COMPROBADO parcial | Tabla/acciones visibles, [captura](evidence/dep11-20261103/01-reception-desktop1440.jpg); frescura DES-03 |
| Clinical escritorio 1440×900 | FAIL | DES-01; pérdida de edición reproducida en fixture propio |
| Clinical portátil 1280×720 | COMPROBADO parcial | [captura](evidence/dep11-20261103/06-clinical-laptop1280.jpg), contenido visible con scroll; no ciclo integral |
| Modal de servicio tablet 768×1024 | COMPROBADO parcial | [catálogo](evidence/dep11-20261103/04-procedure-tablet768.jpg), [errores](evidence/dep11-20261103/05-procedure-validation-tablet768.jpg); acciones visibles en la captura, sin desborde lateral observado |
| Error inválido de seguro/cantidad | PASS acotado | No se guardó procedimiento; errores en el modal, foco al seguro; cantidad aria-invalid=true y aria-describedby=procedure-quantity-description |
| Escape y retorno del foco | FAIL acotado | DES-02, foco BODY; no se certifica navegación completa por teclado |
| Zoom 200% real | NO EJECUTADO | Los atajos enviados a la página no cambiaron zoom. Medición posterior 1280×720 / DPR≈1: no equivale a 200%. Computer Use nativo se detuvo antes de poder verificar Chrome |
| Firma/cierre/PDF de esta pasada | NO EJECUTADO | No se capturó ni guardó una nueva firma; fixture de Diseño permanece encounter OPEN. Los dos ciclos del informe Frontend son históricos de esa entrega |
| Corrección/reconstrucción visual de esta pasada | NO EJECUTADO | Se conserva evidencia de Frontend; no se repitió tras los cambios concurrentes |
| Adjuntar/descargar mediante navegador | NO EJECUTADO | El intento anterior de Frontend no se convierte en PASS; esta sesión se detuvo antes de llegar a ese recorrido |
| Sesión expirada/desconexión | PENDIENTE | Manejo 401 observado solo en código; no se provocó expiración ni error de red visual |
| Admin/Recepción/Profesional por permisos | PARCIAL | Login visual Admin y [permisos efectivos de las tres cuentas](evidence/dep11-20261103/effective-permissions.json); falta recorrido visual de los otros dos y aislamiento UAT-02 |
| SVB externo | APLAZADO POR ALCANCE | No hubo portal, archivo oficial, presentación externa ni valores inferidos |
| Aviso de aplazamiento SVB | COMPROBADO parcial | El modal de servicio ya muestra exactamente `SVB submission pending — file specification not confirmed.`. El shell cambió durante la inspección a `SVB submission pending · No automatic submission` por HMR de Frontend. No se cerró aceptación integral de preparar/registrar ni API de DEP10 |

## Inspección estática complementaria y criterios de reensayo

1. **Firma:** el código actual incorpora teclado (Space y flechas), etiqueta/ayuda, estado del lápiz, `captureMethod=OTHER`, confirmación explícita y protección al descartar. Esto supera el hallazgo antiguo de ausencia de teclado; no se informa como defecto vigente. Probar en QA la operación con teclado/puntero, foco, confirmación reiniciada al cambiar firma/firmante, errores y guardado exacto de versión/hash. No dibujar una firma real ni reinterpretar aceptación oficial.
2. **PDF/descarga:** InvoiceDocuments filtra por invoiceVersionId y presenta error dentro del modal. Verificar en navegador PDF actual e histórico, error visible, recuperación, foco del enlace, descarga efectiva y conservación de bytes/hash después del reinicio. Tener el archivo en disco o un GET 200 no acredita esa interacción.
3. **Retorno a atención/corrección:** conservar contexto y motivo tras conflicto; mismo invoice ID/número, versión original inmutable, firma nueva y PDF de cada versión. Verificar con permisos independientes y errores dentro del diálogo. No reusar los conteos anteriores como nueva aceptación.
4. **Aplazamiento:** el código Frontend actualizado requiere capacidad explícita true y sin fetch activo; al preparar vuelve a consultar readiness. No deducir habilitación de permiso Admin, bandera VITE o falta de respuesta. Reensayar false/ausente/error/concurrencia con Backend publicado, verificar que historia y resolución existente siguen accesibles. No cambiar una bandera para presentar realmente.
5. **Servicios no soportados:** el modal diferencia clinical procedure y diagnóstico SVB; permite elegir el servicio sintético sin inventar fuentes. Negocio debe cerrar qué requisitos de autorización/remisión/accidente excluyen atención en piloto. No aprobar UAT-07 por la sola existencia del aviso.

## Interrupción de la herramienta

Después de capturar la cobertura parcial, se intentó verificar zoom real mediante la habilidad Computer Use. `get_window_state` rechazó continuar porque no pudo determinar la URL activa de Chrome en Windows con suficiente confianza para aplicar su política. No se enviaron más entradas a aplicaciones desde esa interrupción. No se cambió configuración de seguridad ni permisos de extensión y no se intentó evitar el control.

Los atajos previos enviados mediante Browser Use no cambiaron las métricas de viewport/DPR; no se denominan prueba de zoom 200%. La observación nativa no llegó a producir una captura válida. Continuación: recuperar control fiable del navegador o ejecutar una aceptación manual supervisada, manteniendo las filas abiertas hasta evidencia nueva. No es necesaria una decisión SVB para completar esos recorridos clínicos.

## Entrega a Frontend y cierre

Orden sugerido: DES-01 bloquea aceptación clínica por pérdida de edición; DES-02 debe corregirse para continuidad de teclado; DES-03 y DES-04 requieren solución/verificación en su alcance. Frontend es el editor único de componentes. Diseño mantiene estos IDs y reensaya después de la entrega en disco, sin marcar resuelto por un reporte verbal.

No se corrieron lint/build/suites de producto en esta tarea documental: no se modificó producto y Frontend trabaja simultáneamente. Checks propios: enlaces locales, inventario de evidencia sintética sin credenciales y diff --check del área. Las huellas [inicial](evidence/dep11-20261103/source-start.json) y [final](evidence/dep11-20261103/source-end.json) distinguen fuentes concurrentes; entre las nueve fuentes inventariadas cambió EnvironmentNotice, mientras Clinical y Dialog conservaron su huella al concluir. Esta inspección no aprueba un artefacto congelado ni un despliegue.

Las observaciones guardadas `.ax.txt` son diferencias devueltas por la herramienta, no exportaciones completas del árbol. La captura del regreso muestra la nota baseline y el [registro de comprobaciones](evidence/dep11-20261103/check-results.json) conserva los valores observados. Los fallos no se infieren del solo texto `no change` de una diferencia.

La copia QA y documentos se conservan para reproducir; no se ejecutó cleanup ni se eliminó historia. Los procesos de Diseño se detienen al finalizar para no dejar una sesión sintética abierta sin supervisión. El cluster 55443 puede ser utilizado por otros chats: no se detiene en esta entrega.

Antes de retomar, restaurar el viewport/zoom habitual o fijar expresamente la medida del siguiente escenario: la interrupción nativa ocurrió con override de portátil 1280×720 y no se enviaron entradas posteriores para restablecerlo. No se demostró cambio real del zoom. Las cuentas QA permanecen en cache ignorada; no copiar sus contraseñas a este informe.

No se atribuyen aquí como frescas las suites históricas Frontend ni los ciclos anteriores de firma/cierre. Los PASS históricos de otros chats conservan su alcance y evidencia propios.

## Reensayo R2 — fuentes corregidas y evidencia nueva

La revisión se reanudó por encargo del usuario después de la entrega de Frontend. Se usó nuevamente la copia **propia** de Diseño en 55443, backend 3411 y Vite 5179, versión visible `design-dep11-r2`, con `SVB_MANUAL_RECORDING_ENABLED=false`. No se utilizó Supabase clínica ni se creó QA cloud. [Huella inicial R2](evidence/dep11-20261103/retest-r2/source-start.json), [huella final R2](evidence/dep11-20261103/retest-r2/source-end.json), [resultados acotados](evidence/dep11-20261103/retest-r2/results.json).

Las fuentes siguieron compartidas: ManualEntryDialog cambió entre las dos huellas R2; [marcas de tiempo de fuente/captura](evidence/dep11-20261103/retest-r2/source-timing.json) permiten ubicarlo respecto de la observación. Los otros cinco archivos de esta muestra conservaron su hash. Se acreditan los comportamientos vistos en el navegador, no un artefacto candidato congelado ni todas las revisiones posteriores.

| Hallazgo | Resultado independiente R2 | Límite de cierre |
| --- | --- | --- |
| DES-01 | CORREGIDO para pérdida al navegar: nota modificada, enlace Appointment details, sidebar Reception y Back muestran advertencia; Keep editing conserva el texto. Save notes confirma guardado; navegar y volver conserva la nota | No se provocó fallo de guardado, expiración de sesión ni recarga con aviso nativo; no se cierra todo UAT-19 |
| DES-02 | CORREGIDO en Add procedure: apertura con Enter, Tab/Shift+Tab dentro del modal, errores, Escape y retorno final a Add procedure. El diálogo anidado de descarte manual devuelve foco a Release verified preparation | La lectura inmediatamente posterior al desmontaje mostró BODY transitorio; la observación asentada confirmó BUTTON/Add procedure. Se conservan ambos registros. Falta repetir toda la matriz de firma/corrección |
| DES-03 | CORREGIDO para actualización manual: Refresh worklist e indicador Last updated visibles; un segundo cliente modifica solo la cita propia343; Refresh muestra el motivo nuevo conservando q=QA y status=IN_PROGRESS | refetchOnWindowFocus está configurado en las listas; no se atribuye prueba independiente del cambio de foco ni SLA de refresco automático. Primera búsqueda por motivo/nombre completo no dio coincidencias; se corrigió a filtros admitidos antes del ensayo medido |
| DES-04 | CORREGIDO para archivo obligatorio: mensaje dentro de Release preparation, aria-invalid=true, aria-describedby apunta a ayuda/error; con otros campos válidos el foco llega al input file y el motivo se conserva | Selección de un .txt sintético fue bloqueada por permisos de file URLs de la extensión, antes de seleccionar/subir; no se acreditan tipo inválido, subida, retry ni descarga efectiva |

Evidencia DES-01: [conservar edición](evidence/dep11-20261103/retest-r2/des01-keep-editing.json), [árbol completo conservado](evidence/dep11-20261103/retest-r2/des01-preserved.ax.txt), [guardado/regreso](evidence/dep11-20261103/retest-r2/des01-save-return.json), [captura](evidence/dep11-20261103/retest-r2/01-notes-preserved.jpg).

Evidencia DES-02: [bucle de teclado y lectura inmediata](evidence/dep11-20261103/retest-r2/des02-keyboard-focus.json), [foco final asentado](evidence/dep11-20261103/retest-r2/des02-focus-settled.json), [captura](evidence/dep11-20261103/retest-r2/02-focus-restored.jpg). La lectura intermedia no se considera fallo final del arreglo.

Evidencia DES-03: [antes](evidence/dep11-20261103/retest-r2/des03-before-refresh.ax.txt), [después](evidence/dep11-20261103/retest-r2/des03-refreshed.ax.txt), [filtros/resultados](evidence/dep11-20261103/retest-r2/des03-refresh.json), [captura](evidence/dep11-20261103/retest-r2/03-worklist-refreshed.jpg).

Evidencia DES-04: [fixture sintético](evidence/dep11-20261103/retest-r2/attachment-fixture.json), [errores](evidence/dep11-20261103/retest-r2/des04-missing-errors.ax.txt), [foco/asociación](evidence/dep11-20261103/retest-r2/des04-associated-error.json), [captura](evidence/dep11-20261103/retest-r2/06-attachment-error-associated.jpg), [límite de selección](evidence/dep11-20261103/retest-r2/des04-file-selection-blocked.json).

### Fixture de adjunto y SVB aplazado

La copia de Diseño no tenía una reserva UNCERTAIN sin resolver. Se levantó temporalmente un backend **auxiliar propio**, loopback3412, NODE_ENV=test, misma base `_test` y mismo root exclusivo, con habilitación sintética explícita permitida por DEP10. Por los servicios normales se creó el lote138 con **todos** los ítems de invoice230/v244 (un ítem), preparación55 y estado UNCERTAIN. Se utilizó un fixture CLOSED técnico preexistente: esto no es una firma real ni aceptación de otro ciclo de firma. Se dejó rotulado en razón y notas como prueba; no hubo portal, comprobante oficial ni registro externo.

El backend auxiliar fue detenido antes de abrir el formulario. El navegador siguió conectado al3411 **aplazado**: Prepare manual entry y Record portal entry estaban deshabilitados; Release verified preparation seguía accesible conforme al contrato de resolver historia. Se validó el formulario sin archivo y se descartaron sus campos, sin guardar liberación. El checkbox se marcó solo como entrada local de validación sintética; nunca se envió una afirmación externa. La reserva55 permanece UNCERTAIN, sin receipt/submission/resolutionDocument, para reproducción. [Historia aplazada observada](evidence/dep11-20261103/retest-r2/deferred-history.ax.txt).

### Roles y teclado observados en R2

- Admin: guard de notas, guardado, modal, validación, refresco y resolución histórica descritos.
- Recepción: login visual y Clinical343 en solo lectura, sin textarea Clinical notes, Add procedure ni Complete encounter. [Medición](evidence/dep11-20261103/retest-r2/role-reception.json), [captura](evidence/dep11-20261103/retest-r2/04-reception-readonly.jpg).
- Profesional: login visual y Clinical343 con textarea, Add procedure y Complete encounter visibles. [Medición](evidence/dep11-20261103/retest-r2/role-provider.json), [captura](evidence/dep11-20261103/retest-r2/05-provider-editable.jpg).

Esto contrasta controles con los permisos del servidor ya inventariados; no introduce autorización por nombre de rol ni acredita UAT-01/02 completos. No se hicieron nuevas asignaciones de permisos/cuentas ni ensayos de aislamiento en esta ronda.

### Herramientas y pendientes de aceptación manual

Browser Use permitió este reensayo en una URL QA conocida. No se volvió a utilizar la ruta nativa que no pudo verificar la URL de Chrome en R1. Los atajos de página ya habían demostrado no cambiar el zoom; no se repiten como prueba de200%. Se restableció el viewport habitual al cerrar el formulario y se cerró la sesión QA.

La carga mediante fileChooser fue intentada con un archivo .txt sintético para probar rechazo. La extensión respondió que requiere acceso a file URLs; no se modificaron sus permisos ni se recurrió a una ruta nativa bloqueada. Mensaje exacto de diagnóstico de Google Chrome: “To enable file upload, open chrome://extensions, click Details under the ChatGPT browser extension, and enable \"Allow access to file URLs.\" See [here](https://developers.openai.com/codex/app/chrome-extension#upload-files) for details.” Se registra como límite, no como petición de cambiar seguridad ni como condición para que un operador pruebe manualmente el selector normal.

[Guion de aceptación manual de puestos](NEG_DEP_11_ACEPTACION_MANUAL_PUESTOS.md): zoom real200%, selección/tipo/tamaño/subida/descarga, foco por teclado, errores y recuperación. Puestos reales/operador/versión/fecha y resultado se dejan POR CONFIRMAR, sin aprobación inventada.

Checks de Diseño R2: documentos/enlaces/diff, parseo de evidencia JSON y contraste de huellas. No se ejecutaron suites de producto en esta tarea de inspección ni se atribuyen los conteos482/59 de otras áreas como propios. Se preservan fuentes de Frontend, datos clínicos e historia R1. Los procesos propios se detienen; la copia y archivos de prueba permanecen aislados para continuar.
