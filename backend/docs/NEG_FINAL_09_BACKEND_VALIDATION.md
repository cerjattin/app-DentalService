# NEG-FINAL-09 — evidencia Backend y límites de aceptación

Evidencia histórica de la entrega anterior. FE-07-01 se reprodujo posteriormente y se corrige en [NEG-DEP-10/12](NEG_DEP_10_12.md), con corrida y manifiesto propios. La primera ronda clínica ahora aplaza SVB; el 451 de abajo no acredita esa corrección ni aceptación actual del destino.

Fecha: 2026-11-03. Versión: árbol local de trabajo sobre `0bff419bd`, sin commit/publicación. QA sintético PostgreSQL 17.11 en 127.0.0.1:55439; base principal `odontho_final07_backend_20261103_test`, restauración `odontho_final07_restore_backend_20261103_test`, regresión de migraciones `odontho_final07_legacy_backend_20261103_test`. No datos clínicos. Seis migraciones aplicadas en la base principal.

## Ejecución fresca

- `npm run typecheck`: PASS.
- `npm run vercel-build` (prisma generate + npm run build): PASS; no migraciones/seed en el comando. No se ejecutó Vercel remoto.
- `vitest run --reporter=dot --reporter=json` con las tres bases independientes: **451/451 PASS, 51 archivos, cero skips**, 69.90 s. Incluye unitarias, integración API/DB y los opt-in de restauración/migraciones. Informe local ignorado: `backend/storage/final07-preparation/backend-acceptance-results.json`.
- Suite manual: seis escenarios compuestos; concurrencia, UNCERTAIN/evidencia/liberación, idempotencia/conflictos, rollback de auditoría, aislamiento/permisos, líneas completas de resultado e inmutabilidad, hashes/importes antiguos conservados.
- Acceso piloto: cuatro pruebas de JWT expirado, desactivación/organización, permisos recargados y límite de carga.
- Storage/env: doce pruebas de bucket privado, colisión sin overwrite, integridad, errores sin secretos, traversal/otro bucket, reinicio de adaptador/local, HTTPS/CORS/config Vercel. HTTP Supabase simulado, sin bucket remoto.
- Recuperación: pg_dump/restore aislado con presentación/resultado sintéticos; filas/contadores/relaciones/hashes y cuatro documentos recuperados. Un proceso nuevo descarga evidencias desde DB/root restaurados a través de DocumentService. No se altera clínica.
- Tras esa corrida se endureció SUPABASE_URL inválida y se reutilizó la guarda fiscal de 03 al preparar el expediente. Validación final específica: **21/21 PASS** en manual-entry-backend, OpenAPI y private-document-storage; typecheck/build volvieron a pasar. JSON Postman y enlaces locales de los siete documentos nuevos/actualizados verificados sin errores; diff check correcto.

Las advertencias de pg sobre queries concurrentes provienen de escenarios de carrera sobre fixtures; no hubo fallos. La matriz distingue evidencia API sintética de navegador/entorno final. No sumar conteos históricos como una única corrida actual.

## Matriz de responsabilidad Backend

PASS se refiere exclusivamente al alcance Backend/API sintético. Filas con dependencias externas pendientes se registran NO EJECUTADO integralmente, aunque exista cobertura parcial.

| UAT | Estado Backend | Evidencia / límite |
| --- | --- | --- |
| 01 Accesos | PASS | auth-login/me/lockout, rbac y pilot-access-backend; falta smoke con cuentas individuales en destino |
| 02 Organización | PASS | aislamiento API en invoice, declaraciones, documentos, configuración, contexto06 y manual-entry-backend |
| 03 Paciente/seguro | PASS | insurance/authorization y fixtures; elegibilidad administrativa, sin verificación externa automática |
| 04 Citas | PASS | appointment, operational-gaps y business-day; zona America/Curacao |
| 05 Caso tratamiento | PASS | neg-func-03-05/database: paciente/ceros/snapshot/bloqueo |
| 06 Atención/servicios | PASS | clinical-encounter, encounter-procedure, catálogo/tarifas exactas |
| 07 Requisitos externos | NO EJECUTADO | controles06 probados; fuentes clínicas/remisión/reglas SVB sin confirmar |
| 08 Completar atención/cita | PASS | clinical-encounter/appointment; navegador se acepta aparte |
| 09 Factura/versiones | PASS | invoice y numeración/concurrencia/rollback |
| 10 Firma QA | PASS | invoice: preparar/capturar/firmar/cerrar con evidencia/hash; firma en puesto real pendiente |
| 11 PDF/persistencia | PASS | invoice/PDF y recuperación aislada; bucket/host final aún sin smoke |
| 12 Candidatos/lotes | PASS | neg-func candidatos/paginación/concurrencia/exclusividad |
| 13 Resolver Draft | PASS | retiro/cancelación transaccionales, historial/ordinal, bloqueo concurrente |
| 14 Refacturación | PASS | invoice regresa a Clinical, sustituye servicio, nueva firma/cierre y evidencia antigua preservada |
| 15 Campos portal | NO EJECUTADO | adenda elimina archivo; expediente interno/hash probado, comparación real con clínica pendiente |
| 16 Registro manual | PASS | manual-entry-backend; reserva, comprobante, replay, conflicto/incertidumbre. Entrada real NO EJECUTADA |
| 17 Respuesta/rechazo | PASS | resultado completo por línea y evidencia inmutable; no reenvío/aceptación/pago inferidos |
| 18 Dashboard | PASS | operational-gaps y reglas de versiones/monedas; aceptación de navegador separada |
| 19 UX/puestos | NO EJECUTADO | responsabilidad Frontend/Diseño, sin afirmar validación desde Backend |
| 20 Operación real | NO EJECUTADO | recuperación/accesos locales PASS; topología/usuarios/backup/bucket/destino final pendientes |

## Antes de datos clínicos y presentación real

Destino real según [handoff de Base de datos](../../docs/base-de-datos/NEG_FINAL_07_09_HANDOFF.md): baseline existente, cinco migraciones posteriores pendientes (incluida 07), dos permisos pendientes y tres hallazgos fiscales (dos declarantes inválidos y un Draft inconsistente). Ese diagnóstico fue de lectura; no se corrigió ni migró el destino operativo. Repetir diagnóstico tras la corrección controlada. Sin core seed ni fixtures/cleanup de QA en clínica.

Arquitectura coordina host/URLs/versión candidata, responsables/soporte/suspensión, retención/respaldo/restauración, credenciales individuales y aceptación del entorno. Para Vercel, configurar y probar bucket privado real; reconciliar archivos locales previos con sus hashes o mantener host persistente durante transición. Confirmar fuentes SVB con clínica y alcance de servicios; no sustituir semántica pendiente por defaults. Frontend/Diseño/Negocio completan recorrido y matriz observada. Ronda real y aceptación del cliente no ejecutadas.

Incidencias se registran con severidad, responsable, versión, reproducción y evidencia protegida. Fallo crítico suspende capturas/presentaciones según alcance. Restaurar DB no deshace el portal: reconciliar comprobantes antes de reanudar. Esta entrega prepara API/código/pruebas; no declara el piloto clínico aceptado.
