# Registro manual SVB — propuesta Frontend para 06/07

Fecha: 2026-11-03. Decisión directa del usuario: no hay plantilla aceptada de archivo, la operación es manual y **se presenta una declaración por factura**, con sus procedimientos. Esta decisión reemplaza para el recorrido manual la suposición de que siempre se necesita una exportación. Este documento propone organización de datos; no inventa reglas oficiales de SVB ni publica por sí mismo una API.

La [información oficial del Healthcare Portal](https://svbcur.org/svb-healthcare-portal/) permite entrada de declaraciones o carga de archivos. El [portal enlazado oficialmente](https://online.svbcur.org/SVB_CarePortal/) se abre por acción del operador, sin automatizarlo, enviar datos en URL ni guardar credenciales.

## Campos sugeridos y origen

| Grupo | Campos | Origen y protección |
| --- | --- | --- |
| Identidad de presentación | ID interno de registro, organización, canal MANUAL_ENTRY, versión del contrato | Servidor; claves opacas seleccionadas por recursos, nunca copiadas por el operador |
| Factura exacta | invoiceId, invoiceVersionId, número, fecha, hash firmado, PDF de esa versión | Snapshot cerrado; una factura por presentación. Número visible no sustituye IDs/versiones |
| Declarante y profesional | Declarant ID y Provider ID | Valores congelados de organización/profesional al facturar; conservar ceros |
| Paciente/cobertura | Insured ID, identificación del paciente y cobertura necesaria para la captura | Snapshot autorizado de la factura; no volver a consultar un maestro para modificar lo firmado |
| Líneas de la factura | invoiceItemId/declarationItemId, ordinal, código/descripción del procedimiento, fecha de servicio, cantidad, tarifa unitaria, importe y moneda | Snapshot de cada procedimiento; Decimal string; totales calculados por Backend y separados por moneda |
| Contexto clínico SVB | External treatment ID, autorización y evidencia de remisión/accidente cuando apliquen; diagnóstico/nota si el portal los exige | Regla/fuente de clínica por clase. No deducir requisitos desde la presencia de una celda |
| Campos aún sin semántica aprobada | NumberOfTreatments, Assistance y reglas oficiales de PoliClinic | Mantener desconocidos hasta su ficha autorizada; quantity/Aantal no define NumberOfTreatments |
| Preparación | Responsable, fecha de preparación, hash del conjunto de líneas, estado preparado/incierto/registrado/liberado | Servidor congela el conjunto exacto y protege exclusividad; preparar no equivale a presentar |
| Registro del operador | Fecha/hora externa con offset, referencia emitida por portal o ausencia explícita con motivo, confirmación de entrada ya realizada | Sin referencia inventada. Fecha declarada y fecha de registro del servidor se conservan separadas |
| Evidencia de presentación | Documento de comprobante, tipo/tamaño/SHA-256, actor y hora de registro | Archivo privado cargado mediante Backend, relación con factura/versión y comprobación de pertenencia/hash |
| Resultado incierto | Motivo, cuándo surgió la duda, responsable y evidencia de resolución | Bloquea repetición/corrección hasta resolver. Un timeout no autoriza otra presentación |
| Respuesta | Referencia, fecha externa, documento oficial, resultado global y estado/código/mensaje por línea | Recibido no es aceptado; aceptado no es pagado. Aceptaciones parciales de importe dentro de una línea necesitan contrato adicional |
| Idempotencia/auditoría | Clave opaca por intención, huella de request, actor, fechas, historial y correlación | Misma intención/contenido recupera el registro; no crear otra clave después de una respuesta perdida sin reconciliar |

La UI debe recibir los IDs, estados y capacidades del Backend. El operador revisa factura/versiones y selecciona evidencia; no escribe IDs internos, hashes o fórmulas fiscales. Ningún archivo de carga debe ser obligatorio para **entrada manual**.

## Preparación para lotes o API futura

Conservar un núcleo de presentación por factura y separar el transporte. Una futura agrupación puede reunir N presentaciones mediante un batchId, con resultado y errores por factura/línea; no fusionar las facturas ni sumar monedas distintas. Un adapter externo transforma el núcleo a un layout versionado únicamente cuando SVB lo publique y la clínica lo apruebe.

Campos reservados de transporte: canal, schema/layoutVersion, adapterVersion, archivo exacto y su hash si existe, externalBatchReference, externalRequestId, idempotencyKey, estado de entrega, recibo y resultado. Para API: autenticación de integración en Backend, límites, reintentos solo tras reconciliar resultado incierto, correlación por factura y verificación de respuestas; nunca credenciales SVB en el bundle ni llamadas directas desde Frontend.

No se escoge CSV/TXT/XLSX/JSON como formato oficial. Los exportadores actuales son técnicos. El formato, encoding, delimitadores, anchos, fechas, decimales y adjuntos futuros deben provenir de una fuente autorizada. Una descarga no marca presentado.

## Coordinación de la implementación

Frontend integra únicamente rutas, DTO y permisos montados y publicados en OpenAPI/handoff. Backend/Base de datos deben concretar preparación por factura, evidencia e idempotencia, y diferenciar las capacidades de entrada manual de los futuros archivos/API. La ausencia de layout no es por sí misma impedimento de entrada manual; las fuentes clínicas de los campos, los controles de evidencia y los bloqueos efectivos siguen siendo necesarios.

Las propuestas de los contratos 06/07 que exigían siempre declarationExportId deben reconciliarse con la decisión por factura/sin archivo. Un lote con varias facturas requiere dividirse o rechazarse para preparación manual; Frontend no puede resolver esa integridad con una agrupación visual.
