# ODONTHO SVB Backend Postman QA

DEP10/12 vigente: SVB aplazado, nuevas preparaciones/registros devuelven SVB_PRESENTATION_DEFERRED por defecto. [Capacidad Backend, integridad completa y replays](../docs/NEG_DEP_10_12.md). La colección manual siguiente solo se ensaya con habilitación explícita QA local; no sirve para activar el portal en el primer despliegue.

NEG-FINAL-07/08/09 (2026-11-03): [colección manual](NEG_FINAL_07_MANUAL.postman_collection.json), [contrato y cuerpos](../docs/NEG_FINAL_07_09.md), [QA fresco](../docs/NEG_FINAL_09_BACKEND_VALIDATION.md). Captura campo por campo sin archivo: preparar, entrar en portal fuera de la aplicación, subir comprobante y registrar. Colección de ejemplo NO ejecutada en clínica. Usar fixtures propios y claves estables; las peticiones de incertidumbre/liberación son alternativas al registro, no correr todo indiscriminadamente.

NEG-FINAL-06 (2026-11-02): [colección de controles](NEG_FINAL_06.postman_collection.json) y [handoff Backend](../docs/NEG_FINAL_06.md). La ficha clínica no existe: el piloto real está BLOCKED, sin servicios/casos aprobados. Las nuevas peticiones prueban el rechazo de REAL_SVB en un Draft/READY técnico de QA; configurar qaDraftDeclarationId/qaReadyDeclarationId explícitos. Las colecciones técnicas anteriores no acreditan aceptación del portal. No se ejecutó Postman contra clínica como parte de esta entrega.

NEG-FUNC-03/04/05 (2026-10-31): la colección principal ya no envía `declarantIdSnapshot` al crear declaraciones. Backend rechaza un string cliente y vincula la identidad desde la primera factura CLOSED. Consultar [rutas y escenarios nuevos](../docs/NEG_FUNC_03_04_05.md); la colección complementaria `NEG_FUNC_03_04_05.postman_collection.json` cubre las nuevas operaciones. No se ejecutó Postman contra clínica/Supabase operativo como parte de esta entrega.

Sprint 19A/B prepara aceptación manual end-to-end del backend. No modifica `prisma/seed.ts`, schema, migraciones ni permisos.

La colección contiene 96 requests organizados por flujo funcional.

## Baseline

Desde `backend/`:

```bash
npm run typecheck
npm test -- --reporter=dot
```

Los conteos del sprint original son históricos. Para la preparación PostgreSQL, la ejecución local dedicada verificó 31 archivos y 298 tests. Las pruebas de integración requieren `TEST_DATABASE_URL` local con sufijo `_test`; no apuntarlas a Supabase ni a la base operativa. Ver [procedimiento PostgreSQL](../../docs/base-de-datos/MIGRACION_POSTGRESQL.md).

## Dataset QA

Para el proyecto Supabase de pruebas, después del baseline y seed mínimo: `npm run db:qa-seed:supabase`. Para arrancar el backend con esa conexión: `npm run dev:supabase`. El proyecto Supabase y la ejecución Postman aún no se dieron por migrados/validados en la preparación local.

Crear dataset aislado:

```bash
npx tsx src/scripts/qa-postman-cleanup.ts
npx tsx src/scripts/qa-postman-seed.ts
```

El seed imprime JSON con IDs y credenciales QA. Copia esos valores en `ODONTHO_LOCAL.postman_environment.json` o en el environment importado en Postman.

Credenciales locales creadas:

- ADMIN: `qa-postman.admin@local.invalid`
- RECEPTION: `qa-postman.reception@local.invalid`
- PROVIDER: `qa-postman.provider@local.invalid`
- Password común: `QaPostman!2026`

Todos los datos creados usan `QA-POSTMAN-*`, `QA-*` o `@local.invalid`.

## Ejecución

1. Levanta el backend local:

   ```bash
   npm run dev
   ```

2. Importa:

   - `postman/ODONTHO_SVB_BACKEND.postman_collection.json`
   - `postman/ODONTHO_LOCAL.postman_environment.json`

3. Selecciona `ODONTHO_LOCAL`.
4. Ejecuta carpetas en orden.

Los requests no usan un token genérico. Los logins guardan solamente `adminToken`, `receptionToken` y `providerToken`; cada request protegido declara su header `Authorization` con el actor esperado. Los requests `Without Token`/`401` deben permanecer sin header `Authorization`.

## Firma QA

El request `Upload Signature Document` usa body tipo `file`. Selecciona:

```text
tests/fixtures/qa-postman-signature.png
```

No se incluye base64 grande en la colección. El backend valida MIME declarado, tamaño y hash de almacenamiento.

## Cobertura

La colección cubre:

- Health, Auth, `/auth/me`
- Users and Roles
- Patients, Insurance, Payers
- Providers
- Appointments y overlap
- Clinical Encounters
- Diagnosis assignment
- SVB catalog, tariffs and authorizations
- Encounter Procedures con y sin autorización
- Authorization quantity readback
- Invoice, signature, close y PDF
- Correction workflow con replacement version
- Declaration CSV/TXT export
- Submission sin adapter, esperado `503 SUBMISSION_ADAPTER_NOT_CONFIGURED`
- Negativos mínimos: 401, 403, invalid ID, duplicate encounter/diagnosis, invalid authorization quantity, duplicate invoice, appointment not billable, invalid signature document, stale signature hash y mutación cerrada

## RBAC Matrix Summary

| Action | ADMIN | RECEPTION | PROVIDER | Expected |
| --- | --- | --- | --- | --- |
| Read catalog/master data | yes | yes | yes | 200 |
| Patient create/update | yes | yes | no | provider 403 |
| Insurance create/update/verify | yes | yes | read only | provider mutation 403 |
| Appointment create/check-in/cancel | yes | yes | limited status operations | per permission |
| Encounter create/update/complete | yes | read only | yes | reception mutation 403 |
| Diagnosis assign | yes | no | yes | reception 403 |
| Procedure add/update/void | yes | read only | yes | reception mutation 403 |
| Authorization create/update | yes | yes | read only | provider mutation 403 |
| Invoice create/sign/close | yes | yes | partial by permission | per permission |
| Apply correction | yes | no | no | requires `invoice.apply_correction` |
| Declaration export/submit | yes | no | no | reception/provider 403 |

Authorization remains permission-based. Do not infer behavior from role names alone.

## DBR-001

Auth acceptance covers access-token login and `/auth/me`. Refresh tokens, logout revocation and persistent auth sessions remain blocked by DBR-001 and must not be declared production-complete.

## Cleanup

After manual QA:

```bash
npx tsx src/scripts/qa-postman-cleanup.ts
```

The cleanup deletes only QA organizations, users, master-data fixtures and linked records marked with the QA prefixes.
