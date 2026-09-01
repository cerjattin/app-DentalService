# ODONTHO SVB Backend Postman QA

Sprint 19A/B prepara aceptación manual end-to-end del backend. No modifica `prisma/seed.ts`, schema, migraciones ni permisos.

La colección contiene 96 requests organizados por flujo funcional.

## Baseline

Desde `backend/`:

```bash
npm run typecheck
npm test -- --reporter=dot
```

Baseline esperado: 25 archivos de test y 201 tests.

## Dataset QA

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
