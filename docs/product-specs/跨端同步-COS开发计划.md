# ReMarker 跨端同步（腾讯云 COS）开发计划

> Implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add provider-neutral, conflict-safe cross-platform data sync to ReMarker, with complete Settings configuration and Tencent Cloud COS as the first remote object storage provider.

**Architecture:** Keep IndexedDB as the local source of truth. A provider-independent sync engine creates a versioned plaintext JSON snapshot for each device, merges changed snapshots from other devices, applies record-level last-write-wins plus deletion tombstones, and writes only the current device's remote object. COS is a thin adapter behind a minimal object-storage interface, so later S3, WebDAV, OneDrive, or other providers do not change merge, snapshot, or UI state logic.

**Tech Stack:** TypeScript, Chrome Manifest V3 service worker, IndexedDB, Vitest, `fake-indexeddb`, Tencent Cloud `cos-js-sdk-v5`.

---

## Product Decisions

### MVP sync scope

Sync these durable user records:

- Footprints, keyed by `urlKey`.
- Highlights and highlight notes, keyed by `id`.
- Vocabulary and translations, keyed by `id`, including review state.
- Per-site enabled settings, keyed by `hostname`.

Do not sync these in the first release:

- LLM API keys, COS credentials, temporary tokens, or other secrets.
- Audio cache blobs and pronunciation cache metadata; these are large and reproducible.
- Device-local startup cache, extension enabled state, disabled-site startup copy, or transient UI state.
- Highlight restore `status`; it is derived from the current page on the current device. Imported highlights start at `pending`.
- General `AppSettings`. A later release may sync an explicit allowlist of non-sensitive preferences with its own timestamps.

### Security and privacy model

- Remote snapshots are stored as versioned plaintext JSON in v1, without an additional client-side protection layer.
- Settings must clearly recommend a private COS bucket and a dedicated prefix. The user is responsible for keeping the bucket private and limiting access through COS/CAM permissions.
- COS credentials live in a dedicated local `syncSecrets` IndexedDB store and are only read by the service worker.
- Support both a restricted CAM SecretId/SecretKey and a user-supplied temporary-credential endpoint in the first release. The UI must warn that a static key must belong to a dedicated sub-user limited to the configured bucket/prefix.
- Implement the temporary-credential mode through the SDK's `getAuthorization` callback. This is the recommended mode for users who already operate a compatible credential service; ReMarker does not host that service in v1.
- Credentials, temporary tokens, LLM API keys, and other secrets must never enter remote snapshots, backup JSON, logs, runtime errors, or status responses.
- Parse and strictly validate every remote object before any local write. Malformed or unsupported snapshots fail closed.
- Never auto-configure bucket CORS or CAM policy from the extension because that would require broader credentials than object sync itself.

### Conflict model

- Remote object layout: `<prefix>/v1/devices/<deviceId>.json`.
- Each device writes only its own object, so devices never race to overwrite one shared snapshot.
- On sync, list device objects; download new or changed ETags; parse and validate; merge with local data; apply locally; then upload the current device's merged snapshot.
- A newer `updatedAt` wins. A tombstone with `deletedAt >= updatedAt` wins over a live record.
- Equal timestamps use canonical serialized content as a deterministic tie-breaker, so every device reaches the same result.
- Detect remote timestamps more than five minutes ahead of the local clock and surface a clock-skew warning. Do not invent a server timestamp or silently rewrite user data.
- Tombstones are retained indefinitely in v1. Garbage collection requires per-device acknowledgements and is outside this release.

### Settings configuration design

Add a dedicated **Data Sync** section to the existing Settings tab. Sync is opt-in and disabled by default for both new and upgraded installations.

#### Settings hierarchy and visibility

1. **Enable cross-device sync** toggle is always visible.
2. When disabled, keep any saved provider configuration and credentials locally, cancel the sync alarm, skip startup sync, and disable **Test connection** and **Sync now**. Disabling is reversible and does not delete local or remote data.
3. When enabled, show a **Storage provider** selector. The initial option is **Tencent Cloud COS**; the selector remains visible so future providers can be added without redesigning Settings.
4. After a provider is selected, render that provider's configuration form, validation, connection controls, and help text.
5. Show **Automatic sync** only after a provider is selected. When automatic sync is enabled, show an interval selector with `15`, `30`, and `60` minutes.
6. Keep **Sync now** available when sync is enabled and the active provider has a complete saved configuration, regardless of whether automatic sync is enabled.

Turning off an already active toggle is persisted immediately so background sync stops at once. Turning it on for an incomplete setup opens the provider form, but sync becomes active only after **Save configuration** succeeds. Show a clear unsaved/setup state while the toggle is not yet committed.

#### Tencent Cloud COS fields

