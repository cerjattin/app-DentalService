# Contratos del flujo operativo y preparación de Dentalink

Encargo del usuario del 7 de noviembre de 2026. Autoriza continuar el trabajo local, crear contratos y enviarlos a los chats especializados para iniciar modificaciones. El usuario informa que ya existe un despliegue y confirma que la clínica todavía carece de acceso a la API de Dentalink. Esta ronda implementa y valida en local. La operación de despliegue y la aplicación de migraciones en clínica requieren un encargo posterior concreto.

Prevalece el [contrato funcional de atención y facturación](CONTRATO_ATENCION_FACTURACION_DENTALINK_20261106.md) sobre los requisitos anteriores de pantalla clínica. Express, Prisma, JWT y permisos efectivos siguen siendo la autoridad. SVB conserva historial, reportes y preparación existente. Su envío continúa aplazado por la estructura oficial pendiente.

## Base existente y trabajo de esta ronda

Ya hay cambios locales de atención por servicios, cierre conjunto, captura con valoración pendiente, valoración al facturar, permisos de Recepción y contadores por profesional. Son modificaciones sin commit sobre HEAD `1828797be`. Los contratos siguientes parten de ese código y solicitan completar o corregir lo que falte, con evidencia. Las guías históricas contienen decisiones de plataforma y estados anteriores al despliegue comunicado por el usuario. Arquitectura debe actualizarlas con límites explícitos de lo comprobado.

| Contrato | Área y entrega | Archivos propios |
| --- | --- | --- |
| [OPS-01](CONTRATO_OPS_01_BACKEND.md) | Backend valida API, concurrencia, facturación y prepara módulo de importación con adaptador sustituible | Servicios, repositorios, rutas, OpenAPI, pruebas Backend y backend/docs |
| [OPS-02](CONTRATO_OPS_02_FRONTEND.md) | Frontend completa operación de los tres perfiles y consume únicamente contratos publicados | frontend/src y pruebas Frontend |
| [OPS-03](CONTRATO_OPS_03_BASE_DATOS.md) | Base de datos revisa migración e integridad y acuerda persistencia de importación | Prisma, migraciones nuevas y database |
| [OPS-04](CONTRATO_OPS_04_DISENO.md) | Diseño verifica el recorrido en navegador sintético y entrega incidencias accionables | docs/diseno y su evidencia |
| [OPS-05](CONTRATO_OPS_05_ARQUITECTURA.md) | Arquitectura actualiza contexto, orden, contratos y preparación del candidato | Contexto, plan y docs/arquitectura |
| Negocio | Este chat mantiene alcance, contratos y aceptación integrada | docs/negocio |

## Distribución comprobada

El 7 de noviembre los cinco encargos se enviaron mediante mensajes a los chats locales registrados en [CHATS.md](../CHATS.md). La herramienta aceptó los cinco mensajes y la consulta posterior confirmó los cinco turnos activos en estado inProgress. Backend, Frontend y DB ya habían emitido su actualización inicial de trabajo. Diseño y Arquitectura tenían el turno iniciado. Este estado acredita el inicio y la recepción del contrato, con la implementación y aceptación de cada área aún en ejecución.

Negocio cerró su regresión del recorrido base, publicó los contratos y trasladó el diagnóstico de recuperación a DB. Las nuevas ediciones posteriores de las áreas necesitan su evidencia propia.

## Reparto y orden de ejecución

