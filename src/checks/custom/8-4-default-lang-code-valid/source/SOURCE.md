# Sources of the ISO 639 code list (`custom/8-4-default-lang-code-valid`)

Vendored by the M2 orchestrator on 2026-11-18 at 15:09 UTC, under decision Q54 (Fabien: "Yes, both"). The files are kept byte for byte as downloaded. The check builder derives the pinned list from them and records its version with the check, as the check record requires.

| File | Downloaded from | Version in the file | sha256 |
|---|---|---|---|
| `language-subtag-registry.txt` | https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry | `File-Date: 2026-09-17` | `755fad43283be7b41ebe3c89ad054b6eaf928f404f9c0edb74799e0eab74beb1` |
| `ISO-639-2_utf-8.txt` | https://www.loc.gov/standards/iso639-2/ISO-639-2_utf-8.txt | none (UTF-8 with BOM, CRLF) | `42b71885e4dc885559fda5ad059fd81838cf4782cedb5fd08cc3431f7d067371` |

What each covers:
- The IANA registry (BCP 47, RFC 5646): every ISO 639-1 code, the ISO 639-2, 639-3 and 639-5 codes that have no two-letter code, the reserved range `qaa..qtz`, and deprecated codes such as `in`, `iw`, `ji`, `mo`.
- The Library of Congress table (ISO 639-2 Registration Authority): every ISO 639-2 code in its bibliographic and terminologic forms (`fre` and `fra`, for example), which the IANA registry omits when a two-letter code exists. Format: `B|T|639-1|English name|French name`; the reserved range appears as `qaa-qtz`.

**Licence.** Neither file states a licence or terms of use. The IANA registry is published by IANA for free use under the registration procedure of RFC 5646. The Library of Congress table is published by a United States federal agency as Registration Authority. To confirm before any redistribution beyond this private repository.