| Field | Required | Storage | Behavior |
| --- | --- | --- | --- |
| Bucket | Yes | `AppSettings` | Full COS bucket name including the AppId suffix, for example `remarker-sync-1250000000`. |
| Region | Yes | `AppSettings` | COS region such as `ap-shanghai`; trim whitespace and do not infer it from Bucket. |
| Remote path/prefix | Yes | `AppSettings` | Relative prefix dedicated to ReMarker, default `remarker`; trim whitespace/trailing `/` and reject a leading `/`. |
| Authentication mode | Yes | `AppSettings` | `Restricted static key` or `Temporary credential endpoint`. |
| SecretId | Static key only | `syncSecrets` | Password-style secret input; never returned to or redisplayed by the UI after saving. |
| SecretKey | Static key only | `syncSecrets` | Password-style secret input; never returned to or redisplayed by the UI after saving. |
| Temporary credentials URL | Temporary mode only | `AppSettings` | HTTPS endpoint used by the service worker to obtain short-lived COS credentials. Localhost HTTP is allowed only for development. |
| Automatic sync | No | `AppSettings` | Defaults off; controls alarm and startup synchronization. |
| Sync interval | Auto sync only | `AppSettings` | `15`, `30`, or `60` minutes; default `30`. |

The form must state that v1 uploads readable JSON and recommend a private bucket with a least-privilege CAM identity restricted to the configured bucket and prefix. This is an informational warning, not a blocking confirmation.

#### Provider-neutral configuration contract

Use a discriminated union so every future provider owns its required settings and validation:

```ts
export type SyncProvider = "tencent-cos";

export interface TencentCosSyncConfig {
  provider: "tencent-cos";
  bucket: string;
  region: string;
  prefix: string;
  authMode: "static-key" | "temporary-credentials";
  temporaryCredentialsUrl?: string;
}

export type SyncProviderConfig = TencentCosSyncConfig;

export interface SyncConfig {
  enabled: boolean;
  provider?: SyncProvider;
  providerConfig?: SyncProviderConfig;
  autoSync: boolean;
  intervalMinutes: 15 | 30 | 60;
}
```

`providerConfig.provider` must match `provider`. Provider secrets use a parallel discriminated union in `syncSecrets`; they must not be placed in `AppSettings` or returned by `GET_SYNC_STATUS`.

#### Save, test, and sync interactions

- **Save configuration** validates the visible provider form and sends configuration plus optional new secrets as one command. The service worker persists them atomically, updates the alarm, and leaves previously stored static credentials unchanged when both secret inputs are blank.
- Switching authentication mode requires credentials for the new mode before connection testing or synchronization. After a successful save, obsolete secrets from the previous mode are cleared.
- **Test connection** is enabled only after a valid configuration has been saved. It uses the saved provider configuration and locally stored credentials, performs a write-read-delete probe under `<prefix>/v1/probes/`, and must not enable sync automatically.
- **Sync now** is enabled only when the form is clean and the saved configuration is complete and connection-verified. Prevent concurrent test/save/sync actions and show progress on the active action.
- Status shows whether credentials are configured, last successful sync time, last error with redacted COS request ID when available, uploaded/downloaded record counts, and warnings such as clock skew.
- **Disconnect** requires confirmation, sets `enabled` and `autoSync` to false, cancels the alarm, and clears local provider credentials. It must explicitly state that local records, provider configuration, and remote objects are retained.
- Store connection verification against a canonical fingerprint of provider, Bucket, Region, prefix, authentication mode, and temporary-credential URL. A successful test verifies only that exact configuration; secret replacement also invalidates verification.

#### Validation and UI states

- Bucket must match the COS full-name shape and include a numeric AppId suffix.
- Region, Bucket, and prefix are trimmed and required. Prefix must be relative, must not contain `..` path segments, and is normalized without leading or trailing slashes.
- Static authentication requires both SecretId and SecretKey when credentials are not already configured. When saved credentials exist, blank inputs mean “keep existing”; replacing credentials requires entering both values.
- Temporary credentials URL must be a valid HTTPS URL, except `http://localhost` and `http://127.0.0.1` in development builds.
- Changing Bucket, Region, prefix, provider, or authentication mode marks the connection as unverified and requires a new successful connection test before **Sync now** is enabled.
- While a configuration is unverified, preserve the user's `autoSync` preference but suspend the startup trigger and alarm. Resume them after a successful test of the saved configuration.
- Provider or credential failures must not turn off sync automatically. Preserve the configuration, record the redacted error, and let the user correct and retry it.
- Manual backup may include the non-sensitive provider configuration, but import must force `enabled: false` and `autoSync: false`, clear connection verification, and never overwrite this device's locally stored sync credentials. The user must explicitly reconnect after import.

### Why not upload the existing backup JSON

The current backup format has no deletion history, does not merge all record types consistently, includes settings with a separate sensitivity policy, and would make concurrent devices overwrite one another. Sync therefore needs a versioned protocol distinct from manual backup/export.

## Data Flow

