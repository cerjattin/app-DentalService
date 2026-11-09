# OPS-03 Base de datos

Iniciar revisión y correcciones locales del modelo sobre el [contrato común](CONTRATOS_OPERACION_20261107.md). Leer AGENTS.md, la guía DB y las skills Supabase/PostgreSQL antes de cambiar SQL, Prisma o pruebas de integridad. Preservar la importación de pacientes que ya se preparó en este chat y cualquier decisión del usuario sobre sus números históricos. Ese encargo y sus datos reales tienen alcance separado.

## Atención y facturación

Revisar los seis campos nullable y relaciones de EncounterProcedure en schema.prisma, la migración nueva `20261106000000_service_attention`, cliente generado y seed. La captura admite un bloque de valoración completamente vacío o completo. Las filas históricas valoradas y las facturas firmadas/cerradas conservan integridad e inmutabilidad.

Verificar si los checks ya instalados admiten líneas pendientes sin tarifa/seguro y si bloquean combinaciones incompletas. Revisar FKs, borrado restrictivo, auditoría y locks sobre atención/cita para impedir que una carrera deje un servicio fuera del cierre/factura. Los permisos de roles incorporados se actualizan de forma acotada. Admin conserva la capacidad completa de las etapas por sus permisos efectivos.

La migración nueva se ha aplicado únicamente a bases sintéticas locales en esta ronda. Revisar plan de aplicación compatible con datos existentes y diagnóstico previo. Nunca modificar una migración ya aplicada a un destino. La clínica, su seed y sus objetos quedan fuera de las escrituras de este encargo.

## Persistencia Dentalink

Acordar con Backend un modelo mínimo de conexión lógica por organización/cuenta externa, mapeos de profesional/sede, identidades externas de pacientes/citas y registro de ejecución. Diseñar restricciones únicas que hagan idempotente la combinación de organización, cuenta externa, tipo de entidad e ID externo. Mantener IDs externos de forma textual y FKs locales con pertenencia coherente.

La persistencia debe permitir vista previa/confirmación, reanudación o reintento seguro y diagnóstico de incidencias. Fallar después de crear una entidad antes de vincularla no puede duplicarla en el siguiente intento. Resolver en transacción y constraint compartidos con Backend. Conservar números históricos de pacientes existentes y asignar números nuevos con la secuencia transaccional vigente.

El token se resuelve en configuración segura del backend. El modelo de importación no incluye payloads personales o secretos en logs. Incorporar RLS/aislamiento, índices y política de borrado conforme a las tablas actuales y a la necesidad real del módulo. No hay datos reales ni API Dentalink para validar correspondencias de producción.

## Propiedad y aceptación

DB es el único escritor de Prisma, nuevas migraciones, SQL y cliente generado en esta ronda. Backend modifica sus servicios después de publicar el modelo acordado. Usar cluster/puerto/bases/directorio propios, sin compartir el QA de Negocio ni ejecutar suites concurrentes sobre otro chat.

Probar aplicación desde baseline y actualización con fixtures previos, combinación completa/vacía/parcial de valoración, unicidad y transacciones de importación, permisos y separación de organizaciones. Evitar borrado o cambios de snapshots históricos.

Resolver el pendiente de recuperación aislada del 7 de noviembre. La suite general aprobó 482 pruebas con recuperación optativa omitida. En ejecución separada aprobaron dos verificaciones de inventario y la restauración excedió el límite de 120 segundos. Hay dump y documentos copiados en el directorio privado de QA de Negocio. Reproducir en un QA propio, identificar el paso que espera y comprobar restauración de filas, secuencias, checks, firmas y bytes sin aumentar el tiempo a ciegas. Si la corrección afecta qa-recovery.ts o la prueba de Backend, acordar la propiedad de esos archivos con Backend antes de editarlos.

Actualizar docs/base-de-datos/README.md y entregar `docs/base-de-datos/OPS_03_ENTREGA.md` con cambios, migraciones/checksums, evidencia local, dependencias Backend y un plan de aplicación al destino que continúe pendiente de operación autorizada.
