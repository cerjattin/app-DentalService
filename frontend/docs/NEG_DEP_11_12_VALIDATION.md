# NEG-DEP-11/12 — Frontend, validación local de cierre

Fecha: 2026-11-03. **Entrega parcial: DEP11 no aprobado para uso clínico.** [Contrato](../../docs/negocio/CONTRATO_DESPLIEGUE_11_ACEPTACION_CLINICA.md), [alcance](../../docs/negocio/CIERRE_PRIMER_DESPLIEGUE_20261103.md), [entrega Backend](../../backend/docs/NEG_DEP_10_12.md), [inspección Diseño](../../docs/diseno/NEG_DEP_11_INSPECCION_20261103.md). Esta ronda continúa exclusivamente en QA local. SVB externo **APLAZADO POR ALCANCE**. No modifica los resultados históricos de [07–09](NEG_FINAL_07_09_VALIDATION.md).

## Cambios comprobables

- Readiness compartido autoritativo: false, ausencia, error y refresco revocan nueva preparación/registro. Un true almacenado en caché no habilita durante un refresco fallido. Confirmar preparación consulta de nuevo al servidor antes del POST. Permisos siguen proviniendo del backend; no hay override VITE ni acceso directo a DB desde el producto.
- Mensaje `SVB submission pending — file specification not confirmed.` y portal deshabilitado por defecto. Solo el servidor QA explícito muestra el flujo sintético habilitado. Historial, descarga interna, incertidumbre, liberación y respuesta de hechos existentes permanecen disponibles según permisos. El formulario conserva valores si la capacidad desaparece. Un intento incierto conserva solicitud/clave/documento para replay; el servidor distingue replay de escritura nueva.
- Mapeados `SVB_PRESENTATION_DEFERRED`, `MANUAL_ENTRY_SINGLE_INVOICE_REQUIRED`, `MANUAL_ENTRY_INCOMPLETE_INVOICE` con recuperación en inglés. Se conserva el control Frontend del conjunto completo y el enlace a la versión exacta.
- Clinical incorpora el guard existente de navegación/recarga para notas dirty. Cancelar conserva edición; fallo de guardado conserva nota/guard; guardar correctamente permite salir. No persiste notas ni tokens en almacenamiento del navegador.
- Dialog restaura foco al control que lo abrió cuando sigue conectado; cobertura de Escape y Cancel. Recepción tiene Refresh worklist, estado de actualización/hora Curaçao y refetch al volver a la ventana, sin polling/Realtime ni SLA inventado.
- Errores manuales asociados con aria-invalid/aria-describedby; foco al primer error o adjunto faltante. Los valores y la selección válida se conservan tras fallo. Input admite ref tipado de React 19.
- Patient form usa validación Zod inglesa en lugar del mensaje HTML del navegador. Login conserva destino protegido, query y hash después de autenticar, corrigiendo una carrera que devolvía a Dashboard. Se verificó el destino Clinical en navegador y la versión de invoice mediante regresión automatizada.

## Laboratorio y registros

Se reutilizan la copia `odontho_frontend0709_20261103_test`, loopback 55443, organización 84, cuentas QA existentes y root documental exclusivo `backend/storage/frontend0709-documents`. Credenciales en cache ignorada; no se publican aquí. Sin migraciones, seeds generales, limpieza, cambios de roles/contraseñas ni Supabase clínico.

| Interfaz | API | Configuración |
| --- | --- | --- |
| http://127.0.0.1:5177 | http://127.0.0.1:3408/api/v1 | QA clínico local, SVB_MANUAL_RECORDING_ENABLED=false |
| http://127.0.0.1:5178 | http://127.0.0.1:3409/api/v1 | NODE_ENV=test + flag=true explícito; exclusivamente ensayo sintético |

El segundo servidor carga la entrega Backend actual. Preparación parcial recibe 409 INCOMPLETE_INVOICE; al añadir la segunda línea permite PREPARED. [Reensayo FE-07-01](../../docs/frontend/evidence/dep11-20261103/fe0701-retest.json): invoice 235/version 250/items 299–300, Draft 139/preparation 55. Fixture CLOSED técnico explícito, **no firma ni factura clínica probada**. No se modifican invoices firmadas 232/v246/v247 ni sus documentos. Draft 139 conserva reserva PREPARED para continuar la carga; no se creó submission por navegador.