```text
Options UI
   | RUN_SYNC_NOW / SAVE_SYNC_CONFIGURATION
   v
MV3 service worker
   |-- Sync engine
   |     |-- load local records + tombstones
   |     |-- parse/validate remote device snapshots
   |     |-- deterministic merge
   |     |-- atomic local apply
   |     `-- canonicalize current device snapshot
   |
   `-- RemoteObjectStorage interface
          `-- TencentCosStorage adapter
                 `-- COS list/get/put/head/delete APIs
```

## File Map

### Create

- `src/shared/sync/types.ts`: Sync protocol, tombstones, provider configuration unions, provider-neutral metadata, status/result types.
- `src/shared/sync/merge.ts`: Pure record normalization and deterministic merge rules.
- `src/shared/sync/snapshot.ts`: Build, validate, and canonicalize versioned device snapshots.
- `src/shared/__tests__/sync-merge.test.ts`: Create/update/delete/conflict/status-normalization tests.
- `src/shared/__tests__/sync-snapshot.test.ts`: Schema and malformed remote input tests.
- `src/background/sync/remote-object-storage.ts`: Minimal provider contract.
- `src/background/sync/create-remote-storage.ts`: The only provider-selection factory; imports concrete adapters.
- `src/background/sync/tencent-cos-storage.ts`: COS SDK adapter and error mapping.
- `src/background/sync/sync-engine.ts`: Single-flight sync orchestration.
- `src/background/__tests__/tencent-cos-storage.test.ts`: Adapter tests with an injected fake COS client.
- `src/background/__tests__/sync-engine.test.ts`: Two-device and failure-path integration tests with in-memory storage.
- `src/options/SyncSettingsSection.tsx`: Sync enablement, provider configuration, connection test, manual sync, and status UI.
- `docs/development/tencent-cos-sync.md`: COS bucket, CORS, least-privilege credential, plaintext-data warning, and two-profile test instructions.

### Modify

- `package.json`, `package-lock.json`: Add `cos-js-sdk-v5` and `fake-indexeddb`.
- `src/shared/types.ts`: Add non-sensitive sync configuration and bump IndexedDB schema version.
- `src/shared/messages.ts`: Add typed sync commands and redacted responses.
- `src/shared/repositories/db.ts`: Add sync state, secrets, tombstone stores and atomic merge application.
- `src/shared/export.ts`: Explicitly strip all sync credentials and temporary tokens.
- `src/shared/__tests__/export.test.ts`: Prove sync secrets cannot enter backup output.
- `src/background/service-worker.ts`: Add sync handlers, alarm scheduling, startup trigger, and tombstone-aware deletion.
- `src/options/App.tsx`: Mount the sync settings section and refresh status after actions.
- `src/shared/i18n/en.ts`, `es.ts`, `zh-CN.ts`, `zh-TW.ts`: Add all sync labels, warnings, statuses, and actionable errors.
- `public/manifest.json`: Reuse the existing `alarms` permission and current HTTP/HTTPS host permissions; do not broaden permissions for sync.


## Task 1: Add Sync Contracts and Dependencies

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/shared/types.ts`
- Create: `src/shared/sync/types.ts`
- Create: `src/shared/sync/snapshot.ts`
- Create: `src/shared/__tests__/sync-snapshot.test.ts`

- [ ] **Step 1: Install the COS SDK and IndexedDB test helper**

Run:

```bash
npm i cos-js-sdk-v5
npm i -D fake-indexeddb
```

Expected: both packages appear in `package.json` and `package-lock.json` changes without unrelated dependency upgrades.

- [ ] **Step 2: Add non-sensitive application settings**

Add the provider-neutral configuration from **Settings configuration design** to `src/shared/types.ts`. Keep `provider` and `providerConfig` optional so disabled legacy installations normalize safely:

```ts
export type SyncProvider = "tencent-cos";

export interface TencentCosSyncConfig {
  provider: "tencent-cos";
  bucket: string;
  region: string;
  prefix: string;
  authMode: "static-key" | "temporary-credentials";
  temporaryCredentialsUrl?: string;
}

export type SyncProviderConfig = TencentCosSyncConfig;

export interface SyncConfig {
  enabled: boolean;
  provider?: SyncProvider;
  providerConfig?: SyncProviderConfig;
  autoSync: boolean;
  intervalMinutes: 15 | 30 | 60;
}
```

Add `sync: SyncConfig` to `AppSettings` and normalize missing legacy values to `{ enabled: false, autoSync: false, intervalMinutes: 30 }`. Do not bump `SCHEMA_VERSION` yet; the version bump must be committed atomically with the new object stores in Task 4.

- [ ] **Step 3: Define the versioned sync protocol**

Create `src/shared/sync/types.ts` with these core contracts:

```ts
import type {
  FootprintRecord,
  HighlightRecord,
  SiteSetting,
  VocabularyRecord,
} from "../types";

export type SyncEntityType =
  | "footprints"
  | "highlights"
  | "vocabulary"
  | "siteSettings";

export interface SyncTombstone {
  key: string;
  entityType: SyncEntityType;
  recordId: string;
  deletedAt: string;
  deviceId: string;
}

