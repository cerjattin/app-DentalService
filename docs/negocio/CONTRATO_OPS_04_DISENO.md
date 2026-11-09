# OPS-04 Diseño y aceptación operativa

Iniciar inspección y guion de aceptación del [contrato común](CONTRATOS_OPERACION_20261107.md). La solución ahora gestiona atención por servicios y entrega a facturación. Usar frontend/AGENTS.md, los componentes existentes y producción en inglés.

## Recorridos a comprobar

| Perfil | Recorrido y observación requerida |
| --- | --- |
| Recepción | Crear cita, confirmar, reprogramar y cancelar. Reconocer citas completadas, abrir factura, resolver datos de cobro faltantes, preparar y capturar firma y consultar la versión cerrada. |
| Profesional | Abrir cita confirmada, buscar servicio sin exigir precio, registrar cantidad, retirar un error, reagregar y completar. El foco de la pantalla debe estar en la lista de servicios. |
| Admin | Ejecutar ambos recorridos y devolver una factura cerrada a atención para corregir/refacturar, conservando el acceso legible al historial. |
| Reportes | Leer volumen e importes por profesional/período, entender qué período y estados cuentan y comprobar moneda separada. |
| Dentalink | Al publicarse el módulo, distinguir deshabilitado, configurado, vista previa con incidencias y resultado real de importación. |

Revisar carga, vacío, permisos, errores, teclado, foco, tablet y zoom 200%. Verificar cómo se evita el doble envío y qué ocurre ante fallos de red o cambios desde otro puesto. Observar el documento de factura/firma y su correspondencia con los servicios de la versión.

## Coordinación

Frontend es el escritor inicial de componentes. Diseño trabaja primero en docs/diseno, guion e incidencias con ruta, severidad, reproducción y criterio de aceptación. Aplicar ajustes de UI únicamente después de que Frontend o Arquitectura asigne los archivos concretos. Esta regla evita escrituras simultáneas sobre el mismo componente.

Preparar QA propio de navegador con datos sintéticos y procesos/directorios propios. Mantener evidencia de fuente revisada. No usar pacientes de clínica para pruebas ni conectar al portal SVB. El bloqueo anterior de selección de archivos en la extensión debe revalidarse con las herramientas actuales. Si persiste, registrar el paso pendiente y su causa real.

## Entrega

Actualizar docs/diseno/README.md y entregar `docs/diseno/OPS_04_ENTREGA.md` con escenarios observados, defectos corregidos o entregados a Frontend, imágenes anonimizadas de QA y puertas manuales pendientes. Una prueba automatizada o una pantalla simulada no acredita aceptación del cliente o sincronización Dentalink real.
