# Arquitectura y coordinación

## Responsabilidad

Definir límites entre áreas, contratos transversales, decisiones de infraestructura, orden del MVP y preparación de Vercel. Mantener [contexto compartido](../CONTEXTO_PROYECTO.md) y [plan](../PLAN_MVP.md).

## Estructura que conservamos

```text
app-DentalService/
  backend/                 API y reglas de negocio ejecutables
    src/modules/           dominios: routes/controllers/services/repositories
    src/infrastructure/    base de datos y logging
    prisma/                modelo y migraciones de Prisma
  frontend/                aplicación React/Vite
    src/features/          dominios y flujos de interfaz
    src/api/               transporte centralizado
    src/components/        componentes compartidos
  database/                SQL histórico, integridad y futura transición PostgreSQL
  Recursos/                contratos y referencias originales
  docs/                    contexto y guías de las seis áreas
```

La lógica de negocio es un área propia de análisis y validación, implementada en los servicios existentes del backend. Diseño tiene responsabilidad propia sobre UX y componentes, implementados en el frontend. No se extraen paquetes vacíos ni se duplican servicios para representar estas funciones.

## Decisiones base

- Un monolito modular para el backend y una SPA para el frontend, en el mismo repositorio local.
- Supabase se incorpora primero como PostgreSQL. Conservar Express, Prisma y Auth/RBAC actuales durante esa migración.
- Vercel es el destino final de la SPA y la API. La configuración concreta del despliegue se define tras validar PostgreSQL y documentos remotos.
- Almacenamiento de documentos persistente externo antes del despliegue; Supabase Storage es el candidato propuesto.
- Conservación de contratos HTTP y datos históricos; el cambio de motor no justifica alterar reglas del negocio.

## Handoffs

| Cambio | Responsable principal | Coordinación necesaria |
| --- | --- | --- |
| Tabla, índice, constraint o migración | Base de datos | Backend y Negocio |
| Endpoint/DTO/permiso | Backend | Frontend y Negocio |
| Regla/estado/snapshot | Negocio | Backend, Base de datos y Frontend |
| Pantalla/formulario/caché | Frontend | Diseño y Backend cuando cambie el contrato |
| Interacción/token/componente | Diseño | Frontend |
| Runtime, pool, storage, despliegue | Arquitectura | Backend y Base de datos |

## Siguiente trabajo

Reconciliar el reporte MASTER-04A con el checkout y ordenar la migración Supabase. Registrar cada decisión material con motivo, impacto, área responsable y evidencia. Los seis chats arrancan con un diagnóstico de solo lectura para evitar escrituras simultáneas.

Referencia técnica para la fase final: [Express en Vercel](https://vercel.com/docs/frameworks/backend/express). Su soporte no implica que nuestro almacenamiento local o configuración actual ya estén preparados.
