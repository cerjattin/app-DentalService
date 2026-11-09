# OPS-05 Arquitectura y cierre

Iniciar coordinación del [contrato común](CONTRATOS_OPERACION_20261107.md). El usuario autoriza continuar en local y envía las tareas a los chats especializados. Ya existe un despliegue según informó el usuario. La documentación compartida mantiene afirmaciones del 3 de noviembre anteriores a ese dato y requiere actualización.

## Trabajo inmediato

Actualizar docs/CONTEXTO_PROYECTO.md, docs/PLAN_MVP.md y la guía Arquitectura con el nuevo flujo de cita, servicios, entrega a Recepción, factura y firma. Registrar el despliegue como informado por el usuario hasta disponer de observación directa del destino. Separar el estado del repositorio del estado de aplicación de la nueva migración al destino.

Consolidar OPS-01 a OPS-04 con el alcance vigente de Negocio. Mantener Backend como dueño de API/servicios, DB como único escritor de Prisma/migraciones/generado, Frontend como único escritor inicial de componentes y Diseño como verificador independiente. Resolver conflictos de archivos mediante asignación explícita.

Asegurar el contrato mínimo del módulo Dentalink entre Backend/DB/Frontend. La clínica carece de acceso a la API. Puede prepararse persistencia y canal de importación con adaptador sustituible y pruebas sintéticas. El adaptador HTTP real, su mapeo y la ejecución real siguen pendientes de la especificación oficial y de acceso autorizado.

Mantener la función futura SVB y los reportes dentro del producto. La radicación continúa aplazada por estructura oficial pendiente. No asignar valores fiscales ni confundir una exportación técnica con radicación real.

## Cierre del candidato

Definir el manifiesto de archivos/migraciones y vincular las verificaciones a la versión real después de recibir las entregas. Registrar QA local, pendientes de navegador, aceptación del cliente y operación de destino como estados distintos. Revisar compatibilidad de orden de despliegue entre nueva API, UI y schema, incluidos registros/facturas existentes y retorno autorizado por corrección.

Preparar un procedimiento concreto de actualización para el despliegue existente que identifique inventario previo, migraciones pendientes, respaldo/recuperación, versión de aplicación y smoke por perfil. El destino real se comprueba por fuentes autorizadas. Esta tarea no aplica cambios a la clínica ni publica el candidato.

Actualizar docs/arquitectura/README.md y entregar `docs/arquitectura/OPS_05_ENTREGA.md` con estado por contrato, límites, operaciones revisables y dependencias. Actualizar guías históricas mediante notas vigentes con fecha y sin borrar evidencia anterior.