export interface DeviceSyncSnapshot {
  format: "remarker-sync";
  version: 1;
  deviceId: string;
  generatedAt: string;
  footprints: FootprintRecord[];
  highlights: HighlightRecord[];
  vocabulary: VocabularyRecord[];
  siteSettings: SiteSetting[];
  tombstones: SyncTombstone[];
}
```

Also define `SyncRunStatus`, `SyncRunResult`, redacted `SyncConfigurationStatus`, discriminated `SyncSecretInput`, and remote object metadata used by messages. Status may expose booleans such as `hasCredentials`, never credential values.

- [ ] **Step 4: Write schema-validation tests first**

Cover wrong `format`, unsupported `version`, missing arrays, invalid entity IDs, invalid timestamps, unknown entity types, and a valid empty snapshot. The parser must return a typed result or throw a `SyncProtocolError`; it must never cast untrusted JSON directly.

- [ ] **Step 5: Implement the protocol parser**

Create `src/shared/sync/snapshot.ts` and expose:

```ts
export function parseDeviceSyncSnapshot(input: unknown): DeviceSyncSnapshot;
```

Validate each field at the trust boundary and return freshly constructed objects. Do not preserve unknown remote properties.

- [ ] **Step 6: Run the focused test and typecheck**

Run:

```bash
npm test -- src/shared/__tests__/sync-snapshot.test.ts
npm run typecheck
```

Expected: the focused suite passes and TypeScript reports no errors.

- [ ] **Step 7: Commit the contracts**

```bash
git add package.json package-lock.json src/shared/types.ts src/shared/sync/types.ts src/shared/sync/snapshot.ts src/shared/__tests__/sync-snapshot.test.ts
git commit -m "feat: define cross-platform sync contracts"
```

## Task 2: Add Canonical Plaintext Snapshot Serialization

**Files:**

- Modify: `src/shared/sync/snapshot.ts`
- Modify: `src/shared/__tests__/sync-snapshot.test.ts`

- [ ] **Step 1: Write serialization and trust-boundary tests**

Tests must prove:

```ts
it("round-trips a valid versioned plaintext snapshot");
it("produces identical bytes for semantically identical record orderings");
it("produces a stable content hash for canonical bytes");
it("rejects malformed JSON and unsupported versions before local writes");
it("omits credentials, API keys, and unknown properties from snapshots");
```

- [ ] **Step 2: Implement canonical serialization and hashing**

Expose focused operations:

```ts
export function serializeDeviceSyncSnapshot(
  snapshot: DeviceSyncSnapshot,
): Uint8Array;
export function deserializeDeviceSyncSnapshot(
  body: Uint8Array,
): DeviceSyncSnapshot;
export async function hashDeviceSyncSnapshot(
  snapshot: DeviceSyncSnapshot,
): Promise<string>;
```

Sort every record collection by its stable key and tombstones by `key` before serialization. Normalize synced highlight `status` to `pending`.

Decode remote bytes as UTF-8, parse JSON, and pass the result through `parseDeviceSyncSnapshot`. Use one canonical serializer for hashing, tie-breaking, upload bytes, and tests. Do not interpolate JSON manually.

- [ ] **Step 3: Run focused tests**

```bash
npm test -- src/shared/__tests__/sync-snapshot.test.ts
```

Expected: canonical output and hashes are stable, valid round trips pass, and malformed or secret-bearing input is rejected or sanitized as specified.

- [ ] **Step 4: Commit snapshot serialization**

```bash
git add src/shared/sync/snapshot.ts src/shared/__tests__/sync-snapshot.test.ts
git commit -m "feat: serialize and validate sync snapshots"
```

## Task 3: Implement Deterministic Record Merge

**Files:**

- Create: `src/shared/sync/merge.ts`
- Create: `src/shared/__tests__/sync-merge.test.ts`

- [ ] **Step 1: Write failing merge tests**

Cover these exact cases for every entity type:

- Local-only and remote-only records are retained.
- Newer `updatedAt` wins.
- A newer tombstone removes a live record.
- A newer recreated record wins over an older tombstone.
- Equal timestamps resolve identically regardless of input order.
- Remote highlight restore status becomes `pending`.
- A timestamp more than five minutes in the future produces a warning but does not mutate the timestamp.
- Invalid remote input aborts the whole merge and leaves the local input untouched.

- [ ] **Step 2: Implement pure merge functions**

Use a table-driven entity definition instead of four separate algorithms:

```ts
interface SyncEntityDefinition<T> {
  type: SyncEntityType;
  getId(record: T): string;
  getUpdatedAt(record: T): string;
  normalizeRemote(record: T): T;
}

