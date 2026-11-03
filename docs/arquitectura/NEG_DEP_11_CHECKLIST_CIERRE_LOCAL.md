# DEP11 — Lista de cierre manual local

Fecha: 2026-11-03. Estado: **PENDIENTE DE EJECUCIÓN / DEP11 PARCIAL**. Propietarios: Frontend + Diseño, con Negocio para alcance clínico. Arquitectura vincula versión y evidencia; no reemplaza su aceptación. [Entrega Frontend](../../frontend/docs/NEG_DEP_11_12_VALIDATION.md), [Diseño R2](../diseno/NEG_DEP_11_INSPECCION_20261103.md#reensayo-r2--fuentes-corregidas-y-evidencia-nueva), [guion de puestos](../diseno/NEG_DEP_11_ACEPTACION_MANUAL_PUESTOS.md).

Solo QA local con cuentas, pacientes, documentos y confirmaciones sintéticas. Mantener SVB aplazado. No crear recursos cloud ni usar Supabase clínica. No repetir escenarios aprobados salvo cambio, fallo o dependencia de las comprobaciones pendientes.

## Identificar el ensayo antes de actuar

Registrar operador/responsable, fecha/hora, sistema/navegador, resolución/zoom, URL local, versión visible, fuente y configuración efectiva de API/documentos/permisos. Verificar qué laboratorio y root documental pertenecen a esa URL. No mezclar IDs de los informes Frontend y Diseño: son copias diferentes y un mismo ID puede representar otro recurso.

Candidato de fuentes **`dep12-092a67db50d812ff`**; hash source `092a67db50d812ffaae9ea18d824f4950d78a9ed25df931c5d29ca5d984b54e5`. Una instancia Vite local con otra etiqueta pública puede verificar las mismas fuentes si se registra su huella y configuración; no constituye prueba del bundle cloud ni de HTTPS. Si cambian fuentes, identificar nueva versión y comprobar lo afectado. No reiniciar ni limpiar procesos/bases/root de otros chats.

El laboratorio de Diseño fue detenido al finalizar R2; el guion de su área identifica su copia/root. La entrega Frontend identifica sus servidores y fixtures. Seleccionar un solo laboratorio con su propietario, sin copiar credenciales a este documento ni a capturas. La reserva sintética de una copia no autoriza resolver una reserva de otra.

## Pendientes y criterio observable

Todas las filas siguientes permanecen pendientes en su alcance indicado; la tabla es un guion, no resultado.

| ID / dueño | Acción concreta en QA local | Resultado y evidencia exigidos |
| --- | --- | --- |
| M01 — Frontend/Diseño, UAT01 | Completar el recorrido permitido recepción → atención → factura con cuentas individuales Admin, Reception y Provider, usando sus permisos efectivos | Acciones y límites de cada cuenta; registrar qué partes ya tienen evidencia y solo completar faltantes. Sin autorización por nombre de rol ni cambios de permisos para pasar |
| M02 — Frontend, UAT02 | Navegar por enlace directo de paciente/cita/factura/caso/documento/declaración de otra organización **existente** del mismo laboratorio | Rechazo y UX sin renderizar datos ajenos; URL, estado visible y resultado API saneado. El 404 de ID inexistente no cuenta |
| M03 — Frontend + Negocio, UAT07 | Ejecutar el [criterio ya definido por Negocio](../negocio/CONTRATO_DESPLIEGUE_11_ACEPTACION_CLINICA.md#criterio-de-negocio-para-uat-07-en-qa-local): servicio ordinario; autorización ausente/válida/ajena/vencida/sin saldo; retirar y reagregar en OPEN; remisión y accidente | Autorización válida consume/libera exactamente una vez; inválidas rechazan sin consumo parcial. Remisión no soportada y alta de accidente/configuración no publicada quedan excluidas; legado solo prueba guardas API. Falta ejecución/evidencia y aceptación del alcance real, no aclaración de reglas ni defaults SVB |
| M04 — Frontend/Diseño, DES04/UAT16–17 | Selector normal del navegador: archivo .txt, vacío y mayor de 4 MiB; después PDF/PNG/JPEG/WebP válido sintético donde el tipo de formulario lo permita | Error específico, foco/aria asociados, selección inválida rechazada y motivo conservado; selección/carga válida reales por UI con conteo/documento verificable. No usar un PDF como firma si ese formulario solo permite imágenes |
| M05 — Frontend/Backend, UAT16–17/19 | En QA controlado provocar fallo de upload, restablecer y reintentar | Error visible sin éxito ficticio; valores conservados; misma clave/documento cuando corresponda, sin doble operación. Nuevas presentaciones siguen apagadas; usar resolución de historia o QA local explícito conforme a Backend |
| M06 — Frontend/Diseño, UAT11 | Desde navegador descargar PDF actual e histórico de versiones sintéticas existentes | Archivo utilizable y versión/nombre correctos; SHA-256 del archivo descargado igual al Document. Registrar versión exacta y hash, sin volver a firmar contenido histórico |
| M07 — Frontend/Diseño, UAT11/19 | Provocar error de descarga/desconexión y sesión expirada real en QA con formulario pendiente | Error en modal activo, recuperación clara, sin falso guardado ni pérdida de edición/duplicación. No persistir tokens/notas en navegador ni cambiar el reloj del equipo para simularlo |
| M08 — Frontend/Diseño, DES01/02/UAT19 | Completar Back/recarga con aviso nativo y expiración; revisar foco/Tab/Shift+Tab/Escape/Cancel en firma, corrección y confirmación anidada | Keep editing conserva nota; fallo de guardar mantiene guard; éxito permite salir. Foco final vuelve al disparador o destino lógico; no confundir BODY transitorio con resultado asentado. Conservar los PASS R2 de enlace/sidebar/Add procedure |
| M09 — Diseño, UAT19 | Zoom real 200% desde menú del navegador y matriz desktop 1440×900, portátil 1280×720, tablet 768×1024; confirmar puestos reales aparte | Captura del zoom real, controles/errores/foco alcanzables, reflow o scroll útil; viewport reducido/CSS zoom no acreditan 200%. Restaurar tamaño/zoom habituales al acabar |
| M10 — Frontend/Diseño, DES03 | Completar observación de refetch al volver a la ventana después de un cambio sintético desde otro cliente del mismo laboratorio | Datos y filtros correctos, carga/error/hora observables. El Refresh manual ya pasó R2; no repetirlo ni prometer latencia/Realtime por ese PASS |
| M11 — Frontend/Diseño, UAT16–17 | Donde siga pendiente, comprobar resolución/resultado/refresco de hechos históricos sintéticos mediante UI | Capacidad false mantiene Prepare/Record nuevos deshabilitados, conserva historia y resolución por permisos. No marcar confirmación de un hecho externo real ni fabricar recibos oficiales para completar QA |

Para M04–M06 basta el selector/descarga normal manejado por el operador humano. La herramienta automatizada bloqueó file URLs y la ventana nativa no pudo verificar la URL; **no se elude ese control ni se exige cambiar seguridad de la extensión** para realizar el ensayo manual. El guion de Diseño contiene pasos detallados y formularios ya preparados, con las restricciones del laboratorio.

[Guía manual Frontend](../../frontend/docs/MANUAL_QA_DEP11.md): detalla fixture PREPARED, registro/resultado exclusivamente sintéticos, replay y descargas de versiones existentes con sus hashes esperados. No mezclar esos fixtures con la copia de Diseño. Ambos guiones son procedimientos pendientes, no pruebas ejecutadas por esta entrega.

## Registrar y cerrar cada fila

Por fila: versión/fuentes/configuración, operador/hora, permisos, precondición/fixture del laboratorio, pasos, esperado/observado, PASS/FAIL/NO EJECUTADO, evidencia y defecto/responsable si falla. Usar capturas con sintéticos y hashes; no guardar bearer/contraseñas/datos de pacientes reales. La descarga HTTP previa complementa M06, no sustituye el navegador.

Al cambiar una fuente o configuración relevante, comprobar la parte afectada y conservar evidencia anterior con su versión. Si la herramienta interrumpe una prueba, dejar NO EJECUTADO con punto exacto; no convertir tests de componente/API en PASS visual ni reiniciar suites completas solo por editar documentación.

DEP11 permanece **PARCIAL** hasta completar su matriz contractual. Esta lista no aprueba puestos ni cliente. Linux/npm ci/nativos, Storage remoto, HTTPS/host, datos/objetos clínicos y aceptación operativa siguen en DEP12 y **PENDIENTES POR ALCANCE/ACCESO** bajo la decisión local-only. SVB externo es **APLAZADO POR ALCANCE**, nunca un PASS.
