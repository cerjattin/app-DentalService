# Cierre para el primer despliegue — 3 de noviembre de 2026

## Estado actual de la continuación

| Entrega | Resultado acreditado | Límite pendiente |
| --- | --- | --- |
| DEP10 Backend/DB | Factura completa, aplazamiento y regresiones de 482 pruebas por entorno | No habilita nuevas presentaciones SVB |
| Frontend automatizado | Lint y 379 pruebas en 16 archivos ejecutados por Negocio, fuentes estables | Cierre visual integral separado |
| DES-01/02/03 | Reensayo independiente R2 documentado: notas conservadas, foco recuperado y Refresh con filtros conservados | Aprobación acotada a esos recorridos, no todo UAT-19 |
| DES-04 y visual restante | Error obligatorio asociado al input y foco comprobados | Selección/subida/descarga y zoom/puestos aún incompletos; herramienta de ventana nativa no verificó URL |
| Candidato local | `dep12-092a67db50d812ff`, 458 fuentes, build Backend/Frontend Windows aprobado | Fuentes comparadas; DEP11 parcial, sin npm ci limpio/Linux ni despliegue |
| Destino clínico | Inventario/plan de migraciones, permisos, identidad y documentos preparados | Sin aplicación real ni fuentes fiscales corregidas |
| Alcance de QA | Solo local por decisión expresa del usuario | Host/Storage/Linux remotos pendientes por alcance/acceso |
| SVB | Envío aplazado; capacidad nueva deshabilitada por servidor | Formato/fuentes/transporte y presentación externa, fase posterior |

La comparación independiente del candidato `092a` contra el árbol vivo encontró **cero fuentes cambiadas y cero faltantes** en sus 458 entradas. [Artefacto y comprobaciones de Arquitectura](../arquitectura/NEG_DEP_12_ENTREGA.md). Esto sustituye la captura `5d9b` desactualizada; no transforma una prueba visual pendiente en PASS. La documentación histórica de abajo conserva el diagnóstico y los avances anteriores.

Entregas actuales: [Frontend DEP11/12](../../frontend/docs/NEG_DEP_11_12_VALIDATION.md), [Diseño R2](../diseno/NEG_DEP_11_INSPECCION_20261103.md), [guion manual de puestos](../diseno/NEG_DEP_11_ACEPTACION_MANUAL_PUESTOS.md). La carga/descarga visual, zoom real 200%, recorridos completos de perfiles/aislamiento, sesión/desconexión y foco en firma/corrección siguen abiertos según sus matrices. La limitación de selección de archivos/URL es de la herramienta; no se declara fallo del producto ni prueba aprobada por usar HTTP.

Negocio concretó el [criterio UAT-07 local](CONTRATO_DESPLIEGUE_11_ACEPTACION_CLINICA.md): sin defaults SVB; autorización vigente se valida y consume/libera según reglas existentes; remisión no soportada y altas de accidente/remitente no publicadas se excluyen. Resta ejecutar/adjuntar escenarios y confirmar con clínica el alcance real y sus fuentes; no queda pendiente inventar una regla para completar el archivo.

## Decisión vigente y alcance

**Continuación confirmada:** el usuario dispone de cuenta Render y solo Supabase de la clínica; decidió **mantener únicamente QA local por ahora**. En esta ronda no se crea proyecto/bucket QA cloud ni se usa clínica como laboratorio. La preparación local continúa hasta su entrega comprobable; Linux/Storage/host remoto y uso clínico conservan su puerta de aceptación posterior.

El usuario solicita verificar el repositorio, dejar **pendiente el envío a SVB por falta de estructura de archivo**, crear los contratos restantes y enviarlos a los chats especializados para que empiecen inmediatamente. Esta instrucción prevalece sobre el objetivo anterior de presentar realmente durante el primer piloto. No se espera a obtener el archivo para preparar el despliegue clínico.

La aclaración previa de otros chats era captura manual campo por campo, una presentación por factura. Su implementación se conserva; no acredita un formato oficial ni autoriza una actuación externa en esta ronda. Primer despliegue: pacientes/seguros, agenda/recepción, atención/servicios, casos, factura/firma/PDF, regreso a atención/refacturación, administración y Dashboard, según permisos y alcance clínico verificado. Declaraciones y descargas técnicas conservan carácter interno. **Ninguna prueba ni despliegue se usa para enviar o presentar realmente en SVB.**

También quedan dentro del pendiente SVB las fuentes todavía no confirmadas de NumberOfTreatments/Assistance/PoliClinic/remisión y la validación del destinatario. No afirmar que solo falta escribir un serializador. Esto no bloquea el recorrido clínico independiente; los servicios cuyo requisito externo no está soportado siguen bloqueados y se identifican expresamente en el piloto. No inventar tarifas, maestros o valores para habilitarlos.

