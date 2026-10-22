- `CAMERA_DURATION_MS=1200` proves only a configured duration, not a 1200ms rendered end-to-end journey, constant speed, latest-destination semantics, or absence of queueing.

- “Precisely four statements” conflicts with the listed mirrors—FR012/013, AC02/13, and US2/Q4/C5—creating a real risk that one authoritative representation retains the obsolete 200ms settlement rule.

- “Rendered journey” lacks an explicit clock boundary. Invocation, first visible motion, animation start, final frame, and settlement are distinct events; tests and prose could agree numerically while asserting different behavior.

- “Constant speed” is stronger than “1200ms duration.” Existing easing, frame quantization, path-length normalization, interruption, and retargeting behavior may violate it even when the timer equals 1200.

- Latest-destination/no-queue behavior introduces restart and cancellation timing questions. A retargeted journey may exceed 1200ms wall time or violate constant speed depending on which journey is measured.

- Preserving compact-500 observations risks leaving language that readers or automated consumers interpret as a competing navigator requirement rather than historical evidence.

- The distinction between compact 500, detailed 150, and candidate 100/100 depends on labels and scope being uniformly explicit. Bare numeric mirrors are vulnerable to accidental conflation.

- Updating the V3 checksum only proves byte-level synchronization with the edited contract. It does not prove semantic consistency across Markdown, structured records, generated projections, README, or historical briefs.

- Renewed CHECK2/CHECK13 and AC24 evidence may be treated as implementation validation even though the amendment is documentary and the cited source evidence is narrower than the new obligation.

- Historical `UNRESOLVED/WAIVED` material can become misleading without changing status: preserved descriptions of the former 200ms policy may appear to contradict the amended authority or imply the new rule was previously tested.

- The plan assumes reconciliation/project commands preserve unrelated claims exactly. Projection regeneration can produce broad churn, obscure accidental changes, or rewrite evidence metadata beyond the four approved statements.

- Full gate completion depends on Node 22, browser availability, deterministic rendering, and exact checksum updates. Environmental failures could leave the amendment partially projected or apparently invalid despite a correct textual delta.

- CHECK38 remaining incomplete means the pipeline can pass while the independent critique obligation remains open; any release-readiness inference would therefore exceed the amendment’s evidence.