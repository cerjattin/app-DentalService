# NEG-DEP-12 — Configuración y operación revisable

Fecha: 2026-11-03. Responsable técnico: Arquitectura; datos: Base de datos; API: Backend; aceptación de interfaz: Frontend/Diseño/Negocio. Estado: PREPARACIÓN LOCAL, no despliegue. [Contrato](../negocio/CONTRATO_DESPLIEGUE_12_ENTORNO_OPERACION.md). [Evidencia y bloqueos](NEG_DEP_12_ENTREGA.md).

**Decisión vigente:** cuenta Render y solo Supabase clínico; **QA solo local**. No crear/pedir recursos cloud. Linux/Storage/host remotos PENDIENTES POR ALCANCE/ACCESO. [Requisitos conservados](NEG_DEP_12_QA_ACCESO.md). La entrega Frontend y Diseño R2 se vincularon a 092a con fuentes idénticas, conservando su build; [lista manual](NEG_DEP_11_CHECKLIST_CIERRE_LOCAL.md) mantiene DEP11 PARCIAL. No se acredita clínica apta ni se repiten suites por documentación.

## Decisión propuesta y costo

Preparar Render (SPA estática + un servicio Node pagado de 0.5 CPU/512 MB) con PostgreSQL y Storage privado de Supabase. No se ha contratado ni seleccionado una cuenta. La configuración Vercel de otras áreas se conserva como alternativa.

| Concepto | Base mensual USD | Condición |
| --- | ---: | --- |
| Render workspace Hobby | 0 | Una cuenta operadora; revisar acceso/suplencia y condiciones al contratar |
| Render API `0.5c-512mb` | 7 | Una instancia, sin discos locales ni worker adicional |
| Render SPA estática | 0 | Comparte cuotas de transferencia/build del workspace |
| Supabase Pro, un proyecto Micro | 25 | No se ha comprobado el plan facturado de la cuenta existente |
| Total propuesto | 32 | Antes de impuestos, dominio, excesos y respaldo externo de objetos |

