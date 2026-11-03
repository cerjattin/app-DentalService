# NEG-DEP-11 — Aceptación clínica y UX para la primera entrega

Fecha: 2026-11-03. Estado inicial: PENDIENTE. Frontend implementa/prueba; Diseño inspecciona y entrega hallazgos; Negocio valida reglas; Arquitectura integra el cierre. [Alcance vigente](CIERRE_PRIMER_DESPLIEGUE_20261103.md).

## Resultado

Completar la [matriz existente](../../frontend/docs/NEG_FINAL_07_09_VALIDATION.md) en QA sintético, conservando PASS, FAIL y NO EJECUTADO históricos. Añadir columna de aplicabilidad a la primera entrega: SVB externo = **APLAZADO POR ALCANCE**, no PASS; funciones clínicas/seguridad/operación permanecen exigibles. No repetir lo ya probado salvo cambios, fallos o dependencia real.

## Trabajo Frontend

1. UAT-01: recorrido visual real de Admin, Recepción y Profesional con sus permisos. Admin puede hacer recepción, atención, retirar/agregar servicio con encounter OPEN y retornar factura a Clinical para refacturar. Confirmar que los otros perfiles no adquieren permisos por mostrar controles; documentar matriz efectiva del servidor.
2. UAT-02: segunda organización sintética existente, IDs ajenos **que sí existan** para paciente/cita/factura/caso/documento/declaración; rechazos API y UX sin revelar datos. Un 404 para un ID inexistente no prueba aislamiento.
3. UAT-03: alta/edición paciente y seguro, selección correcta y errores sin perder cambios. Tarifas/catálogos de QA se rotulan sintéticos; definir con clínica qué maestros permiten atención real sin inventarlos.
4. UAT-07: comprobar bloqueos y mensajes de servicios con autorización/remisión/accidente no soportados. Distinguir requisito necesario para atención clínica de campo destinado solo a SVB; no bloquear todo el MVP por el archivo, ni permitir un requisito clínico necesario sin solución. Negocio/Arquitectura registran explícitamente los casos excluidos.
5. DEP10: integrar capacidad/error publicados por Backend; verificar API rechaza factura incompleta y UI ofrece recuperación. Con SVB aplazado, nuevos registros/presentaciones no se habilitan. Historia y resolución de reservas existentes se conservan.
6. UAT-16/17: completar carga binaria, comprobante, errores visibles, replay y refresco de respuesta **solo en QA habilitado**; probar el modo aplazado del piloto. No realizar captura externa en portal ni usar un recibo ficticio como real. El flujo real queda APLAZADO aunque el ensayo sintético pase.
7. UAT-11/19: terminar adjunto y descarga mediante navegador, PDF de versión exacta, teclado/foco, sesión expirada, desconexión sin éxito ficticio ni doble operación. La comprobación HTTP de bytes es evidencia complementaria, no sustituto de la interacción visual pendiente.
8. Mantener regresión del retorno Clinical → quitar/agregar → completar atención → reconstruir misma factura → firma nueva → cierre/PDF, conservando hashes/documentos antiguos. Ya existe evidencia de dos ciclos; repetir solo lo afectado por los cambios de esta entrega.

## Trabajo Diseño

Inspeccionar la aplicación real de QA, con datos sintéticos y el sistema visual actual. Matriz mínima: escritorio 1440×900, portátil 1280×720 y tablet 768×1024, más los puestos concretos que acuerde la clínica. Estas medidas son cobertura técnica propuesta, no certificación de dispositivos del cliente. Revisar zoom 200%, teclado/foco, etiquetas/errores de modal, firma, notas sin guardar, tablas, acciones por permisos y claridad del aplazamiento SVB.

Entregar hallazgos reproducibles con pantalla, ancho, rol/permiso, pasos, esperado/actual, severidad y evidencia protegida en `docs/diseno/`. No editar componentes, tokens o pruebas de Frontend mientras ese chat los modifica. Frontend corrige los problemas bloqueantes y registra su verificación; no abrir un rediseño ni crear Figma para aprobar una UI aún no probada.

