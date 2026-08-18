# ODONTHO SERVICES — DATABASE HANDOFF CHECKLIST

## Backend may start implementation

Database status:

- [x] MySQL 8.0.46 validated
- [x] 40 functional tables
- [x] Prisma 7.9.1 client generated
- [x] migration baseline `0_init` applied
- [x] Prisma/database diff = 0
- [x] seed idempotent
- [x] ADMIN + RBAC verified
- [x] MySQL integrity test passed
- [x] 33 cross-table consistency rules = 0 violations
- [x] sequence concurrency test passed (50/50 unique)
- [x] test fixtures cleaned

## Backend first implementation order

1. `NumberSequenceService`
2. Authentication + RBAC
3. Patient + Insurance
4. Provider
5. Appointment
6. Clinical Encounter
7. Diagnosis
8. SVB master + tariff lookup
9. Authorization
10. Encounter Procedures
11. Invoice aggregate/version/item creation
12. Signature + content hash
13. Close Invoice
14. Correction workflow
15. Documents/PDF
16. Declaration batches/items
17. Export adapters
18. Submission adapters
19. Audit middleware/service

## Blocked by external master data

- DeclarantId
- PoliClinic code
- Provider IDs
- SVB procedures
- SVB tariffs
- definitive semantic rules for TreatmentId / NumberOfTreatments / Assistance
