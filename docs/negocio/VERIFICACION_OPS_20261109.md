# Verificación del candidato OPS para revisión y pruebas de usuario

El 9 de noviembre se verificaron las entregas OPS en el repositorio local y se fijó el candidato `ops05-4077c987b6ab2155`. La consulta de solo lectura a GitHub confirmó que `origin/main` apunta a la misma revisión base local `1828797be5abb6d97292dc298dafd6e3976ff9b8`. El candidato está preparado para revisión en Git y pruebas de usuario con datos sintéticos. La aceptación del cliente y la actualización del despliegue se registran por separado.

| Entrega | Comprobación |
| --- | --- |
| [OPS-01 Backend](../backend/OPS_01_ENTREGA.md) | Flujo HTTP de atención, entrega a Recepción, valoración Decimal, firma y refacturación. API interna Dentalink y pruebas de permisos, reintento y concurrencia. |
| [OPS-02 Frontend](../frontend/OPS_02_ENTREGA.md) | Agenda, atención, factura y firma integradas. Evidencia sintética de las dos versiones de factura y sus PDF. La cola completada incluye citas ya facturadas y el estado se consulta en el detalle. |
| [OPS-03 Base de datos](../base-de-datos/OPS_03_ENTREGA.md) | Ocho migraciones, hashes SQL coincidentes con la entrega, actualización desde el baseline con datos históricos y restauración aislada con documentos. |
| [OPS-04 Diseño](../diseno/OPS_04_ENTREGA.md) | Recorrido observado por perfil. Frontend corrigió foco, Escape y orientación al recuperar el cobro. El caso DES-OPS-04 queda abierto para la cola de pendientes. El informe conserva los escenarios manuales que faltan. |
| [OPS-05 Arquitectura](../arquitectura/OPS_05_ENTREGA.md) | Contexto, coordinación y procedimiento de actualización. La captura verificada el 9 de noviembre sustituye el checkpoint provisional del 7 como referencia de código. |

## Validación integrada del 9 de noviembre

- Backend aprobó typecheck, build y **509 pruebas** en la suite general. Las cuatro pruebas optativas se reservaron para bases nuevas separadas. En esa ejecución aprobaron **6 de 6**, incluidas las cuatro optativas y dos comprobaciones de inventario repetidas. Pasaron actualización desde el baseline, bloqueo de recuperación y restauración de filas, secuencias, firmas y archivos.
- Frontend aprobó lint, build y **360 pruebas** en 18 archivos.
- Los dos guiones de navegador de GitHub pasaron en Chrome local con PostgreSQL sintético. Se actualizaron selectores de atención, espera de búsqueda y fecha de negocio de la prueba operativa. Se comprobó catálogo activo/inactivo, preservación de la descripción y tarifa históricas, creación desde Agenda y Recepción y filtros/producción del dashboard.
- Las pruebas de esta ronda usaron exclusivamente PostgreSQL local y documentos sintéticos. Los reportes están en `backend/storage/ops-review-20261109/` y `frontend/node_modules/.cache/ops-review-20261109.json`.

La captura local contiene 481 archivos y ocho migraciones. SHA-256 de fuentes `4077c987b6ab2155903c7022802a1cd21d76d716394fb6e1c81ca957b6b57995`. El manifiesto está en `deployment/releases/ops05-4077c987b6ab2155-1794226887298-b8caef84/manifest.json`. Los dos archivos operativos preexistentes de `deployment/` quedaron fuera de la captura. Los guiones de CI se verificaron aparte porque la captura de fuentes de producto no incluye `frontend/scripts/`.

## Pruebas de usuario

1. Recepción crea, reprograma y confirma una cita sintética. Comprueba cancelación en una cita separada.
2. Profesional inicia la atención confirmada, agrega, retira y reagrega un servicio, y completa. Recepción encuentra la cita y resuelve seguro o tarifa si faltan.
3. Recepción crea la factura, captura una firma de prueba autorizada, cierra y descarga el PDF. Admin devuelve a atención, corrige servicios y refactura. Se conserva el número y se pueden consultar ambas versiones, firmas y PDF.
4. Comprobar volumen e importes por profesional y período. Registrar si el estado de facturación visible en detalle basta para el puesto mientras se resuelve DES-OPS-04.

La revisión en Git debe vincular la rama y la ejecución de CI al candidato. Para el entorno desplegado, primero inventariar el destino y preparar respaldo. Aplicar las migraciones que estén pendientes antes de actualizar API y UI, siguiendo el [procedimiento de actualización](../arquitectura/OPS_05_ACTUALIZACION_DESTINO.md). La conexión real Dentalink depende de acceso y documentación del proveedor. La radicación SVB depende del formato oficial.
