# Encargos ejecutables por asistente — NEG-FUNC-03/04/05

Fecha: 2026-10-31. Repositorio compartido: `C:\workspace\app-DentalService`.

## Asignación

Este documento convierte los contratos en encargos para los [seis chats existentes](../CHATS.md). Preparar estos encargos no ejecuta ni acredita su implementación. Al entregar un encargo a su chat, se solicita implementar y verificar el alcance indicado, conservando los cambios locales; no limitar la respuesta a diagnóstico o planificación.

| Asistente | Responsabilidad que debe resolver | Entregable |
| --- | --- | --- |
| Backend | Responsable principal de NEG-FUNC-03, 04 y 05: servicios, rutas, DTO, permisos, transacciones y auditoría | API implementada y documentada, pruebas y handoff por contrato |
| Base de datos | Integridad, concurrencia, ordinales, permisos persistidos y cambios de modelo necesarios | Diseño concreto, SQL/Prisma cuando proceda y verificación en PostgreSQL dedicado |
| Frontend | Settings, selección de candidatos, casos de tratamiento y conexión con citas | Interfaz operativa contra la API real, caché/errores y aceptación de navegador |
| Diseño | Interacción y accesibilidad de las tres funciones dentro del lenguaje visual actual | Estados, textos en inglés y revisión de las pantallas entregadas |
| Lógica de negocio | Resolver interpretación de invariantes y contrastar los resultados con la matriz funcional | Aceptación funcional o diferencias concretas por resolver |
| Arquitectura | Orden de integración, propiedad de archivos compartidos, entorno QA y cierre transversal | Registro de dependencias y evidencia de aceptación local del MVP |

Los nombres de chat son los del registro: **Odontho · Backend**, **Odontho · Base de datos**, **Odontho · Frontend**, **Odontho · Diseño**, **Odontho · Lógica de negocio** y **Odontho · Arquitectura**. No crear otros chats para representar los mismos módulos ni enviar encargos automáticamente desde este documento.

## Orden de ejecución y dependencias

| Paso | Ejecutor | Trabajo | Condición de salida |
| --- | --- | --- | --- |
| 1 | Arquitectura + Base de datos | Identificar un entorno QA dedicado y definir quién edita cada archivo; revisar integridad requerida | Entorno/configuración de pruebas identificados y archivos asignados, sin credenciales publicadas |
| 2 | Backend + Base de datos | NEG-FUNC-03, incluyendo el enlace de Declarant ID en declaraciones | API, autoridad del snapshot y concurrencia verificadas; handoff disponible |
| 3 | Frontend | Integrar NEG-FUNC-03 | Settings y creación de declaraciones ajustados al Backend entregado |
| 4 | Base de datos + Backend | NEG-FUNC-04: exclusividad activa, ordinales seguros y candidatos | Solo una asignación activa concurrente; consulta y POST compatibles |
| 5 | Frontend | Integrar NEG-FUNC-04 | Selección sin copiar IDs y actualización correcta ante conflictos |
| 6 | Backend + Base de datos | NEG-FUNC-05: permisos, casos y validación de referencias en citas | Paciente/organización/estado comprobados y snapshots protegidos |
| 7 | Frontend | Integrar NEG-FUNC-05 | Registro/consulta/selector operativos con permisos y formularios correctos |
| 8 | Diseño + Negocio + Arquitectura | Revisar UX, reglas y recorrido completo de QA | Evidencia de aceptación por contrato y pendientes materiales identificados |

El análisis de integridad y los diseños de interacción pueden adelantarse sin editar los mismos archivos que otro chat. Los cambios de `declaration.service.ts`, schemas de declaraciones y formularios compartidos se ejecutan en serie: NEG-FUNC-03 cambia el origen del Declarant ID y NEG-FUNC-04 debe conservarlo. Backend y Base de datos deben acordar un único editor de schema/seed/migraciones; no generar o aplicar migraciones simultáneamente.

