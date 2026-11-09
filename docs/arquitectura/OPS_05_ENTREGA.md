# OPS-05 — Arquitectura, contexto y candidato operativo

Fecha: 2026-11-07. Responsable: Arquitectura. **Preparación local entregada; candidato provisional, integración OPS y actualización del destino pendientes.** [Contrato OPS-05](../negocio/CONTRATO_OPS_05_ARQUITECTURA.md), [alcance común](../negocio/CONTRATOS_OPERACION_20261107.md).

## Resultado y límites

Se actualizan contexto/plan/guía con agenda → confirmación → servicios → cierre conjunto → factura/firma en Recepción, Admin por permisos. La captura mínima profesional no exige diagnóstico/nota médica/autorización/remisión/seguro/tarifa. Se conserva historia y el cliente legado con seguro; la valoración ocurre al facturar. Dentalink se prepara con adaptador sustituible y sintéticos; sin acceso ni interfaz HTTP oficial verificados no se anuncia sincronización real. SVB y reportes siguen en producto; radicación aplazada.

El usuario informó un despliegue existente; se registra como **INFORMADO POR USUARIO**. No se ha observado URL, revisión live, schema o Storage. Se comprobó disponibilidad del conector Render y ausencia de workspace seleccionado; no se eligió uno ni consultaron servicios. No se confunde YAML, captura Supabase o migración local con destino aplicado. La tarea actual no actualiza clínica ni publica.

## Estado por contrato al preparar la captura

| Contrato | Comprobado / dependencia | Estado de cierre |
| --- | --- | --- |
| OPS-01 Backend | Inicio/finish-services, DTO mínimo, valoración en factura y volúmenes ya presentes en código base. Módulo Dentalink en preparación; API/errores/DTO/permisos finales dependen de su handoff | EN CURSO; entrega nueva no publicada en la captura inicial |
| OPS-02 Frontend | Pantalla Service attention, cierre/refresh/cachés y factura en recepción ya en base. Dentalink requiere rutas reales | EN CURSO; no se atribuyen checks nuevos a Arquitectura |
| OPS-03 DB | Séptima migración service_attention local; [acuerdo de modelo Dentalink](../base-de-datos/OPS_03_MODELO_DENTALINK.md) propuesto. DB único escritor schema/SQL/generado; recuperación aislada asignada | EN CURSO; aplicación del destino y recuperación pendientes |
| OPS-04 Diseño | Nuevo recorrido y pruebas de los tres perfiles/tablet/teclado/documentos definidos por contrato | EN CURSO; requiere evidencia de navegador y su fuente |
| OPS-05 Arquitectura | Contexto/plan actualizados; [handoffs](OPS_05_COORDINACION_DENTALINK.md), [actualización revisable](OPS_05_ACTUALIZACION_DESTINO.md), captura protegida y guía histórica anotada | PREPARADO LOCAL; finalización integrada pendiente de las otras áreas |

Rutas de las entregas esperadas: `docs/backend/OPS_01_ENTREGA.md`, `docs/frontend/OPS_02_ENTREGA.md`, `docs/base-de-datos/OPS_03_ENTREGA.md`, `docs/diseno/OPS_04_ENTREGA.md`. No se crean informes en nombre de esas áreas ni se cierran por la existencia de archivos.

## Candidato de partida OPS, no release final

Versión **`ops05-736bb3fd61dffca5`**, HEAD base `1828797be5abb6d97292dc298dafd6e3976ff9b8` más fuentes locales de todas las áreas. [Manifiesto](../../deployment/releases/ops05-736bb3fd61dffca5-1794092371323-d00113a3/manifest.json): **465 archivos**, SHA-256 source `736bb3fd61dffca5930f59883f936c3862c2dce9b84da035cf113f5a1faff292`.

La captura es un checkpoint antes de cerrar OPS-01–04, no acredita todos los cambios que sigan escribiendo otras áreas. Su manifiesto registra las cuatro entregas aún ausentes, su política de empaquetado y las siete migraciones con hash exacto; `targetApplied=NOT_CHECKED`. El módulo Dentalink parcial no tiene aceptación por aparecer en fuentes. No se compiló ni se aplicó el snapshot; no se heredan builds/tests de 092a ni resultados del 6–7 a ediciones nuevas.

