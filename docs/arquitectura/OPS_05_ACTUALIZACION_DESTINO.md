# OPS-05 — Actualización revisable del despliegue existente

Fecha: 2026-11-07. Preparación local, **operación no ejecutada**. El usuario informó un despliegue existente. Arquitectura no ha observado aún URL, servicio, versión, migraciones ni Storage de ese destino. El conector Render está disponible pero no tiene workspace seleccionado; no se eligió uno ni se consultaron servicios. No se infiere el host desde el nombre de un YAML.

## Inventario y precondiciones

Registrar en una operación futura autorizada: workspace/servicios y URLs exactos, versión/revisión live, build/start/Node/locks, configuración de API/origen/CORS, proveedor documental y URI locales/externas, conexiones/pool/TLS, cuentas individuales y responsable/suplente. Conectar solo a fuentes autorizadas de lectura. No imprimir variables, claves ni registros clínicos.

DB entrega diagnóstico protegido del destino con huella, `_prisma_migrations`/checksums/estado, constraints, roles/permisos y datos incompatibles. La migración nueva `20261106000000_service_attention` está en repositorio y QA local; aplicación al destino **NO COMPROBADA**. Los cinco pendientes/dos permisos/siete URI del 3 de noviembre son históricos, no inventario vigente después del despliegue informado. La futura migración Dentalink solo entra al plan si OPS-03 la publica/valida; nunca marcar SQL de disco como ya aplicado.

Detener ante checksum cambiado, migración desconocida/fallida, fuentes/versión no identificadas o permisos incompletos. No reset, seed general, bootstrap, cleanup, importación real ni migración en build/start/request. DB es el escritor único de SQL/Prisma; no reescribir migraciones ya aplicadas.

## Compatibilidad y secuencia de actualización

1. Recibir OPS-01/02/03/04, revisar fuentes/evidencia y fijar candidato exacto. Distinguir código del flujo ya presente desde el 6 de noviembre de los cambios adicionales. Respaldo/recuperación, navegador y aceptación del cliente conservan puertas separadas.
2. Resolver la recuperación optativa: el ensayo aislado previo tuvo 2 PASS y 1 timeout. Exigir ensayo exitoso propio DB y plan de copia **base + objetos**, con custodia/retención/roles/ACL/claves y restore en otro destino. No restaurar sobre clínica como test. Respaldos PostgreSQL no incluyen bytes de Storage. Detener escritores durante el corte y la copia consistente.
3. Revisar filas históricas antes de relajar columnas: seis campos de valoración completos o vacíos, FKs y checks; ninguna combinación parcial. Preservar facturas, versiones y firmas. La migración de atención revoca permisos de factura/firma del PROVIDER incorporado; Admin/Recepción deben conservar permisos efectivos. Revisar roles personalizados, no otorgar por nombre a ciegas.
4. Aplicar por operador único la **cadena realmente pendiente**, con checksums fijados y preflight de datos, en ventana autorizada. Si existe Dentalink en el candidato, preparar también sus tablas/FKs/RLS/permisos antes del backend que las use. Guardar verificación posterior sin datos clínicos en logs. Esta lista no autoriza su ejecución.
5. Publicar primero API compatible con clientes legados, después UI nueva. Antes de API nueva, schema debe admitir valoraciones pendientes. El cuerpo antiguo con seguro conserva su contrato; probarlo separadamente. Un servidor antiguo que vea líneas sin valoración podría no admitirlas aunque el DDL sea aditivo: **no permitir escrituras del flujo nuevo hasta que toda la API activa esté actualizada**. Evitar coexistencia de escritores incompatibles durante rolling deploy.
6. Alinear versión/orígenes de UI/API, caches/CDN y enlaces directos. No mantener abierta una interfaz antigua que capture requisitos o datos diferentes. La UI nueva se publica solo cuando sus endpoints/permisos y schema estén listos; el módulo Dentalink no se habilita por una variable de frontend ni por modelos presentes.
7. Smoke no destructivo del destino según permiso/ventana: salud (DB no prueba Storage), sesión/CORS/aislamiento, citas existentes, pacientes/histórico/PDF de versión exacta y reportes. El ciclo de escritura se ensaya con sintéticos en QA propio; cualquier prueba en destino necesita alcance explícito y datos autorizados. El despliegue informado no convierte ese smoke en realizado.

## Matriz de smoke por perfil para la operación futura

| Área / permisos efectivos | Comprobación y resultado esperado |
| --- | --- |
| Recepción | Agenda/confirmación/reprogramar/cancelar antes del inicio. Atención completada aparece para facturación; elige seguro/moneda ante ambigüedad. Tarifa faltante rechaza factura sin perder servicios. Prepara/firma/cierra versión exacta según permisos |
| Profesional | Inicia cita CONFIRMED, registra servicio/cantidad sin notas/diagnósticos/seguro/tarifa/autorización/remisión, retira/reagrega error. Cierre con al menos una línea PERFORMED completa atención+cita. Sin permisos de factura/firma no obtiene esas acciones por API |
| Admin | Puede ambas etapas mediante permisos. Retorno autorizado a atención y nueva firma/refacturación conservan invoice ID/número/seguro/moneda/versiones/PDF anteriores; no se edita historia firmada |
| Concurrencia | Dos inicios devuelven una atención lógica. Alta/retiro frente a cierre/factura no pierde líneas ni genera factura parcial. Reintentos posteriores a un timeout se reconcilian con servidor; errores de conflicto recuperables |
| Reportes | Volumen de atención/unidades incluye servicios sin precio; moneda/estado/período claros. Dinero no mezcla divisas ni atribuye cobros por simple captura. Comparar antes/después de facturar para conservar significado |
| Dentalink | Sin acceso/adaptador real muestra desconectado/no disponible. No pacientes/citas/contadores ficticios. Lo probado por adaptador sintético sigue etiquetado como QA; primera importación real queda pendiente |
| Historia/SVB | Firmas/PDF descargan bytes y versión anteriores; permisos/organización preservados. Declaraciones/reportes siguen accesibles. Nueva radicación SVB permanece aplazada por estructura oficial |

## Retorno y operación

Conservar versión de app/config y copia base/objetos anteriores, huellas y ventana. Si falla, suspender nuevas capturas/importaciones y preservar auditoría/evidencia. Un rollback de código puede ser incompatible con líneas sin valorar o nuevas tablas/estados: no volver automáticamente al binario anterior sin prueba de lectura/escritura. No rellenar NULL con cero ni borrar líneas para acomodarlo.

Preferir corrección hacia delante compatible con el esquema. Restaurar solo con pérdida/RPO evaluados, primero en destino separado y verificando filas/secuencias/checks/objetos/identidades externas antes de redirigir tráfico. Restaurar no deshace una factura firmada, una importación externa ni un hecho SVB previo; reconciliar antes de reanudar.

Responsable/suplente, soporte, RPO/RTO/retención y ventana reales se fijan con la clínica; no se inventa una política aceptada. La autorización actual es local, no una publicación ni permiso para actuar sobre el despliegue existente.