Se creó organización ajena 86 con recursos reales: paciente 289, cita 343, invoice 233, caso 21, documento 158 y declaración 138. Su autor de fixture permanece INACTIVE y sin roles; no hay nueva cuenta de acceso. [26 comprobaciones HTTP PASS](../../docs/frontend/evidence/dep11-20261103/access-isolation-deferred.json): permisos efectivos de ADMIN/RECEPTION/PROVIDER; lectura/escritura ajena 404; prepare ajeno 404 antes del gate; prepare propio nuevo 409 DEFERRED; historial 135/submission 23/22 resultados retenidos; versión 247/ANG 2042.40 preservada. La prueba de aislamiento ahora usa IDs existentes, no IDs supuestos.

Atención sintética abierta 346/encounter 317 para notas/teclado; no se completó ni firmó. Paciente nuevo 290 / QA-DEP11-P-000001: creación/edición, ciudad actualizada, email y país inválidos sin perder campos. Seguro QA con insured ID `000000011`, fechas inválidas corregidas, alta, verificación rotulada sintética y edición hasta 2027-12-31. Verificación administrativa no acredita elegibilidad real.

## Estado de hallazgos Diseño

| Hallazgo | Resultado de esta entrega | Evidencia y límite |
| --- | --- | --- |
| DES-01 P1 notas al navegar | Corregido y reensayado para enlace/sidebar/cancelar/guardar | [Aviso real a 1440](../../docs/frontend/evidence/dep11-20261103/notes-navigation-protected-1440.jpg); nota retenida al cancelar ambas salidas y guardada después. Regresión con data router prueba fallo de save/guard/reload/éxito. Back real y recuperación al expirar sesión aún pendientes de navegador. |
| DES-02 P2 foco Escape | Corregido y reensayado en Add procedure | [Foco BUTTON Add procedure](../../docs/frontend/evidence/dep11-20261103/modal-focus.json), [errores tablet](../../docs/frontend/evidence/dep11-20261103/procedure-validation-tablet768.jpg); Enter abre, error enfoca seguro, Escape devuelve al disparador. Firma/corrección/confirmación anidada pendientes del reensayo visual afectado. |
| DES-03 P2 frescura Reception | Control manual y hora implementados; prueba parcial | [Refresh por Recepción](../../docs/frontend/evidence/dep11-20261103/reception-permissions-refresh.jpg). Falta prueba visual antes/después de cambio desde otro puesto. Sin garantía automática de latencia. |
| DES-04 P2 errores adjunto | Corregido; falta carga binaria visual | [Adjunto faltante con foco](../../docs/frontend/evidence/dep11-20261103/manual-missing-evidence.jpg); aria y conservación al deshabilitar cubiertas por test. Selección/carga efectiva bloqueada por herramienta. |

Frontend registra este reensayo; no modifica el dictamen independiente de Diseño ni le atribuye aprobación.

## Matriz UAT actual y aplicabilidad