## Verificación local de esta revisión

Árbol compartido sobre HEAD `0bff419bd`, con numerosos cambios locales de Backend, Base de datos, Frontend y contratos anteriores. Se preservan sin commit/reset. Se contrastaron contratos, entregas de áreas, últimos mensajes de los cinco chats, rutas montadas y código actual. No se repitieron suites, navegador ni consultas a Supabase en esta revisión documental.

| Alcance | Evidencia comprobada | Estado real |
| --- | --- | --- |
| 03/04/05 y regreso a Clinical | Contratos, módulos montados y entregas de áreas | Implementados localmente; falta aceptación del destino |
| 06 | `svb-readiness.service.ts` bloquea REAL_SVB; captura conserva semántica pendiente | Controles técnicos implementados; fuentes externas pendientes |
| 07 | Siete rutas manuales, evidencia/idempotencia/resultados y persistencia | Implementado con incidencia FE-07-01 todavía abierta |
| Factura completa en registro manual | `packet()` itera ítems seleccionados; no compara el conjunto con todos los ítems de la versión | Falta integridad Backend, confirmada por reproducción de Frontend |
| 08 | Adaptador privado y configuración Vercel, inventario/restauración sintéticos | Falta prueba del almacenamiento y entorno de despliegue reales |
| Destino Supabase | Último inventario protegido de DB del 3 de noviembre | Cinco migraciones, dos permisos y tres hallazgos fiscales pendientes según esa evidencia; repetir antes de aplicar |
| 09 | Nuevo ciclo de firma/refacturación/PDF y paginación probados en QA | Matriz Frontend conserva ocho NO EJECUTADO y un FAIL; no hay aceptación integral |

Referencias: [Backend y pruebas propias](../../backend/docs/NEG_FINAL_09_BACKEND_VALIDATION.md), [Frontend, reproducción y matriz](../../frontend/docs/NEG_FINAL_07_09_VALIDATION.md), [DB, destino y recuperación](../base-de-datos/NEG_FINAL_07_09_HANDOFF.md). Sus 451/434/370 pruebas son evidencias de entregas distintas, **no ejecuciones frescas ni sumables de esta revisión**.

## Contratos de cierre y asignación inmediata

| Contrato | Responsable | Trabajo inmediato |
| --- | --- | --- |
| [NEG-DEP-10 — Integridad y SVB aplazado](CONTRATO_DESPLIEGUE_10_INTEGRIDAD_SVB.md) | Backend; DB revisa sin editar sus archivos | Corregir FE-07-01 y publicar bloqueo de nuevas presentaciones del primer despliegue |
| [NEG-DEP-11 — Aceptación clínica y UX](CONTRATO_DESPLIEGUE_11_ACEPTACION_CLINICA.md) | Frontend + Diseño | Completar navegador, roles/aislamiento, adjuntos, teclado/responsive y regresión afectada |
| [NEG-DEP-12 — Destino, datos y operación](CONTRATO_DESPLIEGUE_12_ENTORNO_OPERACION.md) | Arquitectura + DB, soporte Backend/Frontend | Concretar plataforma, artefacto, reparación revisable, permisos, Storage, recuperación y smoke |

Orden: las áreas comienzan en paralelo en archivos propios. Backend publica errores/readiness antes de la integración final Frontend; DB posee herramientas de inventario/permisos/revisión, Backend conserva módulos/config/OpenAPI/schema/cliente generado/migraciones hasta handoff; Diseño entrega hallazgos/evidencia sin editar componentes que Frontend esté cambiando; Arquitectura posee contexto/plan/decisión de plataforma. Nada de migraciones simultáneas ni suites que limpien documentos del laboratorio ajeno.

Arquitectura evaluó previamente Render + Supabase con presupuesto del usuario de hasta US$35/mes. Era una recomendación, no una plataforma contratada. No asumir Vercel ni dar esos precios históricos como vigentes. Arquitectura verifica opciones y prepara una propuesta/configuración concreta, agotando trabajo local/QA antes de solicitar la decisión imprescindible para publicar o contratar.

## Cierre comprobable

Los tres contratos se cierran con versión/artefacto identificado, checks pertinentes, evidencias protegidas y responsable. Preparación local no equivale a despliegue; un despliegue de QA no habilita datos reales; aceptación técnica no equivale a aceptación del cliente. La única dependencia funcional aplazada intencionalmente es SVB y sus fuentes/transporte; integridad clínica, accesos, persistencia y operación deben pasar antes del uso real.

La ejecución inmediata autorizada comprende correcciones, contratos, configuración, herramientas y QA sintético. No hay orden de hacer commit/push ni de reparar datos clínicos con valores inferidos. La operación clínica y la publicación se presentan concretas, con respaldo, diff, destino y evidencias, según NEG-DEP-12. Cada chat registra su resultado en su guía y en su entrega; este documento no marca tareas terminadas por haber enviado el encargo.

