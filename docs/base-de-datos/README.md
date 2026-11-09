# Base de datos y Supabase

## Operación por servicios y Dentalink — OPS-03

La [entrega OPS-03 del 8 de noviembre de 2026](OPS_03_ENTREGA.md) revisa la valoración pendiente, incorpora el [modelo Dentalink acordado con Backend](OPS_03_MODELO_DENTALINK.md) y verifica creación desde cero y actualización con historia en PostgreSQL sintético propio. Cliente Prisma generado, FKs por organización, cinco tablas privadas con RLS y permisos acotados. La recuperación final comprueba filas, secuencias, estructura y cuatro documentos; el timeout histórico de Negocio no se reprodujo y su causa exacta permanece indeterminada. El helper ahora registra fases y limita esperas.

Evidencia nueva de esta entrega: integridad/actualización 8/8, recuperación/bloqueo 4/4, unitarias Backend 174/174, typecheck/build aprobados. La migración de atención y la nueva migración Dentalink se probaron solo en QA local. El [diagnóstico SQL](../../database/postgresql/ops03-preflight.sql) es de solo lectura. El plan remoto y sus límites están en la entrega.

Las operaciones autorizadas del 5 de noviembre importaron 2.022 servicios/tarifas XCG y 11.451 pacientes con números históricos, con 223 filas retenidas para revisión. Los servicios se activaron por encargo posterior; las tarifas conservaron su estado inactivo en aquella operación. Son evidencias de esa sesión, no una inspección actual. Sus archivos privados y decisiones quedan separados de las fixtures OPS-03.

Las secciones siguientes conservan los hitos y límites de sus fechas originales. El usuario comunicó que la aplicación está desplegada; esta ronda no verifica su estado ni publica una actualización.

## Responsabilidad y ubicación

Modelo, integridad, índices, migraciones, seeds, verificación y conexión con Supabase PostgreSQL. Archivos actuales: `backend/prisma/`, `database/` y contratos originales en `Recursos/`.

`backend/prisma/schema.prisma` es el modelo ejecutable PostgreSQL. Su baseline está en `backend/prisma/postgresql/migrations/`. `database/001...006`, `backend/prisma/migrations/0_init` y `backend/prisma/mysql/schema.prisma` conservan el histórico MySQL; no deben aplicarse en PostgreSQL.

## Estado y destino

**Alcance vigente del primer despliegue:** clínico, con SVB aplazado. Ver [entrega DEP10/12 de inventario, permisos y plan fiscal protegido](DEP12_PRIMER_DESPLIEGUE.md). El destino se volvió a inspeccionar solo en lectura; su aplicación/objetos reales siguen pendientes. Las entregas siguientes conservan su fecha y límites históricos.

Código actual: PostgreSQL con Prisma 7 y `PrismaPg`, con un cliente compartido por runtime, scripts y seeds. El baseline fue comprobado como aplicado en Supabase durante el diagnóstico Postman del 30 de octubre; después el usuario confirmó que sus pruebas pasaron. No se reinspeccionó el destino operativo en el encargo del 31 de octubre. La base MySQL y su configuración no se eliminaron.

El usuario confirmó que todos los datos MySQL son pruebas prescindibles: esta transición crea estructura nueva sin transferir registros. Solicitó conservar comparaciones/búsquedas sin distinguir mayúsculas ni acentos. Se mantienen IDs/Decimal string, autenticación/RBAC e integridad histórica.

La entrega inicial de PostgreSQL del 30 de octubre verificó 298 tests/31 archivos; es evidencia histórica de esa versión. La entrega DB03/04/05 del **31 de octubre** verificó **384 pruebas en 41 archivos**, typecheck/build y los escenarios adicionales de integridad/migración en bases locales dedicadas. Las cuatro migraciones posteriores al baseline y los nuevos permisos se prepararon con Backend y **no se aplicaron a Supabase operativo** desde estos chats.

Ver [entrega DB03/DB04/DB05, diagnóstico y aplicación](NEG_FUNC_03_04_05.md). La revisión incluye propiedad activa exclusiva, ordinales persistentes con recuperación de auditoría, revisión de identidad legada, primer uso de TreatmentCase y matriz de permisos. La aceptación Frontend/navegador y del entorno operativo sigue pendiente.

