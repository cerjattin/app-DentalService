# Contexto compartido del proyecto

Fecha de consolidación: 30 de octubre de 2026. Repositorio: `C:\workspace\app-DentalService`.

## Decisiones actuales del usuario

1. Separar el trabajo en Arquitectura, Backend, Frontend, Lógica de negocio, Diseño y Base de datos, con seis chats especializados de Codex.
2. Mantener backend y frontend en el repositorio y entorno local mientras se completa el MVP.
3. Utilizar Supabase como base de datos objetivo y Vercel para el despliegue final.
4. Conservar el trabajo local existente. La organización actual no publica código ni ejecuta migraciones.

## Producto y arquitectura

ODONTHO SERVICES — SVB Billing App gestiona pacientes y seguros, citas, atención clínica, procedimientos realizados, facturas con versiones, firmas, documentos, correcciones y declaraciones SVB. Incluye administración de usuarios/profesionales, catálogo SVB y Dashboard operativo.

Frontend: React, Vite, TypeScript, Tailwind 4, React Router, TanStack Query, React Hook Form y Zod. Backend: Node.js, Express, TypeScript, Prisma 7, validación Zod, JWT, RBAC, auditoría y PDFKit. API bajo `/api/v1`; salud fuera de ese prefijo.

La base objetivo es **PostgreSQL administrado por Supabase**. Inicialmente Express mantiene autenticación, permisos, aislamiento por organización y reglas de negocio. La interfaz consume Express; no accede directamente a tablas de Supabase. Storage se evaluará para sustituir el almacenamiento local de firmas/PDF antes de Vercel.

## Estado comprobado en disco

| Área | Evidencia local | Interpretación |
| --- | --- | --- |
| Git | HEAD `b31ac7e3f`, integración de operational-forward-fixes | Referencia de inspección; no se modificó el historial |
| Base | `backend/prisma/schema.prisma` usa `provider = "mysql"`; adaptador `PrismaMariaDb` | Supabase pendiente de implementación |
| Catálogo | Módulo `svb-catalog`, API compartida frontend y Services | Preservar MASTER-02R/MASTER-03; no reconstruir desde auditorías antiguas |
| Citas | Diálogo compartido de creación, módulo appointments y clinic-locations | La creación ya existe; no tratarla como funcionalidad ausente |
| Dashboard | Módulo reports, API frontend y reporte con filtros | Ya existe; tiene correcciones locales sin commit que deben conservarse |
| Organización | Sin módulo organization ni rutas de organización montadas; Settings es informativo | MASTER-04A reportado en un chat no está confirmado en este checkout |
| Firma/PDF | Documentos y almacenamiento `local://documents/` | Se requiere almacenamiento persistente remoto antes de Vercel |
| Auth | Access token y RBAC propios | Refresh/revocación siguen pendientes de DBR-001; no cambiar implícitamente por usar Supabase |
| Diseño | Tokens en `frontend/src/index.css`; falta `Recursos/frontend-reference/` | Conservar UI existente; referencia original pendiente de recuperar |

Al iniciar esta organización había cambios en `dashboard-report.tsx`, `operational-gaps.test.tsx`, un nuevo `dashboard-model.ts`, `.gitignore` y `.vscode/`. No atribuirlos a esta tarea ni sobrescribirlos.

## Contexto recuperado de chats

Se consultaron mensajes disponibles, no solamente títulos. La herramienta devuelve páginas de turnos y puede truncar mensajes largos; los archivos adjuntos originales no siempre están disponibles. Esto es una síntesis de decisiones y evidencias, no una exportación íntegra de todos los chats.

