# Atención, facturación e importación de Dentalink

Decisión del 6 de noviembre de 2026. El usuario informó que la aplicación ya está desplegada. Este cambio se prepara en el repositorio y se valida en QA sintético local. La aplicación organiza citas, registra servicios prestados y factura con firma del paciente. El historial médico anterior se conserva para compatibilidad de datos. El nuevo recorrido profesional presenta el catálogo y los servicios de la atención.

| Etapa | Perfil | Resultado |
| --- | --- | --- |
| Agenda | Recepción o Admin | Crea la cita manualmente, confirma, reprograma antes de iniciar o cancela. El inicio profesional parte de una cita confirmada. |
| Atención | Profesional o Admin | Inicia la atención, selecciona servicios, indica cantidad y puede retirar/reagregar antes del cierre. |
| Entrega | Profesional o Admin | Cierra la atención y la cita en una transacción cuando existe al menos un servicio prestado. La cita completada queda disponible en Recepción. |
| Facturación | Recepción o Admin | Genera la factura, revisa el importe y captura la firma del paciente. Los pasos de preparación, confirmación y cierre de la versión conservan su auditoría. |
| Seguimiento | Perfiles autorizados | Consultan actividad, facturación, versiones y declaraciones según permisos. El envío SVB sigue sujeto al formato y al contrato de radicación pendientes. |

## API y persistencia

- `POST /api/v1/appointments/:appointmentId/clinical-encounter/start` admite cuerpo vacío. Requiere `appointment.start` y `encounter.create`. Pasa CONFIRMED a IN_PROGRESS y crea una atención OPEN en la misma transacción. Admite citas legadas CHECKED_IN o IN_PROGRESS. Repetir sobre una atención ya abierta devuelve la misma atención.
- `POST /api/v1/clinical-encounters/:id/procedures` acepta `{ svbProcedureId, quantity? }` con IDs y cantidad decimal como strings. El valor inicial de cantidad es `1.00`. Registra el código, descripción, profesional y fecha con datos del servidor. La captura separa los requisitos de autorización, remisión, seguro y precio del registro de lo prestado. El cuerpo anterior con `patientInsuranceId` mantiene sus reglas para clientes anteriores. El DTO devuelve `null` para seguro, tarifa, moneda e importes aún sin valorar.
- `DELETE /api/v1/clinical-encounters/:id/procedures/:procedureId` sigue disponible con la atención OPEN. El retorno autorizado de una factura conserva versiones y líneas históricas. Retirar una línea ya vinculada al historial deja el registro VOID según el contrato previo.
- `POST /api/v1/clinical-encounters/:id/finish-services` admite cuerpo vacío. Requiere `encounter.complete` y `appointment.complete`. Completa ambos estados y devuelve 409 `ATTENTION_SERVICES_REQUIRED` si faltan servicios prestados. Una corrección mantiene la cita completada y vuelve a cerrar la atención. Una cita legada con atención ya completada puede terminar la entrega pendiente.
- `POST /api/v1/appointments/:appointmentId/invoice` acepta cuerpo vacío o `{ patientInsuranceId?, currencyCode? }`. Selecciona la cobertura activa del paciente a fecha de servicio si hay una sola. Usa la moneda común si es única. Recepción indica la cobertura o moneda ante ambigüedad. Resuelve la tarifa activa por servicio, fecha de cita en Curaçao y moneda. Los importes se calculan con Decimal, redondeo por línea a dos decimales y numeración transaccional. Si faltan datos administrativos, los servicios siguen registrados y puede reintentarse la facturación. La refacturación conserva seguro, moneda, número e historial de la factura.
- La migración `20261106000000_service_attention` admite captura con los seis campos de valoración vacíos o completos. Actualiza los permisos del rol incorporado PROVIDER para que Recepción y Admin ejecuten la factura y la firma. Los permisos efectivos siguen siendo la autoridad. El despliegue requiere aplicar la migración al destino correspondiente en su ventana de operación.
- Dashboard agrega atenciones completadas y unidades por profesional, medidas por inicio de atención en `America/Curacao`. Cuenta atención y cita completadas con al menos un servicio PERFORMED. Los registros sin valorar se reflejan en volumen, mientras los importes provienen de registros ya valorados. Conserva los indicadores y gráficos existentes y separa monedas. Facturación y radicación tienen sus estados de negocio propios.

## Dentalink

La clínica confirmó que aún no tiene habilitada la API. Dentalink ofrece una integración con costo asociado y la creación de clientes de API corresponde a la cuenta administradora. [Guía oficial de integración](https://ayuda.softwaredentalink.com/es/articles/9493507-integracion-api).

El contrato preparado es una importación de lectura hacia la organización local. El backend será el único consumidor del token. La primera entrega propone vista previa y confirmación de importación por un operador autorizado. La frecuencia automática y el tratamiento de actualizaciones externas requieren la revisión del contrato técnico con la clínica.

| Objeto | Datos previstos | Reglas de importación |
| --- | --- | --- |
| Paciente | ID externo, nombre y apellidos y campos administrativos disponibles con permiso | Identidad única por organización, cuenta externa y paciente Dentalink. Si hay posible coincidencia con un paciente local, requiere revisión explícita. |
| Cita | ID externo, referencia de paciente, profesional, sede e inicio/fin | Vincula profesional y sede mediante una tabla de correspondencias de la organización. En el alcance inicial incorpora citas nuevas en SCHEDULED para confirmación local. Un solapamiento, referencia desconocida o estado externo sin mapa va al resumen de incidencias. |
| Ejecución | Ventana, páginas, identidad de cuenta y resultados | Reintentos idempotentes con restricciones únicas y persistencia atómica de vínculo y registro. Una página incompleta mantiene su punto de reanudación. La ejecución audita conteos y motivos sin payloads de pacientes ni tokens. |

Cuando la clínica habilite la API, verificar en la [documentación técnica oficial](https://api.dentalink.healthatom.com/docs/) y con ejemplos anonimizados el método de autenticación, recursos, campos obligatorios, paginación, zona horaria de las citas, estados y filtros de creación/modificación. Confirmar qué valores de Dentalink identifican a cada profesional/sede local. El token se configura en el entorno del backend. La primera prueba de conexión requiere una cuenta o muestra autorizada y un QA separado para validar duplicados, reintentos, solapamientos y aislamiento. Estado actual de esta parte **contrato preparado, conector pendiente de acceso y especificación técnica verificable**.
