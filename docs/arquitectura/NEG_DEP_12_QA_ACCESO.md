# DEP12 — Continuación: Linux, cuenta disponible y QA independiente

Actualización: 2026-11-03. Propietario: Arquitectura. Complementa [runbook](NEG_DEP_12_RUNBOOK.md) y [entrega](NEG_DEP_12_ENTREGA.md). No modifica contratos de Negocio ni entrega de otras áreas.

## Estado confirmado y límite de esta operación

El usuario confirmó **cuenta Render disponible y solo Supabase de la clínica** y después decidió expresamente **“Mantener solo QA local por ahora”**. No crear ni volver a pedir proyecto/bucket/host cloud en esta ronda. La validación remota Linux/Storage/host queda **PENDIENTE POR ALCANCE/ACCESO**, no PASS. No usar clínica, su clave, otro bucket allí ni un schema alternativo como laboratorio. Se conserva debajo la propuesta remota preparada únicamente para una ronda posterior; la decisión local no habilita uso clínico ni cambia el futuro objetivo de despliegue.

Backend terminó su regresión propia 482/482 en 59 archivos; DB terminó otra regresión independiente 482/482 en 59 archivos. Son evidencias distintas de sus informes, no 964 pruebas únicas ni comprobaciones nuevas de Arquitectura. [Backend DEP10/12](../../backend/docs/NEG_DEP_10_12.md), [DB DEP12](../base-de-datos/DEP12_PRIMER_DESPLIEGUE.md). Backend comunicó un manifiesto v2 posterior al candidato conjunto: 343 archivos, hash `6160d526a8e7ad3ee427acb0329653bcb6d16ffc7731d5a666014111eb9a9026`; el v1 queda histórico.

