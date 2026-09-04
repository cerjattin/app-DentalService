# F05 Clinical Contract Inventory

Sources: API_FREEZE_BACKEND, FRONTEND_HANDOFF, BACKEND_RELEASE_CHECKLIST; the
clinical-encounters, diagnoses, svb-catalog, authorizations and encounter-procedures
schemas, response mappers, routes and services resolve missing DTO/lifecycle detail.
Paths below are relative to the configured API base. IDs and decimals are strings.

| Method/path | Permission | Request / response |
| --- | --- | --- |
| GET /appointments/:id | appointment.read | Existing F04 Appointment |
| PATCH /appointments/:id/status | appointment.start for IN_PROGRESS | `{status: IN_PROGRESS}` / Appointment |
| GET /appointments/:id/clinical-encounter | encounter.read | ClinicalEncounter; 404 CLINICAL_ENCOUNTER_NOT_FOUND means absent |
| POST /appointments/:id/clinical-encounter | encounter.create | Optional nullable chiefComplaint, clinicalNotes (65535 chars) / ClinicalEncounter |
| PATCH /clinical-encounters/:id | encounter.update | chiefComplaint, clinicalNotes / ClinicalEncounter |
| POST /clinical-encounters/:id/complete | encounter.complete | No body / ClinicalEncounter |
| GET /diagnosis-codes | diagnosis.read | q, isActive, page, pageSize / DiagnosisCode[] + flat meta |
| GET /clinical-encounters/:id/diagnoses | diagnosis.read | EncounterDiagnosis[] |
| POST /clinical-encounters/:id/diagnoses | diagnosis.assign | diagnosisCodeId, isPrimary, notes / EncounterDiagnosis |
| PATCH /clinical-encounters/:id/diagnoses/:diagnosisId | diagnosis.assign | isPrimary, notes / EncounterDiagnosis |
| DELETE /clinical-encounters/:id/diagnoses/:diagnosisId | diagnosis.assign | No body / removed EncounterDiagnosis |
| GET /svb-procedures | svb_procedure.read | q, isActive, serviceDate, page, pageSize / SvbProcedure[] + flat meta |
| GET /svb-procedures/:id/applicable-tariff | svb_tariff.read | serviceDate, currencyCode / {procedure, tariff, serviceDate} |
| GET /authorizations | authorization.read | patientId, page, pageSize, q / Authorization[] including items + flat meta |
| POST /authorizations | authorization.create | patientId, patientInsuranceId, authorizationId, status, validFrom, validTo, issuedAt, notes; optional metadata / Authorization |
| PATCH /authorizations/:id | authorization.update | status, validFrom, validTo, issuedAt, notes; optional metadata / Authorization |
| POST /authorizations/:id/items | authorization.update | nullable svbProcedureId, authorizedQuantity, validFrom, validTo, notes / AuthorizationItem |
| PATCH /authorizations/:id/items/:itemId | authorization.update | same allowed fields / AuthorizationItem |
| GET /clinical-encounters/:id/procedures | procedure.read | EncounterProcedure[] |
| POST /clinical-encounters/:id/procedures | procedure.update | patientInsuranceId, svbProcedureId, quantity; nullable authorizationItemId, diagnosisId, additionalNote / EncounterProcedure |
| PATCH /clinical-encounters/:id/procedures/:procedureId | procedure.update | diagnosisId, additionalNote only / EncounterProcedure |
| DELETE /clinical-encounters/:id/procedures/:procedureId | procedure.update | No body / removed EncounterProcedure |
| GET /patients/:id/insurance | insurance.read | Existing F03 PatientInsurance[] |

## Response and Lifecycle Rules

ClinicalEncounter contains appointmentId, providerId, OPEN/COMPLETED/VOID status,
startedAt/completedAt, notes, appointment/patient/provider context and audit fields.
Create requires an IN_PROGRESS appointment. Explicit F04 start is separate.
Provider ownership comes from appointment.providerId; no user-ID inference.
Completion requires OPEN only: no diagnosis/procedure-count prerequisite in the
service. It neither changes appointment status nor generates an invoice.

Diagnosis responses contain code/description snapshots, isPrimary and notes;
updates cannot change the code. Assignment checks catalogue validity for the
appointment date. All diagnosis/clinical mutations require OPEN.

Procedure creation resolves ANG tariff for scheduledStart in America/Curacao;
validates insurance, diagnosis ownership and authorization if required. It copies
TreatmentCase.treatmentId server-side. Quantity, tariff and amount are decimals.
Update permits notes/diagnosis only. PERFORMED is editable; billed data is not.
Completed/VOID encounters are read-only. DELETE service physically removes the
record (contrary to freeze prose saying logical void); UI must warn accordingly.

Authorization statuses: PENDING, APPROVED, PARTIALLY_USED, EXHAUSTED, EXPIRED,
CANCELLED. Administrative input accepts only PENDING/APPROVED/EXPIRED/CANCELLED.
Items expose authorizedQuantity, usedQuantity and authoritative remainingQuantity.
Procedure reassignment is forbidden after item usage. Backend checks periods and
remaining quantities. No client-side eligibility verdict or approval inference.

## Gaps and Boundaries

No TreatmentCase routes/lookup/create are frozen. Display appointment.treatmentCaseId
as a reference, never as TreatmentId, plus returned treatmentIdSnapshot only.
No public authorization eligibility resolver; procedure POST remains authority.
No referral capture endpoint in this workflow. No manual tariff/currency override,
quantity edits after creation, NumberOfTreatments or Assistance inputs, billing,
or automatic appointment completion. Optional authorization metadata is not edited.
Full consumed response DTOs and separate write DTOs live in src/types/clinical.ts.
Exact mapped error codes live centrally in src/api/error-messages.ts.