1. Todas las áreas comienzan inspeccionando el estado local y su contrato. Preservan cambios existentes. La autorización actual permite implementar dentro del alcance asignado y sustituye el onboarding inicial de solo lectura de los chats.
2. DB es el único escritor de schema, migraciones y cliente generado. Backend acuerda con DB cualquier campo o tabla nuevo antes de consumirlo. Solo DB regenera Prisma después de ese acuerdo. Las migraciones anteriores aplicadas permanecen inmutables.
3. Backend mantiene API y permisos. Frontend puede cerrar desde ahora el flujo de servicios sobre las rutas existentes. El módulo Dentalink de Frontend depende de la publicación real de sus rutas y DTO.
4. Diseño inicia inspección y guion desde ahora. Frontend es el único escritor inicial de sus componentes. Diseño registra defectos en su informe y aplica correcciones de UI solo después de una asignación expresa de archivos por Frontend o Arquitectura.
5. Cada suite usa base sintética propia terminada en `_test`, puerto/directorio documental propios y alcance de limpieza limitado. No se comparten clústeres ni directorios de pruebas entre chats. La prueba de recuperación requiere fuente limpia y destino vacío separados del resto de fixtures.
6. Cada área actualiza su guía y una entrega vinculada a archivos y pruebas reales. Arquitectura integra las entregas y enumera las puertas pendientes. Un resultado parcial conserva ese estado.

## Criterios de aceptación común

- Recepción crea una cita, confirma, cancela o reprograma antes del inicio. El profesional abre desde CONFIRMED, registra únicamente servicios y cantidades, retira y reagrega errores y cierra con al menos una línea PERFORMED.
- El cierre completa atención y cita en una transacción. Recepción encuentra la cita completada, crea la factura y obtiene la firma de la versión exacta. Admin puede ejecutar los pasos mediante sus permisos.
- Capturar un servicio no exige diagnóstico, nota médica, autorización, remisión, cobertura o tarifa. La generación de factura resuelve cobertura y tarifa. Ante datos de cobro faltantes, conserva los servicios para un reintento.
- Corrección autorizada retorna a la atención, permite retirar/agregar y refacturar sobre la misma factura lógica y número, conservando versiones, firma y contenido anteriores.
- IDs y Decimal son strings. Cantidades, redondeo de línea y sumas usan Decimal. Fechas del negocio usan America/Curacao. Cada endpoint verifica organización y permisos efectivos.
- Los indicadores existentes continúan operables. El volumen de atenciones y servicios es independiente de que ya exista precio. El informe monetario distingue moneda y estado real de facturación. Los nombres de indicadores deben corresponder con su cálculo.
- Dentalink se prepara con un adaptador de lectura sustituible y pruebas sintéticas. El adaptador HTTP real, su mapeo y la primera conexión requieren documentación oficial verificable y acceso autorizado. Una simulación o un endpoint de estado no acredita sincronización real.
- La importación inicial incorpora nuevos pacientes/citas, mantiene identidades externas por organización y cuenta, permite reintentos sin duplicados y deja incidencias ante coincidencias dudosas o mapeos ausentes. Las citas entran SCHEDULED para confirmación local. Actualización de citas existentes, escritura hacia Dentalink y programación automática necesitan contrato posterior.

## Evidencia y límites de validación

El 6 de noviembre Frontend aprobó lint, build y 345 pruebas en 16 archivos. Backend aprobó typecheck y build. El 7 de noviembre, con la prueba del nuevo flujo subiendo una firma PNG mediante HTTP, Backend aprobó 482 pruebas en 60 archivos. La prueba optativa de recuperación quedó omitida en esa suite por requerir fuente/destino separados. El reporte local está en backend/storage/service-flow-20261106-qa/backend-release-results.json.

La recuperación se ejecutó aparte en dos bases sintéticas nuevas, después de aplicar las siete migraciones y el seed en su fuente. Aprobaron sus dos verificaciones de inventario, pero el ensayo de restauración excedió el límite de 120 segundos. El reporte está en backend/storage/service-flow-20261106-qa/backend-restore-results.json. Este pendiente se asigna a OPS-03 junto con Backend si involucra el helper de recuperación. No hay aprobación de recuperación operativa. La ejecución anterior mezclada con otras fixtures también había fallado y queda sustituida como diagnóstico por este resultado aislado.

Los resultados automatizados no sustituyen la aceptación del cliente, las pruebas de navegador pendientes o la validación del destino desplegado. Los archivos ajenos `deployment/prod-ca-2021.crt` y `deployment/supabase-schema-tlfdwmaofwpwlcgrhfps.png` se preservan.
