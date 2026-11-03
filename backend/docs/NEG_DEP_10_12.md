# NEG-DEP-10/12 — Backend del primer despliegue clínico

Fecha: 2026-11-03. Alcance vigente: [cierre de despliegue](../../docs/negocio/CIERRE_PRIMER_DESPLIEGUE_20261103.md), [DEP10](../../docs/negocio/CONTRATO_DESPLIEGUE_10_INTEGRIDAD_SVB.md), [DEP12](../../docs/negocio/CONTRATO_DESPLIEGUE_12_ENTORNO_OPERACION.md). Árbol local sobre `0bff419bd`, sin commit/push/publicación ni escrituras clínicas. Esta entrega actualiza la habilitación manual de NEG-FINAL-07/08/09; los resultados anteriores no cerraban FE-07-01.

## DEP10-A: una factura completa

Prepare y registro nuevo validan dentro de la transacción serializable una única invoice y versión CLOSED vigente de la organización/payer. Comparan el conjunto de invoiceItemId seleccionado con todos los IDs consultados de esa versión; no suman importes ni aceptan una lista autoritativa del cliente. Rechazan faltantes, extras y repetidos. Conservan validaciones fiscales, hash/estado de fuente, reserva exclusiva y auditoría atómica.

Se bloquea primero el lote; las filas invoice se bloquean en orden de ID antes de consultar la composición completa. Lecturas/comparación comparten snapshot transaccional; los conflictos de serialización se reintentan con los límites existentes. Las correcciones concurrentes no pueden invalidar una preparación confirmada. No cambia schema ni SQL aplicado.

| HTTP/código | Significado |
| --- | --- |
| 409 MANUAL_ENTRY_SINGLE_INVOICE_REQUIRED | Mezcla de invoices o versiones |
| 409 MANUAL_ENTRY_INCOMPLETE_INVOICE | Conjunto distinto del total de ítems de la versión |
| 409 MANUAL_SOURCE_NOT_CURRENT / MANUAL_SOURCE_INCONSISTENT | Fuente/identidad/hash no válidos, conservados |
| 409 IDEMPOTENCY_KEY_CONFLICT | Clave existente con distinto contenido, conservado |

Estos errores no incluyen IDs, nombres, rutas o documentos en details. Los permisos anteriores no cambian. El GET de expediente interno continúa permitiendo revisar una selección parcial; no concede permiso para reservarla. Un registro nuevo comprueba otra vez conjunto/hash contra su reserva. Una reserva legada parcial no se reescribe: su registro nuevo falla con INCOMPLETE_INVOICE; consulta y liberación verificada permanecen disponibles. Se conserva la [reproducción original Frontend](../../docs/frontend/evidence/uat-20261103/manual-invoice-contract-probe.json) sin alterar su resultado histórico.

## DEP10-B: SVB aplazado por defecto

`SVB_MANUAL_RECORDING_ENABLED=false` es el valor por defecto, incluso en test. Readiness publica `manualPortalRecordingEnabled: false`. Solo acepta true al arrancar con **NODE_ENV=test y PostgreSQL loopback en una base cuyo nombre termina en _test**. Producción/desarrollo y destinos remotos rechazan esa habilitación por configuración. No basta cambiar una variable para habilitar clínica: fuentes, formato y aceptación SVB requieren contrato posterior. REAL_SVB y transporte no configurado conservan sus bloqueos.

Con capacidad apagada, nuevos POST `/declarations/:id/manual-entry/prepare` y `/declarations/:id/submissions/manual` devuelven **409 SVB_PRESENTATION_DEFERRED**, con texto inglés `SVB submission pending — file specification not confirmed.` No crean reserva, audit parcial, submission, contador o estado. Body/query/header/Admin/VITE no habilitan el servidor.

Orden de comprobaciones:

1. Middleware: JWT/usuario activo y permisos de la ruta; body estricto y ámbito de declaración. Recurso ajeno mantiene 404, sin revelar su estado/capacidad.
2. Prepare: buscar clave de la organización/lote. Replay válido devuelve 200 con la reserva existente, incluso RELEASED/RECORDED; conflicto de clave sigue 409. Después se verifica capacidad y las reglas de reserva/factura completa.
3. Registro: normalizar body/fecha/hash del request y buscar clave confirmada en la organización. Replay exacto retorna mismo registro/evidencia sin acceso al archivo ni nueva validación de fuentes; si cambió contenido da IDEMPOTENCY_KEY_CONFLICT. No se modifica historia antigua al introducir nuevas reglas.
4. Sin replay confirmado: verificar capacidad **antes** de descargar comprobante. En QA habilitado se lee evidencia fuera de la transacción; al entrar se comprueba otra vez clave/capacidad y conjunto/hash, y se guardan estado/contador/auditoría atómicamente. La doble comprobación cubre carreras de registro concurrente.

