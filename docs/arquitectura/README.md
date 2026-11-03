# Arquitectura y coordinación

## Responsabilidad

Definir límites entre áreas, contratos transversales, infraestructura, orden del MVP y primer despliegue clínico. Mantener [contexto compartido](../CONTEXTO_PROYECTO.md) y [plan](../PLAN_MVP.md). Tarea vigente: [NEG-DEP-12](../negocio/CONTRATO_DESPLIEGUE_12_ENTORNO_OPERACION.md), con SVB aplazado.

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
  database/                SQL histórico e integridad PostgreSQL
  Recursos/                contratos y referencias originales
  docs/                    contexto y guías de las seis áreas
```

La lógica de negocio es un área propia de análisis y validación, implementada en los servicios existentes del backend. Diseño tiene responsabilidad propia sobre UX y componentes, implementados en el frontend. No se extraen paquetes vacíos ni se duplican servicios para representar estas funciones.

## Decisiones base

- Un monolito modular para el backend y una SPA para el frontend, en el mismo repositorio local.
- PostgreSQL/PrismaPg implementados localmente; baseline Supabase según DB, con cambios posteriores pendientes según inventario. Express/JWT/RBAC se conservan.
- Vercel fue propuesta inicial y tiene configuración de Backend/Frontend. Render + Supabase se prepara dentro de US$35 mensuales; no contratado ni desplegado.
- Storage privado tiene adaptador; falta bucket real, transición de documentos locales y recuperación remota antes de clínica.
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

El diagnóstico inicial MySQL/ausencia de organización está superado: el checkout monta organización/casos y usa PostgreSQL. Arquitectura posee `deployment/`, contexto/plan y esta guía; no edita implementación ni evidencias de otras áreas.

[Runbook DEP12](NEG_DEP_12_RUNBOOK.md): costo/configuración, Blueprint con auto-deploy off, Node/locks/secretos/CA/pool, snapshot/hash, smoke HTTPS, Storage/URI locales, recuperación/cuentas/soporte y go/no-go. [Entrega y checks](NEG_DEP_12_ENTREGA.md).

[Continuación local y paso remoto conservado](NEG_DEP_12_QA_ACCESO.md): QA local; WSL/Docker/Podman no disponibles, runner preparado sin Linux ejecutado. No crear/pedir cloud ni usar clínica. 092a y su build se conservan: las fuentes finales Frontend/Diseño coinciden. [Lista manual](NEG_DEP_11_CHECKLIST_CIERRE_LOCAL.md) mantiene DEP11 PARCIAL, no publicación/uso clínico. Cierre documental sin recaptura ni suites repetidas.

DEP10 está entregado en QA local por Backend/DB; Frontend/Diseño entregaron DEP11 PARCIAL con reensayos acotados y lista manual pendiente. Se cierra esta ronda como preparación local vinculada al candidato. SVB aplazado no equivale a PASS; no se acredita despliegue ni aceptación clínica. Sin commit/push/deploy/contratación ni escrituras clínicas por esta ronda.
