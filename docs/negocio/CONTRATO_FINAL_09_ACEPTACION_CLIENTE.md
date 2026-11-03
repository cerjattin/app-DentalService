# NEG-FINAL-09 — Aceptación integral y piloto con el cliente

**Alcance posterior vigente, 2026-11-03:** [NEG-DEP-11](CONTRATO_DESPLIEGUE_11_ACEPTACION_CLINICA.md) cierra la aceptación clínica y UX; [NEG-DEP-12](CONTRATO_DESPLIEGUE_12_ENTORNO_OPERACION.md), el destino. SVB externo queda APLAZADO POR ALCANCE, nunca PASS por omisión. La primera presentación real no se exige para este primer despliegue.

Actualización 2026-11-03: [adenda manual](ADENDA_PORTAL_MANUAL_20261103.md) ajusta UAT-15/16 a captura campo por campo. [Evidencia Backend sintética](../../backend/docs/NEG_FINAL_09_BACKEND_VALIDATION.md); no acredita aceptación clínica.

Fecha: 2026-11-02. Alcance elegido por el usuario: datos reales de la clínica y presentación manual real en portal SVB. Estado: **preparación pendiente de aceptación integral**; el documento define cómo completarla.

## Fases y resultado

1. **QA sintético:** cerrar código, reglas, migraciones y recorrido completo en PostgreSQL dedicado. Las pruebas automatizadas y escenarios de error/carrera/fallo de auditoría ocurren aquí.
2. **Preparación operativa:** completar NEG-FINAL-06/07/08; comprobar el entorno exacto, restauración, usuarios y archivos/formato para el portal.
3. **Piloto clínico controlado:** el operador autorizado de la clínica captura atención real según el alcance acordado. La primera carga SVB se realiza una sola vez por el responsable, con comprobante y registro en la aplicación. No repetir una operación clínica o fiscal real como test destructivo.

Definir con el cliente duración de la ronda, usuarios/profesionales, volumen inicial, servicios/casos admitidos, puestos/dispositivos, responsable de soporte y cómo registrar incidencias. No asumir valores predeterminados para volumen ni activar servicios no comprobados.

## Matriz de aceptación previa al piloto

Cada fila debe quedar **PASS, FAIL o NO EJECUTADO**, con fecha, versión, entorno y evidencia. La matriz se ejecuta primero con fixtures sintéticos; las evidencias reales posteriores se custodian en un lugar protegido, no en el repositorio.

| ID | Escenario | Resultado exigido |
| --- | --- | --- |
| UAT-01 | Login Admin/Recepción/Profesional y permisos efectivos | Acciones correctas; petición directa sin permiso rechazada; ninguna condición por nombre de rol |
| UAT-02 | Aislamiento de organización | IDs ajenos no exponen ni modifican pacientes, documentos, facturas, configuración o declaraciones |
| UAT-03 | Paciente y seguro | Registro/actualización y verificación según API; verificación administrativa no presentada como elegibilidad automática |
| UAT-04 | Cita y recepción | Ubicación, horarios Curazao, solapamiento, cambio de día y transiciones correctos |
| UAT-05 | Caso de tratamiento | Referencia del paciente correcto, ceros preservados, bloqueo tras primera vinculación y snapshot externo correcto |
| UAT-06 | Atención y servicios | Guardar notas, varios procedimientos, quitar/reagregar antes de completar; tarifa exacta por vigencia/moneda |
| UAT-07 | Autorización/remisión/accidente según alcance | Fuente y validación correctas; rechazos de casos no habilitados, sin defaults que oculten ausencias |
| UAT-08 | Completar atención y cita | Estados diferenciados; flujo visible para completar ambos antes de facturar; no pérdida de notas |
| UAT-09 | Factura única y versiones | Una invoice por cita, múltiples ítems, ID/número estables y totales Decimal exactos |
| UAT-10 | Firma real de QA | Preparar, ver contenido, capturar firma, confirmar firmado y cerrar con los permisos adecuados; hash y evidencia verificados |
| UAT-11 | PDF y persistencia | PDF con firma visible y datos congelados; descarga por organización/versión; continúa disponible tras reinicio/restauración |
| UAT-12 | Candidatos y varios lotes | Solo ítems elegibles, paginación real de más de una página, diagnóstico SVB visible, exclusividad concurrente demostrada |
| UAT-13 | Resolver Draft y regresar a Clinical | Varias líneas/lotes: liberar solo uno no basta; liberar todos permite regreso autorizado sin borrar historia |
| UAT-14 | Refacturación completa | Retirar servicio facturado conserva VOID histórico; agregar correcto, completar, reconstruir, nueva firma, cierre y PDF nuevo; firma/PDF antiguos conservados |
| UAT-15 | READY y archivo oficial | Datos completos según fuente; archivo exacto admitido para el portal, sin declarar envío al exportar |
| UAT-16 | Presentación manual en ensayo | Registro sintético de carga, evidencia, idempotencia y conflicto; no adaptador que simule transporte |
| UAT-17 | Respuesta/rechazo | Respuesta vinculada a presentación y líneas correctas; no inferir aceptación/pago ni reenviar líneas aceptadas |
| UAT-18 | Dashboard | Producción, pacientes-día, prestador, versiones sustituidas y disponibilidad de declaraciones conservan las reglas; monedas separadas |
| UAT-19 | UX operativa | Desktop/tablet/móvil de los puestos acordados, teclado/foco, firma, cambios sin guardar, errores en modal y pérdida de conexión |
| UAT-20 | Operación y recuperación | Restauración comprobada, usuarios/expiración/desactivación, documentos, soporte y suspensión operativa disponibles |