Frontend publicó su entrega local parcial y Diseño su reensayo R2. El candidato actual **092a** coincide por archivo con esas fuentes finales y conserva el build Windows; no requiere recaptura. El 5d9b queda histórico. [Vinculación y límites](NEG_DEP_12_ENTREGA.md#vinculación-de-cierre-local-sin-nuevas-suites). DEP11 sigue PARCIAL y NO-GO de publicación/uso clínico; [lista manual pendiente](NEG_DEP_11_CHECKLIST_CIERRE_LOCAL.md).

## Disponibilidad Linux comprobada

[Evidencia de equipo](../../deployment/evidence/linux-availability-20261103.json), a las 20:53 UTC del 3 de noviembre:

- `wsl --status`: código 50, WSL no instalado; `wsl --list --verbose`: código 1, misma condición. La presencia de wsl.exe es el stub del sistema, no una distribución Linux utilizable.
- Sin docker/podman/nerdctl/containerd/act/gh en PATH. Sin binarios Docker/Podman en sus rutas habituales ni pipe docker_engine. No se instaló WSL, distribución, Docker, VM ni otra infraestructura.
- Existen tres workflows `ubuntu-latest` en `.github/workflows/`: master-02r, master-03 y operational-gaps. Declaran Node 22, instalaciones y QA propios; no equivalen al Node 24.22.1 del candidato ni acreditan ejecución del árbol local sin commit. No se lanzaron workflows remotos ni se cambió su configuración.

Resultado: **build limpio Linux/nativos NO EJECUTADO por falta de ejecutor local disponible**. No se pide instalar infraestructura pesada para cerrar este diagnóstico.

El [runner preparado](../../deployment/build-linux.mjs) permite, en un ejecutor Linux autorizado con Node 24.22.1, verificar el snapshot, copiar source a un directorio nuevo, ejecutar npm ci de ambos lockfiles, generar Prisma/compilar ambos productos y probar Argon2 hash/verify, Sharp PNG/metadata y PDFKit/Helvetica con bytes sintéticos. Registra versión/hashes en `linux-build-report.json`; no arranca app, migra, siembra ni conecta DB. No hereda secretos/overlays/npm tokens/configuración de usuario. Conserva intacta la fuente congelada y usa cache dentro del ensayo.

```text
node deployment/build-linux.mjs --check-host
node deployment/build-linux.mjs /ruta/al/snapshot-revisado
```

En un contenedor/runner futuro, montar exclusivamente el snapshot sin secretos, no todo el repositorio con sus .env/storage. Verificar digest/versión del ejecutor y conservar logs, locks y reporte. El script no instala Linux ni provisiona el runner. Un build Linux limpio todavía no prueba PostgreSQL/Storage ni el host Render.

Checks propios de esta continuación: `node --check deployment/build-linux.mjs` PASS; dos pruebas `linux-guard.test.mjs` PASS, sin omitidas: inspección honesta del host y rechazo en Windows sin crear outputs/instalar. Estos checks **no** se presentan como validación Linux o pruebas nativas aprobadas.

## Opción mínima de QA remoto conservada para una ronda posterior

1. En la cuenta Supabase existente, revisar el cupo real y crear, solo tras decisión explícita, una organización **Free** separada `Odontho QA` con un proyecto `odontho-clinical-qa`. No mover, degradar ni clonar el proyecto clínico. Si clínica ya está en organización Free y queda cupo, otro proyecto allí también separa base/Storage, pero se prefiere organización QA propia por separación operativa.
2. Free permite hasta dos proyectos gratuitos activos entre todas las organizaciones en que la cuenta es Owner/Administrator. Una organización Pro no puede alojar un proyecto Free: en ese caso se necesita otra organización Free, dentro de la misma cuenta y de sus cuotas. Elegibilidad/cupo todavía no comprobados. No crear cuentas alternativas para eludir límites. [Reglas oficiales de facturación](https://supabase.com/docs/guides/platform/billing-on-supabase).
3. Base y bucket son nuevos, únicamente sintéticos; aplicar la cadena QA validada por DB y sus fixtures autorizados al destino QA identificado, fuera de build/start. Nunca restaurar clínica allí ni ejecutar seeds de QA sobre clínica. Registrar project reference, región y huella de DB QA distintos del destino clínico antes de escribir. El nombre “qa” por sí solo no demuestra separación.
4. Inicialmente el backend local de QA puede usar ese bucket nuevo para probar el adaptador remoto, con PostgreSQL sintético y root propios. Esto no necesita otro host pagado; prueba bucket/proceso, no HTTPS del host ni redespliegue Render.
5. Para QA remoto hay [Blueprint separado](../../deployment/render-qa.yaml): `odontho-clinical-api-qa`, plan Free, y `odontho-clinical-web-qa` estático, Node 24.22.1, auto-deploy off, Storage SUPABASE y SVB false. URLs previstas, no reservadas: `https://odontho-clinical-api-qa.onrender.com` y `https://odontho-clinical-web-qa.onrender.com`. Seleccionar rama/bytes revisados y valores reales antes de importar; no se ha creado ningún servicio.

| Alternativa QA | Incremento base propuesto | Límite/decisión |
| --- | ---: | --- |
| Supabase Free nuevo + backend local | US$0 | Depende de cupo; no cierra host Linux/HTTPS |
| Supabase Free + Render API Free + SPA | US$0 en cuotas incluidas | Solo sintéticos; confirmar cuotas/checkout. Puede generar excesos de build/transferencia en cuentas con medio de pago |
| Supabase Free + API QA pagada 0.5c-512mb | US$7/mes base adicional mientras exista | Alternativa si Free es insuficiente; requiere aceptación de costo |
| Segundo Micro en organización Supabase Pro | Desde US$10/mes de cómputo adicional | No es proyecto gratuito ni otro crédito incluido; revisar factura real |

Free Supabase publica 500 MB de base, 1 GB Storage y 5 GB egress; pausa por una semana de inactividad y sin respaldo diario de pago. No se promete capacidad para todo QA sin medir tamaño/cuotas. [Precios](https://supabase.com/pricing). Un proyecto adicional en Pro consume cómputo aun sin tráfico; [cómputo y créditos](https://supabase.com/docs/guides/platform/manage-your-usage/compute).

Render Free sirve para este ensayo, no producción: duerme tras 15 min, el despertar ronda un minuto, filesystem efímero, cuota compartida de 750 horas, sin shell/one-off jobs. Build/transferencia comparten cuotas y pueden cobrar extras o suspender. También puede suspender por tráfico saliente elevado a DB/Storage. Un servicio Free no acredita latencia/capacidad del plan clínico pagado. No se añade Render Postgres. [Límites oficiales](https://render.com/docs/free).

La cuenta Render existente no revela su plan/cargos/cuotas actuales. Mantener la propuesta clínica US$32 base separada de QA; el presupuesto US$35 no absorbe automáticamente otra API pagada ni otro Micro. No hay autorización para creación, upgrade, cobro o publicación en esta continuación.

## Requisitos exactos del bucket y configuración segura

| Requisito | Valor/acción revisable |
| --- | --- |
| Proyecto | QA independiente, reference/región/destino comprobados, sin pacientes/copias clínicas |
| Bucket | `qa-clinical-documents`, `public=false`, privado desde creación |
| Tamaño por objeto | `4194304` bytes (4 MiB), igual al límite de subida API; probar también que PDF generado cabe o reportar bloqueo |
| MIME admitido por bucket | `application/octet-stream`: el adaptador guarda así PNG/JPEG/WebP/PDF y claves `.bin`; restringirlo solo a image/*/application/pdf rompe la implementación actual |
| Tipos originales | API valida SIGNATURE PNG/JPEG/WebP; otros adjuntos PNG/JPEG/WebP/PDF. La metadata Document conserva su MIME original. No añadir nuevos tipos ni cambiar Backend por este documento |
| Acceso | Sin policies de lectura/escritura pública para anon/authenticated ni URLs públicas. Solo Backend valida permisos/organización, usa credencial QA servidor y entrega bytes autenticados |
| Integridad | Sin upsert, keys nuevas, SHA-256/tamaño, conflicto con bytes distintos; no reemplazar firma/PDF histórico |
| Credenciales | SUPABASE_URL del QA, SUPABASE_SERVICE_ROLE_KEY compatible con el adaptador actual y de ese proyecto, bucket QA. No usar service_role clínico ni poner ninguna clave en VITE |
| DB QA | DATABASE_URL QA independiente, CA auténtica QA/TLS validado, DATABASE_CA_CERT_PATH. Nunca desactivar validación de certificados |
| Render | Secret file `/etc/secrets/supabase-ca.crt`, secretos servidor en panel; no ODONTHO_ENV_FILE ni copiar .env clínico. CORS origen SPA QA HTTPS exacto; DB_CONNECTION_LIMIT=3 |
| Sesión y alcance | ACCESS_TOKEN_SECRET QA nuevo, cuentas sintéticas individuales, JWT/RBAC existentes, SVB_MANUAL_RECORDING_ENABLED=false, APP_TIMEZONE=America/Curacao |
| Frontend | VITE_API_BASE_URL=origen API QA + /api/v1; VITE_APP_ENVIRONMENT=qa; VITE_APP_VERSION del nuevo manifiesto. Sin claves Supabase/BD |

El tamaño/MIME son restricciones del bucket disponibles en Supabase ([crear/restringir bucket](https://supabase.com/docs/guides/storage/buckets/creating-buckets)); privacidad y reglas de aplicación se verifican en API y acceso anónimo real. No hacer público el bucket para eludir errores. El adaptador confirma `public=false` antes de leer/escribir, pero los mocks previos no acreditan que ese bucket exista.

## Evidencia exigida al disponer del destino autorizado

- Registrar prueba de proyecto QA distinto, metadata privada del bucket sin claves, operador y hora. Verificar checksum/schema/permisos QA; no reutilizar el fingerprint clínico de DB como supuesto identificador QA.
- Subir firmas/adjuntos/PDF sintéticos por API. Hash/bytes/tamaño, documento positivo existente, 401 sin sesión, rechazo de otra organización existente y rechazo anónimo directo al objeto privado. Probar 4 MiB/límite excesivo, MIME no permitido, colisión sin overwrite y fallo de proveedor sin filtrar claves.
- Descargar documentos conservados tras reinicio de proceso, luego redespliegue de los mismos bytes; registros separados para ambas pruebas. En Render Free el despertar no debe confundirse con pérdida de objetos ni con PASS de latencia clínica.
- Linux: conservar npm ci de ambos locks en host, versiones y comprobaciones reales de Argon2/Sharp/PDF. El script separado facilita un runner aislado; login/firma/PDF del host también deben funcionar. No declarar nativos aprobados solo por haber generado JS.
- Recuperación: snapshot DB + inventario/copia de **objetos QA**, restaurar en destino QA nuevo y descargar con hash verificado. El mecanismo DB actual recupera LOCAL y rechaza proveedor externo sin adaptador validado: falta cerrar la recuperación de objetos remotos con DB/Backend, no omitirlos del ensayo. Backups PostgreSQL no contienen esos bytes.
- Custodiar logs/manifiestos/reports fuera de Git si contienen IDs/URI de documentos; no reportar bearer, key, connection string, pacientes o respuestas privadas. Soporte/operador/suplente, RPO/RTO/retención/custodia se acuerdan antes de uso real.

## Paso remoto posterior; sin solicitud actual de recursos

Propuesta conservada: proyecto Supabase QA Free independiente si hay cupo, bucket privado y QA Render Free con Blueprint separado. **No se pide decidirla ni crearla ahora**: usuario eligió QA local. Free no confirma elegibilidad/cuota de la cuenta; cualquier futura alternativa pagada necesitará decisión concreta. No se solicitan contraseñas en chat.

Antes de una publicación futura hará falta operación concreta de creación/publicación y bytes revisados (commit/push siguen excluidos). Región/URLs/cuenta/credenciales se configurarán por canal seguro. Esta ronda cierra preparación local con evidencia vinculada de Frontend/Diseño y lista manual precisa, sin repetir build/suites de fuentes idénticas. Linux/Storage/host remotos siguen NO EJECUTADOS por alcance/acceso, sin instalar infraestructura ni usar clínica.
