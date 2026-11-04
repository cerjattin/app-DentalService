# Deploy — Render Free y Supabase clínico

Fecha: 2026-11-03. Responsable: chat Deploy. Estado: configuración local preparada; publicación pendiente.

## Decisión de esta ronda

El usuario solicita iniciar el despliegue con Render gratuito y **conectar la base clínica existente**, en lugar de crear una demo. Confirmó el workspace `My Workspace` (`tea-d04k06buibrs73b5s920`). El acceso Render funciona; su consulta de servicios no devolvió servicios existentes. Esto abre una ronda de preparación cloud posterior al cierre de QA local; no convierte la aceptación clínica pendiente en PASS.

Guías de referencia: [contexto](../CONTEXTO_PROYECTO.md), [plan](../PLAN_MVP.md), [runbook Arquitectura](../arquitectura/NEG_DEP_12_RUNBOOK.md), [entrega DB](../base-de-datos/DEP12_PRIMER_DESPLIEGUE.md) y [checklist Backend](../../backend/docs/BACKEND_RELEASE_CHECKLIST.md). Los documentos anteriores mantienen evidencia histórica; la elección de Free y base clínica corresponde a esta nueva instrucción del usuario.

## Archivo que corresponde usar

- [deployment/render-free.yaml](../../deployment/render-free.yaml): API **Free**, SPA estática y Supabase existente. Es la propuesta de esta ronda.
- [deployment/render.yaml](../../deployment/render.yaml): propuesta previa con API pagada; no importarla para esta operación gratuita.
- [deployment/render-qa.yaml](../../deployment/render-qa.yaml): QA aislado con bucket QA; no conectarlo a clínica.

Los templates clínicos usan los mismos nombres: son alternativas, no dos stacks para importar juntos. Importar un Blueprint puede crear/publicar recursos; `autoDeployTrigger: off` solo evita futuros despliegues por push. La plantilla nueva debe estar publicada en Git antes de que Render pueda leerla; no se autoriza commit/push por este documento.

| Servicio | Root Directory | Build | Start / Publish |
| --- | --- | --- | --- |
| odontho-clinical-api | backend | `npm ci --include=dev && npm run prisma:generate && npm run build` | `npm start` |
| odontho-clinical-web | frontend | `npm ci --include=dev && npm run build` | `dist`, relativo a la raíz frontend |

Node `24.22.1`; API escucha `0.0.0.0` y el PORT de Render. Health check `/health/ready`; liveness `/health/live`. Rewrite SPA `/*` a `/index.html`. La instalación automática de dependencias del sitio se desactiva con `SKIP_INSTALL_DEPS=true` porque el build ya ejecuta `npm ci` con su lockfile. La interfaz se identifica como `Clinic pilot`, una etiqueta de entorno, no aceptación del cliente. Se conservan Express/JWT/RBAC y los contratos API.

La región `virginia` se conserva como propuesta inicial del runbook. La conexión local sugiere un pooler Supabase `ca-central-1`; es una pista de configuración, no una inspección del proyecto remoto ni una medición de latencia. Confirmar la región del destino y la elección de región Render antes de crear la API; Render no permite cambiarla después.

## Configuración protegida antes del arranque

El Blueprint no contiene secretos ni crea otra base. La inspección local solo comprobó presencia de claves, sin conectarse a PostgreSQL ni mostrar valores: el overlay `.env.supabase.local` tiene DATABASE_URL; no declara SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET ni DATABASE_CA_CERT_PATH. Esto no acredita el estado de otras fuentes de configuración ni del panel cloud.

**Antes de importar**, crear en Render un Environment Group llamado `odontho-clinical-tls` con el secret file `supabase-ca.crt` y el certificado CA auténtico del destino. El Blueprint referencia ese grupo existente solo desde la API, por lo que el archivo estará disponible desde el primer arranque; sin el grupo/certificado no aplicar. No poner credenciales en la SPA ni compartir este grupo con el frontend.

Introducir en el flujo de creación del Blueprint para el backend:

| Clave / archivo | Configuración |
| --- | --- |
| DATABASE_URL | Conexión PostgreSQL de la clínica, con TLS verificado; evaluar pooler de sesión 5432 según red. No copiar una URL MySQL histórica |
| SUPABASE_URL | Origen HTTPS del proyecto clínico |
| SUPABASE_SERVICE_ROLE_KEY | Secreto exclusivo del backend, custodiado en Render |
| SUPABASE_STORAGE_BUCKET | Bucket privado clínico verificado; no usar el nombre QA por conveniencia |
| CORS_ALLOWED_ORIGINS | Origen HTTPS real de la SPA, sin path ni slash final |
| Grupo `odontho-clinical-tls` / secret file `supabase-ca.crt` | Preconfigurado en Dashboard con CA auténtica; disponible en `/etc/secrets/supabase-ca.crt` |

ACCESS_TOKEN_SECRET lo genera Render una vez. DATABASE_CA_CERT_PATH ya apunta al secret file. Mantener DB_CONNECTION_LIMIT=3, APP_TIMEZONE=America/Curacao, DOCUMENT_STORAGE_PROVIDER=SUPABASE y SVB_MANUAL_RECORDING_ENABLED=false. No configurar ODONTHO_ENV_FILE en cloud.

