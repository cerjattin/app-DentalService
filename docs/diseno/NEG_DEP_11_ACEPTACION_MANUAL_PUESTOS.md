# NEG-DEP-11 — Aceptación manual pendiente por puesto

Fecha de preparación:2026-11-03. Estado: NO EJECUTADA / NO APROBADA. [Inspección R1/R2](NEG_DEP_11_INSPECCION_20261103.md), [contrato](../negocio/CONTRATO_DESPLIEGUE_11_ACEPTACION_CLINICA.md). Este guion completa lo que las herramientas no acreditaron; no sustituye evidencias existentes ni autoriza usar clínica como laboratorio.

## Registro que completa el operador

| Dato | Estado |
| --- | --- |
| Puesto/dispositivo real y sistema | POR CONFIRMAR con clínica |
| Navegador/versión y escala del sistema | POR CONFIRMAR |
| URL QA sintética y versión visible | POR CONFIRMAR; no usar Supabase clínica |
| Operador/responsable y fecha/hora | POR CONFIRMAR |
| Permisos efectivos de cada cuenta individual | POR CONFIRMAR con Backend |
| Resoluciones técnicas propuestas |1440×900,1280×720,768×1024; no se declaran puestos aprobados |
| Resultado/evidencias/defectos del ensayo | PENDIENTE |

Preparar un entorno QA autorizado con datos y documentos sintéticos. El laboratorio propio de Diseño es copia local `odontho_design_dep11_20261103_test`,3411/5179 y root `backend/storage/design-dep11-20261103/documents`; sus procesos se detuvieron al finalizar R2. No reiniciar ni limpiar laboratorios de otros chats ni publicar credenciales en evidencia. Para adjuntos puede emplearse el selector normal manual del navegador; no se requiere cambiar permisos de la extensión para una prueba humana.

## Zoom real200% y teclado — pendiente

1. Abrir QA y confirmar entorno/versión/usuario. Anotar tamaño de ventana, escala del sistema y resolución efectiva. Restablecer zoom100% en el menú de Chrome y luego elegir **200%** en ese mismo menú; guardar captura que permita verificar el valor. Reducir el viewport a la mitad o usar CSS zoom no acredita este paso.
2. Recorrer login/shell, Reception, Appointment detail y Clinical. Comprobar que nombre/identificador de paciente, estado, campos y acción principal se leen y alcanzan sin superposición; los textos deben conservarse completos por reflow o scroll. Las tablas pueden tener scroll horizontal dentro de su región, pero las acciones deben ser localizables por teclado.
3. Usar solo Tab/Shift+Tab, Enter/Space y Escape. Abrir Add procedure desde su botón, recorrer primer/último control y verificar confinamiento en el modal. Cerrar con Escape y Cancel: foco al disparador o destino lógico si desapareció. Repetir en firma, corrección y confirmación anidada; no confundir BODY transitorio durante cierre con foco final.
4. En Clinical con encounter OPEN, modificar una nota sintética sin guardar. Intentar enlace, sidebar y Back; Keep editing conserva contenido/foco. Comprobar aviso nativo al recargar y cancelar la recarga. Guardar y volver debe conservar el texto. Provocar un fallo de guardado solo en QA controlado y verificar que no anuncia éxito ni descarta edición.
5. Registrar pantalla/resolución/rol/permiso, acción, esperado, actual, evidencia y severidad por escenario. Restablecer zoom100% y tamaño habitual al terminar.

Aceptación: controles alcanzables, foco visible y orden lógico, mensajes asociados, sin pérdida de notas ni pasos ocultos por zoom. Fallos de datos/foco se devuelven a Frontend antes de aprobar el puesto. Este guion no está ejecutado por haber sido escrito.

## Adjunto, errores y recuperación — pendiente parcial

R2 verificó archivo obligatorio, aria-invalid/aria-describedby y foco al input, sin subir bytes. Permanece la prueba siguiente:

1. Usar una reserva **sintética** que permita resolver UNCERTAIN o un ensayo QA explícitamente habilitado por Backend. En el piloto aplazado no se habilitan nuevas presentaciones para completar el ensayo. En la copia de Diseño existe lote138/preparación55, pendiente UNCERTAIN, rotulado QA; no hubo portal ni presentación externa.
2. Abrir Release verified preparation. Sin archivo, enviar una entrada local de prueba: errores dentro del modal; el foco debe señalar lo que falta. Revisar con lector/árbol accesible que el mensaje está unido al selector. No inventar un comprobante oficial.
3. Seleccionar un .txt sintético, un archivo vacío y uno mayor de4MB. Cada uno debe rechazarse con mensaje específico, selección inválida limpia y motivo conservado; ninguna subida o liberación debe producirse. Después seleccionar un PDF/PNG/JPEG/WebP sintético válido, claramente marcado como prueba.
4. Para comprobar fallo real de upload, el responsable controla solo el backend/red de QA. El modal debe conservar motivo, archivo y estado conocido, sin éxito ficticio. Tras restablecer, el reintento utiliza el mismo documento/clave cuando corresponda; confirmar por API y UI que no hubo doble operación.
5. Guardar una resolución solo si el fixture/escenario ha sido autorizado y las confirmaciones representan explícitamente el ensayo sintético. Cancelar cuando se prueba solo validación. No marcar hechos de portal reales ni convertir evidencia ficticia en recibo oficial.

Registrar tipo/tamaño, resultado, control enfocado, mensaje y conteo de documentos/operaciones. No incluir credenciales o datos de pacientes reales.

## Descarga, sesión y permisos — pendiente

1. Abrir una factura sintética con PDF actual e histórico. Seleccionar versión exacta, View/download y Download. Verificar que se descarga un archivo utilizable y que nombre, versión y hash coinciden con el registro. La captura de bytes por API complementa, pero no sustituye, la descarga del navegador.
2. Provocar error de descarga/desconexión en QA: error en el modal activo, sin mensaje de éxito, y recuperación clara. Probar sesión expirada con formularios pendientes según el criterio acordado con Backend; no persistir tokens/notas en navegador para superar el escenario.
3. Repetir recorridos de recepción/atención/factura con cuentas individuales de los tres perfiles y sus permisos reales. La lectura de Recepción y edición de Profesional ya se observaron en R2; esto no sustituye la matriz completa ni el aislamiento con IDs ajenos existentes.
4. Con SVB aplazado, mostrar “SVB submission pending — file specification not confirmed.”; nuevas preparaciones/registros deshabilitados, historia y resolución previa disponibles según permiso. No abrir portal ni presentar nada real.

La aceptación del puesto debe adjuntar resultados frescos y responsable. NEG-DEP-11, UAT-19 y aceptación del cliente permanecen separados de la disponibilidad de Render, del inventario de Supabase y de los tests de Backend/DB.
