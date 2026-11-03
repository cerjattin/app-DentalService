# Ejecución manual pendiente — QA Frontend DEP11

Fecha: 2026-11-03. Procedimiento preparado, **NO EJECUTADO**. [Matriz y bloqueos vigentes](NEG_DEP_11_12_VALIDATION.md). Puede realizarlo un operador humano con el navegador/selector nativo normal; no exige automatizar fuera del control permitido ni cambiar permisos de la extensión. No abrir el portal SVB.

## Comprobar el laboratorio antes de escribir

1. Usar únicamente la copia sintética `odontho_frontend0709_20261103_test` y su root propio `backend/storage/frontend0709-documents`. No crear cuentas, volver a firmar facturas ni ejecutar semillas/migraciones/limpieza. Cuentas QA existentes custodiadas localmente; no copiar credenciales ni tokens a evidencias.
2. Comprobar que API y frontend locales estén disponibles. Clínico: `http://127.0.0.1:5177` → API3408, `manualPortalRecordingEnabled=false`. Ensayo manual: `http://127.0.0.1:5178` → API3409, NODE_ENV=test + flag explícito true en DB loopback `_test`. El aviso QA debe ser visible y organización84. Si no coincide, detener la prueba y revisar configuración; una variable VITE o un rol Admin no habilitan la API.
3. Abrir `/declarations/139` en 5178. Reconciliar historia antes de actuar: se dejó Draft `FEc32b1c3e-000007`, preparación55 PREPARED, factura técnica235/v250, dos líneas, ANG24.60, sin submission. Si ya fue registrada o liberada por otro ensayo, usar su historia y no repetir una presentación ni recrear el fixture. [Estado al cierre](../../docs/frontend/evidence/dep11-20261103/fe0701-retest.json).
4. La invoice235 es fixture CLOSED técnico, no una factura firmada clínica. Factura232/v246/v247 y sus firmas/PDF se mantienen sin edición/regeneración. El archivo de evidencia disponible es `C:\workspace\app-DentalService\frontend\node_modules\.cache\neg-func-qa\SYNTHETIC-DEP11-NO-PORTAL.jpg`: captura sintética de aplicación, no comprobante ni respuesta oficiales.

## Adjunto y registro sintéticos — UAT16 / DES04

1. Abrir Record portal entry. Completar fecha/hora simulada válida en America/Curacao, referencia `SYNTHETIC-DEP11-NO-PORTAL` y motivo que explique que no hubo presentación externa y es exclusivamente QA local. Las confirmaciones se ensayan como parte del fixture sintético; no acreditan un hecho real.
2. Antes de adjuntar, intentar registrar. Esperado: error de evidencia dentro del modal, foco en el control correspondiente, aria-invalid/aria-describedby y valores conservados; ningún registro creado. Este punto ya tiene captura, no repetirlo para sustituir el fallo de carga.
3. Seleccionar con el selector nativo el JPG sintético indicado. Comprobar nombre/selección visibles y ausencia del error anterior. Para escenarios inválidos, usar únicamente archivos sintéticos vacíos, de tipo no admitido o mayores de4MB: deben rechazarse con explicación y foco recuperable. No usar archivos personales.
4. Con evidencia válida, guardar una sola vez. Esperado: carga privada al backend local, modal cierra tras éxito, expediente muestra RECORDED, submission/receiptDocumentId y hash; declaración refrescada y nueva preparación bloqueada. Registrar los IDs/estado/hora observados, sin tokens. No abrir ni registrar nada en SVB.
5. Si hay timeout/desconexión, no suponer éxito ni crear otro intento. Revisar primero el expediente; la aplicación conserva la solicitud/clave/documento de Retry same record. Reintentar solo esa solicitud o reconciliar el registro ya presente. Esperado: mismo submission/documento, sin duplicar. Ante una respuesta que no permita saber el estado, conservar reserva e incertidumbre y dejar el escenario pendiente.

## Resultado sintético — UAT17

1. Solo después de confirmar el submission existente, abrir Record SVB result. Para las dos líneas técnicas, elegir explícitamente un resultado por línea, una Accepted y otra Rejected; Overall Partially rejected y código `SYNTHETIC-QA-REJECTION` en la rechazada. Fecha/referencia/motivo dejan claro que es respuesta simulada, no decisión de SVB.
2. Adjuntar captura sintética por selector nativo, confirmar revisión y guardar una sola vez. Esperado: resultado global y ambas líneas visibles después del refresco, hash/documento de respuesta propios, sin inferir pago. Si ya hay resultado, no sobrescribir: revisar su evidencia.
3. Si falla la respuesta, reconciliar y usar Retry same record con el contenido/clave retenidos. No cambiar líneas/documento para aparentar replay. Registrar IDs y ausencia de duplicación. La cobertura API previa no sustituye esta comprobación visual.