## Laboratorio y comprobaciones

Coordinar versión/capacidades con Backend y entorno con Arquitectura en archivos de entrega. Usar una DB dedicada y root documental propio, sin compartir el directorio que limpian suites ajenas. No resetear el laboratorio existente ni recrear credenciales/cuentas sin necesidad. La autorización de este encargo incluye los recorridos QA sintéticos y firmas rotuladas como prueba; no firmas ni actuaciones externas reales. Preservar evidencia anterior.

Frontend: lint/build/tests pertinentes, navegador y matriz por rol; Backend soporta sus fallos API en su área. Si la herramienta de navegador no puede controlar de manera fiable la página, mantener NO EJECUTADO con el punto exacto y buscar otro medio disponible; no declarar aprobado por una captura previa. Diseño entrega inspección con evidencia y enlace a arreglos, separando comprobado de pendiente.

Cierre: ninguna incidencia alta de integridad, permisos, pérdida de datos o descarga pendiente en el alcance clínico; UAT-01/02/03/19 completas y UAT-07 con alcance soportado/excluido explícito; UAT-16/17 sintéticas y aplazamiento real diferenciados; UAT-20 se cierra con NEG-DEP-12. Aceptación cliente ocurre después del despliegue y no se inventa por aprobar tests locales.

## Criterio de Negocio para UAT-07 en QA local

Se concreta el alcance de prueba sin esperar archivo SVB ni aprobar servicios reales de clínica. No cambia las reglas implementadas:

| Escenario sintético | Resultado esperado |
| --- | --- |
| Servicio sin autorización ni remisión requeridas, con tarifa vigente única, paciente/seguro/prestador/sede correctos | Permite captura con snapshots existentes y Decimal strings; no rellena NumberOfTreatments/Assistance para lograr READY |
| Servicio requiresAuthorization=true sin autorización aplicable | Bloquea; conserva formulario y muestra PROCEDURE_AUTHORIZATION_REQUIRED u otro error específico autoritativo |
| Servicio requiresAuthorization=true con autorización válida, propia y con saldo suficiente | Captura consume solo la cantidad correcta; retirar/reagregar en encounter OPEN libera/consume una sola vez según el flujo existente |
| Autorización ajena, de otro seguro/contexto, vencida o sin saldo | Rechaza sin consumo parcial ni captura; no sustituye por un valor manual |
| Servicio requiresReferral=true | Queda excluido de captura mientras continúe SVB_REFERRAL_FLOW_NOT_SUPPORTED; no aceptar referrerId libre ni desmarcar la regla para pasar |
| Accidente nuevo, remitente/evidencia o configuración cuya captura no está publicada | Excluido de esta ronda; no crear contexto ficticio ni tratarlo como atención ordinaria para evitar el requisito |
| Contexto de accidente legado leído/vinculado por API | Solo comprobar las guardas existentes de paciente/seguro/organización en QA; no acredita el alta/gestión integral de accidentes ni su aceptación real |

La exclusión es de funcionalidad del piloto, no una afirmación sobre qué atención debe recibir un paciente. Para uso real, clínica/operación identifican los servicios y tarifas que ya tengan fuente autorizada y pueden ejecutarse con estos controles; si un caso requiere un flujo excluido, no se registra como si no lo necesitara. La fuente de identidad fiscal y las correcciones históricas siguen en el plan DB. No se aprueba un servicio clínico ni una tarifa por ser un fixture de prueba.

UAT-07 ya tiene criterio de Negocio explícito; el estado pendiente restante es **ejecución/evidencia del escenario y aceptación del alcance real con clínica**, no una autorización para inventar semántica SVB. Los campos destinados a SVB y no confirmados permanecen como diagnóstico y fase aplazada. Ningún resultado positivo de QA se usa para habilitar el portal.
