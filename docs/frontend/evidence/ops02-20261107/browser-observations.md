# Observaciones de navegador del 9 de noviembre de 2026

Lectura de la vista accesible en el entorno sintético OPS-02. Las capturas del mismo paso pueden mostrar el cuadro antes de que termine la actualización visual.

| Pantalla | Observación |
| --- | --- |
| Recepción, **Completed / billing review** | `DB-000001`, 6 de noviembre de 2026 a las 10:00, abre `/appointments/1`. `DB-000002`, 14 de enero de 2027 a las 10:00, abre `/appointments/34`. Ambas filas se ofrecen con **Review billing** y el total visible es `2 completed appointments`. |
| Cobro de `DB-000002` | El diálogo permaneció abierto tras **Confirm creation**. Se observó el aviso `No valid coverage was found for this appointment's service date. Review the invoice coverage.` junto a la fecha `2027-01-14`. `Currency code` conservó `ANG`. **Refresh billing choices**, **Review patient coverage** y **Review services and tariffs** quedaron disponibles con los permisos del Admin sintético. |
| Atención de `DB-000002` | Al guardar `QA-OPS-2` por Enter, la actualización final mostró `Service recorded.`, cantidad `1.25` y foco activo en el botón **Add service**. |
| Dentalink, ejecución `#1` | El historial mostró `CONFIRMED`. La vista mostró `2` importados, `1` incidencia y `2` páginas. **Open patient** abrió `/patients/2` con número `QAOP-P-000001`. **Open appointment** abrió `/appointments/34`, con número `DB-000002` y estado `Scheduled` al terminar la importación. |

La prueba posterior de atención completó `DB-000002` para comprobar el traspaso y el error de cobertura. [Resultado de importación antes de esa prueba](dentalink-after.json)
