# NEG-DEP-12 — Entrega de Arquitectura

Fecha: 2026-11-03. Responsable: chat Arquitectura. Versión documental DEP12-v3-cierre-local. **Preparación local entregada; DEP11 PARCIAL, publicación y uso clínico NO-GO.** Usuario mantiene QA solo local, cuenta Render y solo Supabase clínico. No crear ni pedir recursos cloud. [Runbook](NEG_DEP_12_RUNBOOK.md), [paso remoto conservado](NEG_DEP_12_QA_ACCESO.md), [lista manual pendiente](NEG_DEP_11_CHECKLIST_CIERRE_LOCAL.md). Las fuentes finales coinciden con 092a: se conserva su build, sin recaptura ni suites repetidas por esta actualización documental.

## Alcance y propiedad

Se preparan `deployment/render.yaml`, herramientas de snapshot/build aislado/smoke HTTPS y pruebas de sus controles, runbook, contexto/plan compartidos y guía Arquitectura. No se modifican módulos, schema, migraciones, frontend, datos ni informes protegidos de otras áreas. El artefacto captura archivos de todas las áreas como versión conjunta, sin atribuir su implementación a Arquitectura.

Render + Supabase es una propuesta concreta de US$32 base mensual (condiciones/extras en el runbook), no plataforma contratada. URLs previstas no asignadas. Node 24.22.1, una API pagada, SPA CDN, Storage privado, TLS validado y SVB_MANUAL_RECORDING_ENABLED=false. Sin auto-deploy ni operación de DB en build/start.

## Evidencia previa del candidato 5d9b (conservada)

Versión candidata de preparación: **`dep12-5d9b62c4c85f291b`**, capturada a las 20:36:57 UTC del 3 de noviembre (15:36:57 America/Bogota), HEAD base `0bff419bd435943949c53e1f09cb7a1d7d700fce` + fuentes locales de todas las áreas. No es release publicada ni aceptación final de áreas en curso.