La entrega anterior NEG-FE-REBILL-02 se toma como realizada según la confirmación del usuario; al integrar se comprueba su código efectivo. Si falta en este checkout, registrar la diferencia y coordinar su incorporación con Arquitectura, sin sustituirla por una segunda implementación divergente. Los contratos nuevos mantienen la diferencia entre una API propuesta y una ya publicada.

## Encargo para Odontho · Backend

Texto listo para entregar al asistente:

> Implementa los contratos NEG-FUNC-03, NEG-FUNC-04 y NEG-FUNC-05 en `C:\workspace\app-DentalService`, por ese orden y con entrega verificable por contrato. Lee AGENTS.md, contexto, plan, tu guía, los tres contratos y este documento. Contrasta rutas/código actuales y preserva los cambios locales y staged. La implementación autoritativa debe quedar en servicios del Backend, con validación/transporte en schemas/controllers y persistencia en repositories. Implementa lo que falta y conserva lo que ya cumpla; no termines solo con un informe de diagnóstico. No hagas commit, push, merge, reset ni despliegue.

**B03 — Organización y Declarant ID**

1. Crear el módulo `backend/src/modules/organization/` con repository, service, schemas, controller, routes y OpenAPI; montarlo en `app.ts`. Conservar el cliente Prisma compartido.
2. Publicar GET/PATCH `/api/v1/organization` con los permisos existentes `organization.read/update`, DTO y campos estrictos del [contrato 03](CONTRATO_ORGANIZACION_SVB.md). La organización siempre viene del actor.
3. Resolver e implementar la revisión opaca de configuración. Puede ser una huella canónica del DTO persistido si permite detectar ediciones obsoletas; no introducir una tabla/campo nuevo sin necesidad. Backend calcula/verifica la revisión bajo bloqueo; Frontend solo la devuelve. Conservar ceros iniciales del Declarant ID y la unicidad existente.
4. Aplicar la política de declaraciones del contrato: snapshot inicial null para lotes nuevos, primer ítem vincula el ID de la versión de factura CLOSED vigente, siguientes ítems deben coincidir. Validar y congelar lote/ítem/auditoría en la misma transacción. Retirar el override del cliente de forma coordinada con Frontend/Postman.
5. Aclaración cerrada: una vez vinculado el Declarant ID, el lote Draft lo conserva aunque se retiren todos sus ítems. Para otra identidad se crea otro lote. No restablecerlo a null ni copiar la configuración actual sobre un histórico de forma implícita.
6. Si un Draft legado tiene ítems incompatibles o snapshot ausente, rechazar la nueva vinculación con un conflicto documentado y diagnóstico seguro. Preparar un informe de casos afectados solo en QA o mediante una inspección autorizada; no corregir datos clínicos en masa. Usar 409 `DECLARATION_LEGACY_DATA_CONFLICT` para esa inconsistencia; publicar el código antes de integrar UI.
7. Pruebas: permisos sin nombres de rol, organización ajena, revisión obsoleta, duplicados, primeros ítems concurrentes con Declarant ID distintos, último ítem retirado y rollback de auditoría; demostrar que los snapshots y hashes anteriores no cambian.

Archivos compartidos afectados: `app.ts`, `src/docs/openapi.ts`, `modules/declarations/{declaration.schemas,declaration.service,declaration.repository}.ts`, pruebas de declaraciones/RBAC y los contratos Backend. No reconstruir el módulo de facturación ni modificar el contenido firmado para adaptar los datos.

**B04 — Candidatos y exclusividad**