Verificado el 3 de noviembre contra fuentes oficiales: [cómputo/workspace Render](https://render.com/articles/render-vs-netlify), [pricing](https://render.com/pricing), [SPA/CDN/TLS](https://render.com/docs/static-sites), [Supabase](https://supabase.com/pricing). La página pricing de Render devuelve al lector una tabla incompleta; el artículo oficial mantiene US$7/512 MB y workspace US$0. Confirmar importe final en el checkout, no usar un precio de un tercero como contratación.

Margen del presupuesto de US$35: US$3 antes de impuestos/extras. No es techo garantizado. La configuración no contrata Pro Render, otro proyecto pagado ni backups externos. Mantener alertas/facturas; spend caps no cubren todos los cargos. **En esta ronda QA solo local**. Futuro QA remoto debe ser independiente: hay propuesta Free condicional documentada, sin confirmar cupo; cualquier recurso pagado/exceso queda fuera de US$32. No se crea ni retira infraestructura por esta preparación.

Vercel Pro + Supabase Pro parte de US$45, fuera del presupuesto; Hobby no habilita uso comercial ([precios](https://vercel.com/pricing), [términos](https://vercel.com/legal/terms)). Railway permite preparar Express con consumo variable, pero no se selecciona por un mínimo de US$5 como si fuera factura fija ([precios](https://railway.com/pricing)).

No se promete rendimiento con 512 MB sin medición. En QA registrar 5 sesiones concurrentes como ensayo inicial propuesto, login, lista de citas, Dashboard y firma/PDF, duración p50/p95, memoria/RSS, CPU, conexiones, errores y reinicios. Negocio/clínica deben confirmar concurrencia real y objetivo de latencia; si hay OOM, timeouts o saturación, no pasar a clínica ni subir plan fuera del presupuesto sin revisar costo. QA de carga solo con sintéticos y sin presentar a SVB.

## Configuración concreta

El [Blueprint](../../deployment/render.yaml) usa JSON, subconjunto válido de YAML; Render permite indicar una ruta de Blueprint distinta de `render.yaml`. No importarlo todavía: crear un Blueprint es una operación de publicación y puede iniciar cobros aunque `autoDeployTrigger=off` impida posteriores despliegues por commit. Referencia: [Blueprint](https://render.com/docs/blueprint-spec).

| Servicio | Raíz | Build | Start/salida |
| --- | --- | --- | --- |
| `odontho-clinical-api` | `backend` | `npm ci --include=dev && npm run prisma:generate && npm run build` | `npm start` → `node dist/src/server.js` |
| `odontho-clinical-web` | `frontend` | `npm ci --include=dev && npm run build` | `dist`, rewrite `/*` → `/index.html` |

Node fijado a 24.22.1 (coincide con el entorno local; [configuración de Node Render](https://render.com/docs/node-version)). Lockfiles separados backend/frontend; no usar el package.json raíz para instalar la aplicación. `npm ci --include=dev` incluye TypeScript/Prisma/Vite para compilar aun con NODE_ENV=production. No hay migrate/seed/cleanup/bootstrap en build, start o request. Generar Prisma no aplica migraciones. El asset `backend/assets/invoice/svb-notaform-v1.png` debe acompañar el runtime; `process.cwd()` es backend.

Región inicial del manifiesto: `virginia`, **provisional**. Antes de crear servicios confirmar por canal protegido región de Supabase y latencia desde la clínica; cambiarla a la región Render apropiada antes de congelar la versión. No asumir que la clínica en Curaçao implica que la base está allí. SPA usa CDN global ([regiones](https://render.com/docs/regions)).

URLs previstas, no reservadas ni verificadas:

- SPA: `https://odontho-clinical-web.onrender.com`.
- API: `https://odontho-clinical-api.onrender.com`; base frontend termina en `/api/v1`.
- QA aislado: nombres distintos, por ejemplo `odontho-clinical-web-qa` / `odontho-clinical-api-qa`; no reutilizar base/bucket clínicos. Ajustar ambas URLs/CORS antes del build.
- Dominio propio: opcional, no comprado. Sustituir orígenes y reconstruir SPA si cambia la URL API. Rutas directas `/patients`, `/invoices/:id` y assets deben pasar smoke; un rewrite no acredita sesión ni pantalla clínica.

## Variables, secretos y conexiones

| Variable | Valor/política |
| --- | --- |
| NODE_ENV / HOST | `production` / `0.0.0.0`; Render proporciona PORT |
| NODE_VERSION / APP_TIMEZONE | `24.22.1` / `America/Curacao` |
| SVB_MANUAL_RECORDING_ENABLED | `false`; publicada por Backend en DEP10, no habilitar por VITE/header/rol |
| DATABASE_URL | Solo backend; conexión real de Supabase para este entorno, TLS verificado |
| DATABASE_CA_CERT_PATH | `/etc/secrets/supabase-ca.crt`, cargar certificado CA auténtico como secret file antes del primer build/start |
| DB_CONNECTION_LIMIT | `3`, una instancia inicial; considerar conexiones simultáneas de versión anterior/nueva durante redespliegue y reservar margen para migración/operación |
| ACCESS_TOKEN_SECRET | Generación por Render al crear servicio; no regenerar en cada build; QA y clínica separados |
| CORS_ALLOWED_ORIGINS | Origen SPA HTTPS exacto, sin path/trailing slash/wildcard; no autorizar previews genéricos |
| OPENAPI_ENABLED / LOG_LEVEL | `false` / `info`; logs con correlationId, sin bodies clínicos ni credenciales |
| DOCUMENT_STORAGE_PROVIDER | `SUPABASE`; no fallback LOCAL en Render efímero |
| DOCUMENT_MAX_UPLOAD_BYTES | `4194304` (4 MiB), coherente con la interfaz; JSON API mantiene su límite independiente |
| SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_STORAGE_BUCKET | Solo backend; bucket privado preexistente del entorno correcto; clave custodiada, nunca en artefacto/logs/SPA |
| VITE_API_BASE_URL | Origen API HTTPS + `/api/v1`, nunca duplicar prefijo |
| VITE_APP_ENVIRONMENT / VITE_APP_VERSION | `qa` en ensayo; `pilot` tras aceptación de clínica; ID exacto del manifiesto |

Variables `sync:false` se introducen en el panel al crear; posteriores cambios secretos se gestionan explícitamente, no se sincronizan solos. No copiar `.env`, `.env.supabase.local`, certificados locales, exports ni `storage/` al repo desplegado. No configurar `ODONTHO_ENV_FILE` en cloud. El adaptador valida TLS; no usar NODE_TLS_REJECT_UNAUTHORIZED=0 ni sslmode=disable. Para backend persistente evaluar conexión directa o pooler de sesión según red. Migraciones usan conexión compatible de sesión, aislada de runtime; [Prisma/Supabase](https://supabase.com/docs/guides/database/prisma). No usar credenciales de migración privilegiadas como cuenta permanente si puede limitarse el rol; DB valida permisos efectivos.

TLS protege el transporte, CORS solo lectura desde navegadores. Auth/RBAC/organización siguen autoritativos en Express. El rate limiter actual es por proceso: una instancia no constituye protección global al escalar; Backend debe validar IP del proxy/rate limit en host antes de crecer. Una certificación del proveedor no acredita por sí sola la aplicación ni sus controles clínicos.

## Versión reproducible sin Git/publicación

Desde la raíz, una vez terminadas las ediciones de las áreas:

```powershell
node deployment/release.mjs snapshot
node deployment/release.mjs verify RUTA_RELEASE
node deployment/build-local.mjs RUTA_RELEASE
node --test deployment/tests/preparation.test.mjs
```

`snapshot` copia solo fuentes, assets, Prisma/migraciones, lockfiles y configuración a `deployment/releases/<version>-<timestamp>/source`; guarda listado/bytes/SHA-256, hash conjunto, HEAD base y versión. Incluye `prisma/seed.ts` **como fuente de política** para el lector AST de permisos; no lo ejecuta. Excluye .env, storage, node_modules, dist y evidencias. No usa git archive: hay cambios necesarios sin commit. Detecta cambios durante captura, manipulación posterior y rutas que escapan. Cada nueva edición requiere otra captura; HEAD solo no identifica el contenido.

`build-local` usa copia aislada de dependencias instaladas, genera Prisma contra una URL sintética sin conectar, compila ambos productos y registra hashes. Un segundo argumento opcional apunta al directorio `build` de un ensayo anterior dentro de deployment/releases: reutiliza mediante junction sus dependencias aisladas con locks coincidentes, sin tocar node_modules del producto. El sandbox puede impedir crear junctions; la copia normal sigue disponible. No equivale a `npm ci` limpio ni build Linux; eso queda para runner/host QA autorizado. No usar outputs Windows para resolver nativos Linux (argon2/sharp). Source permanece intacto; custodiar build/manifiestos fuera de Git con ruta/hash, nunca “latest”.

La configuración Git de Render no recibe cambios locales automáticamente. Tras autorización posterior para Git/publicación, llevar **los bytes revisados** a un repo/commit de despliegue, comprobar contra el manifiesto y fijar esa versión; no desplegar la rama por su nombre sin comparación. El modo off evita futuras publicaciones automáticas, no sustituye este control. No hay pipeline ni servicio creado por esta entrega.

## QA remoto y smoke

1. **Etapa futura, aplazada por decisión del usuario:** operador aprovisiona destino QA separado autorizado y bucket privado, con sintéticos y sin datos de clínica. Requisitos/costo condicional en [continuación QA](NEG_DEP_12_QA_ACCESO.md); no crearlos ni solicitarlos ahora. En esta ronda Backend/DB usan QA local propio, sin compartir DB `_test` ni root que limpian otras suites.
2. Ejecutar build Linux limpio con ambos locks, arranque, `/health/live` y `/health/ready`. Esta última solo consulta DB (`SELECT 1`): no demuestra migraciones, permisos, Storage ni integridad.
3. Smoke HTTP preparado, **solo GET/OPTIONS**, sin login ni escrituras:

```powershell
# DEP12_QA_TOKEN se obtiene por un operador en QA y se transmite por entorno seguro.
# Nunca escribir un bearer real en comandos, documentos o historial del shell.
node deployment/smoke.mjs https://SPA_QA https://API_QA VERSION_DEL_MANIFIESTO deployment/evidence/smoke-QA-NUEVO.json
```

Crear `deployment/evidence` primero. Verifica certificados HTTPS, health, preflight permitido/rechazado, 401 sin sesión, SPA/deep link/asset con versión esperada y readiness con manualPortalRecordingEnabled=false/realSubmissionEnabled=false. La versión backend se vincula mediante registro del deploy del host; health no la expone. Sin token la fila readiness es NOT_RUN y la salida falla. No imprime bodies/tokens/headers privados. Un PASS sigue siendo smoke de infraestructura, no UAT clínica, rechazo de escrituras probado ni prueba de Storage.

4. DEP10: probar rechazos API directos SVB nuevos y replay/historia según contrato. Presentación real y manual nueva permanecen aplazadas; no activar la bandera en host remoto ni producir datos oficiales ficticios.
5. DEP11: login por cuentas sintéticas individuales Admin/Provider/Reception, cruces de organización con IDs existentes, paciente/seguro/cita/encounter/procedimientos/factura/firma/cierre/PDF/corrección/regreso a Clinical/Dashboard. Navegador, teclado, tableta, errores, expiración y cambios sin guardar; evidencia por versión y escenario. No repetir carreras destructivas en clínica.
6. Documentos vía API autenticada: subir PNG/JPEG/PDF sintéticos soportados; descargar y comparar bytes/tamaño/hash; acceso sin token y por otra organización rechazados; archivo mayor al límite rechazado sin filas parciales; misma key no sobreescribe bytes distintos. Intento anónimo directo al objeto privado no retorna sus bytes. No colocar service_role en el navegador para probarlo.
7. Registrar IDs QA/URI/hashes en informe protegido. Reiniciar API y descargar de nuevo; después redesplegar **el mismo artefacto** y repetir. Verificar firmas/PDF/evidencias históricas además de un nuevo archivo. Separar PASS reinicio de PASS redespliegue y restauración. Un mock del adaptador no acredita bucket real.
8. Registrar latencia/memoria/pool, CORS, proxy/IP/rate limiting, errores/recovery y logs del host. Solo después completar matriz go/no-go. No interpretar 404 de un documento inexistente como aislamiento probado.

## Documentos previos y recuperación

Cambiar DOCUMENT_STORAGE_PROVIDER solo afecta nuevas escrituras. El lector conserva `local://documents/` y `supabase://documents/`; Render sin disco no tiene los bytes locales anteriores. Backend entregó la CLI de inventario `documents:audit -- --read-only --verify-bytes --require-external --private-manifest`, con selección de entorno explícita; ver [entrega DEP10/12](../../backend/docs/NEG_DEP_10_12.md). Usarla primero en QA propio. El inventario protegido conserva ID, URI, tamaño/hash y organización; revisar vínculos de firma/PDF/evidencia y presencia por la misma base. No copiar por nombre ni recrear firmas/PDF con bytes distintos. Un exit 0 de la CLI no acredita por sí solo aceptación operativa.

Preparar una operación separada y revisable: pausar escritores, respaldar DB+root local, copiar objetos a keys nuevas inmutables con verificación, actualizar únicamente referencias/proveedor permitidos en transacción y bajo reglas del modelo, verificar descargas, conservar originales y mapa de retorno. Su herramienta/operación corresponde a Backend/DB; **no está implementada ni ejecutada por este runbook**. Cualquier URI local pendiente o bytes faltantes es NO-GO. Alternativa de disco persistente Render requiere otro manifiesto/costo/backups y aprobación; no se usa filesystem efímero para pasar la prueba.

Respaldo conjunto base+objetos antes de cambios y durante operación: manifest de hashes/IDs/URI, esquema/migraciones, secuencias, hora UTC y zona de negocio, versión app/config sin secretos. Custodiar cifrado y control de acceso fuera del host. Pro incluye backups diarios de DB, **no objetos Storage** ([Supabase](https://supabase.com/docs/guides/platform/backups)). Los ensayos actuales de DB son locales; no prueban recuperación de un bucket remoto.

Restaurar primero en DB/bucket aislados nuevos. Verificar filas, constraints, secuencias, permisos de app y de BD, roles/ACL preaprovisionados, hashes y descargas de documentos. Usuarios de aplicación siguen en DB; Supabase Auth no se ha incorporado. Roles globales de PostgreSQL, llaves, CA, configuración del host y bucket/policies requieren inventario separado: no asumir que pg_dump los recupera. Rotación de clave requiere reconfigurar backend y probar; no conservar llaves en manifiesto público.

Propuesta para acordar, **no política aceptada**: RPO máximo 24 h y backup previo a cada cambio; RTO objetivo 4 h solo tras medir restore real; copia diaria conjunta, retención/custodia/costo a fijar con clínica; ensayo al cambiar storage/esquema y periódicamente. Si se requiere menor pérdida o recuperación más rápida, revisar solución/costo antes de habilitar uso.

## Ventana de publicación y retorno

1. Cerrar DEP10/11 y snapshot final; completar matriz y decisión de plataforma/costo/cuenta/URLs/región. Asignar persona operadora, suplente y contacto de clínica; canal de soporte probado, credenciales individuales y MFA en cuentas cloud; sin cuentas compartidas de aplicación. RPO/RTO/retención aceptados. Preparación no es aceptación del cliente.
2. Con autorización concreta posterior: congelar escritores, inventario protegido fresco de DB con huella; detener ante drift/migración fallida. Respaldo conjunto verificado y punto de retorno. Revisar diff de cinco migraciones/dos permisos/tres hallazgos reportados; el nuevo inventario puede modificar esos números.
3. DB aplica solo la cadena revisada, por responsable único y conexión de sesión. Sin reset/seed general/bootstrap/cleanup ni reescribir checksums. Ejecutar plan de permisos aislado e idempotente; datos fiscales solo con fuente y autorización específica. Dos organizaciones y un Draft no se arreglan con NULL/default ni sobrescribiendo historia firmada.
4. Inventario posterior sin bloqueos del alcance clínico. Operador publica versión exacta y configura orígenes, Storage, cuentas/soporte. Backend primero, luego SPA alineada; verificar CORS/health/version y smoke no destructivo. El arranque de app nunca aplica migraciones.
5. Antes de habilitar clínica: todo go/no-go obligatorio PASS con evidencia del destino. Cliente/operador observa primera ronda y registra aceptación aparte. Mantener aviso SVB aplazado e historial legible. No habilitar servicios con requisitos externos no soportados.
6. Fallo crítico: suspender ingreso de datos, preservar logs/evidencias/correlationId y comunicar al responsable. Conservar versión previa y respaldo; volver app solo si DB sigue compatible. Migraciones no se revierten a ciegas con deploy rollback. Restaurar en otro destino, verificar DB+objetos y reconciliar cambios posteriores al corte antes de redirigir la app; no aceptar pérdida silenciosa ni reasignación de numeración. Historia de cualquier hecho SVB previo se reconcilia, no se borra por restaurar.

## Matriz go/no-go (estado real de esta entrega)

| Puerta | Evidencia exigida | Estado / responsable |
| --- | --- | --- |
| Plataforma, total, cuenta, región, URLs | Decisión y checkout, destino identificado | Cuenta Render confirmada; resto futuro, QA local vigente |
| Artefacto y build local | Manifiesto/build/evidencias por fuente | 092a conservado y vinculado; [entrega](NEG_DEP_12_ENTREGA.md) |
| Build Linux/npm ci y host | Locks, dependencias nativas, arranque por versión | PENDIENTE POR ALCANCE/ACCESO: no ejecutor local; runner preparado |
| DEP10 integridad y SVB aplazado | Entrega Backend/API y revisión DB | QA local entregado por Backend/DB: 482/59 cada uno; vincular al candidato final sin sumar |
| DEP11 UAT clínica/roles/aislamiento/UX | Matriz y evidencia navegador | PARCIAL; entrega local/R2 vinculadas. [M01–M11 pendientes](NEG_DEP_11_CHECKLIST_CIERRE_LOCAL.md) |
| Datos destino | Inventario fresco, cadena checksum, permisos y hallazgos resueltos | BLOQUEADO según último inventario; DB |
| HTTPS/CORS/pool/rate limit/health | Reporte host + smoke y observabilidad | PENDIENTE POR ALCANCE/ACCESO remoto; Arquitectura/Backend |
| Storage y URI legadas | Bucket privado real, API, reinicio/redespliegue, hash | PENDIENTE POR ALCANCE/ACCESO remoto; 7 URI locales según DB |
| Recuperación conjunta | Restore aislado DB+objetos y descargas | Ensayo LOCAL de DB entregado; remoto PENDIENTE POR ALCANCE/ACCESO |
| Operación y aceptación | Operador/suplente, soporte, cuentas, RPO/RTO y cliente | SIN ASIGNAR/ACEPTAR; usuario/clínica |
| Envío/presentación SVB | Fuente/formato/aceptación posterior | APLAZADO POR ALCANCE; no PASS |

Salida actual: **NO-GO de publicación y uso clínico**; se puede seguir cerrando preparación local y QA sintética independiente. Estado futuro se registra como PREPARADO LOCAL → QA DESPLEGADO → OPERACIÓN CLÍNICA PREPARADA → CLIENTE ACEPTÓ, con evidencia propia en cada transición.
