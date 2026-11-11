# Bloqueo de preparación de firma por Declarant ID

Diagnóstico del 11 de noviembre de 2026 y corrección posterior autorizada. El usuario eligió inicialmente documentar el resultado y después solicitó la corrección. La recuperación ejecutada corresponde a la versión 2 vigente, identificada y autorizada específicamente antes de escribir.

## Causa confirmada

Render devuelve HTTP 409, código `INVOICE_DECLARANT_ID_REQUIRED`, al preparar la firma de la factura `4`, versión interna `4`. La última petición observada a las 17:35:49 UTC fue `/api/v1/invoices/4/versions/4/prepare-signature`, correlación `7babbfe8-a7ad-42b7-b8c7-c24bd79cbfa1`.

La consulta de metadatos a las 17:40:59 UTC confirmó los siguientes valores.

| Dato | Valor |
| --- | --- |
| Factura | `OS-000001` |
| Cita | `APT-000002`, ID `10` |
| Versión visible / ID interno | `1` / `4` |
| Estado | `DRAFT` |
| Organización | ID `1` |
| Declarant ID actual de la organización | `14265` |
| Declarant ID del snapshot de la factura | `NULL` |
| Total | XCG `75.00` |
| Firma / cierre | Fechas NULL, cero registros de firma |

[Evidencia de lectura](evidence/declarant-20261111/readonly-diagnosis.json)

## Validación que produce el error

`assertInvoiceVersionReadyForCanonicalization` exige que `declarantIdSnapshot` contenga un valor antes de calcular el contenido que se bloqueará para firma. Si encuentra NULL o texto vacío, devuelve `INVOICE_DECLARANT_ID_REQUIRED`. `prepareForSignature` ejecuta esa validación mientras la versión está en borrador, antes de fijar el hash y bloquearla.

La ruta de creación de factura copia `appointment.organization.declarantId` al nuevo snapshot. La actualización de Settings modifica la organización, mientras las versiones existentes conservan sus snapshots. Por eso el valor actual `14265` puede coexistir con el NULL de esta factura. Esa diferencia es compatible con haber configurado la organización después de crear el borrador. Esta revisión no reconstruyó la cronología de esos cambios.

[Servicio de facturas](../../backend/src/modules/invoices/invoice.service.ts) · [Servicio de organización](../../backend/src/modules/organization/organization.service.ts) · [Contrato de organización](../negocio/CONTRATO_ORGANIZACION_SVB.md)

## Recuperación identificada

Completar el dato de este borrador requeriría una operación controlada que confirme la organización, el valor autorizado y que la versión siga siendo la vigente, DRAFT, sin bloqueo, hash, firmas ni cierre. La operación debe dejar auditoría. La API publicada no ofrece una acción de actualización del Declarant ID del borrador.

La alternativa fue presentada al usuario con el valor `14265` ya configurado en su organización. Inicialmente eligió **solo documentar el diagnóstico** y después solicitó corregirlo. La primera comprobación detectó que la versión vigente había pasado a ser la 2, ID interno `5`, por XCG `50.00`. La transacción se detuvo antes de modificar la versión 1. El usuario confirmó después expresamente la corrección de esa versión 2.

## Corrección ejecutada

A las 17:54:24 UTC se completó `declarant_id_snapshot` con `14265` únicamente en la versión 2/ID5 de OS-000001. La transacción serializable bloqueó organización, factura y versión, verificó la pertenencia y versión vigente y exigió estado DRAFT, sin hash, bloqueo, firmas, documentos ni cierre. El valor se obtuvo de la organización y se comprobó contra el autorizado.

El borrador conservó total XCG `50.00` y los mismos ítems, verificados mediante SHA-256 antes y después. El historial anterior quedó fuera de la actualización. Se escribió en la misma transacción el evento `INVOICE_DRAFT_DECLARANT_RECOVERY`, auditoría `21721`, con actor de mantenimiento y correlación `approved-draft-declarant-OS000001-v2-20261111`.

La lectura posterior confirmó `14265` en la versión vigente y estado DRAFT. El siguiente paso del operador es volver a abrir la factura y ejecutar **Prepare for signature** con sus validaciones normales.

[Resultado de recuperación](evidence/declarant-20261111/recovery-result.json) · [Verificación posterior](evidence/declarant-20261111/post-recovery.json)

## Prevención propuesta

Validar la configuración del Declarant ID antes de crear una factura permite detectar el faltante antes de generar un borrador con un snapshot vacío. La interfaz puede ofrecer un enlace a Settings por permisos y explicar que el dato se toma al crear la factura. La validación definitiva corresponde al Backend.

Para borradores existentes, se requiere un contrato de recuperación explícito con revisión de versión, motivo, auditoría y rechazo ante contenido bloqueado o firmado. Cambiar la configuración de la organización por sí solo no resuelve ese caso.

La restricción técnica actual de configuración admite strings de 1–5 dígitos y conserva ceros iniciales. La fuente del identificador autorizado debe aportarla la clínica según el contrato de organización.

## Comprobaciones y alcance

Se consultaron logs de Render y metadatos del Supabase previamente confirmado y se revisaron las rutas y el código de creación, configuración y preparación. Con autorización específica se completó el snapshot de la versión 2 vigente en una transacción con auditoría. El diagnóstico usa metadatos de identidad de factura y organización y excluye el nombre del paciente. La revisión preventiva de tarifas preparada durante el paso anterior permanece como trabajo local separado.
