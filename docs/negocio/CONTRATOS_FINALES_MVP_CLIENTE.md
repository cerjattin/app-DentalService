# Paquete final del MVP — piloto clínico y portal SVB

**Alcance vigente para el primer despliegue, 2026-11-03:** el usuario aplaza el envío a SVB por la estructura del archivo. Ver [verificación actual y encargos de cierre DEP10–12](CIERRE_PRIMER_DESPLIEGUE_20261103.md). Los requisitos anteriores de presentación real son una fase posterior; no impiden preparar el recorrido clínico independiente. Hay pendientes adicionales de integridad, QA y entorno, con responsables y contratos nuevos. Este aviso prevalece sobre el alcance anterior descrito abajo.

En la continuación, el usuario confirmó cuenta Render y solo Supabase de la clínica, y eligió **mantener QA solo local por ahora**. La preparación se cierra con evidencia local y candidato actualizado; la validación remota y habilitación clínica requieren su fase posterior. No provisionar cloud ni ejecutar pruebas en clínica para sustituir ese alcance.

Actualización 2026-11-03: usuario confirmó **captura campo por campo**, sin archivo de entrada. [Adenda manual](ADENDA_PORTAL_MANUAL_20261103.md) actualiza requisitos de archivo 06/07 y UAT-15/16, conservando fuentes pendientes y controles de entorno/aceptación.

Fecha: 2026-11-02. Decisiones confirmadas por el usuario en esta conversación: uso de **datos reales de la clínica**, incluyendo **presentación real mediante carga manual en portal oficial SVB**. No se encarga una integración API de SVB ni se autoriza subir declaraciones desde este chat.

## Punto de partida comprobado

NEG-FUNC-03/04/05 están implementados en el commit local `0bff419bd`. La [verificación del 2 de noviembre](VERIFICACION_CONTRATOS_03_05_20261102.md) registra código/rutas/pantallas, checks frescos y el límite de la evidencia histórica de integración/navegador. No volver a implementar esos módulos por guías que todavía digan pendiente.

## Contratos finales y responsables

| Orden | Contrato | Responsable que inicia | Entrega que desbloquea |
| --- | --- | --- | --- |
| 1 | [NEG-FINAL-06 — Datos SVB](CONTRATO_FINAL_06_DATOS_SVB.md) | Negocio con la clínica; Backend concreta API | Campos/fuentes/reglas y archivo destino sin defaults inventados |
| 2 | [NEG-FINAL-07 — Portal manual](CONTRATO_FINAL_07_PORTAL_SVB.md) | Backend + Base de datos; Frontend integra | Exportación exacta, carga por operador, registro de comprobante y respuesta |
| 3 | [NEG-FINAL-08 — Entorno clínico](CONTRATO_FINAL_08_ENTORNO_CLINICA.md) | Arquitectura + Base de datos/Backend | Destino/migraciones/roles, accesos, persistencia, backup y restauración |
| 4 | [NEG-FINAL-09 — Aceptación cliente](CONTRATO_FINAL_09_ACEPTACION_CLIENTE.md) | Negocio + Arquitectura con todas las áreas | Matriz completa QA, preparación del piloto y ronda real con el cliente |

La preparación del entorno y la revisión de UX pueden avanzar con las fuentes de datos; no se habilita presentación real mientras falten 06/07. Backend y Base de datos acuerdan editor único de schema/migraciones y validan antes en PostgreSQL dedicado. Frontend no llama rutas propuestas hasta su publicación real.

## Encargos listos para los chats

**Odontho · Lógica de negocio:** cerrar con la clínica la ficha de fuentes de NEG-FINAL-06 y las reglas externas todavía ausentes, revisar los contratos de datos/portal, mantener la matriz UAT y evaluar la evidencia. No declarar resueltas NumberOfTreatments/Assistance a partir de quantity o del PDF.

**Odontho · Backend:** implementar las partes faltantes de 06 y el registro de presentación manual/resultado de 07 con servicios, permisos, idempotencia, auditoría y documentos. Concretar y publicar las rutas propuestas, DTO/errores/OpenAPI/handoff. Mantener los tres contratos anteriores y no habilitar un adaptador que finja la carga al portal. Implementar y probar lo independiente mientras se completan las fuentes, sin certificar los casos que dependen de ellas.

**Odontho · Base de datos:** preparar soporte del registro/evidencia y la integridad de 07; comprobar el estado real de migraciones/roles del entorno del piloto, diagnóstico protegido y recuperación de 08. Probar primero en base dedicada; no aplicar scripts de QA ni correcciones masivas en clínica.

**Odontho · Frontend:** consumir la entrega real de 06/07, mostrar diagnóstico y separar descargar, abrir portal, registrar carga y registrar respuesta. Completar UAT-01 a UAT-20 en QA con datos sintéticos, incluido nuevo ciclo firma/corrección/PDF y varias páginas/lotes. No presentar una exportación como envío ni un recibo como aceptación/pago.

**Odontho · Diseño:** revisar el recorrido completo de datos, errores, firma, descarga y registro de comprobante en los puestos acordados. Entregar la matriz responsive/teclado, no rediseñar el sistema visual ni certificar funciones por una maqueta.

**Odontho · Arquitectura:** coordinar topología y versión candidata, propiedad de archivos, entorno de QA separado, preparación/retorno y cierre con el cliente. Actualizar contexto/plan compartidos con la nueva evidencia; las referencias antiguas MySQL/Settings pendientes no prevalecen sobre el código. Publicación/despliegue y la primera carga real ocurren como pasos concretos posteriores, nunca como efecto de escribir estos contratos.

## Condición de finalización

El piloto se prepara con datos sintéticos y restauración probada; se habilita el entorno clínico solo con sus controles/evidencias y alcance identificado. La primera presentación real la realiza el operador autorizado de la clínica mediante su portal y se registra su comprobante; no se usa clínica para probar fallos, seeds, concurrencia o rollback. Los resultados externos se siguen sin modificar el histórico original ni duplicar la presentación al restaurar una base.

Lo que permanece fuera del cierre inmediato si no resulta necesario para el alcance acordado: CRUD general de roles, borrado administrativo, bulk/XLSX/API_PAYLOAD, Realtime y un cambio completo de Auth. Si se requieren sesiones revocables/refresh, DBR-001 se resuelve expresamente; no se implementa de forma implícita por incorporar Supabase.

Este paquete es documentación de ejecución, no una declaración de que el MVP ya está listo para datos reales. Los responsables entregan archivos y comprobaciones reales; no se suman pruebas de diferentes versiones como una única ejecución fresca.