- [Manifiesto local](../../deployment/releases/dep12-5d9b62c4c85f291b-1793738215046/manifest.json): 453 archivos de fuentes/configuración/locks/assets/migraciones, SHA-256 conjunto `5d9b62c4c85f291b19dfc244a088e7edabc7cf45e4b297eb95a638de8600d482`.
- [Artefacto fuente ZIP](../../deployment/releases/dep12-5d9b62c4c85f291b-1793738215046/dep12-5d9b62c4c85f291b-source.zip): 1.569.333 bytes, SHA-256 `c2b848920faf8cff1ca0a5a86555b860f3fa092984d981e3598a0b8b1d2d0d32`. Contiene source, manifiesto y build-report; excluye .env, storage, evidencias y node_modules. El hash fija esos bytes; no se atribuye propiedad de toda la implementación a Arquitectura.
- [Build aislado](../../deployment/releases/dep12-5d9b62c4c85f291b-1793738215046/build-report.json): Prisma generate 7.9.1, compilación TypeScript Backend y Frontend + Vite 8.2.2 PASS. Node 24.22.1/Windows; dependencias del ensayo aislado anterior con locks coincidentes. 592 archivos de salida, hash conjunto `39e7833512b38fa748a398035b44d43f1c3334d7129fb060b0babad16937958e`. No es npm ci limpio ni validación Linux/nativos de Render. Se preservó el source congelado y se volvió a verificar.
- Blueprint validado offline con el [esquema oficial Render](https://render.com/schema/render.yaml.json), descargado sin enviar credenciales ni crear servicios. [Informe](../../deployment/evidence/blueprint-validation-20261103.json): PASS, cero errores; hash schema `8a3fb8da6b4f55fe686fbefa790e011d3dd7895f013f355953c572a21ab6494a`. El hash del Blueprint coincide con el archivo del manifiesto. No equivale a validación de la API de Render ni publicación.
- `node --test deployment/tests/preparation.test.mjs`: **9 PASS, 0 FAIL, 0 omitidas**, frescas. La prueba de junction inicialmente bloqueada por el sandbox se repitió fuera de esa restricción y pasó; las pruebas no usan DB, Storage ni datos clínicos. Verifican manipulación/rutas del manifiesto y rechazo de smoke ante CORS abierto, versión incorrecta, SVB habilitado o sesión ausente.
- [Configuración del Backend compilado](../../deployment/evidence/production-config-final-20261103.json): **3 PASS** sin conexiones: acepta configuración Render propuesta con valores sintéticos; rechaza SVB=true en producción remota y CORS wildcard. No acredita conectividad/bucket ni prueba de endpoints de escritura.
- Cinco documentos del área/contexto/plan: enlaces locales verificados sin roturas; `git diff --check` de los documentos existentes sin errores (solo aviso de normalización LF/CRLF). No se ejecutan suites de producto nuevas contra clínica ni se atribuyen los conteos de otras áreas.

Hubo un primer snapshot/build `dep12-54152d047b6b4fdb`, conservado como ensayo previo, no candidato vigente. La captura se repitió para incluir nuevas herramientas de DB y validación/smoke de Arquitectura; no se mezclaron sus hashes. Las ediciones de áreas posteriores a esta captura requieren nuevo snapshot y checks de lo afectado antes de publicación. La entrega no bloquea ese trabajo ni marca sus contratos PASS.

## Pendientes exactos y coordinación

- Backend publicó [DEP10/12](../../backend/docs/NEG_DEP_10_12.md): integridad/aplazamiento, runtime local e inventario de documentos. Sus pruebas completas y revisión DB se acreditan en esa entrega, no por el build de Arquitectura. Frontend/Diseño mantienen DEP11; los hallazgos [de Diseño](../diseno/NEG_DEP_11_INSPECCION_20261103.md) necesitan corrección/reensayo de su área antes de aceptación. Regenerar candidato si cambian fuentes; no mezclar evidencias de hashes distintos.
- DB posee inventario/plan de permisos/reparación. Última evidencia compartida: cinco migraciones, dos permisos y tres hallazgos; no se reconsultó ni aplicó el destino desde Arquitectura.
- Cuenta Render disponible; no se han creado servicios. Plataforma/costo/región/URLs y build Linux/smoke remotos quedan para ronda futura, **PENDIENTES POR ALCANCE/ACCESO**. No hay ejecutor Linux local: WSL no instalado, Docker/Podman ausentes; [evidencia](../../deployment/evidence/linux-availability-20261103.json).
- Bucket privado/credenciales QA/Storage y recuperación remota quedan **PENDIENTES POR ALCANCE/ACCESO**, sin volver a pedir su creación. QA solo local usa sintéticos; no se usa clínica. DB confirmó además 7 URI locales por 654296 bytes de metadata para una transición futura, no las copió al laboratorio.
- Faltan operador/suplente, soporte, política de copias/RPO/RTO y aceptación observada del cliente.

Resultado de salida: **NO-GO para publicación/uso clínico**, no bloqueo para terminar trabajo local. No se solicita permiso genérico ni se publica al compilar. La decisión de contratar/publicar se plantea sobre el candidato exacto una vez cerradas las puertas técnicas; no se piden contraseñas en chat.

Al retomar cloud en otra ronda: concretar costo/servicios/región/URLs/operador y acceso QA por canal seguro. **No se solicita esa decisión ahora**; usuario mantiene QA local. Conservar propuesta Render+Supabase base US$32 y QA Free condicional para esa etapa, sin prometer elegibilidad. No se contrató/publicó/presentó ante SVB ni se alteraron datos clínicos.

## Continuación local y preparación Linux

Se añadió runner `deployment/build-linux.mjs`, guardado para un ejecutor Linux futuro: npm ci de ambos lockfiles, Prisma/build, checks sintéticos Argon2/Sharp/PDFKit y hashes de salida sin conexiones. Sintaxis PASS y **2 pruebas propias nuevas PASS** del guard en Windows, sin instalar ni crear outputs. No son pruebas nativas Linux aprobadas ni se suman como repetición de las 9 anteriores. Se conserva un Blueprint QA Free separado validado offline con el esquema oficial; no se creó un servicio. [Informe del Blueprint QA](../../deployment/evidence/blueprint-qa-validation-20261103.json).

El snapshot incluye ahora `backend/prisma/seed.ts` como **fuente AST de política**, necesaria por la herramienta DB de permisos; se copia como archivo y nunca se ejecuta. No hay cambio en seeds/SQL/cliente/servicios de otras áreas. Esto evita entregar el sincronizador sin su entrada de política al preparar la operación futura.

Cierre documental local: entrega Frontend y Diseño R2 recibidas y vinculadas abajo. El 5d9b queda histórico; 092a conserva sus bytes/build. La lista manual pendiente mantiene DEP11 parcial; no se infiere GO clínico ni publicación.

## Candidato local 092a — evidencia vinculada, DEP11 parcial

**`dep12-092a67db50d812ff`**, 458 archivos, [manifiesto](../../deployment/releases/dep12-092a67db50d812ff-1793739679732/manifest.json), SHA-256 source `092a67db50d812ffaae9ea18d824f4950d78a9ed25df931c5d29ca5d984b54e5`. Incluye correcciones presentes de Frontend, Backend v2, política seed como entrada AST y herramientas de esta continuación. QA LOCAL_ONLY; no se han creado servicios o buckets.

- [Build aislado](../../deployment/releases/dep12-092a67db50d812ff-1793739679732/build-report.json): generación Prisma y compilación Backend/Frontend/Vite PASS en Node 24.22.1 Windows. 592 salidas, hash `b9e497a62396c174ac36dc70a7a13293cbb5c17a6fbbe121b20a58c6811ff0a5`. Dependencias del ensayo aislado previo con locks coincidentes; no npm ci limpio/Linux.
- [Entradas del plan DB](../../deployment/releases/dep12-092a67db50d812ff-1793739679732/candidate-inputs-report.json): seis checksums de migración coinciden; `seed.ts` incluido y hash de política coincide con DEP12_OPERACION_PREPARADA. Se conserva [copia exacta del plan](../../deployment/releases/dep12-092a67db50d812ff-1793739679732/operation-plan.json) con hash `318eed73aee54565898293fb96d08002dbc8022ff0c1954b81411023af94532c`. Sin aplicar ni consultar DB.
- [Verificación de código/política](../../deployment/releases/dep12-092a67db50d812ff-1793739679732/local-inputs-verification.json): lector AST compilado funciona con la política empaquetada, coincide con el plan y conserva ADMIN completo; 274 archivos comunes con manifiesto Backend v2, cero diferencias. Los archivos QA/documentales fuera de esa intersección no se declaran verificados por esa comparación.
- [Comprobación del árbol](../../deployment/releases/dep12-092a67db50d812ff-1793739679732/source-current-check.json): sin archivos cambiados/eliminados frente a la captura al tomar la comprobación. DEP11 seguía pendiente de entrega. No se marca aceptación por fuente estable o por comentarios de progreso.
- [ZIP fuente/plan/reportes](../../deployment/releases/dep12-092a67db50d812ff-1793739679732/dep12-092a67db50d812ff-source.zip): 1.584.898 bytes, SHA-256 `70f03ecc234ed561d3a05679c73bd2cc640c308c1d384a9a6abc8334edc64af5`. Sin .env, node_modules, storage ni objetos clínicos. El plan público contiene huellas/conteos/precondiciones, no valores fiscales ni pacientes.

Al generar el ZIP, Frontend/Diseño seguían en reensayo; esa situación histórica se conserva en source-current-check dentro del archivo. La continuación siguiente vincula sus entregas ya publicadas mediante un reporte adicional, sin sobrescribir aquel informe ni modificar el ZIP.

## Vinculación de cierre local, sin nuevas suites

[Vinculación por archivo v2](../../deployment/releases/dep12-092a67db50d812ff-1793739679732/acceptance-binding-20261103-v2.json): las 458 fuentes siguen presentes e idénticas, cero cambios/faltantes; **167 fuentes Frontend** y **6 huellas finales Diseño R2** coinciden con 092a. La v1 se conserva como registro anterior a la continuación documental de Frontend/UAT07; la v2 incorpora sus documentos y guion manual actualizados. No hubo recaptura, compilación ni tests de producto en esta revisión.

La [entrega Frontend](../../frontend/docs/NEG_DEP_11_12_VALIDATION.md) registra lint/build propios y la suite independiente de Negocio **379/379, 16 archivos**, huella `036cdc50a6468f31f2f766bd540073ec3c3c0b1f10875e69d316f0c89a3a88ae`. Es su evidencia vinculada, no una corrida nueva de Arquitectura. Los agregados de Frontend/Negocio/este artefacto usan formatos/entradas distintos: no se comparan entre sí ni se exige que el build local Frontend tenga el hash del bundle de Arquitectura con otra configuración pública.

[Diseño R2](../diseno/NEG_DEP_11_INSPECCION_20261103.md#reensayo-r2--fuentes-corregidas-y-evidencia-nueva) confirmó notas al navegar/guardar, foco en Add procedure y diálogo anidado, Refresh manual con filtros y error de archivo obligatorio asociado/enfocado. ManualEntryDialog cambió entre inicio/fin del reensayo; el reporte conserva ese hecho y compara las huellas **finales**, sin declarar que cada observación ocurrió sobre un artefacto congelado. Cinco fuentes de su muestra permanecieron iguales. No se amplían sus PASS acotados a selección/upload/retry/descarga ni a toda la matriz visual.

**Pendientes manuales exactos:** [M01–M11](NEG_DEP_11_CHECKLIST_CIERRE_LOCAL.md), con [guía Frontend](../../frontend/docs/MANUAL_QA_DEP11.md) y guion de puestos de Diseño. UAT07 tiene criterio de Negocio definido: falta ejecución/evidencia de autorización/remisión/accidente y aceptación real, no inventar reglas. Siguen recorridos por perfil, deep links ajenos, selector/subida/retry/descarga PDF exacta, errores de red/sesión, foco y avisos nativos, zoom real 200%/puestos, refetch y resolución histórica aplicable. Ensayo humano normal, sin eludir límites de herramientas ni pedir cambiar seguridad de la extensión.

Estado de la ronda: **PREPARADO LOCAL Y EVIDENCIA VINCULADA**. DEP11 **PARCIAL**; Linux/Storage/host remotos **PENDIENTES POR ALCANCE/ACCESO**; SVB externo **APLAZADO POR ALCANCE**. Se conserva NO-GO de publicación/uso clínico y aceptación del cliente pendiente. No se inicia otra suite ni operación como efecto de registrar este cierre.