## Envío e inicio comprobados

Se enviaron los encargos por la herramienta de mensajes a los cinco chats especializados existentes, por solicitud expresa del usuario. Snapshot posterior: **los cinco tienen turno activo en progreso y anunciaron el inicio del alcance asignado**. No se crearon chats nuevos ni se atribuye finalización a ese estado.

| Área | Chat existente | Contratos enviados | Estado al comprobar |
| --- | --- | --- | --- |
| Backend | `01a18ddd-1358-78e1-a24d-ed0868cce551` | DEP10 y soporte DEP12 | INICIADO |
| Base de datos | `01a18ddd-491e-73f0-9fcf-c1e672a9ba19` | DEP12-B/C y revisión DEP10 | INICIADO |
| Frontend | `01a18ddd-1e7f-7be1-9eee-6a28ccbc8163` | DEP11, integración DEP10 y smoke DEP12 | INICIADO |
| Diseño | `01a18ddd-386c-7ae1-8374-b90087af5271` | Inspección DEP11 | INICIADO |
| Arquitectura | `01a18ddd-0163-7671-a659-b55872b8ae22` | Coordinación DEP12 y contexto/plan | INICIADO |

Esta entrega de Negocio crea este informe y tres contratos DEP10–12; actualiza el índice, README, adenda y avisos de alcance de 06–09. Comprobaciones documentales: enlaces locales, whitespace de nuevos documentos y diff check. No incluye tests nuevos de producto ni despliegue ejecutado. Las entregas que los especialistas generen después se evalúan por sus evidencias propias.

## Seguimiento posterior de las entregas — mismo día

Tras recibir el avance de Backend se contrastaron su entrega y los cambios de código, sin repetir sus suites. El snapshot conjunto muestra Backend, DB, Frontend y Arquitectura en progreso, y Diseño con inspección parcial terminada. Esto actualiza el diagnóstico inicial de esta página; no lo convierte retroactivamente en una prueba aprobada.

- **DEP10:** [handoff Backend](../../backend/docs/NEG_DEP_10_12.md) y código actual ya comparan exactamente los ítems de una sola factura/versión en prepare/registro, publican los dos errores 409 y capacidad SVB segura por defecto. Se conserva consulta parcial de expediente interno, que no concede reserva. DB reporta revisión independiente de 22 líneas y carreras aprobada. Falta registrar cierre de la regresión final de esa entrega y aceptación Frontend; FE-07-01 pasa de fallo de implementación conocido a **corregido en código, aceptación integrada pendiente**.
- **DEP12 datos:** [entrega DB](../base-de-datos/DEP12_PRIMER_DESPLIEGUE.md) incluye sincronizador de permisos con dry-run/diff y plan fiscal protegido. Su inventario de lectura repite cinco migraciones, dos permisos y los tres hallazgos; añade siete URI locales. No se aplicaron cambios clínicos ni se resolvieron las fuentes fiscales.
- **DEP12 plataforma:** [entrega Arquitectura](../arquitectura/NEG_DEP_12_ENTREGA.md) prepara Blueprint/artefacto/runbook y checks locales. Plataforma/URLs/bucket reales, smoke remoto, Linux y decisiones operativas siguen con estado propio; no hay despliegue acreditado por este seguimiento.
- **DEP11 Diseño:** [inspección con evidencia](../diseno/NEG_DEP_11_INSPECCION_20261103.md) identifica P1 de pérdida de notas sin guardar, P2 de retorno de foco y cola desactualizada, más asociación de errores de adjunto pendiente de prueba visual. Se envió inmediatamente ese informe al chat Frontend dentro del encargo autorizado para su corrección/reensayo. Diseño no aprueba DEP11 y conserva pruebas visuales abiertas.
- **DEP11 Frontend:** continúa navegador y QA de roles, paciente/seguro y recursos existentes de otra organización. No se marcan esas filas PASS hasta su entrega y evidencia final.

**Situación del primer despliegue:** preparación en progreso; no apto todavía para habilitar datos reales. El pendiente SVB sigue aplazado; pérdida de edición, aceptación de UI, identidad fiscal, migraciones/permisos y durabilidad/operación del destino siguen su cierre independiente. No se solicita una aprobación genérica para continuar estas tareas ya encargadas.

## Continuación solicitada por el usuario — verificación de evidencias

El usuario confirmó **cuenta Render existente y solo Supabase de la clínica**. No existe destino Supabase QA separado confirmado. Se comunicó a Arquitectura para concretar opción/configuración de QA independiente; no usar clínica como laboratorio ni asumir que una cuenta disponible ya tiene servicios contratados. Se mantiene el presupuesto previo sin crear recursos por inferencia.

Negocio inspeccionó directamente los dos JSON de regresión conservados por las áreas:

