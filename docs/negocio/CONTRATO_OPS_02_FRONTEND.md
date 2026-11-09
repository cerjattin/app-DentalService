# OPS-02 Frontend

Iniciar modificaciones locales desde el código actual. Leer el [contrato común](CONTRATOS_OPERACION_20261107.md), el [recorrido y API publicados](CONTRATO_ATENCION_FACTURACION_DENTALINK_20261106.md), frontend/AGENTS.md y backend/docs/FRONTEND_HANDOFF.md. Frontend mantiene la escritura inicial de componentes y pruebas frontend. Diseño produce un informe independiente.

## Operación

Completar la navegación de Recepción y Admin para crear, confirmar, cancelar y reprogramar citas antes del inicio. Preservar la creación compartida de citas y la caché/API compartida del catálogo SVB. Mostrar datos administrativos útiles para reconocer paciente, profesional, fecha, sede y estado.

Verificar la atención desde una cita confirmada. La vista profesional muestra servicios prestados y cantidad. Permite retirar y reagregar errores antes del cierre. El cierre debe llevar la cita a la cola de facturación de Recepción. Actualizar las cachés de cita, atención, listados, Recepción y dashboard para reflejar cada transición. Tratar errores y datos modificados desde otro puesto de forma recuperable.

Revisar todas las entradas activas a la atención para que el recorrido profesional prescinda de diagnósticos, notas médicas, remisiones, autorizaciones, seguros y tratamientos como pasos de captura. Evitar borrar historial anterior por simplificar una pantalla.

Recepción crea factura y captura firma. Ante cobertura/moneda ambigua o tarifa ausente, presentar el mensaje administrativo y permitir reintento conservando servicios. Las firmas se vinculan al contenido y versión exactos. Verificar regreso autorizado de Admin a atención, retiro/reagregado, reconstrucción y nueva firma. Representar permisos efectivos con guardas acordes con el backend.

Conservar reportes/gráficos existentes y completar la presentación de volumen de atenciones y unidades por profesional. Explicar el período de medición y el estado que representan los importes. Mantener monedas separadas.

## Dentalink y dependencias

La clínica carece de API habilitada. El módulo Backend y sus DTO se están preparando en OPS-01 y OPS-03. Integrar la configuración de estado, vista previa, incidencias y confirmación únicamente cuando esas rutas estén realmente publicadas en el handoff. Hasta entonces, documentar la dependencia en la entrega y avanzar con atención/facturación. La ausencia de conexión debe quedar explícita para el operador.

El frontend consume el backend. Credenciales, token Dentalink y tablas permanecen en el servidor. Una conexión deshabilitada no puede mostrar contadores simulados como si fueran resultados reales. Los pacientes/citas importados deben usar los mismos componentes operativos que los registros manuales.

## Aceptación

Ejecutar lint, build y pruebas relevantes después de cambios. Cubrir permisos de los tres perfiles, captura sin requisitos médicos/administrativos, retiro/reagregado, entrega a Recepción, errores de facturación y caché. Preparar un guion de navegador con fixtures sintéticos propios para Diseño.

Actualizar docs/frontend/README.md y entregar `docs/frontend/OPS_02_ENTREGA.md` con archivos, verificaciones actuales, pendientes y rutas. Coordinar cualquier escritura de Diseño en componentes antes de realizarla. Los checks del 6 de noviembre corresponden a esa versión y no acreditan ediciones posteriores.
