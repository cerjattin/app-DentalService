# Migración a Supabase PostgreSQL

Preparación local del 30 de octubre de 2026. El usuario confirmó que los registros MySQL son de pruebas, pueden descartarse y no habrá nuevas escrituras durante la transición. El proyecto Supabase está vacío y es exclusivo de esta aplicación. No se transfieren registros ni se elimina MySQL.

Actualización del 31 de octubre: el estado inicial descrito abajo es histórico. El baseline ya se comprobó aplicado en Supabase durante el diagnóstico Postman y el usuario confirmó después que sus pruebas pasaron. Para las nuevas funciones 03/04/05, seguir [el handoff DB y su diagnóstico previo](NEG_FUNC_03_04_05.md); sus migraciones todavía no se aplicaron al destino operativo en esta entrega.

## Estado de esta entrega

- Código convertido a PostgreSQL y cliente Prisma regenerado.
- Baseline PostgreSQL separado del historial MySQL; probado desde cero en PostgreSQL 17.11 local temporal.
- Seed mínimo probado en la base local dedicada.
- Conexión del nuevo adaptador y de la CLI a Supabase comprobada con certificado validado.
- **Supabase continúa sin tablas de aplicación. La migración, el seed, el bootstrap y Postman en destino están pendientes.**

## Qué cambia y qué se conserva

| Aspecto | Implementación PostgreSQL |
| --- | --- |
| Modelo | `backend/prisma/schema.prisma`, provider PostgreSQL; 40 modelos |
| Historial nuevo | `backend/prisma/postgresql/migrations/20261030000000_init/migration.sql` |
| Histórico MySQL | `backend/prisma/migrations/0_init/`, su lock MySQL y `backend/prisma/mysql/schema.prisma`; se conservan sin aplicar en PostgreSQL |
| Identificadores | `BigInt` firmado, no negativo; límite PostgreSQL 9223372036854775807; strings en API |
| Otros enteros | `Int` PostgreSQL, no negativos; smallint/tinyint unsigned conservan además topes 65535/255. Los antiguos unsigned int quedan limitados al máximo firmado 2147483647. No hay datos que transferir |
| Dinero y cantidades | `numeric(15,2)` / `numeric(10,2)`, exactos; strings en API |
| Fechas | `date` para fechas clínicas y `timestamptz(3)` para instantes; conexión UTC y días del negocio `America/Curacao` |
| JSON y enums | JSONB y enums nativos, con los estados existentes |
| Integridad | 33 CHECK de negocio, 153 controles de no negatividad/rango, FK/RESTRICT, unicidades e índices existentes |
| Timestamps | 28 triggers mantienen `updated_at`, también en escrituras SQL |
| Texto | Collation ICU `odontho_ai_ci`: igualdad/unicidad sin distinguir mayúsculas ni acentos. Hashes binarios y contraseñas conservan comparación exacta |
| Búsquedas | 40 columnas auxiliares en 17 tablas, normalizadas por triggers con `unaccent`; la misma función normaliza la consulta. No alteran textos originales, snapshots ni DTOs |
| Permisos | Express/JWT/RBAC y aislamiento por organización; RLS habilitada sin políticas públicas en las tablas. No se incorpora Supabase Auth |
| Documentos | Continúan en almacenamiento local. Storage persistente y Vercel son trabajo posterior |

Los nombres de algunos índices `fk_*` cambian a `ix_*` para evitar colisiones entre nombres de índices y restricciones en Prisma/PostgreSQL. Las búsquedas usan columnas deterministas porque PostgreSQL 17 no permite `LIKE` sobre collations no deterministas. ICU/unaccent no son una implementación idéntica de todos los casos Unicode de MySQL; los casos representativos de mayúsculas, acentos y ligaduras están cubiertos por pruebas. Mantener el mismo contrato y revisar casos lingüísticos adicionales si aparecen.

Los campos auxiliares son internos. No admitirlos en cuerpos HTTP ni incluirlos en DTOs. Las futuras migraciones deben preservar collations, triggers, CHECK y RLS; generar SQL solo desde Prisma no representa todos esos objetos. El mapa de columnas está en `backend/prisma/postgresql/search-fields.json`.

## Paso a paso en PowerShell

### 1. Preparar el backend

Detener el backend que estaba conectado a MySQL. Desde una consola:

```powershell
Set-Location C:\workspace\app-DentalService\backend
npm.cmd ci
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:unit
```

No cambiar el `.env` MySQL original. Los comandos `*:supabase` cargan explícitamente `.env.supabase.local` sobre la configuración local, usan `certs/supabase-ca.crt` y mantienen validación TLS. El certificado es público; las credenciales del archivo de entorno están excluidas de Git. No se necesitan claves `NEXT_PUBLIC_*` ni credenciales de base en el frontend.

### 2. Verificar el destino

```powershell
npm.cmd run db:check:supabase
npm.cmd run db:status:supabase
```

Antes del primer despliegue se esperan 0 tablas y la migración `20261030000000_init` pendiente. `migrate status` devuelve código 1 mientras está pendiente; no es un fallo de conexión. Confirmar que se está usando el proyecto exclusivo de desarrollo. No usar `migrate reset`, `db push` ni marcar `0_init` como aplicada.

