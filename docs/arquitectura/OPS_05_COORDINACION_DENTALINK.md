# OPS-05 — Dependencias entre áreas y preparación Dentalink

Fecha: 2026-11-07. Alcance: implementación local y sintética. [Contrato común](../negocio/CONTRATOS_OPERACION_20261107.md), [reglas funcionales](../negocio/CONTRATO_ATENCION_FACTURACION_DENTALINK_20261106.md). Este documento coordina entregas; no publica endpoints ni modifica el modelo.

## Propiedad y orden acordados

| Entrega | Editor único | Consumidor / condición de handoff |
| --- | --- | --- |
| Prisma/schema/SQL/cliente y recuperación acordada | DB OPS-03 | Backend consume tras publicar modelo/generado/migraciones y sus checks. DB tiene reserva de qa-recovery.ts/pilot-recovery.test.ts según su acuerdo; no edita otro chat esos archivos sin reasignar |
| Servicios/repositorios/DTO/rutas/OpenAPI/permisos | Backend OPS-01 | Frontend consume rutas montadas y handoff actualizado. Arquitectura no inventa ni implementa otra API |
| Componentes/cachés/formularios/pruebas UI | Frontend OPS-02 | Diseño OPS-04 inspecciona y reporta; solo edita UI con asignación expresa de archivos |
| Reglas/alcance/aceptación integrada | Negocio | Arquitectura mantiene contexto/plan y puertas por versión |
| Candidato y operación de actualización | Arquitectura OPS-05 | Recibe entregas con hashes; no aplica migración ni publica por esta ronda |

## Contrato mínimo Dentalink

La clínica aún no tiene acceso a la API. El módulo interno puede probarse con adaptador sustituible **confinado a pruebas**. En operación sin adaptador oficial, devolver estado deshabilitado/no disponible; nunca un resultado sintético como si viniera de Dentalink.

| Frontera | Requisito verificable | Estado inicial / responsable |
| --- | --- | --- |
| Modelo | Cuenta por organización/cuenta externa, mapas profesional/sede, identidades externas textuales exactas y ejecuciones/ítems | [Acuerdo OPS-03](../base-de-datos/OPS_03_MODELO_DENTALINK.md) publicado; implementación/cliente y SQL por DB |
| Idempotencia | Único por organización/cuenta/tipo/ID; registro local + identidad + auditoría/conflictos en transacción. Reintento no duplica ni renumera pacientes existentes | DB constraints + Backend; evidencia concurrente antes de aceptación |
| Preview | DTO normalizado validado; incidencias por referencias/mapas/solapamiento/coincidencia dudosa; hash congela lo confirmado. Cursor conserva reanudación de página incompleta | Backend publica DTO/estados/errores en OpenAPI/handoff; no se deducen aquí rutas |
| Confirmación | Permisos efectivos y organización; paciente/cita nuevos solamente; cita SCHEDULED para confirmación local; estado/bloqueo/hash revisados en transacción | Backend/DB; Frontend integra cuando contrato HTTP exista |
| Coincidencias | Ninguna fusión automática por nombre/documento. Números históricos no se reemplazan; nuevos números por secuencia transaccional | Backend/DB; revisar incidencias explícitamente |
| Seguridad | Credencial solo en backend; sin token/URL secreta en tablas o VITE; sin payload personal en logs/auditoría. DTO normalizado privado sujeto a aislamiento/retención | DB propone RLS/FK/constraints; Backend valida. Retención final de payloads/ejecuciones debe quedar explícita en su handoff |
| HTTP real | Documentación oficial verificable de auth/recursos/campos/paginación/límites/fechas/estados, mapeos y acceso autorizado | PENDIENTE EXTERNO. No inventar endpoints ni normalización de timezone. Token real/primera conexión/importación requieren ronda autorizada |
| UI | Estado desconectado, preview/incidencias y confirmación real de esa ejecución; conserva paciente/cita en componentes compartidos | Frontend depende de rutas reales; no contadores simulados ni botones funcionales sin contrato |

El acuerdo de DB propone cinco modelos, estados internos y permisos dentalink.read/manage/import; son decisiones internas, no esquema ni estados oficiales de Dentalink. Backend debe confirmar alcance exacto y publicar los errores/paginación. La disponibilidad de esos modelos en disco no acredita que se hayan migrado ni que exista conector operativo.

## Handoff que debe quedar en las entregas

- DB: migraciones/checksums/cliente, FKs e identidad textual, límites y RLS; prueba de unicidad/pertenencia/rollback/reintentos. Ningún token en el modelo.
- Backend: rutas efectivamente montadas, DTO/errores/permisos, estado sin adaptador, confirmación/hash/replays/cursor, límites/tamaños y protección de logs. Muestra normalizada solo sintética.
- Frontend: integración exacta del handoff, flujo desconectado recuperable, vista previa e incidencias y resultado; pruebas del nuevo recorrido y cachés. Una página de estado no acredita importación.
- Diseño: evidencia por fuente/resolución/permisos y defectos reproducibles, con Dentalink identificado como preparación o desconectado.
- Arquitectura: vínculo por hashes a esas entregas y matriz de dependencia. Si una entrega falta, candidato provisional; no fingir que todo quedó cerrado por compilar.

## Recuperación y destino

El timeout aislado de restauración a 120 s queda en DB OPS-03, con archivos reservados según acuerdo; se requieren fase/causa y restore de filas/secuencias/checks/documentos. Aumentar timeout sin diagnóstico no cierra la puerta. La suite base de Negocio omitió esa integración optativa: 482 aprobadas no equivalen a recuperación aprobada.

Las tablas/identidades/ejecuciones de importación deben entrar en inventario/dump/restore y sus secuencias/constraints. Se preservan vínculos externos para que restaurar/reintentar no duplique importaciones. Observar compatibilidad con el helper: si rechaza tabla/proveedor nuevo, documentarlo y corregir en el área asignada, sin omitir datos para que pase.

Primera conexión/importación real Dentalink, actualizaciones externas, escrituras hacia el proveedor y programación automática quedan fuera de esta ronda. La importación anterior de Excel/pacientes y sus números históricos tiene encargo separado; no ejecutarla ni repetirla como fixture de OPS.
