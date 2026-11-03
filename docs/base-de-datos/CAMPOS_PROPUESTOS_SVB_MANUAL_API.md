# Campos propuestos: captura manual y futura automatización SVB

Fecha: 2026-11-03. **Propuesta interna**, no layout de archivo ni contrato de API oficial SVB. El operador captura los campos admitidos en su portal; la aplicación conserva un expediente y registra el hecho ya realizado con comprobante. No se presupone que exista una carga de archivos.

El expediente implementado por Backend usa `ODONTHO_MANUAL_ENTRY_V1`, con snapshots de facturas CLOSED vigentes. La disponibilidad técnica de un dato no acredita su obligatoriedad o significado ante SVB. La clínica debe confirmar cada regla externa; los campos sin fuente siguen identificados como pendientes.

| Grupo | Campos propuestos | Origen/tipo y límite |
| --- | --- | --- |
| Identidad de expediente | schemaVersion, declarationId, manualEntryId, contentHash, preparedAt, preparedByUserId | Generados por servidor; hash canónico del contenido. IDs internos string, separados de códigos externos |
| Línea/origen | declarationItemId, sequenceNumber, invoiceItemId, invoiceId, invoiceVersionId, versionNumber, invoiceContentHash | Trazabilidad de la versión exacta; no consultar el maestro actual para reescribirla |
| Identidad externa | declarantId, invoiceNumber, detailInvoiceNumber, providerId, insuredId, treatmentId | Texto congelado; conservar ceros. El portal puede no requerir todos: falta fuente oficial para fijarlo |
| Atención | serviceDate, procedureCode, procedureDescription, quantity | Fecha YYYY-MM-DD de Curazao; quantity Decimal/string del procedimiento para el expediente, **sin convertirlo en NumberOfTreatments** |
| Importes | amount, currencyCode, totalsByCurrency | Decimal/string por línea y moneda explícita; agregados separados por divisa, sin conversión implícita ni floats |
| Requisitos condicionados | authorizationId, accidentFormNumber, referrerId, policlinic | Snapshots cuando existan y el caso esté autorizado; elegir remitente no sustituye evidencia de remisión |
| Semántica pendiente | numberOfTreatments, assistance | Null/pendiente mientras no exista fuente; no proponer 1/quantity/Y/N como default |
| Procedencia de reglas | sourceRulesReference, sourceRulesVersion, approvedBy, approvedAt | Propuesta adicional para una futura entrega respaldada por la clínica. No inventar versiones/aprobadores para pasar validaciones |
| Registro de presentación | idempotencyKey, expectedContentHash, submittedAt, externalReference, reason, receiptDocumentId | Confirmación humana explícita de hecho ya realizado, fecha externa separada del registro servidor; motivo si no hay referencia. Evidencia privada íntegra de la misma organización |
| Resultado externo | respondedAt, resultDocumentId, externalReference, status, lines[].declarationItemId/status/responseCode/responseMessage | Respuesta oficial preservada; recibido no es aceptado, aceptado no es pago. Estado/importe parcial dentro de una línea requiere fuente/modelo adicional |

## Diseño para futuras cargas por lote o API

Conservar una representación canónica versionada del expediente. Un adaptador posterior transforma esa representación al formato autorizado de su canal; no cambia el contenido firmado ni vuelve a llenar snapshots desde maestros. La captura manual, el archivo y el request API deben referirse a los mismos IDs de versión, contenido/hash y reglas de origen.

Para automatización se proponen además: identificador de trabajo/lote, clave idempotente del request, versión del adaptador, identificador externo de correlación, hash del archivo/request y respuesta exacta, tiempos del intento, estado de transporte distinto del resultado SVB y control de reintentos. Los nombres son propuestas de nuestro sistema; solo se enviarán los campos publicados por el destinatario.

Antes de automatizar: contrato del endpoint/archivo, autenticación/autorización, límites de lote, obligatoriedad por caso, encoding, fechas/decimales, adjuntos, catálogo de errores, límites de reintento y consulta de estado ante incertidumbre. La futura cola/outbox tendrá persistencia, control transaccional y decisión de despliegue propias. No guardar credenciales del portal en snapshots ni disparar envíos desde triggers.

Una respuesta incierta bloquea el reenvío hasta consultar al destinatario; una restauración tampoco elimina la presentación externa. Las referencias de evidencia deben seguir descargándose por Backend con permisos, sin URLs públicas permanentes. El hecho de haber definido estos campos no habilita una API ni certifica un layout SVB.

Ver [persistencia y recuperación 07/08/09](NEG_FINAL_07_09_HANDOFF.md), [fuentes pendientes 06](NEG_FINAL_06_DATOS_SVB.md) y [contrato de portal](../negocio/CONTRATO_FINAL_07_PORTAL_SVB.md).
