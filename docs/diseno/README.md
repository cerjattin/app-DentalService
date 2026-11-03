# Diseño y experiencia de uso

## Responsabilidad y ubicación

Jerarquía visual, interacción operativa, accesibilidad, sistema de componentes y consistencia de flujos. La implementación vive en `frontend/src/components/`, `frontend/src/index.css` y las vistas de cada feature.

## Referencias actuales

- Tokens existentes: Inter/DM Mono, navy `#0b1f3a`, azul `#1a6fe8`, superficies y colores semánticos en `frontend/src/index.css`.
- `frontend/AGENTS.md` establece `Recursos/frontend-reference/` como referencia principal, pero esa carpeta no existe en el checkout inspeccionado.
- El chat «Diseñar Tarjetas Odontho» aporta contexto de marca; sus adjuntos no se recuperaron y una pieza promocional no reemplaza el diseño de producto.

Mientras se recupera la referencia original, conservar el lenguaje visual existente. No introducir un rediseño global, nuevas fuentes o paletas por deducción del material promocional.

## Criterios de trabajo

1. Textos de producción en inglés, claros y consistentes con los estados reales.
2. Densidad operativa útil en escritorio y controles cómodos para tablet.
3. Navegación por teclado, foco visible, etiquetas de formulario y errores asociados al control.
4. Estados de carga, vacío, error, permiso denegado y recuperación explícitos.
5. Evitar pérdida de notas/formularios; clarificar progreso de firma, cierre y corrección.
6. No presentar cobertura verificada como elegibilidad clínica automática ni exportación como envío real.
7. Revisar lectura del PDF y correspondencia con el contenido firmado sin inventar el layout oficial SVB.

## Prioridades

Inventario de componentes existentes, fricciones recepción→atención→factura→firma, accesibilidad de firma y formularios, y revisión responsive. Coordinar con Frontend antes de modificar componentes compartidos y con Negocio antes de cambiar secuencias operativas.

## Entrega

Para cada mejora: pantalla y problema, propuesta concreta, estados e interacción, componentes/tokens reutilizados y criterios de aceptación. Las primeras tareas de este chat son diagnóstico; cualquier artefacto de diseño nuevo se crea cuando sea parte de una solicitud concreta.

## NEG-DEP-11 — Primera inspección QA del 3 de noviembre de 2026 (R1 histórica)

[Inspección reproducible, hallazgos y matriz](NEG_DEP_11_INSPECCION_20261103.md). Se creó una copia sintética exclusiva para Diseño, sin clínica, migraciones, seeds generales ni limpieza de otros laboratorios. Evidencia en `evidence/dep11-20261103/`; no contiene contraseñas/tokens.

**No aprobado:** pérdida de notas al navegar (DES-DEP11-01, P1), retorno de foco a BODY al cerrar modal (DES-02, P2), cola sin actualización visible entre clientes (DES-03, P2) y asociación de errores de adjunto pendiente de confirmar visualmente (DES-04, revisión estática). Frontend corrige componentes; Diseño no los edita simultáneamente.

Cobertura parcial observada: Reception/Clinical 1440×900, Clinical 1280×720, modal de servicios 768×1024, validación y foco de primer control inválido. Los dispositivos de clínica siguen por confirmar. Computer Use se detuvo al no poder verificar la URL activa: zoom 200%, firma/corrección, adjunto/descarga y matriz visual de Recepción/Profesional permanecen abiertos. Los ciclos/pruebas históricos de Frontend no se presentan como ejecución nueva.

SVB externo = **APLAZADO POR ALCANCE**. Se observó el nuevo mensaje exacto en el modal de servicios y cambio del shell durante HMR; integración DEP10/API completa aún requiere su aceptación propia. Se conserva el sistema visual, sin Figma ni rediseño. Checks de esta entrega: rutas/enlaces y diff del área; ninguna suite de producto atribuida como nueva.

## NEG-DEP-11 — Reensayo independiente R2 (estado vigente)

[Informe actualizado y huellas R2](NEG_DEP_11_INSPECCION_20261103.md). Sobre la copia propia de Diseño se verificaron en ejecución las correcciones de DES-01 (advertencia/conservación/guardado de notas), DES-02 (teclado y foco final al disparador) y DES-03 (Refresh worklist, frescura y filtros conservados tras un cambio de segundo cliente). DES-04 tiene error obligatorio/aria/foco verificados; selección/tipo/subida real siguen pendientes porque la extensión bloqueó fileChooser por falta de acceso a file URLs. No se cambiaron permisos ni componentes.

Se contrastó Clinical con Admin, Recepción solo lectura y Profesional editable por sus permisos; alcance parcial, no UAT-01/02 completos. Se creó una reserva UNCERTAIN técnica exclusiva para validar adjuntos mediante un backend auxiliar localtest temporal; el frontend siguió con SVB aplazado y no se guardó ninguna liberación/presentación. Fuente clínica y QA cloud no se utilizaron.

Zoom real200%, recarga/expiración/desconexión, selección/subida/descarga efectiva y aceptación de puestos permanecen abiertos. [Guion manual por puesto](NEG_DEP_11_ACEPTACION_MANUAL_PUESTOS.md) contiene pasos, evidencias y campos de responsable/dispositivo por confirmar. NEG-DEP-11 global y aceptación cliente NO APROBADOS. Checks propios: enlaces/diff/JSON/huellas; sin atribuir conteos de pruebas de otras áreas.
