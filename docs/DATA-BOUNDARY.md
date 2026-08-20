# Data boundary

Narraiva DSH does not connect to Narraiva Cloud. It has no Narraiva account, entitlement, analytics, manuscript upload, or cloud synchronization path.

Local project files are accessed only through a directory handle granted by the author. Browser persistence may remember that handle, subject to browser permission. DSH owns conversation persistence and DeepSeek API credentials. Narraiva does not read or store the credential.

Before a model request, the UI shows the active document/selection and optional retrieval evidence. Only checked evidence enters the request. A receipt records path, line range, revision, character count, and content hash. The exact evidence payload is sent once through DSH to the configured DeepSeek API. A changed or unreadable source blocks sending.

The unified agent can call only DSH's native `skill` loader. Bundled Narraiva skills contain writing methods and output constraints; loading one does not read project files or grant shell, filesystem, search, or direct-edit authority. The selected skill, routing reason, context scope, and output contract are visible before sending and retained in request metadata.

Ask has no write authority. Write produces Proposal data only. File updates require Narraiva validation and explicit author acceptance; conflicts fail closed and recoverable Change Set state is persisted locally.
