---
"@spectratools/tx-shared": patch
---

Ensure `tx-shared` builds `@spectratools/cli-shared` before generating DTS output so telemetry type declarations are present during isolated package builds, and explicitly type the `withSpan` callback parameter to avoid implicit `any` errors.