1. Con Base de datos, resolver la protección de una sola asignación activa por InvoiceItem y la asignación segura de ordinales. Entregar la solución concreta y sus pruebas; una comprobación previa a insertar sin serialización no cumple el contrato.
2. Implementar GET `/api/v1/declarations/:id/candidates`, query/DTO/permisos del [contrato 04](CONTRATO_CANDIDATOS_DECLARACIONES.md). La consulta no reserva ítems. Usar paginación en servidor y filtros reales de organización, payer, versión actual y asignaciones activas.
3. Reutilizar las reglas de preparación SVB del mapper/validador existente. Extraer una validación compartida si se necesitan diagnósticos múltiples; no mantener otra validación independiente para candidatos. Publicar los campos/códigos de `issues` en OpenAPI y conservar los errores actuales de READY/exportación.
4. Actualizar el POST existente de ítems para revalidar y asignar en la misma transacción; integrar retiro/cancelación efectivos sin borrar históricos. Conservar la política de Declarant ID implementada en B03.
5. Auditar las asignaciones, liberar solo la disponibilidad que corresponda y conservar el bloqueo de Clinical cuando quede cualquier asignación activa. Si una operación concurrente cambia estado/versión/disponibilidad, devolver un conflicto y no éxito parcial.
6. Probar dos lotes que compiten por el mismo ítem, retiro/cancelación contra READY, lectura de candidatos obsoleta, primera asignación de Declarant ID y rollback de auditoría. Estas propiedades necesitan PostgreSQL dedicado además de pruebas unitarias.

Archivos principales: módulo `declarations/`, `declarations/export/declaration-row.mapper.ts`, pruebas de declaraciones, PostgreSQL y Dashboard cuando cambie disponibilidad. Añadir los archivos necesarios al módulo existente; no introducir una segunda aplicación de reglas.

**B05 — Casos de tratamiento**

1. Crear el módulo `backend/src/modules/treatment-cases/` y publicar las cuatro operaciones del [contrato 05](CONTRATO_CASOS_TRATAMIENTO.md) bajo el paciente. Montar rutas y OpenAPI.
2. Coordinar los nuevos permisos con Base de datos. Implementar la matriz propuesta mediante asignaciones persistidas; los servicios/rutas verifican permisos, no el nombre del rol.
3. Crear casos PLANNED con referencia externa suministrada, paciente/organización/actor de servidor. No generar TreatmentId ni inferirlo de cantidades o claves internas.
4. PATCH solo para un caso PLANNED sin citas vinculadas. Serializar la edición y su primera vinculación. Orden estable de lista: `createdAt DESC, id DESC`; paginación y filtros en servidor.
5. En crear/editar citas validar referencia del mismo paciente/organización, estado asignable y bloqueo del contexto una vez existan procedimientos/snapshots. Conservar los demás permisos y reglas de agenda. No aceptar una referencia por existir su ID en cualquier paciente.
6. Mantener el snapshot de TreatmentId al registrar el procedimiento. Probar que cambios posteriores de referencias/maestros no cambian factura, firma o documentos anteriores. No completar NumberOfTreatments/Assistance.

Archivos compartidos: `app.ts`, OpenAPI, `modules/appointments/{appointment.service,appointment.repository,appointment.schemas}.ts`, `modules/encounter-procedures/` cuando sea necesario para validar el snapshot, pruebas de citas/procedimientos/RBAC. Reutilizar el modelo TreatmentCase existente.

**Entrega obligatoria por B03/B04/B05**

Actualizar `backend/docs/API_FREEZE_BACKEND.md`, `FRONTEND_HANDOFF.md`, la guía Backend y OpenAPI con rutas realmente montadas. Ejecutar typecheck/build/unitarias; integración en una base dedicada cuando esté disponible. Entregar una sección por contrato con archivos, DTO/errores publicados, resultado real de pruebas, impacto de modelo y pendientes. Si falta QA, completar implementación y pruebas independientes, identificando la aceptación de base como pendiente; no declararla aprobada.

## Encargo para Odontho · Base de datos

Texto listo para entregar al asistente:

> Resuelve el soporte de integridad de NEG-FUNC-03/04/05 en el PostgreSQL actual del repositorio. Lee AGENTS.md, tu guía y estos contratos. Coordina con Backend la propiedad de schema, seeds y migraciones. Entrega diseño concreto y cambios reproducibles cuando hagan falta; no vuelvas a migrar MySQL por referencias documentales antiguas. No ejecutes migraciones, seeds, limpieza o pruebas contra clínica/Supabase operativo, ni publiques credenciales.

- **DB03:** comprobar tipo, normalización/unicidad de Organization.declarantId y bloqueo/revisión de configuración. Confirmar la estrategia de primera vinculación concurrente del Declarant ID en el lote. No proponer una revisión en BD si la huella de Backend satisface el contrato sin cambio de modelo. Identificar inconsistencias legadas y preparar su diagnóstico seguro, sin normalizar históricos automáticamente.
- **DB04:** elegir y entregar la protección de asignación activa. Una alternativa válida es una relación de asignaciones actuales con unicidad por invoiceItemId, sincronizada transaccionalmente con el historial de DeclarationItem; una solución equivalente es admisible si demuestra la misma exclusividad. No usar una unicidad global en el historial que impida conservar lotes cancelados. Explicar cómo add/remove/cancel, cambios de versión y regreso a Clinical conservan el invariante.
- **DB04, ordinales:** sustituir el patrón MAX + 1 del caso de uso por un mecanismo transaccional de asignación por lote. Definir su inicialización para datos existentes sin reescribir líneas históricas ni suponer que todas las secuencias retiradas siguen presentes. Probar rollback y retirar la última línea seguido de una nueva asignación. Backend no debe inventar el contador desde las páginas del cliente.
- **DB04, datos existentes:** detectar asignaciones duplicadas entre lotes activos antes de crear restricciones o poblar una relación de asignaciones actuales. No elegir silenciosamente un ganador ni borrar evidencia. Un conflicto real es un bloqueo de aplicación de la migración que debe devolverse a Negocio con IDs de QA o un informe protegido, nunca con secretos/datos clínicos en la respuesta.
- **DB05:** comprobar la unicidad de TreatmentCase por paciente/referencia externa y las relaciones existentes; resolver la carrera entre primera vinculación y edición. Preparar permisos `treatment_case.read/manage` con la matriz del contrato, conservando Admin con todos los permisos. Reutilizar las tablas actuales cuando basten.
- Preparar SQL/Prisma/seed-verify y pruebas si el diseño requiere cambios. Conservar CHECK, RLS, collations, índices y triggers manuales de la migración PostgreSQL. Documentar aplicación y retorno; no modificar el baseline MySQL ni cambiar Auth.
- Verificar en PostgreSQL dedicado local con nombre terminado en `_test`. Documentar versiones, comandos/resultados reales y limitaciones. Actualizar la guía de Base de datos y entregar a Backend la forma concreta de usar la solución; no dejar solo recomendaciones generales.

## Encargo para Odontho · Frontend

Texto listo para entregar al asistente:

> Implementa la integración Frontend de NEG-FUNC-03/04/05 en el repositorio local, por entregas. Lee AGENTS.md, frontend/AGENTS.md, tu guía y los contratos. Comprueba la API realmente montada, OpenAPI y handoff de Backend antes de habilitar cada función. Reutiliza React/Vite, Query, formularios, permisos y componentes existentes. Conserva cambios locales/staged, tokens en memoria, IDs y Decimal como strings y textos productivos en inglés. No simules éxito ni accedas directamente a Supabase. No hagas commit/push/despliegue.

**FE03 — Settings y autoridad fiscal**

