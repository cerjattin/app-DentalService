# Plan del MVP y transición de plataforma

Estado inicial al 30 de octubre de 2026. Este plan distingue organización ya documentada de implementación pendiente; no autoriza a ejecutar todas las fases al abrir un chat especializado.

## Orden de trabajo

| Fase | Resultado esperado | Responsable | Estado |
| --- | --- | --- | --- |
| 0 — Organización | Contexto común, seis guías y seis chats con alcances definidos | Arquitectura | Completada; chats en [registro](CHATS.md), diagnósticos iniciales en curso |
| 1 — Compatibilidad | Inventario de datos, respaldo verificable y mapa MySQL→PostgreSQL | Base de datos + Backend | Pendiente |
| 2 — Supabase | Modelo/migraciones PostgreSQL, adaptador y pruebas en destino dedicado | Base de datos + Backend | Pendiente |
| 3 — Regresión MVP | Flujos completos sobre PostgreSQL con frontend/backend locales | Todas las áreas | Pendiente |
| 4 — Preparación Vercel | API compatible, documentos persistentes remotos y configuración por entorno | Arquitectura + Backend + Base de datos | Pendiente |
| 5 — Despliegue final | Entorno Vercel/Supabase validado, operación y restauración probadas | Arquitectura | Pendiente, posterior al MVP local |

## Fase 1: decisiones necesarias antes de migrar

- Identificar qué datos deben conservarse, su volumen y un respaldo que pueda restaurarse.
- Identificar proyecto/entorno Supabase destino y disponer de conexión mediante secretos locales. No publicar credenciales en chats ni documentos.
- Mantener el histórico MySQL y definir dónde residirá el historial PostgreSQL.
- Revisar SQL manual de Dashboard (`CONVERT_TZ`, casts y agregaciones), schema/tipos y todos los puntos de construcción de Prisma.
- Reconciliar el reporte de organización MASTER-04A con el código local. No ampliar el alcance a CRUD de organizaciones por inferencia.

## Fase 2: migración con contrato estable

Cambiar provider, tipos nativos, adaptador, parser y configuración de CLI/runtime de forma coordinada. Generar y revisar el SQL PostgreSQL, incluyendo constraints manuales. Validar migrations, seeds y pruebas en una base dedicada antes de usar datos operativos. Si existen datos que conservar, ejecutar y verificar su transferencia, sin reemplazarlos por seeds.

No ejecutar simultáneamente migraciones desde varios chats. No usar `migrate reset` ni eliminar datos como solución automática a drift. Conservar un camino de retorno a la base anterior hasta cerrar la aceptación.

## Fase 3: aceptación del MVP local

- Login/permisos/aislamiento por organización.
- Paciente, seguro, cita, ubicación y recepción.
- Atención y varios procedimientos con tarifa por fecha/moneda.
- Factura, preparación, firma, cierre y corrección con snapshots históricos.
- Documentos descargables y declaración/exportación según contratos reales.
- Dashboard conserva semántica y exactitud monetaria al cambiar de motor.
- Regresión de catálogo compartido Clinical/Services y correcciones locales del Dashboard.
- Typecheck/build/tests apropiados, QA de navegador y Postman contra el entorno de pruebas.

Registrar el resultado real de cada escenario. Resolver notas sin guardar, frescura, selectores y accesibilidad según lo que siga vigente tras la auditoría. Los datos SVB oficiales y el adaptador de envío real siguen siendo dependencias externas.

## Fase 4–5: Vercel

La SPA React/Vite y el backend Express se conservan. Antes de desplegar, revisar el entrypoint soportado por Vercel, generación de Prisma, dependencias nativas, CORS, deep links de SPA, timeouts/payloads y conexiones PostgreSQL. Las migraciones se ejecutan como una operación controlada, fuera de cada request o arranque de función.

El adaptador actual escribe firmas/PDF al filesystem local: sustituirlo por almacenamiento persistente externo antes de Vercel. Supabase Storage privado es el candidato propuesto; conservar permisos, hashes y descargas mediadas por el backend. Validar persistencia entre ejecuciones y redespliegues.

Separar desarrollo, pruebas/preview y producción. El despliegue final debe incluir configuración operativa, backups/restauración, URLs y pruebas de flujos; no queda listo por el solo hecho de compilar.

## Coordinación diaria

Cada chat lee `AGENTS.md`, contexto, plan y su guía. Su primera entrega es un diagnóstico de solo lectura con estado comprobado, discrepancias y próximo paso. Las tareas de implementación posteriores se delimitan por área y se registran en su guía.

Al tocar contratos compartidos, indicar archivos afectados y comunicar el handoff en el repositorio. No hay sincronización automática de memoria entre chats. Arquitectura mantiene contexto/plan y el registro de chats; cada área mantiene su entrega. No modificar un mismo archivo simultáneamente.

Fuentes de plataforma consultadas: [Prisma/Supabase](https://supabase.com/docs/guides/database/prisma), [Express/Vercel](https://vercel.com/docs/frameworks/backend/express). Revalidar sus requisitos en el momento de implementar/desplegar.