export function mergeDeviceSnapshots(
  local: DeviceSyncSnapshot,
  remotes: DeviceSyncSnapshot[],
  now: string,
): SyncMergeResult;
```

For timestamp ties, compare canonical serialized records lexically. Tombstones participate in the same winner selection rather than running in a second destructive pass.

- [ ] **Step 3: Run the focused merge suite**

```bash
npm test -- src/shared/__tests__/sync-merge.test.ts
```

Expected: all permutations converge on the same merged snapshot.

- [ ] **Step 4: Commit merge behavior**

```bash
git add src/shared/sync/merge.ts src/shared/__tests__/sync-merge.test.ts
git commit -m "feat: add deterministic sync merge rules"
```

## Task 4: Add Durable Sync State, Secrets, and Tombstones

**Files:**

- Modify: `src/shared/repositories/db.ts`
- Modify: `src/shared/export.ts`
- Modify: `src/shared/__tests__/export.test.ts`
- Modify: `src/background/service-worker.ts`
- Create: `src/shared/__tests__/sync-db.test.ts`

- [ ] **Step 1: Write IndexedDB upgrade tests using `fake-indexeddb`**

Verify schema version 6 creates:

```text
syncState       keyPath: key
syncSecrets     keyPath: key
syncTombstones  keyPath: key, index: entityType
```

Also verify upgrading a version 5 database preserves every existing record.

- [ ] **Step 2: Add explicit repository APIs**

Bump `SCHEMA_VERSION` from `5` to `6` in the same change that creates the stores below.

Implement focused functions instead of exposing the new stores through arbitrary callers:

```ts
export function getOrCreateSyncDeviceId(): Promise<string>;
export function getSyncConfigurationStatus(): Promise<SyncConfigurationStatus>;
export function saveSyncConfiguration(
  config: SyncConfig,
  secrets?: SyncSecretInput,
): Promise<void>;
export function saveSyncSecrets(input: SyncSecretInput): Promise<void>;
export function clearSyncSecrets(): Promise<void>;
export function loadSyncSecrets(): Promise<SyncSecrets | undefined>;
export function listSyncTombstones(): Promise<SyncTombstone[]>;
export function deleteSyncedRecord(
  entityType: SyncEntityType,
  recordId: string,
  deletedAt: string,
  deviceId: string,
): Promise<void>;
export function applySyncMerge(result: SyncMergeResult): Promise<void>;
```

`saveSyncConfiguration`, `deleteSyncedRecord`, and `applySyncMerge` must use multi-store IndexedDB transactions. Configuration and replacement secrets must be committed together; a deletion cannot be committed without its tombstone; a remote merge cannot be partially applied.

- [ ] **Step 3: Route user deletions through tombstone-aware APIs**

Update highlight and vocabulary deletion paths in `src/background/service-worker.ts`. Keep cache eviction and non-syncable store deletion on the existing generic helper.

- [ ] **Step 4: Prove secrets never enter exports**

Extend `src/shared/__tests__/export.test.ts` with COS SecretId, SecretKey, and temporary credential token marker strings. Assert none appears even when manual backup uses `includeSensitive: true`; sync secrets are intentionally outside `AppSettings` and outside `LIST_ALL_DATA`.

Add an import test proving restored sync settings are disabled and unverified, and that existing local sync credentials are neither exported nor replaced by backup data.

- [ ] **Step 5: Run repository and export tests**

```bash
npm test -- src/shared/__tests__/sync-db.test.ts src/shared/__tests__/export.test.ts
```

Expected: upgrade, atomic deletion, atomic merge, and secret exclusion tests pass.

- [ ] **Step 6: Commit durable sync state**

```bash
git add src/shared/repositories/db.ts src/shared/export.ts src/shared/__tests__/export.test.ts src/shared/__tests__/sync-db.test.ts src/background/service-worker.ts
git commit -m "feat: persist sync state and deletion tombstones"
```

## Task 5: Implement the Provider Interface and Tencent COS Adapter

**Files:**

- Create: `src/background/sync/remote-object-storage.ts`
- Create: `src/background/sync/create-remote-storage.ts`
- Create: `src/background/sync/tencent-cos-storage.ts`
- Create: `src/background/__tests__/tencent-cos-storage.test.ts`
- Create: `docs/development/tencent-cos-sync.md`

- [ ] **Step 1: Define the minimal provider contract**

```ts
export interface RemoteObjectMetadata {
  key: string;
  etag?: string;
  size?: number;
  lastModified?: string;
}

export interface RemoteObjectStorage {
  list(prefix: string): Promise<RemoteObjectMetadata[]>;
  read(key: string): Promise<{ body: Uint8Array; metadata: RemoteObjectMetadata }>;
  write(key: string, body: Uint8Array): Promise<RemoteObjectMetadata>;
  delete(key: string): Promise<void>;
  testConnection(probePrefix: string): Promise<void>;
}
```

The sync engine must not import COS types or inspect COS error codes.

- [ ] **Step 2: Write adapter tests with an injected COS-like client**

Test pagination, empty prefix, Blob/ArrayBuffer conversion, quoted ETag normalization, 404 mapping, permission errors with request IDs, network errors, and write-then-read-then-delete connection probing.

- [ ] **Step 3: Implement `TencentCosStorage`**

Wrap the SDK operations corresponding to list, get, put, head metadata, and delete. Configure authentication through one injected credentials provider. Map SDK failures into:

```ts
export type RemoteStorageErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "cors"
  | "network"
  | "invalid-config"
  | "unknown";
