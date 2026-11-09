# Contexto compartido del proyecto

## Vigencia — 7 de noviembre de 2026, OPS-01 a OPS-05

Prevalecen [contratos OPS](negocio/CONTRATOS_OPERACION_20261107.md) y [atención/facturación/Dentalink](negocio/CONTRATO_ATENCION_FACTURACION_DENTALINK_20261106.md). La autorización vigente permite modificaciones y QA **locales**, con archivos/entornos propios; no escrituras clínicas, importaciones reales, migraciones remotas, cambios de credenciales ni commit/push/deploy.

| Etapa actual | Autoridad por permisos | Regla |
| --- | --- | --- |
| Agenda y confirmación | Recepción/Admin | Crear, confirmar, cancelar o reprogramar antes del inicio |
| Servicios prestados | Profesional/Admin | Inicio desde CONFIRMED; catálogo/cantidad, retirar y reagregar antes del cierre. Sin diagnóstico/nota médica, seguro, tarifa, autorización o remisión como requisito de captura nueva |
| Entrega conjunta | Profesional/Admin | Al menos un servicio PERFORMED; completar atención+cita en una transacción y entregar a Recepción |
| Factura y firma | Recepción/Admin | Resolver seguro/moneda/tarifa al facturar. Error administrativo conserva servicios para reintento. Firma de versión exacta e historial inmutable |
| Corrección/reportes | Permisos efectivos | Misma factura/número y nuevas versiones/firmas según contrato. Volumen sin precio separado de importes/monedas/estados |

Los perfiles de esta tabla son orientación operativa: Backend autoriza por permisos/organización, sin atajos de rol. El cuerpo legado con seguro conserva su contrato específico; el historial médico no se borra, pero no define requisitos ni pantallas del nuevo recorrido. Las restricciones antiguas UAT07/diagnóstico/notas del 3 de noviembre quedan históricas para ese cliente legado, no se aplican como bloqueo de la captura mínima nueva.

**Repositorio comprobado al arrancar OPS:** HEAD `1828797be5abb6d97292dc298dafd6e3976ff9b8` más cambios locales. PostgreSQL/PrismaPg; endpoints start y finish-services montados, DTO mínimo y valoración en factura, pantalla Service attention y métricas de volumen presentes. `20261106000000_service_attention` es la séptima migración local al iniciar la ronda: nullable de valoración y permisos del PROVIDER incorporado. Su aplicación al destino **no está comprobada por Arquitectura**. DB puede añadir otra migración Dentalink; el manifiesto final debe incluir la cadena efectivamente entregada.

**Despliegue:** el usuario informa que ya existe. Se registra como **INFORMADO POR USUARIO**, sin observación directa de URL/versión/schema/Storage. El conector Render está disponible pero no tiene workspace seleccionado; esta ronda no eligió uno ni consultó servicios. Los YAML y precios propuestos del 3 de noviembre no prueban plataforma/plan/factura reales. [Procedimiento de actualización](arquitectura/OPS_05_ACTUALIZACION_DESTINO.md).

**Dentalink:** clínica sin acceso API. Preparar módulo interno/adaptador inyectable y prueba sintética; ninguna simulación acredita conexión/importación real. [Acuerdo de persistencia DB](base-de-datos/OPS_03_MODELO_DENTALINK.md), [dependencias de handoff](arquitectura/OPS_05_COORDINACION_DENTALINK.md). Credencial solo Backend. Primera entrega: pacientes/citas nuevos, identidades por organización/cuenta/ID y citas SCHEDULED; sin fusión por nombre ni cambio de números históricos, actualizaciones externas o escritura al proveedor por inferencia.

**Propiedad:** DB es único escritor de schema/migraciones/cliente generado; Backend API/servicios/repositorios; Frontend componentes/caché; Diseño inspección independiente y escritura UI solo por asignación expresa; Negocio reglas/aceptación; Arquitectura contexto/plan/candidato. Cada área usa QA sintético propio, sin compartir ni limpiar laboratorios ajenos. `deployment/prod-ca-2021.crt` y la captura Supabase se conservan; no son entradas del artefacto de código.