Continuar con el [paso a paso y contrato de conversión](MIGRACION_POSTGRESQL.md). Los nuevos scripts `*:supabase` seleccionan explícitamente el entorno y el certificado; no sobrescriben el `.env` MySQL.

La elección de Supabase no migra automáticamente usuarios de aplicación a Supabase Auth. Auth, sesiones, Storage y Realtime tienen alcances separados.

## Contrato final 06 — datos SVB

La [entrega técnica de Base de datos del contrato 06](NEG_FINAL_06_DATOS_SVB.md) incorpora diagnóstico de integridad/snapshots y simulación de precarga de maestros con procedencia, sin escrituras. El usuario confirmó el 2 de noviembre que todavía no existe la ficha clínica autorizada: carga real y presentación siguen bloqueadas. Se conserva el modelo actual; la unicidad de PoliClinic por organización requiere contrastarse con la fuente antes de publicar su edición. Las pruebas de esta entrega utilizan otro PostgreSQL local dedicado, sin aplicar cambios a Supabase operativo.

## Contratos finales 07/08/09 — preparación de piloto

Ver [entrega de integridad, inventario y recuperación](NEG_FINAL_07_09_HANDOFF.md). El 3 de noviembre se verificó el Supabase configurado **solo en lectura**: baseline aplicado, migraciones posteriores/permisos nuevos pendientes y conflictos fiscales contados sin exponer datos. La migración 07 del registro manual se preparó con Backend y se valida en PostgreSQL local separado. La captura manual campo por campo conserva un expediente y comprobante; no requiere inventar un archivo oficial SVB ni configurar transporte automático. El entorno operativo permanece bloqueado hasta resolver su inventario y completar la aplicación controlada/aceptación. No se desplegó ni se ejecutaron semillas, migraciones o limpieza sobre clínica.

## Trabajo de transición

1. En este arranque, datos MySQL prescindibles confirmados por el usuario. Si posteriormente aparecen datos a conservar, detener el plan de base vacía e inventariar datos y respaldos.
2. Definir un destino de desarrollo/pruebas separado y estrategia de transferencia de datos. Con datos reales, conservar relaciones, IDs, hashes de firma y vínculos de documentos.
3. Diseñar conversión de tipos MySQL: unsigned, tinyint, fechas, enums, JSON, defaults e índices; mantener `Decimal` exacto y validar rangos de BigInt PostgreSQL.
4. Revisar constraints/checks, claves compuestas y constraints manuales que Prisma no representa. No basta con generar tablas desde el schema.
5. Conservar el historial PostgreSQL separado del baseline MySQL. No marcar `0_init` MySQL como aplicado en PostgreSQL.
6. Coordinar cambios de adaptador/configuración con Backend; revisar todos los clientes de scripts, seeds y pruebas.
7. Validar collation/case sensitivity, unicidad de email/códigos, locks, concurrencia, rollback, tarifas y fechas.
8. Probar restauración y registrar evidencia antes de cambiar la base operativa.

## Conexiones y exposición

Para el backend persistente local, evaluar conexión directa o pooler de sesión según la red. Para el futuro runtime serverless, evaluar pooler transaccional y límites del driver. Migraciones necesitan conexión compatible con continuidad de sesión, separada de la configuración de runtime cuando corresponda. Copiar los endpoints reales del proyecto Supabase, nunca inventarlos.

Si se usa únicamente Prisma, mantener desactivada Data API según la guía de Supabase. Si se habilita en una fase futura, definir acceso/RLS antes de exponer tablas. No asumir que el JWT propio de Express ya se integra con `auth.uid()`.

## Aceptación

Schema válido y cliente generado; migración desde cero en destino de pruebas; seeds/verificación reproducibles; paridad de constraints y datos; numeración y tarifas concurrentes; regresión de facturación/firma/declaraciones/reportes; backup y restore comprobados. Una conexión exitosa no completa la migración.

Referencias: [Prisma con Supabase](https://supabase.com/docs/guides/database/prisma), [conexiones PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres), [contrato original](../../Recursos/ODONTHO_DATABASE_CONTRACT_BACKEND.md). Este último conserva contexto MySQL y debe actualizarse al cerrar la transición.