```

Preserve COS request IDs in internal diagnostic details, but never include credentials or signed URLs.

- [ ] **Step 4: Add the provider factory**

Create `src/background/sync/create-remote-storage.ts` with a discriminated switch over `SyncProvider`. It is the only non-test module outside the COS adapter allowed to import `TencentCosStorage`:

```ts
export function createRemoteObjectStorage(
  config: SyncConfig,
  secrets: SyncSecrets,
): RemoteObjectStorage {
  switch (config.providerConfig.provider) {
    case "tencent-cos":
      return new TencentCosStorage(config.providerConfig, secrets);
  }
}
```

For temporary credentials, define the endpoint response contract as `credentials.tmpSecretId`, `credentials.tmpSecretKey`, `credentials.sessionToken`, `startTime`, and `expiredTime`; reject missing fields or an already-expired response before passing it through `getAuthorization`.

- [ ] **Step 5: Verify SDK compatibility with the MV3 bundle**

Run:

```bash
npm run typecheck
npm run build
```

Expected: the SDK is bundled locally into the service worker, no remote script is loaded, and the content-bundle verification still passes.

- [ ] **Step 6: Document COS setup**

Document a dedicated private bucket/prefix, required object operations, HTTPS-only endpoints, CORS methods `GET`, `HEAD`, `PUT`, `DELETE`, exposed `ETag` and request-ID headers, and a dedicated least-privilege CAM identity. Recommend an explicit extension origin where COS accepts it; otherwise explain that wildcard origin is acceptable only for a dedicated private bucket with authorization still required. State plainly that v1 objects are readable JSON and contain the user's synced reading data.

- [ ] **Step 7: Commit the COS adapter**

```bash
git add src/background/sync/remote-object-storage.ts src/background/sync/create-remote-storage.ts src/background/sync/tencent-cos-storage.ts src/background/__tests__/tencent-cos-storage.test.ts docs/development/tencent-cos-sync.md
git commit -m "feat: add Tencent COS sync storage adapter"
```

## Task 6: Implement the Sync Engine

**Files:**

- Create: `src/background/sync/sync-engine.ts`
- Create: `src/background/__tests__/sync-engine.test.ts`
- Modify: `src/shared/repositories/db.ts`

- [ ] **Step 1: Build an in-memory provider test double**

The test double must implement the real `RemoteObjectStorage` contract, produce deterministic ETags from bytes, and allow injected list/read/write failures.

- [ ] **Step 2: Write two-device convergence tests**

Use isolated repository fixtures for device A and B. Verify:

1. A creates a highlight, syncs, then B receives it.
2. A edits while B is offline; B later edits a different record; both changes survive.
3. A deletes a vocabulary record; offline B reconnects without resurrecting it.
4. Both edit the same record; every input order produces the same winner.
5. A malformed or corrupted remote object, permission error, or failed upload never deletes or partially imports local data.
6. Unchanged ETags are not downloaded again.
7. An unchanged merged snapshot is not uploaded again.

- [ ] **Step 3: Implement the single-flight sync sequence**

```ts
export async function runSync(
  dependencies: SyncDependencies,
  trigger: "manual" | "alarm" | "startup",
): Promise<SyncRunResult>;
```

The sequence is fixed:

1. Validate enabled, complete, connection-verified config and locally available secrets.
2. Acquire an in-memory single-flight promise.
3. Load local records, tombstones, device ID, and known remote ETags.
4. List `<prefix>/v1/devices/` and download only new or changed objects.
5. Decode, parse, and validate every downloaded object before any local write.
6. Merge all inputs in memory.
7. Apply the merged result atomically to IndexedDB.
8. Build and canonically serialize the current device snapshot.
9. Upload only when its canonical content hash changed.
10. Persist redacted success status, ETags, content hash, configuration fingerprint, counts, and warnings.

On failure, persist an actionable redacted error and retry time. Never upload a new snapshot after a parse, validation, or merge failure.

- [ ] **Step 4: Run the engine suite**

```bash
npm test -- src/background/__tests__/sync-engine.test.ts
```

Expected: all convergence and fail-closed scenarios pass.

- [ ] **Step 5: Commit the engine**

```bash
git add src/background/sync/sync-engine.ts src/background/__tests__/sync-engine.test.ts src/shared/repositories/db.ts
git commit -m "feat: add multi-device sync engine"
```

## Task 7: Integrate Runtime Messages and Automatic Scheduling

**Files:**

- Modify: `src/shared/messages.ts`
- Modify: `src/background/service-worker.ts`
- Modify: `src/shared/repositories/db.ts`

- [ ] **Step 1: Add redacted runtime contracts**

Add these commands:

```ts
| { type: "GET_SYNC_STATUS" }
| {
    type: "SAVE_SYNC_CONFIGURATION";
    config: SyncConfig;
    secrets?: SyncSecretInput;
  }