**Evidencia de partida, no ejecución fresca de Arquitectura:** Negocio reporta el 7 de noviembre 482 pruebas Backend aprobadas en 60 archivos, con recuperación optativa omitida. En ensayo aislado de recuperación: 2 PASS y 1 timeout a 120 s, asignado a DB. Frontend lint/build/345 pruebas y Backend build del 6 de noviembre; Backend typecheck del 7. Nuevas ediciones OPS necesitan evidencia propia. Recuperación no aprobada por esos conteos; tampoco navegador, Dentalink real, operación de destino o aceptación del cliente. [Entrega OPS-05](arquitectura/OPS_05_ENTREGA.md).

SVB y reportes se conservan dentro del producto; nueva radicación sigue aplazada por estructura oficial. No inventar maestros/tarifas/campos fiscales ni interpretar exportación técnica como radicación real. IDs/Decimal strings, numeración transaccional, aislamiento y America/Curacao continúan vigentes.

## Registro histórico del 3 de noviembre — no sustituye OPS

Actualizado por Arquitectura: 3 de noviembre de 2026 (NEG-DEP-12). Consolidación histórica inicial: 30 de octubre. Repositorio: `C:\workspace\app-DentalService`.

## Decisiones registradas el 3 de noviembre

1. Separar el trabajo en Arquitectura, Backend, Frontend, Lógica de negocio, Diseño y Base de datos, con seis chats especializados de Codex.
2. Preparar ahora el primer despliegue clínico, conservando desarrollo/QA local y Express/Prisma/JWT/RBAC. [Cierre vigente y contratos DEP10–12](negocio/CIERRE_PRIMER_DESPLIEGUE_20261103.md).
3. Supabase PostgreSQL está incorporado en código y tiene baseline aplicado según DB. Vercel fue el destino inicial; Render + Supabase es la propuesta dentro de US$35/mes. No hay plataforma contratada ni publicación por esta preparación. [Configuración/runbook](arquitectura/NEG_DEP_12_RUNBOOK.md).
4. Aplazar envío/presentación SVB por falta de fuente/formato; conservar historia y diagnóstico. Nuevas presentaciones manuales bloqueadas por configuración autoritativa DEP10. No inventar maestros, tarifas ni semántica para habilitar servicios.
5. Preservar cambios locales. Correcciones/preparación/QA sintética autorizadas; commit/push/deploy/contratación y escrituras clínicas requieren operación concreta posterior. No ejecutar migraciones/seeds/cleanup/integración en clínica por esta ronda.
6. Continuación del 3 de noviembre: cuenta Render disponible, único Supabase existente es clínico. Usuario decide **QA solo local por ahora**. No crear ni pedir proyecto/bucket cloud en esta ronda; Linux/Storage/host remotos PENDIENTES POR ALCANCE/ACCESO. Conservar requisitos futuros, sin sustituir QA con clínica ni declarar uso real apto por el aplazamiento. [Detalle](arquitectura/NEG_DEP_12_QA_ACCESO.md).

## Producto y arquitectura

ODONTHO SERVICES — SVB Billing App gestiona pacientes y seguros, citas, atención clínica, procedimientos realizados, facturas con versiones, firmas, documentos, correcciones y declaraciones SVB. Incluye administración de usuarios/profesionales, catálogo SVB y Dashboard operativo.

Frontend: React, Vite, TypeScript, Tailwind 4, React Router, TanStack Query, React Hook Form y Zod. Backend: Node.js, Express, TypeScript, Prisma 7, validación Zod, JWT, RBAC, auditoría y PDFKit. API bajo `/api/v1`; salud fuera de ese prefijo.

La implementación actual usa **PostgreSQL con PrismaPg**, un cliente compartido por runtime/scripts/seeds y migraciones separadas de MySQL. Express conserva autenticación, permisos, aislamiento por organización y reglas. La interfaz consume Express; no accede directamente a tablas ni claves privadas de Supabase. El adaptador opcional de Supabase Storage privado ya existe; configurar SUPABASE no transfiere documentos locales anteriores ni acredita persistencia remota.

## Estado comprobado en disco el 3 de noviembre

