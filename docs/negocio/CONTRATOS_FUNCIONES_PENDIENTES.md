# Contratos de funciones pendientes — índice de ejecución

Fecha de revisión actualizada: 2026-11-02. Alcance: seguimiento de contratos y cierre del MVP local. NEG-FUNC-03/04/05 tienen implementación local comprobada; ver [verificación](VERIFICACION_CONTRATOS_03_05_20261102.md). La siguiente entrega está en los [contratos finales para datos reales y portal SVB](CONTRATOS_FINALES_MVP_CLIENTE.md).

## Entrega anterior y estado de evidencia

La discrepancia de evidencia registrada el 31 de octubre sobre NEG-FE-REBILL-02 queda resuelta en código local: las rutas de retiro/cancelación Draft y los detalles de bloqueo están publicados e integrados. La [preparación Frontend](../frontend/PREPARACION_NEG_FE_REBILL_02.md) es histórica; la [validación de entrega](../../frontend/docs/NEG_FUNC_03_04_05_VALIDATION.md) y las [rutas actuales](../../backend/src/modules/declarations/declaration.routes.ts) describen la implementación. La aceptación integral de firma/PDF y entorno del piloto continúa en NEG-FINAL-09.

Las guías comunes mantienen algunas referencias históricas MySQL. El schema/runtime revisados ya apuntan a PostgreSQL; no se vuelve a encargar la migración por esa prosa antigua. La aplicación/aceptación del destino y sus datos se comprueba con evidencias propias, sin ejecutar operaciones sobre clínica para preparar estos documentos. No se cambian contexto/plan compartidos de Arquitectura en esta entrega.

## Nuevos contratos preparados

| Orden | Contrato | Resultado | Responsable inicial y dependencia |
| --- | --- | --- | --- |
| 1 | [NEG-FUNC-03 — Organización y Declarant ID](CONTRATO_ORGANIZACION_SVB.md) | Settings de la organización actual y autoridad de snapshots fiscales | Backend; coordinar declaraciones/Frontend y restricciones existentes con Base de datos |
| 2 | [NEG-FUNC-04 — Candidatos y asignación exclusiva](CONTRATO_CANDIDATOS_DECLARACIONES.md) | Elegir ítems reales sin copiar IDs y evitar duplicaciones entre lotes activos | Backend + Base de datos; consumir retiro/cancelación efectivos y reglas del Declarant ID |
| 3 | [NEG-FUNC-05 — Casos de tratamiento](CONTRATO_CASOS_TRATAMIENTO.md) | Registrar referencia externa y seleccionarla para el paciente/cita correctos | Backend + permisos; Frontend después del contrato HTTP publicado |

Los tres ya tienen implementación Backend/Frontend y evidencia de QA local. No se vuelven a encargar desde cero. La publicación de migraciones/roles en el entorno exacto del piloto y el cierre transversal se comprueban separadamente; no se deducen de un commit ni de conteos históricos.

Los [encargos ejecutables por asistente](ENCARGOS_ASISTENTES_FUNC03_05.md) detallan responsabilidades, tareas B03/DB03/FE03 a B05/DB05/FE05, archivos, dependencias, textos listos para entregar a cada chat y matriz de cierre. Backend es dueño de las reglas ejecutables; Base de datos de su integridad; Frontend de su integración. Diseño, Negocio y Arquitectura mantienen sus responsabilidades de revisión y coordinación.

## Siguiente cartera, sin contrato HTTP definido todavía

| Función | Evidencia/pendiente | Paso posterior |
| --- | --- | --- |
| Configuración SVB de ubicaciones | Existe ClinicLocation.policlinicCode, pero el lookup montado expone solo id/code/name/isActive | Contrato de lectura/gestión limitada y congelación de PoliClinic; no crear catálogo ficticio |
| Accidentes y remitentes | Modelos/referencias existen; no hay un flujo de gestión montado | Definir fuentes, permisos, vínculo paciente/cita/procedimiento e inmutabilidad antes de publicar CRUD |
| Historial de citas/declaraciones | Hay tablas de historial; no se exponen sus lecturas prácticas | Contrato de lectura paginada por permisos del dominio, sin exponer AuditLog ni metadatos sensibles |
| NumberOfTreatments y Assistance | Validación actual los exige para READY; su significado productivo sigue pendiente | Obtener semántica autorizada antes de definir captura/defaults; cantidad/Aantal no la reemplaza |
| Sesiones y revocación DBR-001 | Sigue autenticación access-token propia sin persistencia de sesión | Decisión coordinada de Arquitectura/Backend/Base de datos; no habilitar refresh/logout ficticios desde UI |
| Documentos persistentes remotos | Storage local actual no constituye preparación final Vercel | Contrato de almacenamiento/permisos/hashes y recuperación, coordinado por Arquitectura |
| Maestros y envío real SVB | Fuentes productivas/adaptador externos pendientes | Contrato oficial y credenciales seguras; exportación local no implica envío/aceptación |

## Condición común de entrega

Cada módulo entrega primero servicio Backend, esquema de validación, rutas montadas, permisos, invariantes transaccionales, errores, OpenAPI/API Freeze y handoff. Base de datos revisa cambios de integridad/modelo y valida en PostgreSQL dedicado. Frontend consume solo esa entrega real, implementa accesibilidad/errores/caché y realiza aceptación con el API de QA.

Conservar Express/Prisma/Auth/RBAC propios, IDs y Decimal como strings, America/Curacao, aislamiento por organización y snapshots históricos. No ejecutar integración contra Supabase operativo ni sembrar datos para simular aceptación clínica. No sobrescribir cambios locales o staged de otros chats, ni hacer commit/push/merge/despliegue.

La redacción inicial de contratos fue documental. La revisión del 2 de noviembre ejecutó comprobaciones de producto registradas en su informe, sin pruebas destructivas sobre clínica ni aceptación ficticia de PostgreSQL/navegador.
