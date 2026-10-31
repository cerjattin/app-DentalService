# Lógica de negocio

## Responsabilidad y ubicación

Definir casos de uso, invariantes, estados y criterios de aceptación. La implementación autoritativa permanece en `backend/src/modules/*/*.service.ts`, apoyada por constraints y transacciones; la UI refleja las reglas mediante contratos explícitos.

## Reglas base

| Concepto | Regla |
| --- | --- |
| Agenda | `Appointment` representa el evento operativo; no equivale a atención ni a factura |
| Atención | `ClinicalEncounter` describe el encuentro y sus procedimientos |
| Catálogo | Service/SKU = `SvbProcedure`; ejecución = `EncounterProcedure`; precio vigente = `SvbTariff` |
| Facturación | Una factura lógica por cita; múltiples ítems y versiones por corrección |
| Historia | Cambios del catálogo no recalculan snapshots clínicos/fiscales anteriores |
| Firma | Firma y hash vinculados a una versión exacta e inmutable |
| Autorización | Exigir autorización externa cuando el procedimiento la requiera; no confundir con Declarant ID |
| Organización | Aislamiento por organización del actor; Declarant ID autoritativo para snapshots SVB |
| Dinero | Decimales exactos y agrupación por moneda, sin sumar divisas distintas |
| Numeración | Asignación dentro de la transacción del caso de uso; nunca `MAX + 1` |
| Fechas | Fecha de negocio en `America/Curacao`; distinguir fecha sin hora de timestamp |

Usar las máquinas de estado del [contrato backend actual](../../backend/docs/API_FREEZE_BACKEND.md). Las propuestas iniciales de arquitectura no autorizan añadir estados como `WAITING` si no están implementados.

## Casos que deben conservarse en PostgreSQL

1. Registrar paciente/seguro, crear cita y ejecutar atención con varios procedimientos.
2. Resolver tarifa por fecha y moneda sin periodos activos superpuestos.
3. Preparar una factura con snapshots, capturar firma, firmar y cerrar.
4. Corregir mediante nueva versión conservando el documento y firma históricos.
5. Construir/exportar declaración sin duplicar asignaciones; distinguir exportación local de envío real.
6. Dashboard: conservar las definiciones documentadas de producción, pacientes-día, prestador ejecutante y asignación de declaraciones.

## Pendientes por resolver

Semántica oficial de `NumberOfTreatments` y `Assistance`, maestros/tarifas productivas, diseño oficial SVB, adaptador real de envío, contrato de sesiones DBR-001 y reconciliación de organización MASTER-04A. No convertir estas ausencias en defaults ficticios.

## Entrega

Cada cambio de regla debe describir disparador, precondiciones, transición permitida, resultado, errores, permisos, datos congelados y escenarios de aceptación. Backend implementa; Base de datos refuerza integridad; Frontend y Diseño reflejan el flujo. La migración de motor debe pasar los mismos escenarios, sin redefinirlos.

## Regreso a atención y refacturación — 2026-10-30

El usuario confirmó que Admin debe poder devolver una invoice a atención, quitar/agregar servicios y refacturar. Admin conserva el conjunto completo de permisos; la autorización continúa por permisos y organización. Se implementó `POST /invoices/:id/reopen-encounter` para DRAFT/PENDING_SIGNATURE/SIGNED/CLOSED, con motivo y versión esperada. Crea una corrección aprobada y una versión nueva vacía; reabre solo la atención. No reprograma la cita ni modifica el contenido histórico de versiones, firmas o documentos anteriores.

El profesional puede retirar un servicio equivocado y agregar el correcto antes de completar una atención OPEN. Si el servicio tiene historial facturado, el retiro autorizado lo marca VOID y conserva las referencias; libera el consumo de autorización una sola vez. Tras completar la atención, se reconstruye la nueva versión de la misma factura/número con sus servicios actuales y se requiere otra firma. Se bloquean declaraciones activas, correcciones simultáneas y cambios de seguro/moneda dentro de este flujo. [Precondiciones, transacciones, errores y escenarios](../../backend/docs/CLINICAL_REBILLING.md).

## Contrato de pendientes para Frontend — 2026-10-31

Se definió [NEG-FE-REBILL-02](CONTRATO_FRONTEND_REFACTURACION_DRAFT.md): retiro de ítems y cancelación exclusivamente de declaraciones Draft, detalle de asignaciones que bloquean el regreso a Clinical y aceptación completa en PostgreSQL/navegador. Las rutas nuevas son especificación pendiente de Backend; Frontend debe comprobar su publicación antes de habilitarlas. Este contrato no implementa esas operaciones ni acredita su validación.

## Contratos funcionales siguientes — 2026-10-31

Se prepararon NEG-FUNC-03 (organización/Declarant ID), NEG-FUNC-04 (candidatos y exclusividad de asignaciones) y NEG-FUNC-05 (registro/selección de casos de tratamiento). [Índice, orden de ejecución y cartera posterior](CONTRATOS_FUNCIONES_PENDIENTES.md). Son especificaciones pendientes de Backend/Frontend; no se publicaron rutas ni se ejecutaron pruebas de producto. El índice conserva la confirmación del usuario sobre la entrega anterior y distingue esa confirmación de la evidencia disponible en este checkout.

Se detallaron los [encargos para los seis asistentes](ENCARGOS_ASISTENTES_FUNC03_05.md), con implementación, archivos, dependencias, comprobaciones y cierre por contrato. Los encargos están preparados para entregarlos a sus chats; no se enviaron automáticamente ni se implementó producto en esta pasada.
