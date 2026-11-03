# Plan del MVP y primer despliegue clínico

Actualizado por Arquitectura el 3 de noviembre de 2026, NEG-DEP-12. [Alcance vigente](negocio/CIERRE_PRIMER_DESPLIEGUE_20261103.md). El usuario solicita iniciar correcciones/preparación/QA ahora; SVB se aplaza, no se espera su archivo para avanzar clínica. Este plan no ordena publicar, contratar, hacer commit/push ni escribir en la base clínica.

**Cierre de ronda local:** cuenta Render confirmada y solo Supabase clínico; usuario mantiene **QA solo local**. 092a se conserva con fuentes idénticas a entregas finales Frontend/Diseño y build existente. [Vinculación](arquitectura/NEG_DEP_12_ENTREGA.md#vinculación-de-cierre-local-sin-nuevas-suites) y [lista manual pendiente](arquitectura/NEG_DEP_11_CHECKLIST_CIERRE_LOCAL.md). DEP11 PARCIAL; Linux/Storage/host remotos PENDIENTES POR ALCANCE/ACCESO. No pedir/crear cloud ni usar clínica.

## Estado comprobable y orden

| Fase | Resultado | Estado y dueño |
| --- | --- | --- |
| Organización | Seis áreas/chats, monolito modular + SPA | Realizada; [registro](CHATS.md) |
| PostgreSQL local | Schema/migraciones/PrismaPg compartido, reportes y validación sintética | Implementado por Backend/DB; histórico MySQL conservado |
| Supabase destino | Baseline y datos existentes; inventario/permisos/migraciones | Baseline aplicado según DB; cinco migraciones/dos permisos/tres hallazgos en último inventario. Repetir antes de operar |
| DEP10 | Integridad de factura completa y nuevas presentaciones SVB aplazadas | Entregas locales Backend y DB: 482/59 PASS cada una, separadas; vincular fuentes al candidato final |
| DEP11 | Aceptación clínica y UX en QA sintética | Entrega local parcial y Diseño R2; automatizado 379/16 de Negocio vinculado, manual pendiente |
| DEP12 local | Configuración/snapshot/build/runbook y vínculo por fuente | PREPARADO LOCAL, 092a conservado; [entrega](arquitectura/NEG_DEP_12_ENTREGA.md). No GO clínico |
| DEP12 remoto | QA aislado, HTTPS, pool, Storage, redespliegue y restore | PENDIENTE POR ALCANCE/ACCESO por decisión de QA local; requisitos conservados para otra ronda |
| Operación clínica | Datos/permisos/cuentas/documentos/respaldo/smoke/soporte listos | NO-GO hasta cumplir puertas y operación autorizada |
| Cliente aceptó | Primera ronda observada y alcance registrado | Pendiente; no inferir por pruebas técnicas |
| SVB posterior | Fuentes/campos/formato/destinatario y aceptación | APLAZADO POR ALCANCE; no inventar valores ni archivos oficiales |

## Trabajo entregado y aceptación pendiente por áreas

1. [DEP10](negocio/CONTRATO_DESPLIEGUE_10_INTEGRIDAD_SVB.md): Backend entregó integridad transaccional de factura completa, SVB false/readiness y 409 SVB_PRESENTATION_DEFERRED conservando replay/historia/resolución; DB revisó. El QA aprobado no autoriza habilitar SVB en producción.
2. [DEP11](negocio/CONTRATO_DESPLIEGUE_11_ACEPTACION_CLINICA.md): Frontend integró capacidad false/ausente/error y correcciones DES; Diseño reensayó con límites explícitos. Entrega PARCIAL: [lista manual](arquitectura/NEG_DEP_11_CHECKLIST_CIERRE_LOCAL.md), sin repetir suites aprobadas. UAT07 tiene criterio definido; ejecución/evidencia y aceptación real siguen pendientes. Sin defaults SVB.
3. [DEP12](negocio/CONTRATO_DESPLIEGUE_12_ENTORNO_OPERACION.md): DB entregó inventario/planes de migraciones, permisos y hallazgos sin aplicar en clínica; Arquitectura entregó configuración/candidato/build/runbook y vínculo por fuente. Backend conserva schema/migraciones/servicios. Operación real y cloud son etapa posterior; preparación local no equivale a aplicación.

Integración solo en PostgreSQL local sintético independiente `_test`, root documental propio y sin compartir directorios que limpien otras suites. No repetir pruebas aprobadas salvo cambio, fallo o dependencia nueva. Cada área actualiza su guía/evidencia; no sumar conteos históricos de entregas diferentes.

## Infraestructura y versión

Render SPA + una API pagada `0.5c-512mb` + Supabase Pro/Storage privado: propuesta de US$32/mes base, no contratada. Presupuesto hasta US$35; impuestos/excesos/dominio/respaldo externo/proyectos QA adicionales quedan fuera. Vercel conserva preparación como alternativa desde US$45 con Supabase Pro, fuera del límite. Confirmar factura/plan reales al decidir, no asumir que Supabase ya paga Pro. [Fuentes actuales, variables, URLs y región provisional](arquitectura/NEG_DEP_12_RUNBOOK.md).

Express/JWT/RBAC permanecen; Supabase Auth/Realtime son decisiones separadas. Frontend usa backend sin secretos VITE. Storage privado tiene adaptador; las URI locales necesitan inventario/transición y recuperación, no desaparecen al configurar proveedor. No se añade otro backend de reglas.

La versión es snapshot de fuentes/locks/assets/migraciones, con SHA-256 por archivo y hash conjunto. HEAD no identifica ediciones locales. Build Linux limpio y smoke remoto deben vincularse al mismo manifiesto. Sin publicaciones automáticas ni migraciones en build/start/request. Nuevas ediciones requieren nueva captura y aceptación de lo afectado.

## Secuencia controlada posterior

Los pasos cloud siguientes se conservan para otra ronda; no se piden recursos ni se ejecutan ahora. Esta ronda entrega candidato/evidencia vinculada y una lista manual precisa. No repetir checks aprobados de las mismas fuentes solo para actualizar documentación.

1. Terminar DEP10/11 y candidato exacto; elegir cuenta/plataforma/región/URLs/costo. Completar preparación antes de pedir solo decisiones/acceso imprescindibles por canal seguro, sin contraseñas en chat.
2. QA remoto separado con sintéticos: build limpio Linux, health/HTTPS/CORS/proxy/pool, UAT y documentos tras reinicio/redespliegue; restauración conjunta en otro destino. No usar clínica como laboratorio.
3. Operación final revisable: ventana/responsable único, escritores detenidos, inventario fresco/checksums, respaldo verificado y fuente fiscal autorizada; aplicar cadena revisada/permisos/plan de datos solo con autorización concreta. Sin reset, seed general, cleanup ni reescribir migraciones aplicadas.
4. Publicar solo con autorización concreta; comprobar versión/URLs/smoke/roles/documentos y recuperación. Datos fiscales/Storage/permisos deben resolverse antes de uso real aunque SVB esté aplazado. Operador/suplente/soporte/cuentas/política RPO-RTO-retención aceptados.
5. Registrar aceptación del cliente aparte. Ante fallo crítico suspender, preservar evidencia y ejecutar retorno compatible con schema/objetos; no restaurar encima de clínica como ensayo ni borrar hechos externos previos.

Ver [runbook DEP12 y go/no-go](arquitectura/NEG_DEP_12_RUNBOOK.md). Código PostgreSQL no significa destino actualizado; adaptador Storage no significa bucket probado; build aprobado no significa desplegado.