1. Ampliar `features/administration/administration-api.ts`, tipos/modelos y `admin-settings-page.tsx`; sustituir la pantalla informativa cuando B03 esté publicado.
2. Lectura con `organization.read`, edición con `organization.update`. Añadir razón, confirmación de cambio/limpieza del Declarant ID y protección de cambios sin guardar.
3. Devolver `expectedRevision` recibido. En conflicto, conservar lo editado y ofrecer recargar/comparar; no reemplazar la revisión y guardar de nuevo automáticamente.
4. En `features/declarations/declaration-dialogs.tsx`, `declaration-model.ts`, tipos y API retirar la captura de Declarant ID junto con la entrega Backend coordinada. Mostrar snapshot en lectura y estado no asignado para un Draft vacío. Añadir errores de conflicto/identidad/legado al mapeo central.
5. Invalidar organización y recursos afectados por la configuración; no reescribir snapshots, regenerar PDF ni recalcular dinero desde UI. Probar permisos y formularios en `administration.test.tsx` y declaraciones.

**FE04 — Selección de candidatos**

1. Añadir query keys, tipos y GET candidates al módulo `features/declarations/`. Reutilizar el diálogo de Add item, cambiando la copia manual de IDs por búsqueda/selección paginadas.
2. Mostrar factura, versión, servicio, fecha, identidad congelada, importe y moneda, más diagnóstico SVB devuelto por Backend. Un candidato incompleto no se convierte en una promesa de READY.
3. Agregar un ítem por acción con el POST existente y `declaration.update`; deshabilitar doble envío. Ante un conflicto, mantener el diálogo, mostrar el error y reconsultar sin reasignar automáticamente.
4. Invalidar candidatos/detail/items/lists, invoices y Dashboard tras cambios. Integrar los retiros/cancelaciones reales del contrato anterior sin duplicarlos. No deducir disponibilidad de una única página ni sumar monedas diferentes.
5. Cubrir filtros, paginación, estados vacíos, permisos, conflicto por ítem ya asignado, datos incompletos y actualización tras liberar disponibilidad. Usar dobles explícitos para pruebas UI y el API de QA para aceptación real.

**FE05 — Casos y selector de tratamiento**

1. Añadir sección Treatment cases al detalle del paciente y un módulo de API/tipos/formularios para este recurso. Diferenciar External treatment ID de la clave interna.
2. Habilitar registro/edición por los nuevos permisos publicados en `/auth/me`. Mostrar estados del modelo; no implementar transiciones o borrado no contratados.
3. Añadir selector por paciente a `appointment-create-dialog.tsx` y `appointment-update-dialog.tsx`, con los ajustes de modelos/API necesarios. Cambiar de paciente limpia la selección; sin lectura no pedir claves manuales. Con solo lectura se selecciona un caso existente sin crear/editar.
4. Respetar el bloqueo clínico devuelto por Backend y mantener los campos históricos de Clinical como snapshots. No actualizar una referencia de cita ya utilizada para corregir el histórico indirectamente.
5. Invalidar recursos del paciente/citas afectados. Probar selección cruzada, cambio de paciente, caso no asignable, permisos y conservación de snapshots visibles.

**Cierre Frontend**

Ejecutar lint/build/tests y recorrido de navegador contra QA por contrato. Actualizar guía y publicar `frontend/docs/NEG_FUNC_03_04_05_VALIDATION.md`, con resultados separados y sin secretos: archivos, rutas reales, permisos/estados, casos recorridos, checks frescos, evidencias y bloqueos. Si Backend o QA falta, completar lo independiente y distinguir preparación con dobles de aceptación real; no habilitar llamadas ficticias ni declarar la función completa.

## Encargo para Odontho · Diseño

> Define y revisa la interacción de NEG-FUNC-03/04/05 usando los componentes/tokens actuales. Entrega a Frontend los estados de Settings (lectura, edición, conflicto, cambio de identidad, cambios sin guardar), selector de candidatos (filtros, incompletos, conflicto de disponibilidad) y casos de tratamiento (registro, lectura, caso bloqueado y selección por paciente). Especifica textos en inglés, foco/teclado, errores dentro del modal, estados de carga y móvil/escritorio. No agregues pasos que dependan de APIs o reglas inexistentes ni sustituyas el sistema visual. Revisa después las pantallas implementadas con evidencia; no marques funcionalidad Backend como resuelta por un diseño. Si editas archivos compartidos, acuerda antes su propiedad con Frontend. No se requiere crear un archivo Figma nuevo para cumplir este encargo.