| Área | Reporte local protegido/ignorado | Resultado del archivo |
| --- | --- | --- |
| Backend | `backend/storage/dep10-backend-qa/acceptance-final-results.json` | success=true, 482 aprobadas, 0 fallos, 59 archivos |
| Base de datos | `backend/storage/dep12-db-qa/acceptance-results.json` | success=true, 482 aprobadas, 0 fallos, 59 archivos |

Son dos ejecuciones propias de sus áreas, no 964 casos distintos ni una nueva ejecución por Negocio. [Entrega Backend](../../backend/docs/NEG_DEP_10_12.md) y [entrega DB](../base-de-datos/DEP12_PRIMER_DESPLIEGUE.md) registran bases/roots separados y sus límites. DEP10 queda implementado y con regresión Backend/DB acreditada; integración visual y entorno siguen pendientes.

Arquitectura produjo el candidato provisional `dep12-5d9b62c4c85f291b`: 453 fuentes, manifiesto/ZIP y compilación aislada Windows. La comparación independiente de Negocio contra el árbol vivo detectó **10 archivos del manifiesto cambiados después de capturarlo**, sin faltantes: dos herramientas Backend y ocho archivos Frontend/pruebas, entre ellos notas, diálogo y Recepción. No publicar esa captura como si incluyera los arreglos posteriores; recapturar y verificar después del cierre de las áreas. Su build no acredita npm ci limpio/Linux ni persistencia remota.

Frontend anunció correcciones de notas, foco y actualización de Recepción; la lectura actual confirma la integración de UnsavedChanges, retorno de foco y Refresh worklist/refetch al recuperar foco. Eso es evidencia de código, no cierre visual. Se encargó a Diseño el reensayo independiente de DES-01..04 sobre fuentes actuales y cobertura pendiente, preservando su QA y las restricciones de control fiable del navegador. No se marca P1 resuelto hasta su evidencia nueva.

Arquitectura continúa la comprobación de Linux disponible y prepara el destino QA mínimo con el dato real de recursos del usuario. Los datos fiscales correctos, acceso/bucket QA, operación de migraciones/permisos, transición de siete documentos y smoke remoto siguen pendientes concretos; su preparación progresa sin esperar el archivo SVB.

### Decisión posterior: QA únicamente local

La opción de proyecto Supabase QA independiente se planteó concretamente al usuario, quien eligió **“Mantener solo QA local por ahora”**. Se comunicó a Arquitectura y Frontend para cerrar esta ronda sin provisionar cloud ni insistir en esa creación. La propuesta QA remota que Arquitectura preparó queda como alternativa futura, sin ejecución.

La comprobación de Arquitectura encontró WSL sin instalar y ningún Docker/Podman disponible: build Linux no ejecutado aquí. Sus herramientas/Blueprint futuros y pruebas de sintaxis no sustituyen la ejecución Linux ni el bucket real. Las comprobaciones remotas quedan pendientes por la decisión de alcance/acceso, sin invalidar los PASS locales ni convertirse en PASS por omisión. Los problemas de identidad, permisos/migraciones y documentos del destino continúan abiertos para la operación clínica futura.

Cierre de esta ronda: correcciones y aceptación local aplicables, informes de Backend/DB/Frontend/Diseño, candidato actualizado tras esas entregas y documentación de lo que falta exactamente para publicar. Desplegar cloud, migrar clínica o presentar a SVB no son efectos de mantener QA local.

### Comprobación Frontend ejecutada por Negocio

Se coordinó con Frontend para no duplicar sus checks y se ejecutaron, en `frontend`, `npm.cmd run lint` y `npm.cmd test -- --reporter=dot`: **ambos exit 0; 379/379 pruebas y 16/16 archivos aprobados**, duración Vitest 32.13 s. Sin tests de integración DB, cambios de fuentes ni build desde Negocio. Este resultado es una ejecución nueva de esta continuación, distinto de los 370 históricos.

La huella SHA-256 de `frontend/src` y las entradas package.json/package-lock.json/eslint.config.js/vite.config.ts fue idéntica antes y después: `036cdc50a6468f31f2f766bd540073ec3c3c0b1f10875e69d316f0c89a3a88ae`. Si esas fuentes cambian, esta corrida conserva su alcance, sin atribuir aprobación al árbol nuevo. Se comunicó resultado y huella al chat Frontend; build y cierre visual permanecen en su entrega.

Avance de reensayos comunicado por las áreas: Frontend obtuvo 409 para 1 de 2 líneas y preparación válida con las 2 en QA; Diseño confirmó conservación de notas al cancelar enlace/sidebar/Atrás, retorno de foco y Refresh con cambios del segundo cliente sin perder filtros. Son comprobaciones acotadas; las pruebas de adjuntos, restantes escenarios visuales y la entrega final de aceptación deben conservar su evidencia propia.