La presentación real de UAT-16 se completa únicamente durante la fase 3 autorizada, después de aprobar el ensayo y los prerrequisitos. Guardar el comprobante oficial de esa primera carga y hacer seguimiento del resultado real; no fabricar una aceptación para cerrar la matriz.

## Qué impide iniciar o continuar

No iniciar datos reales si queda un fallo crítico sin resolver en aislamiento/permisos, integridad monetaria/identidad, firma/documentos, exclusividad de asignaciones, migraciones del destino o recuperación. No iniciar presentación real si falta la fuente del archivo/campos obligatorios, el mecanismo de comprobante o el control de presentación duplicada/resultado incierto.

Si un caso de servicio depende de reglas externas sin confirmar, retirarlo del alcance de la ronda con constancia y bloqueo efectivo del servidor, o resolverlo antes. Esa exclusión no permite afirmar que la función completa del MVP fue aceptada. La matriz debe mostrar el alcance real acordado.

Una incidencia crítica durante el piloto suspende nuevas capturas o presentaciones según el impacto, conserva los datos/evidencia y activa al responsable. El retorno no consiste en borrar facturas, firmas o declaraciones. Restaurar un backup tampoco deshace una carga ya realizada en el portal: registrar y reconciliar por separado toda presentación externa antes de reanudar para evitar duplicarla.

## Entregables y asistentes

- **Backend:** evidencia de API, firma/corrección/documentos, portal manual e incidencias; checks frescos e integración dedicada.
- **Base de datos:** diagnóstico/migraciones/roles del destino, concurrencia, backup y restauración verificados.
- **Frontend:** recorrido de navegador completo, permisos, paginación real, errores, caché y archivos por versión; lint/build/tests frescos.
- **Diseño:** revisión de puestos/resoluciones acordados, foco/teclado y controles de firma/confirmación.
- **Lógica de negocio:** matriz observada, fuentes SVB, casos admitidos y diferencias; no sustituir datos ausentes por inferencias.
- **Arquitectura:** versión candidata, entorno, responsables, secuencia de operación y decisión de preparación con el cliente.

La decisión final con el cliente debe revisar una versión candidata concreta, sus resultados y límites. Mantener registro de incidencias con severidad, responsable, estado, reproducción y versión corregida, sin datos clínicos en canales no protegidos. Un cambio posterior que afecte una fila exige repetir las pruebas correspondientes.

## Formato mínimo del cierre

Registrar: versión/commit, fecha, entorno, escenarios PASS/FAIL/NO EJECUTADO, evidencias, limitaciones, respaldo/restauración, responsables, alcance y aceptación del cliente. Separar **listo para comenzar el piloto** de **aceptado por el cliente después de la ronda**. La preparación de estos contratos no aprueba ninguna de las dos fases ni ejecuta una presentación real.
