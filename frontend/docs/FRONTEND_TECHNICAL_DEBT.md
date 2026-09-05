# Frontend Technical Debt

## Build And Architecture

- Route splitting reduced the entry chunk to 310.00 kB, but total distributed JavaScript is 667.22 kB (217.37 kB gzip). The largest shared lazy dependency chunk is `schemas` at 90.18 kB (25.54 kB gzip), primarily form/schema infrastructure. No dependency replacement is justified currently.
- The largest feature chunk is Clinical at 41.68 kB gzip 10.14 kB. Split it further only if measured navigation latency becomes material on clinic hardware.
- A failed lazy chunk reloads the document. Under DBR-001 this also requires a new login because authentication is intentionally memory-only.

## Remaining Manual QA

- A normal external browser must visually open generated invoice PDFs. Authenticated retrieval, MIME validation, version association, download links, and object-URL cleanup are automated or browser-validated; the integrated browser blocks final native-viewer acceptance.
- Live Backend shutdown was not forced because the running service was shared. Network-failure behavior is covered at the mocked API boundary and should be rechecked during deployment rehearsal.
- The browser pass covered representative administrator permissions, direct automated denial, 401 clearing, and 403 retention. It did not manually exercise every possible permission combination.
- This sprint performed an accessibility engineering pass, not formal WCAG certification or assistive-technology certification.

## Runtime Observations

- React StrictMode may abort an initial GET before the successful development request. No mutation is effect-driven and duplicate mutation guards are in place.
- Historical files missing from Backend local storage cannot be repaired by the Frontend; see `KNOWN_CONTRACT_GAPS.md`.