| Área | Evidencia local | Interpretación |
| --- | --- | --- |
| Git | HEAD base `0bff419bd` + numerosas ediciones locales compartidas | HEAD solo no identifica la versión; manifiesto por archivo/hash en DEP12. Sin modificar historial |
| Base local | Schema PostgreSQL, PrismaPg compartido, SQL reportes portado, historial PostgreSQL | Implementado localmente; MySQL es histórico, no runtime actual |
| Base destino | [Entrega DB DEP12](base-de-datos/DEP12_PRIMER_DESPLIEGUE.md): cinco migraciones, dos permisos/cinco asignaciones, tres hallazgos fiscales y siete URI locales pendientes | Inspección protegida de DB; Arquitectura no aplicó/reparó destino ni copió objetos a QA |
| Catálogo | Módulo `svb-catalog`, API compartida frontend y Services | Preservar MASTER-02R/MASTER-03; no reconstruir desde auditorías antiguas |
| Citas | Diálogo compartido de creación, módulo appointments y clinic-locations | La creación ya existe; no tratarla como funcionalidad ausente |
| Dashboard | Módulo reports, API frontend y reporte con filtros | Ya existe; tiene correcciones locales sin commit que deben conservarse |
| Organización/casos | Rutas organization y treatment-cases montadas; contratos 03/04/05 y refacturación locales | Diagnóstico de ausencia del 30 de octubre superado; falta aceptación de destino |
| Firma/PDF | Adaptadores LOCAL/SUPABASE, hashes, PDF y descargas autenticadas; configuración Vercel | Falta bucket remoto real, transición URI locales, reinicio/redespliegue y restore conjunto |
| SVB | REAL_SVB bloqueado; captura/historia manual implementadas; DEP10 añade aplazamiento e integridad de factura completa | Captura campo por campo previa no autoriza presentar en primer despliegue |
| Aceptación | [Entrega local Frontend](../frontend/docs/NEG_DEP_11_12_VALIDATION.md), Diseño R2 y [vinculación 092a](arquitectura/NEG_DEP_12_ENTREGA.md#vinculación-de-cierre-local-sin-nuevas-suites) | 167 fuentes Frontend y 6 finales Diseño coinciden con candidato; 379/16 de Negocio vinculados, sin repetir. DEP11 PARCIAL; [M01–M11](arquitectura/NEG_DEP_11_CHECKLIST_CIERRE_LOCAL.md) pendientes |
| Auth | Access token y RBAC propios | Refresh/revocación siguen pendientes de DBR-001; no cambiar implícitamente por usar Supabase |
| Diseño | Tokens en `frontend/src/index.css`; falta `Recursos/frontend-reference/` | Conservar UI existente; referencia original pendiente de recuperar |

Al iniciar había cambios Dashboard/pruebas, `.gitignore` y `.vscode/`; ahora hay entregas de todas las áreas. No atribuirlas a Arquitectura ni sobrescribirlas. Cada área conserva archivos propios; Arquitectura posee contexto/plan y `deployment/`.

## Contexto recuperado de chats

Se consultaron mensajes disponibles, no solamente títulos. La herramienta devuelve páginas de turnos y puede truncar mensajes largos; los archivos adjuntos originales no siempre están disponibles. Esto es una síntesis de decisiones y evidencias, no una exportación íntegra de todos los chats.

| Chat consultado | Identificador | Contexto útil |
| --- | --- | --- |
| Odontho SVB · 00 Arquitectura y Coordinación | `6a7ca711-6120-83e9-9217-71c42e181864` | Separación agenda/atención/factura, snapshots y coordinación; propuestas iniciales de estados deben contrastarse con el contrato actual |
| Odontho SVB · 01 Base de Datos | `6a7ceda1-572c-83e9-9186-4ac3601e7748` | Modelo e integridad MySQL, numeración transaccional y propuesta más reciente de pasar a Supabase conservando Express/Prisma/RBAC |
| Diseño Backend API | `6a83c2ee-d344-83e9-83e3-6145762475ef` | Catálogo, firma, Declarant ID y reporte de MASTER-04A; este último requiere reconciliación con disco |
| Odontho SVB 02 Frontend | `6a96f32e-4138-83e9-af68-a7b724e6b247` | MASTER-02R/03, catálogo compartido y preferencia de desarrollo local |
| Rama: Odontho SVB 02 Frontend | `6ae23240-4e48-83e9-b8b2-e5dcd97b3a77` | Repositorio local como fuente de implementación y necesidad de verificar citas/Dashboard actuales |
| Chat equipo | `6a7ca05a-0830-83e9-8867-81eb1cee77cb` | Herramientas y preparación del entorno |
| Subir proyecto a Git | `6a84a7c3-b510-83e9-9688-e8bec2ba53de` | Historia de organización y exclusión de archivos locales; no sustituye decisiones actuales sobre Git |
| Auditar arquitectura frontend | `01a18314-2388-7412-a102-d20b9a8e9047` | Recuperación e integración de MASTER-02R/03; múltiples estados históricos del checkout |
| Audit frontend product | `01a18457-22be-7482-b890-d71197e1a721` | Posibles mejoras: notas sin guardar, frescura, selectores y accesibilidad; gaps de citas/Dashboard quedaron superados por cambios posteriores |
| Verifica acceso local | `01a18501-a359-7221-88db-08012c17c299` | Última corrección local de filtros Provider y fechas del Dashboard; preservar esos archivos |
| Chat local de correcciones de citas y Dashboard | `01a184e1-00a6-7ba0-a14c-a5f22c5b9ad9` | Confirmación previa de implementación existente; el listado usa un prompt largo como título |
| Ajustar pruebas de Postman | `01a182c1-3337-7cf3-8e06-92bbe960edd0` | Colección principal y uso exacto de `baseUrl`; preparación QA no equivale a colección completa ejecutada |
| Solucionar Errores | `01a17fd8-b9fb-7a11-99b8-284fe2f4b6df` | Diagnóstico histórico de autenticación MySQL y baseline `0_init`; se consultaron los turnos recientes, hay más historial |
| Corregir comandos MySQL en Windows | `01a17b54-5c5c-76e1-b79c-744e8d8284fb` | PATH MySQL resuelto; antecedente del entorno actual |
| Chat de inicio de sesión en Codex/VS Code | `01a184d8-f968-7501-b1a8-df1527fafd9a` | Contexto de acceso al entorno; sin nuevas reglas de producto |
| Diseñar Tarjetas Odontho | `6ae3db07-9e14-83e9-b8ef-1436a83d27a7` | Contexto de marca; no es especificación funcional ni autorización para cambiar los tokens de la aplicación |

Se revisó también el listado archivado: los tres chats archivados asociados a esta ruta no devolvieron mensajes útiles. Los chats de otros productos se excluyeron de esta consolidación.

## Reglas que comparten todas las áreas

- `SvbProcedure` es Service/SKU; `EncounterProcedure` representa lo realizado; `SvbTariff` mantiene importes y vigencias.
- Una factura lógica por cita, múltiples ítems y versiones explícitas. Firmas y snapshots pertenecen a una versión; históricos firmados/cerrados/sustituidos inmutables.
- IDs BigInt y Decimal viajan como strings. Conservar cantidades exactas y monedas separadas.
- Zona del negocio: `America/Curacao`. La zona del equipo del desarrollador no define fechas clínicas.
- Autorización externa solo cuando las reglas del procedimiento la requieran. `DeclarantId` es configuración de la organización, un requisito distinto.
- No inventar catálogos productivos, tarifas, `NumberOfTreatments`, `Assistance` ni envío real SVB.
- Ante contradicciones: instrucción vigente del usuario, código/rutas/pruebas actuales y contrato específico actualizado. Registrar discrepancias en vez de dar por terminado un cambio por su reporte histórico.

## Límites de esta consolidación

El diagnóstico inicial fue estático. Después hubo implementación PostgreSQL y validaciones de las áreas: son evidencias fechadas, no ejecuciones frescas ni números sumables de Arquitectura. NEG-DEP-12 registra sus propios checks y snapshot en [entrega](arquitectura/NEG_DEP_12_ENTREGA.md). Preparación local, QA remoto, operación clínica y aceptación del cliente son estados distintos. No se publicó ni contrató desde este chat; toda puerta de destino sin evidencia continúa pendiente.
