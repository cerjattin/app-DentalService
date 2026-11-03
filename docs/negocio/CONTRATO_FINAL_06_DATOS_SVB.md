# NEG-FINAL-06 — Datos y reglas SVB para operación real

**Alcance posterior vigente, 2026-11-03:** [primer despliegue clínico con SVB aplazado](CIERRE_PRIMER_DESPLIEGUE_20261103.md). Las fuentes/formato de este contrato siguen pendientes para la fase SVB; no bloquean la preparación clínica independiente. Los controles ya implementados se conservan.

Actualización 2026-11-03: [captura campo por campo confirmada](ADENDA_PORTAL_MANUAL_20261103.md). Archivo destino no es prerrequisito del registro manual; las reglas/fuentes de datos continúan pendientes.

Fecha: 2026-11-02. Alcance confirmado: datos reales y carga manual en portal SVB. Estado: **contrato final pendiente de implementación/validación de las partes faltantes**.

## Resultado exigido

Cada ítem que llegue a READY/exportación para presentación real tiene datos trazables y reglas de captura autorizadas. No completar campos obligatorios únicamente para que pase el validador. La lista de servicios/casos habilitados en el piloto debe ser explícita y comprobable en Backend.

El usuario confirmó previamente Aantal del PDF como quantity del procedimiento. Esa decisión no confirma por sí misma el significado de NumberOfTreatments del archivo de declaración ni de Assistance.

## Fuentes que deben cerrar Negocio y la clínica

Entregar una ficha versionada con la fuente autorizada, responsable de la clínica, fecha, obligatoriedad, valores permitidos y regla de origen/captura de cada campo: DeclarantId, ProviderId, InsuredId, TreatmentId, NumberOfTreatments, Assistance, PoliClinic, autorización externa y referencia/accidente cuando apliquen.

Para NumberOfTreatments y Assistance es un bloqueo real la falta de semántica confirmada. No establecer `quantity`, `1`, `Y` o `N` como defaults por inferencia. Tampoco cambiar el validador para dejar pasar vacíos sin una regla autorizada del formato destino. Si una fuente confirma que un campo no aplica a una clase de servicio, publicar y probar esa regla por clase, sin extrapolarla a todo el catálogo.

La fuente del formato de carga debe especificar versión, formato aceptado, encoding, delimitador/anchos, encabezados, fechas, separadores decimales, longitudes, ceros iniciales y adjuntos requeridos. Tener `Recursos/DeclFileLayOut.pdf` o exportadores CSV/TXT/XML/JSON no acredita por sí solo que el portal acepte la salida actual.

## Backend y Base de datos

1. Conservar los contratos 03/04/05 implementados. Auditar el recorrido nuevo de datos y definir un único origen por campo; congelarlo en el momento contratado. Los datos firmados nunca se rellenan desde maestros actuales.
2. Implementar, tras la ficha de fuente, la captura de campos SVB de un procedimiento nuevo o su contexto autorizado. Publicar campos/DTO/errores exactos en schemas/OpenAPI; no admitir edición libre de snapshots firmados. Las correcciones pasan por nueva versión y firma.
3. Completar configuración de `ClinicLocation.policlinicCode`: propuesta de ampliar el GET existente de ubicaciones con el campo y publicar PATCH `/api/v1/clinic-locations/:id/svb-settings`, permiso existente `clinic_location.manage`, motivo y revisión/control concurrente. GET conserva `clinic_location.read`. El body y sus valores admitidos se fijan con la fuente autorizada; hoy el mapper técnico valida P/K. No crear ubicaciones ficticias ni cambiar los snapshots anteriores.
4. Para casos que requieran accidente/remitente, publicar el mínimo registro/lookup y validación paciente/seguro/organización. Las rutas nuevas se documentan antes de UI. Reutilizar AccidentCase y Referrer; conservar ceros y sus identificadores externos, sin introducir claves manuales en Frontend.
5. `requiresReferral` no queda satisfecho por elegir cualquier Referrer ID. Negocio debe definir qué documento/referencia externa constituye la remisión autorizada y cuándo se exige. Si el caso requiere ese flujo y todavía no existe, Backend debe impedir tratarlo como preparado para presentación real.
6. Mantener una sola validación compartida entre captura, candidatos, READY y exportación. Distinguir errores faltantes, valores inválidos y un flujo no soportado; publicar códigos estables, no textos para que Frontend deduzca reglas.
7. Cargar maestros/tarifas y códigos reales mediante un procedimiento controlado con procedencia/vigencia, detección de duplicados y auditoría. Probarlo primero en QA. No ejecutar semillas generales ni sustituir clínica por fixtures.

Las nuevas rutas de este contrato son propuestas y no se consideran implementadas por este documento. Backend debe concretar la porción de API una vez resueltas las fuentes; Base de datos revisa modelo/constraints y preparación de cambios, sin escrituras automáticas sobre datos reales.

## Frontend y Diseño

- Mostrar solo campos publicados, etiquetas y ayuda en inglés, obligatoriedad por reglas del servidor y fuente trazable cuando corresponda.
- Seleccionar sede, caso, accidente/remitente mediante recursos reales; no pedir IDs internos ni fórmulas fiscales al operador.
- Mostrar diagnóstico por línea antes de READY; permitir corregir datos en su origen o crear la versión correctiva adecuada. No ofrecer editar contenido firmado como solución rápida.
- Mostrar claramente qué servicios/casos están habilitados para el piloto y qué requisito concreto bloquea un caso. El bloqueo se impone también en Backend.
- Después de guardar, invalidar recursos afectados; no recalcular tarifas ni totales monetarios en el navegador.

## Criterios de cierre

| Caso | Evidencia necesaria |
| --- | --- |
| Servicio ordinario | Captura → snapshot → candidato → READY → archivo con datos exactos |
| Autorización requerida | Validación de cobertura/vigencia/cantidad; consumo y liberación correctos, independiente de Declarant ID |
| Remisión/accidente si está habilitado | Referencia/evidencia correcta y rechazo efectivo de ausencias o vínculos ajenos |
| Cambio de maestro/configuración | Solo afecta nuevas capturas; versiones y documentos anteriores intactos |
| Campos y monedas | IDs/Decimal strings y ceros preservados; fechas Curazao; ninguna suma de divisas |
| Documento de formato destino | Fuente versionada y archivo validado con la clínica para el portal autorizado |

Responsable inicial: **Lógica de negocio con la clínica** para cerrar fuentes; **Backend** implementa, **Base de datos** soporta integridad, **Frontend/Diseño** capturan y presentan. No cerrar este contrato con una prueba construida a partir de defaults inventados. Integración automatizada solo con datos sintéticos en PostgreSQL dedicado.
