# Known Backend Contract Gaps

These are frozen Backend limitations, not Frontend defects. The Frontend must not work around them with inferred IDs, local business rules, or fabricated data.

## Scheduling And Coverage

- No mounted ClinicLocation lookup exists, so appointment creation cannot obtain an authoritative `clinicLocationId`.
- Appointment status history is not exposed as a read endpoint.
- Insurance verification metadata is not a service-date eligibility verdict. The Frontend must not label coverage as eligible from dates alone.

## Clinical And Billing

- TreatmentCase is available only through existing references and snapshots; no practical lookup or CRUD workflow is frozen.
- Production semantics for `NumberOfTreatments` and `Assistance` remain unresolved. No defaults are generated.
- Encounter completion does not automatically complete the appointment.
- Procedure deletion behavior differs between freeze prose and service implementation; no client workaround is used.
- Failed signature capture may leave an unlinked uploaded document because no cleanup endpoint exists.

## Declarations And Documents

- No declaration-candidate/eligibility endpoint is exposed. Items are submitted by authoritative invoice-item ID and validated by the Backend.
- Declaration item removal and declaration status-history endpoints are absent.
- `XLSX` and `API_PAYLOAD` appear in schema/domain types but are not supported by the mounted export service; the UI exposes only `CSV`, `TXT`, `JSON`, and `XML`.
- The submission adapter is not configured in the local environment; `SUBMISSION_ADAPTER_NOT_CONFIGURED` is expected.
- Historical document records `1202` and `1203` reference missing local files. Newly generated documents remain available.

## Administration And Session

- Settings CRUD is absent. `/admin/settings` remains informational.
- Roles and permissions are read-only. No role mutation, custom permission assignment, or user-specific override endpoint exists.
- No administrative user deletion or password-reset endpoint is mounted.
- DBR-001 provides no refresh-token or server logout contract. Tokens remain memory-only, reload requires login, and logout discards the local token only.
