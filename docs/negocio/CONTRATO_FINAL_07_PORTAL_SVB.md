# NEG-FINAL-07 — Presentación real por portal SVB y registro de evidencia

**Alcance posterior vigente, 2026-11-03:** el usuario aplaza el envío SVB. El registro manual tiene [implementación local](../../backend/docs/NEG_FINAL_07_09.md), con integridad y capacidad de despliegue todavía por cerrar en [NEG-DEP-10](CONTRATO_DESPLIEGUE_10_INTEGRIDAD_SVB.md). La presentación externa no es requisito de salida del primer despliegue clínico ni se ejecuta como prueba.

Actualización 2026-11-03: prevalece la [adenda de captura campo por campo](ADENDA_PORTAL_MANUAL_20261103.md). No se recibe archivo; registro manual no exige export previo. [Entrega Backend](../../backend/docs/NEG_FINAL_07_09.md).

Fecha: 2026-11-02. Canal confirmado por el usuario: **carga manual en portal oficial SVB**. Estado: **flujo nuevo pendiente; no es una integración API automática**.

## Fuente y límite

La [página oficial del SVB Healthcare Portal](https://svbcur.org/svb-healthcare-portal/) informa que los prestadores pueden introducir declaraciones o cargar un archivo y seguir su procesamiento. Fuente consultada el 2 de noviembre de 2026. Esa página confirma el canal, pero no publica en su contenido consultado el contrato exacto de archivo aplicable a esta clínica ni las reglas pendientes de NumberOfTreatments/Assistance.

El alcance es: generar el archivo correcto, el operador autorizado lo presenta en el portal, la aplicación registra la evidencia y posteriormente la respuesta externa. No se automatiza el navegador del portal, no se guardan sus contraseñas en la aplicación y no se configura un adaptador ficticio que marque SUBMITTED al generar/descargar un archivo.

## Recorrido requerido

1. Completar NEG-FINAL-06 y cerrar la versión de formato admitida. Solo facturas CLOSED vigentes y un lote READY con datos válidos pueden producir la exportación para presentación real.
2. Congelar exportación, ítems/versiones, formato, versión de layout, cantidad de líneas, importe por moneda, usuario/fecha y hash del archivo. Conservar los bytes exactos, no reconstruir un archivo distinto después de presentado.
3. El operador descarga esa exportación y comprueba que no consta una presentación previa ni una carga de resultado incierto. Un responsable por lote coordina la carga manual; la aplicación no puede garantizar que otro usuario no vuelva a cargar una copia fuera de ella.
4. El operador accede al portal oficial y carga el archivo. No usar declaraciones reales como fixtures de pruebas automatizadas. La primera presentación real ocurre en la fase de piloto autorizada, no al implementar este contrato.
5. Conservar el comprobante externo y registrar la presentación de la exportación exacta. Si no se conoce el resultado del upload, consultar el portal antes de repetirlo; un timeout o duda no autoriza un segundo envío.
6. Registrar la respuesta de SVB mediante evidencia oficial: recibido/procesamiento no equivale a aceptado, y aceptado no equivale a pagado. Los estados existentes ACCEPTED/PARTIALLY_REJECTED/REJECTED solo se asignan según respuesta externa.

## API propuesta para registrar el upload manual — no implementada

Propuesta: `POST /api/v1/declarations/:id/submissions/manual`, permiso `declaration.submit`. No reemplaza el POST `/submit` actual por un éxito simulado; Backend publica esta operación específica y Frontend la consume después.

Cuerpo estricto propuesto:

```ts
{
  declarationExportId: string
  externalReference: string | null
  submittedAt: string // ISO con offset; fecha externa declarada por el operador
  receiptDocumentId: string
  idempotencyKey: string
  reason?: string // requerida si el portal no proporciona referencia
}
```

`externalReference` contiene la referencia que emita realmente el portal, sin inventarla. Si no existe, registrar explícitamente esa ausencia y motivo; el comprobante sigue siendo obligatorio. Backend guarda además su propia hora de registro y el actor real. Motivos hasta 500 caracteres, referencia hasta el límite actual del modelo, IDs como strings y clave idempotente opaca validada.

El comprobante se carga por el Backend con los permisos de documentos, organización y controles de tipo/tamaño/hash. Puede reutilizarse el tipo OTHER para la evidencia en la primera entrega si se documenta su propósito en la relación de presentación; cualquier tipo nuevo requiere publicación coordinada. No usar una URL pública ni un path de disco suministrado por el navegador. La app registra la declaración del operador y la evidencia; no afirma haber verificado autónomamente el portal.

Backend debe verificar bajo transacción: lote EXPORTED, exportación propia del lote/organización, archivo conservado e íntegro, identidad de ítems congelada y ausencia de presentación incompatible. Debe impedir duplicación de registro por exportación/lote y por clave idempotente. Una repetición con la misma clave y mismo contenido devuelve el registro anterior; misma clave con contenido distinto devuelve 409. La referencia externa sola no constituye una clave global inventada.

Primera creación propuesta: 201 con envelope y DTO de presentación; repetición idempotente: 200. Registrar canal PORTAL_UPLOAD y estado SUBMITTED solo después de confirmación explícita de carga con comprobante, junto con historial/auditoría. Guardar comprobante y relación de exportación de forma persistente. Errores/DTO definitivos deben quedar en OpenAPI, API Freeze y handoff antes de UI.

## Resultado y rechazos

Extender de forma coordinada el endpoint existente de resultado `/declarations/:id/submissions/:submissionId/result` para exigir la evidencia externa y la referencia aplicable. Para PARTIALLY_REJECTED se necesita identificar qué líneas quedaron aceptadas/rechazadas y su causa; no inferirlas solo del estado del lote.

La respuesta puede requerir información que el modelo actual no soporte, por ejemplo una aceptación parcial dentro de una línea. Backend/Negocio deben resolver ese caso contra una muestra autorizada antes de afirmar conciliación completa. No modificar el importe original de la factura para hacer coincidir una respuesta, ni convertir aceptación en cobro registrado.

Las líneas aceptadas no se vuelven a presentar como si no existiera su historial. La corrección/rechazo conserva exportación, presentación y respuesta originales; una nueva presentación requiere una versión/caso permitido por las reglas oficiales. No habilitar cancelación de un lote SUBMITTED ni reabrirlo borrando evidencia. Ante discrepancia, bloquear el reenvío automático y dejar el caso identificado para resolución por el operador responsable.

## Frontend, operación y aceptación

Reemplazar el botón genérico que hoy terminaría en `SUBMISSION_ADAPTER_NOT_CONFIGURED` por acciones reales claramente separadas: **Download submission file**, **Open official portal**, **Record portal submission**, **Record SVB result**. El enlace al portal es una navegación del usuario; no es prueba de que se haya presentado nada.

Mostrar formato/versión/hash, exportación seleccionada, comprobante, referencia, usuario, fecha externa y de registro. Errores en el modal, permisos independientes y protección de doble envío. No marcar SUBMITTED al descargar ni ACCEPTED al guardar un comprobante de recepción. Evidencias clínicas nunca se guardan en Git, screenshots de QA públicas ni chats.

Cierre requerido: prueba sintética del recorrido con comprobantes ficticios claramente marcados y servicios dobles; idempotencia/conflicto/rollback en PostgreSQL dedicado; archivo contrastado con la fuente autorizada; ensayo guiado con la clínica y procedimiento de primera carga real. El uso real del portal se realiza por un operador autorizado al comenzar el piloto, con evidencia protegida y sin repetir el envío para obtener una captura de prueba.

Responsables: **Backend + Base de datos** implementan persistencia/estados/idempotencia; **Frontend + Diseño** implementan el recorrido; **Negocio con la clínica** valida formato y respuestas; **Arquitectura** coordina el entorno y custodia de evidencia. El cierre completo exige NEG-FINAL-06/08/09 y no equivale a que este documento ya publique las rutas nuevas.
