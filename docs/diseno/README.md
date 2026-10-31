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
