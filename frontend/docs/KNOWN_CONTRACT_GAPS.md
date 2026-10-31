# Known Backend Contract Gaps

These are frozen Backend limitations, not Frontend defects. The Frontend must not work around them with inferred IDs, local business rules, or fabricated data.

## Scheduling And Coverage

- ClinicLocation lookup and shared appointment creation are available; patient/provider/location read permissions are required for selection.
- Appointment status history is not exposed as a read endpoint.
- Insurance verification metadata is not a service-date eligibility verdict. The Frontend must not label coverage as eligible from dates alone.

## Clinical And Billing

- TreatmentCase list/detail/create/update are published and integrated under patient routes in NEG-FUNC-05. Editing depends on server isEditable; no delete or state transitions are exposed.
- Production semantics for `NumberOfTreatments` and `Assistance` remain unresolved. No defaults are generated.
- Encounter completion does not automatically complete the appointment.
- Procedure deletion behavior differs between freeze prose and service implementation; no client workaround is used.
- Failed signature capture may leave an unlinked uploaded document because no cleanup endpoint exists.

## Declarations And Documents

- NEG-FUNC-04 publishes paginated candidates; selection submits the exact invoice-item ID and the Backend rechecks availability and SVB snapshots.
- Draft item removal/cancellation with reason are published and integrated. A declaration status-history read endpoint remains absent.
- `XLSX` and `API_PAYLOAD` appear in schema/domain types but are not supported by the mounted export service; the UI exposes only `CSV`, `TXT`, `JSON`, and `XML`.
- The submission adapter is not configured in the local environment; `SUBMISSION_ADAPTER_NOT_CONFIGURED` is expected.
- Historical document records `1202` and `1203` reference missing local files. Newly generated documents remain available.

## Administration And Session

- Organization settings GET/PATCH are published and integrated at `/admin/settings`, with independent permissions, reason and opaque revision. No organization create/delete workflow is exposed.
- Roles and permissions are read-only. No role mutation, custom permission assignment, or user-specific override endpoint exists.
- No administrative user deletion or password-reset endpoint is mounted.
- DBR-001 provides no refresh-token or server logout contract. Tokens remain memory-only, reload requires login, and logout discards the local token only.

NEG-FUNC-03/04/05 were verified against dedicated local PostgreSQL QA, not Supabase operational. See [validation and deployment prerequisites](NEG_FUNC_03_04_05_VALIDATION.md).
