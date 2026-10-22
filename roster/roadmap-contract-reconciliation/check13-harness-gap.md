# CHECK-13 current-source execution gap

The unmodified real CHECK-13 runner returned exit2 with `spawnSync rtk ENOBUFS`, exceeding its50,000,000-byte stdout buffer while executing the selected native JSON report with embedded attachments. The captured report is incomplete and is not a behavioral assertion or PASS. Captured report SHA256:6566c71af75f0dc575f1fb4de0987dfcca31aad8d3ce0e4729c661376c1cb93b. Artifact retained at /tmp/observatory-v3-AC-13-DxEw5R/AC-13.playwright.json.

No runner, required scenarios, assertion count, product code or historical evidence changed to bypass this gap. Fresh full acceptance requires a separately reviewed guard/report repair.