Herramienta propia: [ops-candidate.mjs](ops-candidate.mjs), que reutiliza colector/hash/verificador de deployment. Copia a directorio nuevo, detecta cambios durante captura y guarda evidencia de áreas con estado de revisión pendiente. Usa una lista explícita para archivos de deployment; excluye artefactos locales desconocidos, certificados y capturas de la app/proyecto. Los archivos originales no se editan. La fuente de política `prisma/seed.ts` se copia para lectura AST, nunca se ejecuta.

```powershell
node docs/arquitectura/ops-candidate.mjs snapshot
node deployment/release.mjs verify RUTA_DEL_CANDIDATO
```

El cierre posterior revisa las entregas, compara sus hashes/locks/SQL/generado con el candidato y recaptura **solo si cambiaron fuentes**; vincula checks reales y estados parciales. Si el esquema o cliente Dentalink siguen en escritura, no generar/editar Prisma desde Arquitectura ni compilar un estado intermedio como aceptado. El build limpio del candidato se coordina después de ese handoff. QA local no acredita host/Linux/Storage ni cliente.

## Archivos protegidos

| Archivo original preservado, fuera del source empaquetado | SHA-256 antes/después |
| --- | --- |
| deployment/prod-ca-2021.crt | 700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7 |
| deployment/supabase-schema-tlfdwmaofwpwlcgrhfps.png | 3de6295d37e85212f64ab5c7a0baf5c1cef1f423d7b74bdb5ebec567b3f3ec47 |

No se inspeccionó ni reprodujo el contenido de la captura ni se subieron estos archivos. Un certificado presente no prueba una conexión; la captura no prueba migrations/constraints aplicados hoy.

## Evidencia y verificaciones

Propias de Arquitectura: lectura de contratos/código/rutas, `node --check` del capturador, snapshot de fuentes con guardas, hashes de preservación/exclusión y verificación íntegra de sus archivos. Se completan enlaces/rutas y diff check de los documentos propios; no se ejecutan suites de producto ni pruebas de base por una modificación documental/de empaquetado. No se necesitó cluster/base/root documental porque no hubo operaciones QA de producto ni conexiones DB.

Evidencia **de partida de Negocio, sin repetir ni sumar**: Backend 482 aprobadas en 60 archivos el 7 de noviembre, recuperación optativa omitida; typecheck de ese día. Build Backend/Frontend y 345 pruebas Frontend del 6 de noviembre. Recuperación aislada: 2 PASS y 1 timeout120s. Los nuevos cambios de OPS necesitan sus checks por área. Ningún resultado de este informe cierra recuperación, navegador o importación real.

## Operación preparada y puertas

[Actualización revisable del destino](OPS_05_ACTUALIZACION_DESTINO.md): inventario autorizado, cadena realmente pendiente, compatibilidad de datos/permisos, respaldo conjunto probado y escritores detenidos; schema primero, API compatible después, UI al final. Evitar coexistencia de servidor antiguo con valoración nullable nueva. Sin migrate/seed en build/start. Retorno de código requiere compatibilidad real; no completar NULL con cero ni borrar historia.

| Puerta | Estado actual / responsable |
| --- | --- |
| Nuevo flujo local | IMPLEMENTADO DE BASE / aceptación OPS nueva pendiente; Backend/Frontend/DB |
| Dentalink persistencia/API/UI | PREPARACIÓN EN CURSO con acuerdo interno; no conector real |
| Dentalink referencia/acceso/mapeos/primera conexión | PENDIENTE EXTERNO; clínica/Backend, operación posterior |
| Recuperación aislada | NO APROBADA: DB diagnostica timeout y prueba restore completo |
| Navegador/perfiles/documentos/corrección | PENDIENTE OPS-02/04; no heredar aprobación del flujo médico anterior |
| Candidato final con evidencias | PROVISIONAL; Arquitectura vincula tras handoffs |
| Destino live/migraciones/objetos | INFORMADO, no verificado; operación posterior autorizada |
| Actualización publicada/cliente aceptó | NO EJECUTADO POR ESTA RONDA / no aprobado por preparar código |
| SVB radicación | APLAZADA por estructura oficial; historial y reportes se conservan |

No se solicita autorización genérica ni se ejecutan cambios externos para llenar esas puertas. El siguiente paso de esta área es recibir entregas OPS, fijar la versión exacta y su matriz de aceptación; la publicación/aplicación clínica será una operación concreta posterior. Se preserva todo el trabajo compartido.