## Encargo para Odontho · Lógica de negocio

> Contrasta cada entrega B03/04/05 y FE03/04/05 con el contrato correspondiente. Resuelve las dudas de interpretación dentro de los invariantes ya fijados y documenta cualquier cambio de contrato con sus áreas afectadas. Comprueba: origen y conservación del Declarant ID; una asignación activa por ítem; retiro/cancelación y regreso a Clinical; vínculo paciente/caso/cita; separación entre referencia externa, cantidad, NumberOfTreatments y Assistance. Revisa las evidencias de pruebas y el recorrido completo en QA. Entrega una matriz cumple/no cumple/no ejecutado con disparador, resultado observado y evidencia. No sustituyas una prueba concurrente en PostgreSQL por un mock ni completes semánticas SVB sin fuente autorizada.

## Encargo para Odontho · Arquitectura

> Coordina los encargos de este documento en los chats existentes. Confirma con los responsables el entorno dedicado y la propiedad de archivos; ordena las entregas B03 → B04 → B05 y sus integraciones Frontend. Reconciliar el contrato anterior significa localizar código/evidencia o registrar la diferencia, no sobrescribir cambios. Actualiza contexto/plan compartidos cuando exista evidencia nueva y conserva los estados históricos como tales. Mantén Express/Prisma/Auth/RBAC y el MVP local; Storage, sesiones, Realtime y despliegue continúan en sus alcances separados. Cierra cada contrato solo con evidencia de API, integridad y UX; informa los casos pendientes sin considerar una compilación como aceptación completa.

## Qué pueden resolver autónomamente y qué requiere información externa

Los asistentes pueden resolver dentro de su encargo: estructura de módulos, validadores, query keys, estrategia opaca de revisión, diseño transaccional equivalente, pruebas, componentes actuales y documentación. Una duda técnica requiere investigación del repositorio y coordinación entre áreas, no devolver todo el trabajo al usuario.

Requieren una fuente o intervención externa cuando realmente falte: valores productivos de Declarant ID/TreatmentId, semántica oficial de NumberOfTreatments/Assistance, credenciales/entorno QA no disponible o resolución de inconsistencias de datos que obligaría a elegir qué histórico conservar. Esos casos deben incluir el hecho concreto faltante, trabajo ya completado e impacto. No inventar valores, credenciales o criterios para aparentar cierre.

## Matriz mínima de cierre por contrato

| Contrato | Backend/Base de datos | Frontend/Diseño | Negocio/Arquitectura |
| --- | --- | --- | --- |
| 03 | Organización aislada; revisión obsoleta; ceros iniciales; auditoría/rollback; primera vinculación concurrente; históricos intactos | Settings, razón/conflicto, sin override manual y formulario accesible | Identidad congelada correcta en facturas de distintas épocas y lote coherente |
| 04 | Una asignación activa concurrente; ordinales seguros; candidatos consistentes; estados/rollback | Selección real paginada, errores y caché; incompleto distinto de no disponible | Retiro/cancelación libera solo lo debido y Clinical conserva los bloqueos restantes |
| 05 | Paciente/organización/estado validados; edición contra primera vinculación; snapshot correcto | Registro/selector con permisos; limpiar caso al cambiar paciente; histórico de lectura | Referencia externa sin inferencias, sin cambios retroactivos y sin semánticas SVB inventadas |

Cada responsable informa archivos reales modificados, comprobaciones ejecutadas y casos pendientes. Las pruebas de Backend son typecheck/build/unitarias e integración dedicada; Frontend lint/build/tests y navegador QA. No ejecutar suites de integración contra clínica. No publicar secretos ni atribuir conteos históricos como comprobación fresca. Conservar un estado explícito de **implementado sin aceptación real** si falta verificar PostgreSQL/navegador.