Siguen disponibles GET historial/submissions/expediente/download, documentos privados, uncertain/release de reservas existentes y official-result de hechos ya registrados. Apagar capacidad no borra reservas ni resultados. Liberar UNCERTAIN sigue exigiendo comprobante de verificación y declaración de NO presentación; nunca inventar esa confirmación para liberar algo que realmente ocurrió. Mantener evidencia y conciliación explícita ante cualquier hecho externo pendiente; no reenviarlo al restaurar.

Frontend debe tratar false, ausencia o error de readiness como deshabilitado para nuevas preparaciones/registros. Mantener lectura, advertencia de JSON interno y controles necesarios de historia/resolución. El texto de aplazamiento no significa que el resto de clínica deba esperar un formato SVB.

## DEP12: runtime y documentos

Se mantiene Express/PrismaPg/JWT/RBAC. Runtime de host: root backend, `npm ci`, `npm run prisma:generate`, `npm run build`, `npm start`; PORT lo suministra el host, HOST por defecto 0.0.0.0. Nunca migrate/seed en startup. La configuración Vercel existente sigue siendo preparación alternativa, no plataforma contratada. Arquitectura decide host/coste/región/URLs/artefacto y smoke de despliegue. Health `/health/live` y `/health/ready`, CORS producción HTTPS exacto, límites de carga/pool/TLS y secretos solo Backend continúan vigentes.

Prueba nueva inicia servidor real en puerto loopback dinámico, sube PDF sintético por HTTP, verifica SHA-256, detiene el proceso, inicia otro y descarga mismos bytes. Prueba además 401 sin token, 404 de otra organización, private/no-store y readiness aplazado. Root por ejecución `storage/dep12-runtime-qa/<UUID>`; no usa carpeta de otros chats. Esto verifica host persistente local, no bucket ni redespliegue remotos.

### Inventario de transición de documentos

`npm run documents:audit -- --read-only [--verify-bytes] [--require-external] [--private-manifest]` exige selección explícita: ODONTHO_ENV_FILE o DATABASE_URL idéntica a TEST_DATABASE_URL local _test. No hacer fallback accidental al .env clínico. La CLI solo lee metadatos en transacción REPEATABLE READ/READ ONLY paginada; luego verifica bytes fuera de la transacción. No actualiza DB, objetos, hashes, IDs ni vínculos.

- Reporte público: conteos local/externo/no soportado, hash del manifiesto, resultados de integridad y `operationalReadinessApproved: false`; sin rutas, pacientes, IDs ni errores del proveedor.
- `--verify-bytes`: comprueba tamaño/hash; distingue faltantes/corrupción/fallo de storage. Sin él el resultado solo acredita inventario de metadatos.
- `--require-external`: bloquea si quedan URI locales, útil para el candidato Vercel.
- `--private-manifest`: crea archivo nuevo, sin overwrite, en `storage/dep12-private/document-manifest-<UUID>.json`, ignorado por Git. Incluye IDs string/organización/URI/proveedor/hash/tamaño para plan protegido. El operador debe custodiar ACL/cifrado/copia; no publicarlo en chat/repo.
- Exit 0: comprobaciones solicitadas sin bloqueo; 2: hallazgos; 1: fallo saneado, sin imprimir URL/credenciales.

Ejemplo PowerShell solo para QA propio:

```powershell
$env:TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55447/odontho_dep10_backend_20261103_test'
$env:DATABASE_URL=$env:TEST_DATABASE_URL
$env:NODE_ENV='test'
$env:SVB_MANUAL_RECORDING_ENABLED='false'
$env:DOCUMENT_STORAGE_PATH='C:/workspace/app-DentalService/backend/storage/dep10-backend-qa/documents'
npm run documents:audit -- --read-only --verify-bytes --private-manifest
```

La transición posterior debe: pausar escritores; tomar DB+objetos/manifiesto; copiar a bucket privado sin overwrite; verificar bytes/hashes de cada destino; revisar diff de URI/proveedor con IDs/hashes esperados; cambiar únicamente metadatos de almacenamiento en operación transaccional auditada; probar firma/PDF/evidencia por API y proceso nuevo; conservar originales para retorno y nueva copia verificada. No ejecutar ese plan como efecto de cambiar DOCUMENT_STORAGE_PROVIDER. Desajuste/colisión/error detiene transferencia, sin cambiar identidad, firma, snapshots ni vínculos. Esta entrega prepara inventario/plan; no aplica transferencia clínica.

### Pendientes precisos del destino

No hay SUPABASE_URL/service key/bucket QA configurados en el overlay revisado y no hay conector Supabase disponible. **Bucket privado remoto: NO EJECUTADO.** Falta un destino QA con credenciales servidor por canal protegido, luego upload/download autenticados, no overwrite, organización/permisos/hash/tamaño/errores, proceso nuevo y redespliegue; sin hacerlo público ni usar archivos clínicos. No se pide pegar claves al chat. Los tests HTTP simulados no cierran ese punto.

