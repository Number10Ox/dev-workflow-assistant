---
phase: 06-linear-integration
plan: 01
subsystem: api
tags: [typescript, vscode-extension, linear, issue-tracking, service-bridge]

# Dependency graph
requires:
  - phase: 05-drift-tracking
    provides: Registry drift events and external system sync requirements
provides:
  - Extended IssueTracker interface with externalId, container, queryByExternalId
  - BridgeCapabilities versioning system for consumer compatibility checks
  - Package entry point exports for DWA consumption
affects: [06-02, 06-03, 06-04, linear-sync, issue-management]

# Tech tracking
tech-stack:
  added: []
  patterns: [capability-negotiation, semantic-versioning, provider-agnostic-abstraction]

key-files:
  created:
    - packages/core/src/issues/capabilities.ts
    - packages/core/src/index.ts
  modified:
    - packages/core/src/issues/tracker.ts
    - packages/core/src/issues/providerRegistry.ts
    - packages/core/src/extension.ts
    - packages/linear-provider/src/linearTracker.ts
    - packages/linear-provider/src/extension.ts

key-decisions:
  - "Use IssueCreateInput interface instead of positional parameters for createIssue()"
  - "Use IssueFilter interface instead of string status parameter for listIssues()"
  - "Add queryByExternalId as required method in IssueTracker interface"
  - "Set BRIDGE_API_VERSION to 2.0.0 to indicate breaking interface changes"
  - "Use provider-agnostic 'container' field instead of 'projectId' for portability"

patterns-established:
  - "Capability negotiation: Consumers call getCapabilities() before invoking new methods"
  - "Provider-agnostic abstraction: Generic field names (container) map to provider-specific concepts (Linear project, JIRA board, GitHub milestone)"
  - "Interface extension: New optional fields with backward-compatible defaults"

# Metrics
duration: 3m 5s
completed: 2026-01-25
---

# Phase 06 Plan 01: Extend Bridge Interface Summary

**IssueTracker interface extended with externalId deduplication, container grouping, and queryByExternalId lookup for idempotent Linear sync**

## Performance

- **Duration:** 3m 5s
- **Started:** 2026-01-25T06:35:57Z
- **Completed:** 2026-01-25T06:39:02Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Extended Issue interface with externalId, identifier, and container fields for cross-system sync
- Created IssueCreateInput and IssueFilter interfaces for structured parameters
- Added queryByExternalId method to IssueTracker interface for deduplication lookups
- Created BridgeCapabilities module with version handshake (API v2.0.0)
- Wired all exports through package entry point for clean DWA consumption
- Updated both core and linear-provider implementations to match new interface

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend IssueTracker interface with externalId, container, and query methods** - `f1da691` (feat)
2. **Task 2: Create capabilities module for version handshake** - `cf7f0ab` (feat)
3. **Task 3: Update providerRegistry and wire exports to package entry point** - `99f9ae3` (feat)

## Files Created/Modified

- `packages/core/src/issues/tracker.ts` - Added externalId, identifier, container to Issue; created IssueCreateInput and IssueFilter interfaces; updated IssueTracker method signatures
- `packages/core/src/issues/capabilities.ts` - Created BridgeCapabilities, CapabilityProvider interfaces; defined BRIDGE_API_VERSION constant; added getDefaultCapabilities helper
- `packages/core/src/issues/providerRegistry.ts` - Added queryByExternalId validation; added getCapabilities() method; re-exported capabilities types
- `packages/core/src/index.ts` - Created package entry point with all exports for consumer imports
- `packages/core/src/extension.ts` - Updated createIssue call to use new IssueCreateInput signature
- `packages/linear-provider/src/linearTracker.ts` - Implemented extended interface with placeholder queryByExternalId (returns null until custom fields implemented)
- `packages/linear-provider/src/extension.ts` - Updated API export to include new method signatures and queryByExternalId

## Decisions Made

1. **Breaking change strategy:** Changed createIssue from positional parameters (title, description, labels) to single IssueCreateInput object for better extensibility. This required updating both core extension and linear-provider to prevent compilation errors.

2. **Provider-agnostic field naming:** Used generic "container" instead of provider-specific names like "projectId" to ensure the interface works for Linear (projects), JIRA (boards), and GitHub (milestones) without bias.

3. **Capability versioning:** Set BRIDGE_API_VERSION to 2.0.0 to signal breaking changes, enabling consumers to detect incompatibility before attempting to use new methods.

4. **Placeholder implementation:** LinearTracker.queryByExternalId returns null as placeholder - actual implementation will require Linear custom fields support in a future plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated core extension.ts to use new createIssue signature**
- **Found during:** Task 1 compilation
- **Issue:** TypeScript error "Expected 1 arguments, but got 2" - extension.ts called createIssue(title, description) with old signature
- **Fix:** Changed call to createIssue({ title, description }) to match new IssueCreateInput interface
- **Files modified:** packages/core/src/extension.ts
- **Verification:** TypeScript compilation succeeded
- **Committed in:** f1da691 (Task 1 commit)

**2. [Rule 3 - Blocking] Updated linear-provider to implement extended interface**
- **Found during:** Task 1 compilation
- **Issue:** TypeScript errors in linear-provider - interface mismatch with new signatures
- **Fix:** Updated linearTracker.ts and extension.ts to match new IssueCreateInput, IssueFilter, and queryByExternalId interface requirements
- **Files modified:** packages/linear-provider/src/linearTracker.ts, packages/linear-provider/src/extension.ts
- **Verification:** TypeScript compilation succeeded with no errors
- **Committed in:** f1da691 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were necessary to maintain compilation after breaking interface changes. No scope creep - these are implementation updates required by the new interface contract.

## Issues Encountered

None - plan executed as designed. TypeScript compilation errors were expected due to breaking changes and resolved via deviation protocol.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 06 Plan 02 (Linear OAuth & MCP Foundation):**
- IssueTracker interface supports externalId for deduplication
- IssueTracker interface supports container for project grouping
- queryByExternalId method available (placeholder in LinearTracker, ready for implementation)
- BridgeCapabilities available for version handshake
- All types exported from @devex/core entry point

**Note for future plans:**
- LinearTracker.queryByExternalId currently returns null - will need Linear custom fields support to store/query externalId
- The identifier field is populated from Linear's native identifier (e.g., "ENG-123")
- Container field not yet populated in LinearTracker - will be added when project mapping is implemented

---
*Phase: 06-linear-integration*
*Completed: 2026-01-25*
