# Preparación Frontend del entorno cliente

Fecha: 2026-11-03. Preparación de configuración; no es despliegue ni autorización de datos reales.

## Build y publicación de SPA

Directorio raíz del proyecto Vercel: `frontend`. Instalar desde package-lock con `npm ci`, construir con `npm run build`, salida `dist`. [Configuración SPA](../vercel.json) preparada según la [documentación oficial Vite/Vercel](https://vercel.com/docs/frameworks/frontend/vite): acceso directo a rutas como `/patients/:id` o `/invoices/:id?versionId=...` devuelve index.html y React Router controla la navegación.

Variables **públicas**, resueltas durante build, en [.env.example](../.env.example):

| Variable | Contenido |
| --- | --- |
| VITE_API_BASE_URL | URL HTTPS del Backend terminada en /api/v1; localhost solo para desarrollo/QA local |
| VITE_APP_ENVIRONMENT | development, qa, pilot o production; se muestra en login y aplicación |
| VITE_APP_VERSION | Identificador público de versión candidata, hasta 64 caracteres alfanuméricos/punto/guion/guion bajo/plus |

Cambiar variables requiere reconstruir. No poner DATABASE_URL, claves privadas, contraseñas, tokens de operador ni claves Supabase en VITE. El frontend consume Express y documentos autenticados; no accede a la base ni al portal por API. Sin entorno/versión configurados, la pantalla dice que no están identificados; no se adivina Production.

## Comprobaciones para Arquitectura/operación

1. Identificar origen real del Frontend y host HTTPS del Backend; configurar CORS exactamente para ese origen. No se ha elegido una URL de cliente desde este chat.
2. Confirmar migraciones/permisos y diagnóstico de integridad en destino con Backend/Base de datos. Las pruebas se hacen exclusivamente en QA dedicado.
3. Confirmar almacenamiento privado persistente y recuperación conjunta de base, firma, PDF, archivos y comprobantes. Filesystem de funciones Vercel no resuelve esta dependencia.
4. Verificar deep links, assets, login por rol, 401/403, conexión perdida y descargas después de reinicio/restauración en el destino definitivo. No acreditar Vercel solo con un build local.
5. Registrar responsable de suspensión y soporte, versión candidata y alcance clínico autorizado. El portal continúa manual; no hay un envío automático oculto al exportar.

## Sesión y UX

Los tokens siguen solo en memoria. Recarga pide login; logout descarta la sesión local, sin promesa de revocación del token. La expiración rechaza el guardado y no anuncia éxito. Mantener ventanas de captura con cambios protegidos y no guardar datos clínicos como solución al reload.

La firma conserva su imagen y hash por versión. Se añade dibujo por teclado con procedencia OTHER admitida por Backend: Space baja/sube lápiz, flechas trazan y Shift amplía el paso. No sustituye la firma por un texto ni elimina la revisión explícita. Cancelar un trazo pendiente exige descartar o continuar.

Las evidencias de QA deben ser sintéticas y rotuladas; comprobantes/pacientes reales se custodian fuera de Git. El entorno definitivo, sus usuarios, backup/restauración y el primer registro real siguen requiriendo aceptación de los responsables de los contratos 08/09.

## Entrega y smoke pendientes del 3 de noviembre

Backend publica un adaptador opcional de Storage privado y preparación Express para Vercel en su [handoff 07/08/09](../../backend/docs/NEG_FINAL_07_09.md). Frontend conserva documentos mediante la API autenticada y no recibe claves Supabase. Los adjuntos de la pantalla manual se limitan a 4 MB, compatibles con el límite publicado por Backend para Vercel; un límite de servidor menor sigue siendo definitivo.

En QA se verificaron dos firmas, dos PDF y dos evidencias manuales después de reiniciar un proceso Backend con root documental propio. El primer ensayo usó el root que limpian las suites y perdió un archivo: no compartir `storage/documents` con suites que lo eliminan. Usar un directorio absoluto dedicado por entorno, identificar qué base referencia sus bytes y respaldarlos conjuntamente. No declarar persistencia de Vercel ni bucket privado remoto por este ensayo local.

La [matriz Frontend](NEG_FINAL_07_09_VALIDATION.md) conserva la incidencia de integridad de factura completa, la carga/descarga de navegador interrumpida y las filas de aceptación pendientes. La configuración está preparada; no se publicó ninguna versión candidata.