DB entrega inventario/permisos/plan fiscal y recuperación en sus archivos independientes. Esta entrega no aplica migraciones ni valores fiscales al destino. Arquitectura/clínica completan responsables/suplente, custodia/frecuencia/retención/RPO/RTO/soporte/suspensión y URLs. Hasta tener configuración/artefacto/smoke real, el estado es **PREPARADO LOCAL**, no QA DESPLEGADO, OPERACIÓN CLÍNICA PREPARADA ni CLIENTE ACEPTÓ.

## Verificación de esta entrega

QA nuevo PostgreSQL 17.11 en 127.0.0.1:55447. Base principal `odontho_dep10_backend_20261103_test`; restauración final `odontho_dep10_restore_final_backend_20261103_test` y migraciones `odontho_dep10_legacy_final_backend_20261103_test`, vacías al iniciar sus ensayos y distintas de la principal. Root `storage/dep10-backend-qa/documents`; fixtures sintéticos. Seis migraciones aplicadas sin alterar sus archivos.

- **Typecheck y build PASS**, ejecutados sobre los cambios finales.
- **482/482 pruebas PASS en 59 archivos, cero omitidos**, corrida final 106.97 s. [Reporte local](../storage/dep10-backend-qa/acceptance-final-results.json). Incluye unitarias, API/DB, opt-in de migración/restore y runtime de proceso nuevo. No sumar este conteo con el 451 anterior ni con corridas de otras áreas.
- La primera corrida amplia fue 481/482 por el CLI offline06, que importaba configuración de readiness incluso al pedir solo SQL. DB desacopló ese import en su archivo; seis pruebas afectadas pasaron y la corrida completa anterior se reemplazó por la final de 482 PASS. No se cambió autenticación ni producción para acomodar QA.
- Las unitarias iniciales restringidas por sandbox tuvieron EACCES de loopback. La corrida final autorizada de QA local incluye todas y pasa; no queda fallo pendiente por esa restricción.
- Revisión independiente DB: tres pruebas con factura de 22 líneas, dos mitades concurrentes rechazadas, completo con un ganador y mezcla rechazada. [Entrega DB](../../docs/base-de-datos/DEP12_PRIMER_DESPLIEGUE.md), evidencia separada.
- CLI documents:audit ejecutado de solo lectura en QA: código 0, manifiesto protegido creado, cero documentos restantes tras limpieza de fixtures; no representa inventario del destino real ni evidencia de bucket remoto. Tests unitarios verifican inventario positivo/corrupción/faltantes/proveedor/privacidad; runtime verifica PDF real sintético tras proceso nuevo.
- JSON/configuración, enlaces locales de handoff y diff check verificados. [Manifiesto de fuente Backend](../storage/dep10-backend-qa/runtime-manifest.json): 343 archivos de fuente/QA/assets/schema/dependencias, SHA-256 `caa05357bdc42d04f87eed458d900938ce8d879009873c1ce1bbb0037a392e6e`. Excluye secretos/documentos/build; snapshot compartido, sin atribuir todos sus cambios a Backend. Revalidar cada hash antes de empaquetar/publicar, sin commit/tag implícitos.

Checks específicos iniciales: DEP10 nuevo ocho escenarios + seis de regresión manual PASS; runtime HTTP con nuevo proceso PASS. Los mismos casos están incluidos en la corrida final, sin contarlos de nuevo.

### Continuación y manifiesto vigente

Al continuar el cierre se verificó el reporte de 482 PASS y se detectó un único cambio posterior de fuente en `src/infrastructure/database/svb-final06-preflight.ts`. La verificación específica del CLI volvió a pasar **6/6**, seguida de typecheck y build PASS; no se presenta como otra corrida completa de 482. Runtime local confirmado Node **24.22.1**, npm **11.19.1** en Windows. Linux/dependencias nativas del host siguen pendientes del ensayo de Arquitectura.

Manifiesto vigente Backend: [runtime-manifest-v2.json](../storage/dep10-backend-qa/runtime-manifest-v2.json), 343 archivos, SHA-256 **`6160d526a8e7ad3ee427acb0329653bcb6d16ffc7731d5a666014111eb9a9026`**. Conserva referencia al hash anterior y no sustituye el candidato conjunto de Arquitectura; una nueva captura conjunta debe incluir también los cambios pendientes de Frontend/Diseño. No mezclar las evidencias de los dos manifiestos. La coordinación final y detención del PostgreSQL propio se reintentaron tras un fallo previo de revisión automática por límite de uso; ese fallo no ejecutó las acciones y no fue una determinación de inseguridad.

Coordinación final enviada a Negocio, Arquitectura y Base de datos. PostgreSQL exclusivo de QA **55447 detenido correctamente**, con bases, reportes y manifiestos conservados; no se detuvieron servidores de otros chats.

Propiedad Backend: módulos declarations/manual-entry/readiness/config, document.repository/storage-audit, CLI audit-document-storage, .env.example/package scripts/OpenAPI/handoff y pruebas Backend. Sin schema, cliente Prisma o migración nuevos para DEP10. Archivos independientes DB y pantallas Frontend pertenecen a sus áreas; se preservan.
