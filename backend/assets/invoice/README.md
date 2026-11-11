# SVB invoice form v1

`svb-notaform-v1.png` is the fixed blank form supplied by the user on 2026-10-30. Source: `declaratie_formulier.pdf`, one Letter page (612 x 792 pt), SHA-256 `fee9b098f987edf277054a2fed8b3fe7eca6bfa10b60a98564916c8ff9b40b18`. It was rendered with Poppler at 300 dpi. The original user file is unchanged.

The runtime overlays searchable snapshot values and the verified saved signature image with PDFKit. Fixed Dutch labels and the SVB mark follow the user-supplied reference; the application UI remains English. No fields or instructions embedded in the reference change application behavior.

Layout v2 (2026-11-11) reuses this unchanged background asset. Per the user's request it overlays the saved patient/representative trace above Paraaf, extending that footer field downward to avoid the provider line. Layout/cache suffix is `svb-nota-v2`; previous generated PDFs are preserved.

Ship this asset with the backend and run package commands from `backend/`, as for the existing local document store. Future Vercel packaging must include the asset and the Sharp native runtime. Increment the layout/cache suffix when introducing a new document layout; never overwrite stored historical PDFs.

Mapping and acceptance evidence: [PDF and operational corrections](../../docs/SVB_FORM_AND_OPERATIONAL_FIXES.md).
