# ODONTHO SERVICES — SVB Billing App

Aplicación para recepción, agenda, atención clínica, facturación versionada, firma del paciente y declaraciones SVB en Curaçao.

## Organización por funciones

Un repositorio local con seis áreas de responsabilidad. La separación organiza el trabajo y los contratos; no introduce microservicios ni seis aplicaciones independientes.

| Área | Responsabilidad | Guía |
| --- | --- | --- |
| Arquitectura | Límites, contratos, decisiones técnicas y despliegue | [Arquitectura](docs/arquitectura/README.md) |
| Backend | API, seguridad, repositorios e integraciones | [Backend](docs/backend/README.md) |
| Frontend | Vistas, formularios, navegación y consumo del API | [Frontend](docs/frontend/README.md) |
| Lógica de negocio | Reglas clínicas, facturación, estados y snapshots | [Negocio](docs/negocio/README.md) |
| Diseño | Experiencia operativa, componentes y accesibilidad | [Diseño](docs/diseno/README.md) |
| Base de datos | Modelo, integridad, migraciones y Supabase | [Base de datos](docs/base-de-datos/README.md) |

Todos los chats deben partir del [contexto consolidado](docs/CONTEXTO_PROYECTO.md) y del [plan de transición](docs/PLAN_MVP.md). El [registro de chats](docs/CHATS.md) identifica las seis conversaciones creadas.

## Entornos

**Estado del código al 30 de octubre de 2026:** React/Vite local → Express/TypeScript local → Prisma 7 con adaptador MariaDB → MySQL. La migración a Supabase todavía no está implementada.

**Objetivo durante el MVP:** React/Vite local → Express/TypeScript local → Prisma → Supabase PostgreSQL. Backend y frontend permanecen en este repositorio local. El acceso a la base remota requiere conectividad.

**Destino final:** frontend y API en Vercel, base en Supabase. La adaptación de la API y del almacenamiento de documentos se realizará antes del despliegue; esta organización no constituye un despliegue ni una migración ejecutada.

## Arranque local actual

Desde `backend`, con su configuración local preparada:

```powershell
npm.cmd run dev
```

Desde otra terminal en `frontend`, con `VITE_API_BASE_URL=http://localhost:3000/api/v1` en su configuración local:

```powershell
npm.cmd run dev
```

Backend usa por defecto el puerto 3000; Vite normalmente el 5173. Salud: `/health/live` y `/health/ready`; documentación: `/api/docs`. Las credenciales y la URL privada de la base pertenecen únicamente al backend.

## Coordinación

Los seis chats comparten archivos, no memoria automática. Registrar decisiones y entregas en la guía del área correspondiente. Consultar [AGENTS.md](AGENTS.md) y las instrucciones más específicas antes de modificar código. Durante esta etapa se conserva el trabajo local y no se publica ni se actualiza el remoto.
