# Privacy and data boundary

Narraiva DSH is local-first and does not connect to Narraiva Cloud. Projects and Narraiva settings remain in the author-granted local directory and local DeepSeek Harness profile.

The DeepSeek API key is configured and managed by DeepSeek Harness. Narraiva DSH does not read, persist, log, or transmit that key. When the author sends an Ask or Write request, the visible current-document context and any explicitly selected retrieval evidence are sent directly through the configured DSH model provider to the DeepSeek API. The UI shows the evidence scope before sending and records a Context Receipt.

No Narraiva analytics or telemetry is enabled by this package. The launcher disables DSH telemetry by default unless the user deliberately overrides its environment setting. Review DeepSeek Harness and model-provider policies separately because they are independent projects and services.