| ID | Aplicabilidad primera entrega | Estado actual | Evidencia / pendiente concreto |
| --- | --- | --- | --- |
| 01 | Clínica | PARCIAL | Admin: CRUD y ciclos anteriores; Recepción: cola/acciones y ausencia de Users; Profesional: pacientes de lectura, sin Create, Clinical abierto y acciones permitidas, sin Declarations. [Recepción administración](../../docs/frontend/evidence/dep11-20261103/reception-admin-limits.jpg), [Profesional](../../docs/frontend/evidence/dep11-20261103/provider-patient-readonly.jpg). Falta cerrar recorrido integral de cada perfil. |
| 02 | Seguridad | API PASS / UX PENDIENTE | Segunda organización existente y 26 checks, IDs arriba. Falta navegador de deep links ajenos sin fuga. |
| 03 | Clínica | PASS sintético | Alta/edición paciente/seguro/verificación y errores conservando valores. [Paciente](../../docs/frontend/evidence/dep11-20261103/patient-validation-keeps-values.jpg), [fechas](../../docs/frontend/evidence/dep11-20261103/insurance-date-error.jpg), [seguro](../../docs/frontend/evidence/dep11-20261103/patient-insurance-verified.jpg). |
| 04–06 | Clínica | PASS histórico conservado + reensayo notas | No repetir firmas ni modificar snapshots para ampliar evidencia. |
| 07 | Clínica / exclusiones SVB | PENDIENTE | Criterio definido en [Negocio: UAT-07 QA local](../../docs/negocio/CONTRATO_DESPLIEGUE_11_ACEPTACION_CLINICA.md#criterio-de-negocio-para-uat-07-en-qa-local): servicio ordinario válido permite; autorización ausente/ajena/vencida/sin saldo rechaza sin consumo parcial, válida consume/libera/reagrega una vez; requiresReferral bloqueado/excluido, altas de accidente/remitentes no publicadas excluidas, contexto legado solo guardas API. Falta ejecutar/evidenciar y aceptación del alcance real por clínica; no falta definir el criterio QA. |
| 08–10 | Clínica | PASS histórico conservado | Atención, factura única y dos firmas QA autorizadas, sin repetición en esta ronda. |
| 11 | Clínica | API/PDF histórico PASS; descarga navegador PENDIENTE | Se conservan hashes y PDF de ambas versiones. Falta descarga desde navegador de la versión exacta con verificación. |
| 12–14 | Clínica / técnico interno | PASS histórico conservado | Candidatos/concurrencia, dos bloqueos y retorno/refacturación conservados. Reensayo afectado de foco en corrección pendiente. |
| 15 | SVB externo | APLAZADO POR ALCANCE | No hay formato/estructura oficial aceptada; no es PASS. |
| 16 | Ensayo QA manual / SVB externo aplazado | FE-07-01 PASS; UI PARCIAL | 409 de incompleta y preparación completa comprobados contra Backend nuevo. Validación de comprobante faltante visible; adjunto/registro por navegador no ejecutados. Histórico FAIL permanece en informe original. |
| 17 | Ensayo QA manual / SVB externo aplazado | API histórico PASS / UI PENDIENTE | Resultado por línea/idempotencia existentes conservados. Falta carga/respuesta/refresco visual; ningún recibo sintético se presentó como real. |
| 18 | Clínica | PASS histórico conservado | Dashboard conserva ANG 2042.40 y una invoice cerrada. |
| 19 | Clínica / accesibilidad | PARCIAL | Desktop 1440×900 aviso; tablet 768×1024 modal/error/foco; [portátil 1280×720](../../docs/frontend/evidence/dep11-20261103/clinical-laptop1280.jpg), DOM scrollWidth 1274 <= viewport1280. Falta matriz integral, Tab/Shift+Tab, zoom200%, sesión expirada y desconexión reales. Medidas técnicas no certifican dispositivos cliente. |
| 20 | Operación | LOCAL PARCIAL / DESTINO POSTERIOR | Build/lint/tests/manifiesto local. Host/bucket/smoke HTTPS/operadores/aceptación cliente en fase posterior por decisión local-only; no PASS de despliegue. |

## Límite de herramienta reproducido

Se completó formulario QA de Draft139 con referencia y motivo `SYNTHETIC...NO-PORTAL`, se comprobó el error por falta de evidencia y los valores retenidos. No se pulsó registro válido ni el enlace externo. FileChooser/setFiles falló por acceso a file URLs deshabilitado en la extensión Chrome. Al inspeccionar la alternativa nativa, Computer Use terminó porque no podía verificar la URL con suficiente certeza. No se cambió la configuración de seguridad ni se automatizó por otra vía. La selección/subida y descarga visual quedan pendientes, aunque existan pruebas de API y componentes.

Instrucción de recuperación indicada por la herramienta (requiere actuación del usuario si decide habilitarla): To enable file upload, open chrome://extensions, click Details under the ChatGPT browser extension, and enable "Allow access to file URLs." See [here](https://developers.openai.com/codex/app/chrome-extension#upload-files) for details.

La última dimensión temporal del navegador fue 1280×720; no se pudo restablecer mediante UI tras la interrupción. No se dejan marcados tabs QA para entrega. Las instancias locales siguen disponibles mientras sus procesos permanezcan activos; los formularios no guardados no son evidencia persistida.

## Archivos y validaciones

Producto: `src/features/svb-readiness/use-svb-pilot-readiness.ts`, `svb-pilot-notice.tsx`, `src/features/declarations/manual-portal-workflow.tsx`, `manual-entry-panel.tsx`, `manual-entry-dialog.tsx`, `src/api/error-messages.ts`, `src/components/app-shell/environment-notice.tsx`, `src/features/clinical/clinical-appointment-page.tsx`, `src/components/ui/dialog.tsx`, `input.tsx`, `src/features/reception/reception-page.tsx`, `src/features/patients/patient-form-dialog.tsx`, `src/features/auth/login-page.tsx`. Tests: `dep11`, `clinical`, `manual-entry`, `foundation`, `declarations`, `neg-final-06`, `neg-final-07-09`, fixture `svb-readiness`.

- Propios: lint PASS exit0; build final PASS exit0 (TypeScript + Vite, 2200 módulos); 53/53 Clinical/manual y 2/2 disponibilidad/foco PASS en corridas enfocadas. La corrida completa propia anterior tuvo 378 PASS y un test antiguo de enlace portal que esperaba disponibilidad sin readiness; se actualizó al contrato aplazado y se revalidó con la corrida independiente siguiente.
- Negocio ejecutó de forma independiente lint PASS y suite completa **379/379 PASS, 16 archivos**, sobre huella de inputs `036cdc50a6468f31f2f766bd540073ec3c3c0b1f10875e69d316f0c89a3a88ae`, igual antes/después. No se atribuye como nueva corrida completa de Frontend ni se suma a pruebas de otras áreas.
- [Manifiesto de fuente/build por archivo](../../docs/frontend/evidence/dep11-20261103/frontend-build-manifest.json): agregado fuente `cf4dc2837fc83da743eced978bddbea5c8068081fc7de6d775dac1363d9cc0e1`, agregado build `33d974209ebd818443fced66ea503dcf2812c1e227d59924ecdb4fbcfca61ba9`. Algoritmo propio de manifiesto distinto del agregado de Negocio; no comparar hashes como si fueran el mismo algoritmo. Build local no es artefacto de despliegue configurado/aceptado.
- `git diff --check -- frontend docs/frontend/README.md` PASS, solo avisos CRLF. Enlaces locales del informe comprobados. No dependencias nuevas, commits, push, reset, migraciones ni despliegue.

La [comparación documental posterior](../../docs/frontend/evidence/dep11-20261103/documentary-source-check.json) verifica cero cambios en los inputs del build propio y en los 173 archivos Frontend del candidato de Arquitectura `dep12-092a67db50d812ff`. Ese candidato ya incluye estas fuentes; no exige otra compilación de Frontend por esta aclaración documental. Arquitectura conserva la verificación del conjunto de áreas y la vinculación final de sus informes; recaptura si cambian inputs. Próxima continuación: recuperar control fiable, terminar carga/descarga y roles/aislamiento visual; UAT07 y DES03; teclado/zoom/desconexión/expiración; reensayo de Diseño. Se conserva todo el trabajo y la evidencia histórica. No se cierra DEP11 por tener suites verdes.


## Continuación documental — criterio UAT-07 y ejecución manual

Se leyó la sección nueva [Criterio de Negocio para UAT-07 en QA local](../../docs/negocio/CONTRATO_DESPLIEGUE_11_ACEPTACION_CLINICA.md#criterio-de-negocio-para-uat-07-en-qa-local). La definición queda vinculada a la fila07; su estado sigue PENDIENTE de ejecución/evidencia, no pendiente de aclaración de reglas. La guía de ejecución [MANUAL_QA_DEP11.md](MANUAL_QA_DEP11.md) identifica laboratorio, precondiciones, resultados esperados de adjunto/descarga, recuperación y evidencia mínima. Es un procedimiento **no ejecutado**, no una nueva prueba aprobada.

Esta continuación solo cambia documentación y añade comparación de hashes de lectura. Sin cambios de producto/configuración/DB ni nueva suite: se conservan las validaciones anteriores con su procedencia y se verifican enlaces/diff. El candidato 092a tiene los mismos inputs Frontend; la aceptación visual continúa bloqueada y no se habilita publicación.
