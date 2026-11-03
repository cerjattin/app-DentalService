# NEG-DEP-12 — Entorno, datos y operación del primer despliegue

Fecha: 2026-11-03. Estado inicial: PENDIENTE. Arquitectura coordina; DB implementa inventario/permisos/plan de datos; Backend garantiza API/Storage; Frontend verifica URL y navegación. [Alcance vigente](CIERRE_PRIMER_DESPLIEGUE_20261103.md).

**Decisión posterior de la continuación:** cuenta Render disponible, solo Supabase de la clínica y **QA únicamente local por ahora**, elegido expresamente por el usuario. Completar preparación/candidato/QA local sin crear otro proyecto/bucket cloud ni usar clínica. Los requisitos remotos de este contrato se conservan para la fase de despliegue; no se marcan aprobados por esta limitación ni impiden cerrar la entrega de preparación local.

## DEP12-A — Plataforma y artefacto

Arquitectura revisa la recomendación anterior Render + Supabase y presupuesto de hasta US$35/mes, sin dar por contratada esa plataforma ni reutilizar precios antiguos. Preparar decisión concreta con coste vigente, consumo/límites, regiones/conexiones, comandos de build/start, raíces backend/frontend, versiones/lockfiles, variables por entorno y URLs/deep links/CORS. Si la selección necesita decisión humana, preguntar con alternativa concreta y continuar la preparación independiente.

Conservar PostgreSQL/PrismaPg y Express/JWT/RBAC actuales. Actualizar docs/CONTEXTO_PROYECTO.md, docs/PLAN_MVP.md y guía Arquitectura para separar historia MySQL de estado local actual y del destino todavía pendiente. Backend posee su runtime/config; Frontend su configuración. Las configuraciones Vercel existentes son preparación, no prueba de destino ni obligación de contratarlo sin resolver el presupuesto.

Preparar artefacto reproducible identificado por hash/manifiesto sin hacer commit/push/tag en este encargo. Registrar archivos/versión exactos y no declarar todo el árbol compartido propiedad de una sola área. Un despliegue necesita versión concreta y plan revisable; no publicar automáticamente al terminar un build.

## DEP12-B — Destino e integridad

Último [inventario de DB](../base-de-datos/NEG_FINAL_07_09_HANDOFF.md): cinco migraciones pendientes, treatment_case.read/manage sin persistir/asignar y tres hallazgos fiscales. Esa evidencia puede envejecer; repetir diagnóstico protegido de solo lectura antes de decidir. Usar huella del destino y conteos en documentación, no credenciales ni registros de pacientes.

DB prepara inmediatamente:

- Sincronización **solo** de permisos/asignaciones requeridos, con simulación/diff, transacción, idempotencia y auditoría/informe. No usar core seed/bootstrap/fixtures sobre clínica. Preservar Admin con todas las funciones y las fronteras de Provider/Reception.
- Plan revisable para dos organizaciones con Declarant ID inválido y un Draft inconsistente: identificar en informe protegido precondiciones/filas esperadas, fuente autorizada del dato correcto, motivo, efectos y reversión. No adivinar identidades ni reemplazar snapshots firmados. Distinguir configuración no firmada de historia que necesita flujo explícito de corrección.
- Cadena de migraciones con checksums, preflight que detiene ante drift/fallo, aplicación por responsable único fuera de arranque y verificación posterior. Probar primero en DB sintética separada; no reescribir migraciones ya aplicadas.

Si hace falta un dato que solo conoce la clínica, entregar el plan y pedir exclusivamente ese dato por canal protegido, mientras se completan las demás tareas. No desbloquear a fuerza de NULL/default ni limpiar registros. Este encargo no autoriza a resolver esas tres filas con valores inferidos ni a ejecutar integración/seeds/cleanup sobre clínica.

## DEP12-C — Documentos y recuperación

Backend y Arquitectura prueban un bucket privado real de **QA** o almacenamiento persistente del host elegido, con archivos sintéticos. Validar subida/descarga autenticadas, organización/permisos, tamaño/hash, no overwrite, errores y bytes tras reinicio/redespliegue. No hacer público el bucket ni llevar service_role a VITE. Persistencia mock/local aprobada no acredita bucket remoto.

Inventariar URI locales previas y preparar transición que preserve IDs/hashes/vínculos/documentos originales; configurar proveedor nuevo no copia los archivos anteriores. Si no hay acceso al bucket/host, dejar la comprobación precisa pendiente y preparar toda configuración disponible, sin sustituirla por filesystem efímero.

Respaldo conjunto de base **y objetos** con restauración aislada, cuentas/roles/privilegios necesarios, prueba de descarga de firmas/PDF/evidencias y manifiesto de hashes. Los backups de PostgreSQL no incluyen los objetos de Storage, según [documentación Supabase](https://supabase.com/docs/guides/platform/backups). Mantener [acceso a Storage](https://supabase.com/docs/guides/storage/security/access-control) mediado por Backend. No restaurar encima del destino clínico como prueba.

Asignar responsable/suplente, frecuencia/retención/custodia, RPO/RTO acordados, soporte y suspensión/recuperación. Esas decisiones quedan con su estado real; no inventar una política aceptada por la clínica. Restaurar DB no deshace un hecho externo SVB; preservar y reconciliar cualquier historia existente aunque las nuevas presentaciones estén aplazadas.

## DEP12-D — Secuencia para publicar y habilitar clínica

1. Cerrar DEP10 y QA clínico DEP11 con versión exacta, configuración SVB aplazada y destino definido. Preparar health/liveness/readiness, HTTPS/CORS, límites de carga, pool/conexiones, logs sin secretos y configuración de documentos.
2. Ensayar artefacto en entorno de despliegue separado con datos sintéticos. Smoke: login/roles/aislamiento, deep links, paciente/cita/atención/factura, firma/PDF/corrección, documentos tras actualización y Dashboard. No reutilizar clínica como laboratorio.
3. Dejar revisable la operación final: destino/ventana/responsable, respaldo verificado, migraciones exactas, cambios de permisos/datos con precondiciones, publicación, smoke sin tests destructivos, suspensión y retorno. Resolver solo las decisiones/credenciales indispensables por canal adecuado; no solicitar contraseñas en el chat.
4. Aplicar operaciones reales/publicación solo bajo la autorización concreta correspondiente y las restricciones AGENTS. No commit/push/deploy ni escrituras clínicas como efecto de esta delegación de preparación. La solicitud actual es preparar contratos y que los especialistas inicien para poder desplegar; no modifica valores fiscales desconocidos ni contrata servicios pagos.
5. Antes de habilitar datos reales: inventario posterior sin bloqueos del alcance clínico, cuentas individuales, documentación de copia/recuperación y resultados de smoke de destino. Operador/cliente observa la primera ronda y registra aceptación separada. SVB permanece aplazado; fallos críticos suspenden uso.

## Entregas y cierre

Arquitectura entrega decisión/manifest/configuración/runbook y matriz de go/no-go, actualiza contexto/plan. DB entrega herramientas, diff de permisos, plan protegido de reparación y comprobaciones QA. Backend entrega evidencia de Storage/config/runtime y contratos sincronizados. Frontend entrega smoke/navegación sobre artefacto exacto. Cada área escribe su guía; evita ediciones simultáneas del mismo archivo.

Cierre exige distinguir PREPARADO LOCAL, QA DESPLEGADO, OPERACIÓN CLÍNICA PREPARADA y CLIENTE ACEPTÓ. Cada estado necesita evidencia propia. No marcar primer despliegue completado sin URL/versión/smoke, ni uso clínico apto con migraciones, documentos o identidad fiscal sin resolver.