| {
    type: "TEST_SYNC_CONNECTION";
  }
| { type: "RUN_SYNC_NOW" }
| { type: "DISCONNECT_SYNC" }
```

`GET_SYNC_STATUS` may return `hasCredentials`, the active provider, connection verification state, timestamps, counts, warnings, and redacted errors, never secret values. `SAVE_SYNC_CONFIGURATION` commits settings and secrets as a single service operation so a half-updated authentication mode cannot be observed. `TEST_SYNC_CONNECTION` reads only the saved configuration and credentials, then records successful verification against their current fingerprint.

- [ ] **Step 2: Add service-worker handlers**

Keep `handleMessage` cases thin: validate the message, call a sync service function, return a typed result. Do not place COS or merge logic in the switch.

- [ ] **Step 3: Add a dedicated sync alarm**

Use `remarker-sync` independently of the existing review alarm. Create or recreate it only when sync is enabled, automatic sync is enabled, and the current saved configuration fingerprint is connection-verified. Run an automatic sync on `chrome.runtime.onStartup` only under the same conditions, and use the configured 15/30/60 minute period. Disabling sync or automatic sync clears the alarm; changing the target or authentication suspends it until a successful connection test. A failed automatic sync must not throw an unhandled rejection or interfere with review badge scheduling.

- [ ] **Step 4: Implement disconnect semantics**

Disconnect sets `enabled` and `autoSync` to false and clears local provider credentials only after confirmation from the UI. It retains the non-sensitive provider configuration so the user can reconnect without re-entering Bucket, Region, and prefix. It deletes neither local records nor remote COS objects.

- [ ] **Step 5: Run typecheck and existing tests**

```bash
npm run typecheck
npm test
```

Expected: all runtime-message unions are exhaustive and the full suite passes.

- [ ] **Step 6: Commit background integration**

```bash
git add src/shared/messages.ts src/background/service-worker.ts src/shared/repositories/db.ts
git commit -m "feat: schedule and expose sync operations"
```

## Task 8: Add Sync Settings UI and Localized Feedback

**Files:**

- Create: `src/options/SyncSettingsSection.tsx`
- Modify: `src/options/App.tsx`
- Modify: `src/shared/i18n/en.ts`
- Modify: `src/shared/i18n/es.ts`
- Modify: `src/shared/i18n/zh-CN.ts`
- Modify: `src/shared/i18n/zh-TW.ts`

- [ ] **Step 1: Add all locale contracts before rendering UI**

Add copy for the main sync toggle, provider, Bucket, Region, prefix, authentication mode, SecretId, SecretKey, temporary credential URL, private-bucket/plaintext warning, automatic sync, interval, save, connection test, sync now, disconnect, last success, changed counts, clock warning, and every mapped provider/protocol error.

- [ ] **Step 2: Build the focused settings section**

`SyncSettingsSection` receives redacted status and command callbacks. Implement the exact visibility and state rules in **Settings configuration design**. It renders:

- An always-visible **Enable cross-device sync** toggle.
- When enabled, a provider select; only Tencent Cloud COS is available initially.
- A provider-specific COS form for Bucket, Region, prefix, authentication mode, and the credentials required by that mode.
- Automatic sync toggle and conditional 15/30/60 minute interval selector.
- Private-bucket and plaintext remote-data warning.
- Save configuration, Test connection, and Sync now commands with disabled/loading/dirty states.
- Last successful sync, last failure, upload/download counts, and warnings.
- Disconnect confirmation clarifying that remote files are retained.

Never display a saved SecretId, SecretKey, or temporary token again. Render empty password fields plus a `Credentials configured` status. Do not treat provider configuration as complete merely because this boolean is true; it must belong to the active provider and authentication mode.

- [ ] **Step 3: Mount it from `SettingsTab`**

Keep the existing `App.tsx` responsible for top-level refresh and Toast notification. Keep provider form state, dirty state, conditional fields, sync-specific validation, and action locking inside `SyncSettingsSection.tsx`. Model provider forms through a provider definition map so adding a provider does not add COS-specific branches throughout `App.tsx`.

- [ ] **Step 4: Validate inputs before saving or testing**

- Bucket must include the COS app ID suffix expected by the SDK.
- Region and prefix must be non-empty after trimming.
- Prefix must be relative, must not begin with `/`, and must reject `..` path segments.
- Temporary-credential URLs must be HTTPS except explicit localhost development URLs.
- Static credentials require both SecretId and SecretKey when no matching credentials are already saved; entering only one replacement value is invalid.
- Provider and `providerConfig.provider` must match.
- Sync now requires an enabled, saved, complete, and connection-verified active provider configuration.

- [ ] **Step 5: Verify settings transitions**

Add component tests or an equivalent options-page integration suite for disabled-to-enabled flow, provider selection, authentication-mode field switching, preserving blank saved credentials, clearing obsolete credentials, invalid URL/prefix feedback, save/test/sync action locking, alarm-affecting toggles, and disconnect confirmation semantics.

- [ ] **Step 6: Run tests, typecheck, and build**

```bash
npm test -- src/options
npm run typecheck
npm run build
```

Expected: all locale keys are complete and the options page plus service worker build successfully.

- [ ] **Step 7: Commit the UI**

```bash
git add src/options/SyncSettingsSection.tsx src/options/App.tsx src/shared/i18n/en.ts src/shared/i18n/es.ts src/shared/i18n/zh-CN.ts src/shared/i18n/zh-TW.ts
git commit -m "feat: add COS sync settings and status UI"
```

## Task 9: End-to-End Verification and Release Documentation

**Files:**

- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `src/shared/i18n/en.ts`
- Modify: `src/shared/i18n/es.ts`
- Modify: `src/shared/i18n/zh-CN.ts`
- Modify: `src/shared/i18n/zh-TW.ts`
- Modify: `docs/development/tencent-cos-sync.md`

- [ ] **Step 1: Run the complete automated verification**

```bash
npm run typecheck
npm test
npm run build
```

Expected: all commands exit 0, no test is skipped, and `dist/service-worker.js` contains no remote script loader.

- [ ] **Step 2: Verify secret redaction mechanically**

Configure marker values such as `COS_SECRET_ID_MARKER`, `COS_SECRET_KEY_MARKER`, and `COS_SESSION_TOKEN_MARKER` in a development profile. Export normal and sensitive backup JSON, inspect sync status responses and remote snapshot JSON, and search the built extension logs. None of the markers may appear outside the dedicated local secret store.

- [ ] **Step 3: Verify with two clean Chrome profiles**

Run this sequence against a dedicated COS test prefix:

1. Profile A enables sync, selects Tencent Cloud COS, configures a dedicated private Bucket/Region/prefix, tests the connection, creates a highlight and vocabulary record, then syncs.
2. Profile B enables sync, configures the same COS location and credentials, tests the connection, then syncs and receives both records.
3. Disconnect B from the network. A edits the note and deletes the vocabulary record. B creates another highlight.
4. Reconnect and sync both profiles in both orders.
5. Confirm both profiles converge, the deleted vocabulary does not return, and the B-only highlight remains.
6. Disable automatic sync on B and confirm its alarm is removed while manual Sync now still works.
7. Disable cross-device sync on B and confirm startup/alarm/manual sync do not run while saved configuration remains.
8. Disconnect B and confirm local records and remote objects remain, while local COS credentials are cleared.

- [ ] **Step 4: Verify COS-side privacy and layout**

Confirm COS contains only `<prefix>/v1/devices/<deviceId>.json` objects and optional probe objects are deleted. Download an object through the COS console and confirm it is valid versioned JSON containing the expected synced records. Confirm it contains no COS credentials, temporary tokens, LLM API keys, or unrelated settings. Confirm the bucket is private and unauthenticated requests cannot read the object.

- [ ] **Step 5: Update product documentation and release notes**

Document synced and excluded data, the plaintext remote-data model, private COS setup, conflict rules, manual/automatic triggers, Settings fields and validation, disconnect behavior, current static-key warning, and troubleshooting by redacted request ID.

- [ ] **Step 6: Commit release documentation**

```bash
git add README.md README.zh-CN.md docs/development/tencent-cos-sync.md src/shared/i18n/en.ts src/shared/i18n/es.ts src/shared/i18n/zh-CN.ts src/shared/i18n/zh-TW.ts
git commit -m "docs: document COS cross-device sync"
```

## Acceptance Gate

The feature is complete only when all conditions are true:

- Two independent Chrome profiles converge after create, update, and delete operations.
- Offline devices cannot resurrect a record deleted elsewhere.
- A corrupt object, credential failure, or network interruption cannot partially overwrite local data.
- Every remote object is valid versioned plaintext JSON; secrets are absent from remote data, backups, status messages, and logs.
- Settings provides opt-in enablement, provider selection, provider-specific configuration, connection testing, manual/automatic controls, status, and non-destructive disconnect behavior.
- COS-specific code is referenced only by the provider factory/adapter and its provider form definition; merge, snapshot, and UI status contracts remain provider-neutral.
- Automatic sync and review alarms coexist without unhandled failures.
- `npm run typecheck`, `npm test`, and `npm run build` all pass.

## Explicitly Deferred

- Remote tombstone garbage collection and stale-device removal.
- Syncing LLM configuration, API keys, UI preferences, or audio cache.
- Server-managed accounts or a ReMarker-hosted credential service.
- Optional client-side encryption for remote snapshots.
- Real-time push notifications; v1 uses manual, startup, and alarm-based pull/push.
- Provider-specific object version history UI.
- S3, WebDAV, OneDrive, Google Drive, Dropbox, or other adapters; the interface is prepared, but each provider requires a separate implementation and acceptance plan.