| Chat consultado | Identificador | Contexto útil |
| --- | --- | --- |
| Odontho SVB · 00 Arquitectura y Coordinación | `6a7ca711-6120-83e9-9217-71c42e181864` | Separación agenda/atención/factura, snapshots y coordinación; propuestas iniciales de estados deben contrastarse con el contrato actual |
| Odontho SVB · 01 Base de Datos | `6a7ceda1-572c-83e9-9186-4ac3601e7748` | Modelo e integridad MySQL, numeración transaccional y propuesta más reciente de pasar a Supabase conservando Express/Prisma/RBAC |
| Diseño Backend API | `6a83c2ee-d344-83e9-83e3-6145762475ef` | Catálogo, firma, Declarant ID y reporte de MASTER-04A; este último requiere reconciliación con disco |
| Odontho SVB 02 Frontend | `6a96f32e-4138-83e9-af68-a7b724e6b247` | MASTER-02R/03, catálogo compartido y preferencia de desarrollo local |
| Rama: Odontho SVB 02 Frontend | `6ae23240-4e48-83e9-b8b2-e5dcd97b3a77` | Repositorio local como fuente de implementación y necesidad de verificar citas/Dashboard actuales |
| Chat equipo | `6a7ca05a-0830-83e9-8867-81eb1cee77cb` | Herramientas y preparación del entorno |
| Subir proyecto a Git | `6a84a7c3-b510-83e9-9688-e8bec2ba53de` | Historia de organización y exclusión de archivos locales; no sustituye decisiones actuales sobre Git |
| Auditar arquitectura frontend | `01a18314-2388-7412-a102-d20b9a8e9047` | Recuperación e integración de MASTER-02R/03; múltiples estados históricos del checkout |
| Audit frontend product | `01a18457-22be-7482-b890-d71197e1a721` | Posibles mejoras: notas sin guardar, frescura, selectores y accesibilidad; gaps de citas/Dashboard quedaron superados por cambios posteriores |
| Verifica acceso local | `01a18501-a359-7221-88db-08012c17c299` | Última corrección local de filtros Provider y fechas del Dashboard; preservar esos archivos |
| Chat local de correcciones de citas y Dashboard | `01a184e1-00a6-7ba0-a14c-a5f22c5b9ad9` | Confirmación previa de implementación existente; el listado usa un prompt largo como título |
| Ajustar pruebas de Postman | `01a182c1-3337-7cf3-8e06-92bbe960edd0` | Colección principal y uso exacto de `baseUrl`; preparación QA no equivale a colección completa ejecutada |
| Solucionar Errores | `01a17fd8-b9fb-7a11-99b8-284fe2f4b6df` | Diagnóstico histórico de autenticación MySQL y baseline `0_init`; se consultaron los turnos recientes, hay más historial |
| Corregir comandos MySQL en Windows | `01a17b54-5c5c-76e1-b79c-744e8d8284fb` | PATH MySQL resuelto; antecedente del entorno actual |
| Chat de inicio de sesión en Codex/VS Code | `01a184d8-f968-7501-b1a8-df1527fafd9a` | Contexto de acceso al entorno; sin nuevas reglas de producto |
| Diseñar Tarjetas Odontho | `6ae3db07-9e14-83e9-b8ef-1436a83d27a7` | Contexto de marca; no es especificación funcional ni autorización para cambiar los tokens de la aplicación |

Se revisó también el listado archivado: los tres chats archivados asociados a esta ruta no devolvieron mensajes útiles. Los chats de otros productos se excluyeron de esta consolidación.

## Reglas que comparten todas las áreas

- `SvbProcedure` es Service/SKU; `EncounterProcedure` representa lo realizado; `SvbTariff` mantiene importes y vigencias.
- Una factura lógica por cita, múltiples ítems y versiones explícitas. Firmas y snapshots pertenecen a una versión; históricos firmados/cerrados/sustituidos inmutables.
- IDs BigInt y Decimal viajan como strings. Conservar cantidades exactas y monedas separadas.
- Zona del negocio: `America/Curacao`. La zona del equipo del desarrollador no define fechas clínicas.
- Autorización externa solo cuando las reglas del procedimiento la requieran. `DeclarantId` es configuración de la organización, un requisito distinto.
- No inventar catálogos productivos, tarifas, `NumberOfTreatments`, `Assistance` ni envío real SVB.
- Ante contradicciones: instrucción vigente del usuario, código/rutas/pruebas actuales y contrato específico actualizado. Registrar discrepancias en vez de dar por terminado un cambio por su reporte histórico.

## Límites de esta consolidación

La revisión fue estática y documental. No se comprobó una conexión Supabase, no se corrieron suites de producto, no se inspeccionaron datos clínicos y no se desplegó a Vercel. Los resultados de pruebas mencionados en chats anteriores siguen siendo evidencia histórica.