## Descargas de documentos existentes — UAT11/19

1. Descargar recibo y respuesta desde sus controles de evidencia; verificar que el navegador crea un archivo accesible y sus bytes/hash coinciden con el documento que muestra el expediente. Guardar screenshot de estado/control y evidencia local del archivo/hash, sin rutas de documentos clínicos.
2. Abrir en 5177 `/invoices/232?versionId=247`; después del login debe conservar esa versión. Usar descarga del PDF existente153, sin regenerarlo ni volver a firmar. Inspeccionar firma QA visible, cantidad corregida2.00 y total ANG2042.40.
3. Repetir lectura/descarga de la versión histórica246, documento151, total ANG1953.60. Conservar ambos archivos con nombres diferentes. No sustituir los originales.

| Documento existente | Tamaño esperado | SHA-256 esperado |
| --- | --- | --- |
| v1 /151 | 331117 bytes | d65d0da03b08a429ce209674c407751ac45673603b2d17b3e317a48be67dba36 |
| v2 /153 | 361707 bytes | 5674b68544c3dde4c9c3ed6dcb1d2d25277332570eef6e56853ab80f2ea9bf22 |

Fuentes: [v1](../../docs/frontend/evidence/uat-20261103/isolated-invoice-v1.json), [v2](../../docs/frontend/evidence/uat-20261103/isolated-invoice-v2.json). Comparar el archivo realmente descargado, no una copia que ya estuviera en evidencia. La generación/descarga por API anterior no cierra esta fila.

## Modo SVB aplazado

En 5177/API3408 verificar false: portal deferred, preparar/registrar nuevo deshabilitados. Revisar expediente135 con submission23 y sus22 resultados históricos: debe seguir consultable/descargable. Resolución de reservas existentes se mantiene según permisos y exige evidencia cuando procede; no liberar una reserva inventando que se comprobó un hecho externo. Verificar que tampoco Admin habilita una escritura nueva. Ningún resultado QA habilita SVB real.

## UAT07: criterio definido y ensayo pendiente

Aplicar exactamente [la tabla de Negocio](../../docs/negocio/CONTRATO_DESPLIEGUE_11_ACEPTACION_CLINICA.md#criterio-de-negocio-para-uat-07-en-qa-local). Usar fixtures rotulados sintéticos con tarifa vigente única; no editar flags/tarifas reales para superar una guarda. Registrar para cada escenario estado antes/después y error del servidor, sin consumo parcial:

- Servicio ordinario sin requisitos: captura válida con snapshots/Decimal strings, campos SVB no confirmados sin defaults.
- Autorización requerida: ausencia/ajena/otro contexto/vencida/sin saldo rechazan; autorización válida consume cantidad exacta, retirar en OPEN libera y reagregar consume una vez.
- requiresReferral: bloqueado con SVB_REFERRAL_FLOW_NOT_SUPPORTED y formulario conservado; excluido mientras no exista captura autorizada soportada.
- Alta de accidentes/remitentes/evidencia/configuración no publicada: excluida. Contexto legado solo guardas API de paciente/seguro/organización, sin atribuir alta integral ni aceptación real.

Clínica debe aceptar el alcance real y las fuentes de servicios/tarifas por separado. El criterio QA ya está definido; su ejecución/evidencia sigue pendiente.

## Registrar cierre sin sustituir evidencia histórica

Añadir un informe nuevo por escenario con fecha, versión/huella, URL local, perfil/permisos, IDs sintéticos, esperado/actual, screenshot y hashes de archivos descargados. PASS solo después de completar y verificar; bloqueo/fallo conserva el estado pendiente y su causa. No editar informes originales para borrar un FAIL.

Siguen por completar la matriz integral de roles y deep links ajenos, DES03 antes/después de cambio desde otro puesto, Tab/Shift+Tab y foco anidado/firma/corrección, zoom200%, Back, sesión expirada y desconexión reales. Restablecer la dimensión temporal1280×720 cuando se recupere control fiable. No se repite una firma por un ajuste documental.