Como el frontend accede por Express/Prisma, desactivar la Data API de Supabase en API Settings, siguiendo su guía oficial. Esto también evita exponer metadatos de migraciones; no se está configurando acceso directo desde el navegador.

### 3. Crear la estructura

```powershell
npm.cmd run db:migrate:supabase
npm.cmd run db:status:supabase
npm.cmd run db:check:supabase
```

Esto aplica el baseline revisado mediante Prisma, dentro de una transacción. Tras aplicar, se esperan 40 tablas de aplicación más `_prisma_migrations`, 186 CHECK explícitos y ninguna migración pendiente. Las migraciones se ejecutan una vez de forma controlada, fuera de cada request/arranque del servidor. Solo un chat/persona debe ejecutarlas a la vez.

Si falla, guardar el mensaje sin credenciales e inspeccionar el estado antes de repetir o resolver una migración. No editar una migración ya aplicada ni limpiar tablas como solución automática.

### 4. Cargar la configuración mínima

```powershell
npm.cmd run db:seed:supabase
npm.cmd run db:verify-seed:supabase
```

El seed configura organización, sede, pagador, roles/permisos, secuencias y settings. No reinicia contadores existentes; sí sincroniza los permisos de los roles del sistema. No crea usuarios con contraseña, catálogos/tarifas SVB productivos ni valores administrativos SVB reales.

### 5. Elegir cómo probar

Para QA con Postman, ejecutar una vez el fixture existente usando la conexión Supabase:

```powershell
npm.cmd run db:qa-seed:supabase
```

Es exclusivamente un dataset sintético. El script imprime las credenciales QA y actualiza `backend/postman/ODONTHO_LOCAL.postman_environment.json` con sus IDs. No compartir esa salida ni confundir esas tarifas/identificadores con datos SVB oficiales. La guía de Postman identifica las cuentas de prueba.

Si se desea además un administrador propio, añadir **localmente** a `.env.supabase.local`:

```dotenv
BOOTSTRAP_ADMIN_EMAIL="TU_EMAIL"
BOOTSTRAP_ADMIN_PASSWORD="TU_CONTRASENA_DE_AL_MENOS_12_CARACTERES"
BOOTSTRAP_ADMIN_FIRST_NAME="TU_NOMBRE"
BOOTSTRAP_ADMIN_LAST_NAME="TU_APELLIDO"
```

Y ejecutar una sola vez:

```powershell
npm.cmd run db:bootstrap:supabase
```

El bootstrap conserva el flujo JWT/RBAC existente y rechaza un email ya registrado. No es necesario para las cuentas creadas por el fixture Postman.

### 6. Iniciar y ejecutar Postman

```powershell
npm.cmd run dev:supabase
```

Importar la colección y el environment indicados en [la guía Postman](../../backend/postman/README.md). `baseUrl` debe ser `http://localhost:3000`, sin añadir `/api/v1`: las rutas de los requests ya incluyen ese prefijo. Verificar el puerto configurado si se cambió localmente.

Ejecutar las carpetas en orden: salud/login/permisos; pacientes/seguros/citas; atención/catálogo/procedimientos; factura/preparación/firma/cierre/PDF; corrección; declaración/exportación. Adjuntar el PNG indicado en la guía para la firma. El envío SVB real sigue sin adaptador. Revisar también Dashboard y búsquedas `Jose`/`José`, importes por moneda y límites diarios de Curaçao. Registrar el resultado real; no asumir que Postman ya fue ejecutado por haber pasado los tests automáticos.

## Repetir integración automática

Las suites no utilizan el proyecto Supabase ni recurren al `.env` operativo. Requieren un PostgreSQL 17 local con ICU/unaccent, una base dedicada cuyo nombre termine en `_test`, baseline y seed aplicados. Después:

```powershell
$env:TEST_DATABASE_URL="postgresql://USUARIO:CONTRASENA@127.0.0.1:5432/odontho_test"
npm.cmd run test:integration
```

El setup rechaza destinos remotos y bases sin sufijo `_test`. Los workflows CI se actualizaron a PostgreSQL 17 con bases desechables; su ejecución remota no forma parte de esta entrega.

## Retorno y pendientes

MySQL, su `.env`, SQL original e historial permanecen conservados. El código nuevo utiliza PostgreSQL; para volver a arrancar el adaptador MySQL se necesitaría una copia anterior del código/cliente/dependencias en un directorio separado. Cambiar solo la URL ya no cambia de motor. No ejecutar reset/stash para preparar ese retorno.

Pendientes después de esta preparación: aplicar migración y seed en Supabase, aceptación Postman/navegador, configuración SVB real y copia/restauración cuando haya datos a conservar. No se desplegó a Vercel ni se resolvieron Storage, refresh/revocación o envío SVB real.

Referencias: [Prisma/Supabase](https://supabase.com/docs/guides/database/prisma), [certificado SSL](https://supabase.com/docs/guides/platform/ssl-enforcement), [collations PostgreSQL 17](https://www.postgresql.org/docs/17/collation.html).