En frontend: VITE_API_BASE_URL es la URL HTTPS **real** de la API con `/api/v1`; VITE_APP_VERSION identifica el commit/artefacto revisado (por ejemplo, el SHA completo del commit que se publique). El prefijo se configura una sola vez. Nunca poner claves de base/Supabase en variables VITE. Los nombres no reservan URLs: revisar los dominios asignados y CORS antes de habilitar el frontend.

El conector Render actual no expone creación de Blueprints, rootDir, rewrites, headers ni secret files en sus operaciones de creación. Se prepara Blueprint para conservar toda la configuración; crear el grupo/certificado y aplicar por Dashboard. No crear deliberadamente un servicio con configuración incompleta para obtener una URL. Para preparar el enlace de importación usar [nuevo Blueprint del repositorio](https://dashboard.render.com/blueprint/new?repo=https%3A%2F%2Fgithub.com%2Fcerjattin%2Fapp-DentalService) y seleccionar la ruta **deployment/render-free.yaml**. No pulsar Apply hasta revisar secretos, CA, región, coste y estado del destino.

## Secuencia de publicación y aceptación

1. Validar el template local, revisar diff y publicar sus bytes en Git solo con autorización del usuario. Verificar el commit remoto antes de importar; el candidato histórico 092a no identifica automáticamente los archivos añadidos en esta ronda.
2. Revisar en lectura el estado actual de migraciones/permisos/documentos del destino con las herramientas protegidas de Backend/DB. La última entrega registró cinco migraciones y dos permisos pendientes, tres hallazgos fiscales y siete URI locales; son hallazgos históricos, no inspección fresca de Deploy. No usar seeds/cleanup/integración de QA en clínica. Cualquier aplicación/reparación requiere operación concreta revisada; no está incluida en build/start/preDeploy.
3. Verificar bucket privado y disponibilidad de los bytes originales. Configurar Storage no traslada documentos anteriores; las siete URI locales históricas requieren transferencia por hash, conservación de originales y transición autorizada por Backend/DB. El filesystem efímero de Free no puede alojar firmas/PDF persistentes.
4. Completar CA y variables por Dashboard, revisar que el resumen muestre API Free y sitio estático, y aplicar el Blueprint en el workspace confirmado cuando estén resueltos los requisitos de arranque. Mantener despliegue automático apagado.
5. Monitorizar cada build/deploy Linux hasta su estado terminal. Registrar commit, logs sin secretos y URLs. Probar health, HTTPS, CORS permitido/rechazado, 401 sin sesión, deep links SPA y asset/version con el [smoke existente](../../deployment/smoke.mjs). Readiness solo hace SELECT 1: no prueba schema, permisos ni objetos.
6. Completar aceptación clínica y recuperación pendientes con las áreas responsables. No crear pacientes, citas, facturas ni firmas ficticias como smoke en la base clínica. Las pruebas que escriben necesitan QA aislado o un flujo clínico concreto autorizado. La elección del host no resuelve las puertas abiertas del [checklist manual](../arquitectura/NEG_DEP_11_CHECKLIST_CIERRE_LOCAL.md).

## Límite del plan gratuito y coste

API Free: 0.1 CPU / 512 MB; duerme tras 15 minutos sin tráfico, el siguiente arranque puede tardar aproximadamente un minuto. No tiene disco persistente, shell ni jobs puntuales. Los archivos locales desaparecen con reinicio, suspensión o redespliegue. Render no recomienda Free para producción; un deploy exitoso no acredita disponibilidad clínica. No añadir pings para eludir el reposo ni contratar upgrades automáticamente.

El coste de cómputo de esta propuesta Render es gratuito, sujeto a las cuotas del workspace. Transferencia/minutos de build pueden causar cargos o suspensión según método de pago/límites; verificar Billing. El plan y consumo de Supabase son independientes y no se comprobaron en esta ronda; no prometer coste total cero.

Referencias oficiales consultadas: [Free](https://render.com/docs/free), [planes](https://render.com/docs/compute-plans), [Blueprint](https://render.com/docs/blueprint-spec), [variables y secret files](https://render.com/docs/configure-environment-variables), [sitios estáticos](https://render.com/docs/static-sites), [Web Services](https://render.com/docs/web-services), [Prisma/Supabase](https://supabase.com/docs/guides/database/prisma).

## Verificación local de esta entrega

```powershell
node --test deployment/tests/preparation.test.mjs deployment/tests/linux-guard.test.mjs
node deployment/validate-blueprint.mjs deployment/evidence/render-free.schema.json deployment/evidence/blueprint-free-validation.json render-free.yaml
git diff --check
```

El esquema público se descargó para esta ronda en `deployment/evidence/` (ignorado por Git). El validador crea un informe nuevo; usar otra ruta si ya existe. Validación de esquema no es validación de API Render ni despliegue. CLI Render no está instalado en este equipo; la validación adicional `render blueprints validate deployment/render-free.yaml` queda pendiente si se instala. No se repiten suites de producto porque no se modifican backend/frontend, schema, reglas ni contratos.

Resultado de esta ronda: validación del esquema PASS; 13 pruebas de preparación aprobadas, cero fallos y una omitida porque el sandbox Windows impide crear nctions. No hay build Linux, despliegue, consulta SQL ni aceptación remota nuevos. Reporte de esquema en `deployment/evidence/blueprint-free-validation-final.json`.
