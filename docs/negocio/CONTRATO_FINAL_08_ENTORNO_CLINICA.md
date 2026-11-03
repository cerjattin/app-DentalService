# NEG-FINAL-08 — Entorno operativo para datos reales de clínica

**Cierre actualizado, 2026-11-03:** [NEG-DEP-12](CONTRATO_DESPLIEGUE_12_ENTORNO_OPERACION.md) concreta los pendientes del entorno y la decisión de plataforma. Vercel es el objetivo histórico; existe recomendación posterior Render + Supabase bajo presupuesto, todavía por resolver con Arquitectura. [Alcance clínico con SVB aplazado](CIERRE_PRIMER_DESPLIEGUE_20261103.md).

Fecha: 2026-11-02. Estado: **contrato de preparación y verificación; sin despliegue ni cambios operativos ejecutados aquí**.

## Resultado

Definir y probar el entorno exacto donde el cliente utilizará datos reales, separándolo del laboratorio automatizado. Tener el MVP local compilado y el baseline Supabase aplicado no acredita por sí solo la preparación de las migraciones posteriores, los permisos ni la recuperación de datos/documentos.

La topología del piloto debe quedar registrada por Arquitectura: host/servicio del Backend y Frontend, base de destino, almacenamiento de documentos, forma de acceso del cliente, responsables y mecanismo de suspensión. No se presupone acceso remoto ni despliegue Vercel a partir de la selección de datos reales. El despliegue final sigue siendo Vercel/Supabase, con su aceptación propia.

## Encargo Arquitectura + Base de datos

1. Inventariar, sin exponer secretos, versión de aplicación, migraciones aplicadas, permisos, orígenes Frontend, target DB y almacenamiento del piloto. Comparar las cuatro migraciones NEG-FUNC posteriores al baseline y sus roles con el destino real; no asumir que faltan ni que están aplicadas por un reporte antiguo.
2. Ejecutar primero el diagnóstico de integridad preparado por Base de datos según su guía. Ante identidad legada, asignación activa duplicada u ordinal/evidencia inconsistente, conservar evidencia y resolver explícitamente; no resetear ni elegir un ganador automáticamente.
3. Preparar cambios de esquema/permisos en un destino separado; documentar aplicación y retorno. No lanzar migraciones en el arranque del Backend ni en cada request. La aplicación operativa es una tarea concreta controlada y separada de estas pruebas.
4. Respaldar conjuntamente base y documentos; demostrar una restauración en un entorno aislado con relaciones, hashes, firmas, exportaciones y comprobantes recuperables. Entregar responsable, frecuencia, retención y procedimiento de recuperación. Un archivo de backup sin prueba de restauración no cierra el requisito.
5. Confirmar cuentas reales, roles/permisos efectivos y responsable de atención de incidencias. No compartir una cuenta Admin entre operadores ni utilizar usuarios de QA para capturar actividad real.

## Encargo Backend

- Mantener Express/Prisma/JWT/RBAC existentes. Comprobar en el entorno elegido: expiración de token, organización, permisos, desactivación de usuario efectiva sobre peticiones posteriores, límites de carga y errores sin secretos. La decisión de usar datos reales no sustituye Auth por Supabase Auth.
- El logout actual descarta el token local; documentar esa limitación y comprobar la revocación mediante desactivación de cuenta cuando sea necesaria. Si el piloto requiere revocación individual de sesiones/refresh/continuidad de sesión, implementar antes el contrato dedicado DBR-001 con persistencia, rotación/revocación y pruebas. No prometer revocación mediante una variable en memoria o solo ocultando botones.
- Definir acceso seguro y expiración de credenciales del piloto, procedimiento de recuperación de acceso y quién puede suspender usuarios. No imprimir contraseñas o tokens en informes.
- Asegurar que los documentos sobreviven reinicios y cambios de versión. El actual storage local puede servir solo en un host persistente controlado, con backup/restauración demostrados y acceso mediado por Backend. Para Vercel, preparar almacenamiento persistente externo antes de publicar; no asumir durabilidad del filesystem de funciones.
- Si se usa almacenamiento externo, mantener privado el contenido, comprobar organización/permisos/hash y conservar URI antiguas con una transición verificada. Frontend no recibe credenciales privilegiadas ni URLs públicas permanentes.
- Verificar descargas tras restauración y actualización: firmas, PDF de cada versión, archivo presentado y comprobantes. No borrar originales al generar un layout nuevo.
- Configurar HTTPS cuando se accede fuera del host, CORS para orígenes reales y secretos fuera del bundle/VITE. Probar las URLs/deep links reales y logs con correlación sin datos clínicos innecesarios.

## Encargo Frontend + Diseño

Verificar roles y rutas en el entorno exacto del piloto; formularios con protección de cambios sin guardar, errores visibles, sesión expirada sin guardar un éxito ficticio, firma accesible y descargas por versión. La recarga requiere login mientras continúe el contrato actual de tokens en memoria; no persistir tokens para evitarlo. El operador debe poder reconocer claramente qué entorno usa y si una declaración está solo exportada o ya presentada.

## Requisitos de salida

| Entrega | Prueba verificable |
| --- | --- |
| Base de destino compatible | Versión/migraciones/roles comprobados y diagnóstico sin bloqueos abiertos |
| Recuperación | Restauración aislada exitosa de base y documentos, con hashes/vínculos y procedimiento registrado |
| Accesos | Admin/Recepción/Profesional efectivos, rechazo cruzado de organización y desactivación comprobada |
| Documentos | Firma/PDF/exportación/comprobante descargables después de reinicio y actualización |
| Operación | Responsables, configuración, suspensión de capturas/presentaciones y retorno definidos |
| Aceptación | QA automatizado separado de clínica y entorno real identificado para el piloto |

Ninguna suite de integración, seed o cleanup de QA se ejecuta sobre datos clínicos. No usar una copia de datos reales como fixture por defecto. Los logs, capturas e informes compartidos se redactan para no exponer pacientes ni secretos.

Responsable principal: **Arquitectura**, con **Base de datos/Backend** para integridad, accesos y persistencia; **Frontend/Diseño** para el recorrido. Este contrato no exige una integración nueva con SVB API: el canal acordado es manual y se cubre en NEG-FINAL-07. No se hace commit/push/despliegue mediante la preparación documental.
