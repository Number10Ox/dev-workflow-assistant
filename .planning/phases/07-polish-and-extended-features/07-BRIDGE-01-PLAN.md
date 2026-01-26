---
phase: 07-polish-extended
plan: BRIDGE-01
type: execute
wave: 0
depends_on: []
files_modified:
  - ../../../devex-service-bridge/packages/gworkspace-provider/package.json
  - ../../../devex-service-bridge/packages/gworkspace-provider/src/extension.ts
  - ../../../devex-service-bridge/packages/gworkspace-provider/src/googleWorkspaceProvider.ts
  - ../../../devex-service-bridge/packages/gworkspace-provider/src/auth.ts
  - ../../../devex-service-bridge/packages/gworkspace-provider/src/docsApi.ts
  - ../../../devex-service-bridge/packages/gworkspace-provider/src/driveApi.ts
autonomous: true

must_haves:
  truths:
    - "Provider exposes capabilities handshake object with version, features, and providerId"
    - "docs.readDocument returns raw Google Docs API v1 JSON with etag/modifiedTime"
    - "docs.getDocumentInfo returns metadata without full content"
    - "drive.fetchByUrl downloads embedded assets (images) by URL"
    - "checkAvailability returns clear setup instructions when not configured"
    - "Auth uses VS Code SecretStorage, not external MCP credentials"
  artifacts:
    - path: "packages/gworkspace-provider/src/extension.ts"
      provides: "VS Code extension entry point exporting GoogleWorkspaceProviderAPI"
      exports: ["activate", "deactivate"]
    - path: "packages/gworkspace-provider/src/googleWorkspaceProvider.ts"
      provides: "Core provider implementation"
      exports: ["GoogleWorkspaceProvider"]
    - path: "packages/gworkspace-provider/src/auth.ts"
      provides: "OAuth and SecretStorage credential management"
      exports: ["GoogleWorkspaceAuth"]
    - path: "packages/gworkspace-provider/src/docsApi.ts"
      provides: "Google Docs API wrapper"
      exports: ["DocsApi"]
    - path: "packages/gworkspace-provider/src/driveApi.ts"
      provides: "Google Drive API wrapper for assets"
      exports: ["DriveApi"]
  key_links:
    - from: "packages/gworkspace-provider/src/extension.ts"
      to: "vscode"
      via: "Extension API exports"
      pattern: "context\\.subscriptions"
    - from: "packages/gworkspace-provider/src/auth.ts"
      to: "vscode.SecretStorage"
      via: "Credential storage"
      pattern: "secrets\\.get|secrets\\.store"
---

<objective>
Implement the Google Workspace Provider in devex-service-bridge that DWA Phase 7 consumes via VS Code extension API.

Purpose: DWA does NOT call Google APIs directly. This provider owns authentication (SecretStorage), API calls (googleapis), and exposes a clean interface that DWA's bridge client consumes via capability handshake.

Output: New package `gworkspace-provider` in devex-service-bridge monorepo with docs/drive API wrappers.
</objective>

<execution_context>
@/Users/jedwards/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jedwards/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/jedwards/workspace/JobPrep/DevEx/devex-service-bridge/.planning/designs/gdocs-provider.md
@/Users/jedwards/workspace/JobPrep/DevEx/devex-service-bridge/packages/linear-provider/src/extension.ts (pattern reference)
@/Users/jedwards/workspace/JobPrep/DevEx/devex-service-bridge/packages/linear-provider/src/linearTracker.ts (pattern reference)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create gworkspace-provider package structure</name>
  <files>packages/gworkspace-provider/package.json, packages/gworkspace-provider/tsconfig.json</files>
  <action>
1. Create `packages/gworkspace-provider/package.json`:
   ```json
   {
     "name": "gworkspace-provider",
     "displayName": "Google Workspace Provider",
     "description": "Google Docs/Drive access for DevEx Service Bridge consumers",
     "version": "0.1.0",
     "publisher": "jedwards",
     "engines": { "vscode": "^1.85.0" },
     "activationEvents": ["onStartupFinished"],
     "main": "./out/extension.js",
     "contributes": {
       "commands": [
         {
           "command": "gworkspace.authenticate",
           "title": "Google Workspace: Authenticate"
         }
       ]
     },
     "dependencies": {
       "googleapis": "^140.0.0"
     },
     "devDependencies": {
       "@types/vscode": "^1.85.0",
       "typescript": "^5.3.0"
     }
   }
   ```

2. Create `packages/gworkspace-provider/tsconfig.json` following linear-provider pattern.

3. Update root `package.json` workspaces to include new package.
  </action>
  <verify>
`npm install` from monorepo root succeeds.
Package structure matches linear-provider pattern.
  </verify>
  <done>
gworkspace-provider package scaffolded with googleapis dependency.
  </done>
</task>

<task type="auto">
  <name>Task 2: Implement auth module with SecretStorage</name>
  <files>packages/gworkspace-provider/src/auth.ts</files>
  <action>
1. Create `packages/gworkspace-provider/src/auth.ts`:

```typescript
import * as vscode from 'vscode';
import { OAuth2Client } from 'google-auth-library';

const SCOPES = [
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive.readonly'
];

const SECRET_KEY = 'google-workspace-tokens';

export interface AuthStatus {
  authenticated: boolean;
  scopes: string[];
  expiry?: string;
  email?: string;
}

export class GoogleWorkspaceAuth {
  private secrets: vscode.SecretStorage;
  private oauth2Client: OAuth2Client | null = null;

  constructor(context: vscode.ExtensionContext) {
    this.secrets = context.secrets;
  }

  async getAuthStatus(): Promise<AuthStatus> {
    const tokens = await this.secrets.get(SECRET_KEY);
    if (!tokens) {
      return { authenticated: false, scopes: [] };
    }
    try {
      const parsed = JSON.parse(tokens);
      return {
        authenticated: true,
        scopes: parsed.scope?.split(' ') || [],
        expiry: parsed.expiry_date ? new Date(parsed.expiry_date).toISOString() : undefined,
        email: parsed.email
      };
    } catch {
      return { authenticated: false, scopes: [] };
    }
  }

  async ensureAuth(options?: { scopes?: string[] }): Promise<{ success: boolean; error?: string }> {
    const requestedScopes = options?.scopes || SCOPES;

    // Check existing tokens
    const status = await this.getAuthStatus();
    if (status.authenticated) {
      const hasAllScopes = requestedScopes.every(s => status.scopes.includes(s));
      if (hasAllScopes) {
        return { success: true };
      }
    }

    // Launch OAuth flow
    try {
      const credentials = await this.launchOAuthFlow(requestedScopes);
      await this.secrets.store(SECRET_KEY, JSON.stringify(credentials));
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getOAuth2Client(): Promise<OAuth2Client | null> {
    const tokens = await this.secrets.get(SECRET_KEY);
    if (!tokens) return null;

    try {
      const parsed = JSON.parse(tokens);
      // Initialize OAuth2Client with stored tokens
      // Client ID/secret from extension settings or bundled config
      const client = new OAuth2Client();
      client.setCredentials(parsed);
      return client;
    } catch {
      return null;
    }
  }

  private async launchOAuthFlow(scopes: string[]): Promise<object> {
    // Implementation using VS Code authentication API or external browser flow
    // Returns token object to store
    throw new Error('OAuth flow not implemented - run setup wizard');
  }

  async importMcpCredentials(): Promise<{ imported: boolean; error?: string }> {
    // One-time import from ~/.gdrive-mcp/ if exists
    // This is a convenience, not the primary auth mechanism
    const fs = require('fs');
    const path = require('path');
    const mcpPath = path.join(require('os').homedir(), '.gdrive-mcp', 'credentials.json');

    if (!fs.existsSync(mcpPath)) {
      return { imported: false, error: 'MCP credentials not found' };
    }

    try {
      const creds = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
      await this.secrets.store(SECRET_KEY, JSON.stringify(creds));
      return { imported: true };
    } catch (error) {
      return { imported: false, error: String(error) };
    }
  }
}
```
  </action>
  <verify>
Auth module compiles without errors.
SecretStorage integration follows VS Code patterns.
  </verify>
  <done>
Auth module manages credentials via VS Code SecretStorage.
Optional MCP import provides migration path.
  </done>
</task>

<task type="auto">
  <name>Task 3: Implement Docs and Drive API wrappers</name>
  <files>packages/gworkspace-provider/src/docsApi.ts, packages/gworkspace-provider/src/driveApi.ts</files>
  <action>
1. Create `packages/gworkspace-provider/src/docsApi.ts`:

```typescript
import { docs_v1, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface GoogleDocContent {
  id: string;
  title: string;
  revisionId?: string;
  etag?: string;
  modifiedTime?: string;
  body: {
    content: docs_v1.Schema$StructuralElement[];
  };
  lists?: Record<string, docs_v1.Schema$List>;
  footnotes?: Record<string, docs_v1.Schema$Footnote>;
  inlineObjects?: Record<string, docs_v1.Schema$InlineObject>;
  documentStyle?: docs_v1.Schema$DocumentStyle;
}

export interface DocumentInfo {
  id: string;
  title: string;
  revisionId?: string;
  etag?: string;
  modifiedTime?: string;
}

export class DocsApi {
  private docs: docs_v1.Docs;

  constructor(auth: OAuth2Client) {
    this.docs = google.docs({ version: 'v1', auth });
  }

  async readDocument(docId: string): Promise<GoogleDocContent> {
    const response = await this.docs.documents.get({
      documentId: docId,
      // Request specific fields to ensure we get lists, footnotes, etc.
    });

    const doc = response.data;

    // Get revision info from Drive API for modifiedTime
    // (Docs API doesn't expose modifiedTime directly)

    return {
      id: doc.documentId!,
      title: doc.title!,
      revisionId: doc.revisionId,
      etag: response.headers?.etag,
      // modifiedTime fetched separately via Drive API
      body: {
        content: doc.body?.content || []
      },
      lists: doc.lists,
      footnotes: doc.footnotes,
      inlineObjects: doc.inlineObjects,
      documentStyle: doc.documentStyle
    };
  }

  async getDocumentInfo(docId: string): Promise<DocumentInfo> {
    const response = await this.docs.documents.get({
      documentId: docId,
      // Minimal fields for metadata only
    });

    return {
      id: response.data.documentId!,
      title: response.data.title!,
      revisionId: response.data.revisionId,
      etag: response.headers?.etag
    };
  }
}
```

2. Create `packages/gworkspace-provider/src/driveApi.ts`:

```typescript
import { drive_v3, google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

export interface FetchedFile {
  bytes: Uint8Array;
  mimeType: string;
  name?: string;
}

export class DriveApi {
  private drive: drive_v3.Drive;

  constructor(auth: OAuth2Client) {
    this.drive = google.drive({ version: 'v3', auth });
  }

  async fetchFile(fileId: string): Promise<FetchedFile> {
    // Get file metadata first
    const meta = await this.drive.files.get({
      fileId,
      fields: 'name,mimeType'
    });

    // Download file content
    const response = await this.drive.files.get({
      fileId,
      alt: 'media'
    }, { responseType: 'arraybuffer' });

    return {
      bytes: new Uint8Array(response.data as ArrayBuffer),
      mimeType: meta.data.mimeType || 'application/octet-stream',
      name: meta.data.name || undefined
    };
  }

  async fetchByUrl(url: string): Promise<FetchedFile> {
    // Parse Google URLs to extract file ID
    // Handles: googleusercontent.com URLs from inline objects
    // drive.google.com/file/d/{id}/ URLs

    const fileId = this.extractFileIdFromUrl(url);
    if (!fileId) {
      // For googleusercontent.com URLs, fetch directly
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      return {
        bytes: new Uint8Array(buffer),
        mimeType: response.headers.get('content-type') || 'image/png'
      };
    }

    return this.fetchFile(fileId);
  }

  async getFileModifiedTime(fileId: string): Promise<string | undefined> {
    const response = await this.drive.files.get({
      fileId,
      fields: 'modifiedTime'
    });
    return response.data.modifiedTime || undefined;
  }

  private extractFileIdFromUrl(url: string): string | null {
    // Match drive.google.com/file/d/{id}/
    const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
    if (driveMatch) return driveMatch[1];

    // Match docs.google.com/document/d/{id}/
    const docsMatch = url.match(/docs\.google\.com\/document\/d\/([^\/]+)/);
    if (docsMatch) return docsMatch[1];

    return null;
  }
}
```
  </action>
  <verify>
API wrappers compile without errors.
ReadDocument returns lists, footnotes, inlineObjects (needed for conversion).
  </verify>
  <done>
Docs API wrapper returns full document structure including lists and footnotes.
Drive API wrapper fetches assets by URL or file ID.
  </done>
</task>

<task type="auto">
  <name>Task 4: Implement extension entry point with capability handshake</name>
  <files>packages/gworkspace-provider/src/extension.ts, packages/gworkspace-provider/src/googleWorkspaceProvider.ts</files>
  <action>
1. Create `packages/gworkspace-provider/src/googleWorkspaceProvider.ts`:

```typescript
import { GoogleWorkspaceAuth, AuthStatus } from './auth';
import { DocsApi, GoogleDocContent, DocumentInfo } from './docsApi';
import { DriveApi, FetchedFile } from './driveApi';

export interface AvailabilityResult {
  available: boolean;
  error?: string;
  setupInstructions?: string;
}

export interface CapabilityHandshake {
  version: string;
  features: string[];
  providerId: string;
}

export interface GoogleWorkspaceProviderAPI {
  checkAvailability(): Promise<AvailabilityResult>;

  auth: {
    getAuthStatus(): Promise<AuthStatus>;
    ensureAuth(options?: { scopes?: string[] }): Promise<{ success: boolean; error?: string }>;
    importMcpCredentials(): Promise<{ imported: boolean; error?: string }>;
  };

  docs: {
    readDocument(docId: string): Promise<GoogleDocContent>;
    getDocumentInfo(docId: string): Promise<DocumentInfo>;
  };

  drive: {
    fetchFile(fileId: string): Promise<FetchedFile>;
    fetchByUrl(url: string): Promise<FetchedFile>;
  };

  capabilities: CapabilityHandshake;
}

export class GoogleWorkspaceProvider implements GoogleWorkspaceProviderAPI {
  private authManager: GoogleWorkspaceAuth;
  private docsApi: DocsApi | null = null;
  private driveApi: DriveApi | null = null;

  readonly capabilities: CapabilityHandshake = {
    version: '1.0',
    features: [
      'docs.readDocument',
      'docs.getDocumentInfo',
      'drive.fetchFile',
      'drive.fetchByUrl',
      'auth.ensureAuth',
      'auth.getAuthStatus'
    ],
    providerId: 'gworkspace-provider'
  };

  constructor(authManager: GoogleWorkspaceAuth) {
    this.authManager = authManager;
  }

  async checkAvailability(): Promise<AvailabilityResult> {
    const status = await this.authManager.getAuthStatus();

    if (!status.authenticated) {
      return {
        available: false,
        error: 'Not authenticated with Google Workspace',
        setupInstructions:
          'Run command "Google Workspace: Authenticate" or ' +
          'run "DevEx Service Bridge: Run Setup Wizard" to configure Google Docs access.'
      };
    }

    // Verify we can initialize APIs
    try {
      await this.ensureApis();
      return { available: true };
    } catch (error) {
      return {
        available: false,
        error: String(error),
        setupInstructions: 'Re-authenticate with Google Workspace.'
      };
    }
  }

  private async ensureApis(): Promise<void> {
    if (this.docsApi && this.driveApi) return;

    const client = await this.authManager.getOAuth2Client();
    if (!client) {
      throw new Error('No OAuth client available');
    }

    this.docsApi = new DocsApi(client);
    this.driveApi = new DriveApi(client);
  }

  auth = {
    getAuthStatus: () => this.authManager.getAuthStatus(),
    ensureAuth: (options?: { scopes?: string[] }) => this.authManager.ensureAuth(options),
    importMcpCredentials: () => this.authManager.importMcpCredentials()
  };

  docs = {
    readDocument: async (docId: string) => {
      await this.ensureApis();
      return this.docsApi!.readDocument(docId);
    },
    getDocumentInfo: async (docId: string) => {
      await this.ensureApis();
      return this.docsApi!.getDocumentInfo(docId);
    }
  };

  drive = {
    fetchFile: async (fileId: string) => {
      await this.ensureApis();
      return this.driveApi!.fetchFile(fileId);
    },
    fetchByUrl: async (url: string) => {
      await this.ensureApis();
      return this.driveApi!.fetchByUrl(url);
    }
  };
}
```

2. Create `packages/gworkspace-provider/src/extension.ts`:

```typescript
import * as vscode from 'vscode';
import { GoogleWorkspaceAuth } from './auth';
import { GoogleWorkspaceProvider, GoogleWorkspaceProviderAPI } from './googleWorkspaceProvider';

let provider: GoogleWorkspaceProvider | null = null;

export function activate(context: vscode.ExtensionContext): GoogleWorkspaceProviderAPI {
  const auth = new GoogleWorkspaceAuth(context);
  provider = new GoogleWorkspaceProvider(auth);

  // Register authentication command
  context.subscriptions.push(
    vscode.commands.registerCommand('gworkspace.authenticate', async () => {
      const result = await provider!.auth.ensureAuth();
      if (result.success) {
        vscode.window.showInformationMessage('Google Workspace authentication successful');
      } else {
        vscode.window.showErrorMessage(`Authentication failed: ${result.error}`);
      }
    })
  );

  console.log(`Google Workspace Provider activated: v${provider.capabilities.version}`);

  // Return the API for other extensions to consume
  return provider;
}

export function deactivate(): void {
  provider = null;
}
```
  </action>
  <verify>
Extension compiles and exports GoogleWorkspaceProviderAPI.
Capability handshake includes version, features array, and providerId.
checkAvailability returns clear setup instructions.
  </verify>
  <done>
Extension exports GoogleWorkspaceProviderAPI with capability handshake.
Provider validates authentication before API calls.
Clear setup instructions when not configured.
  </done>
</task>

</tasks>

<verification>
Build and test the provider:
```bash
cd packages/gworkspace-provider
npm run compile
```

Verify exports:
```typescript
import { GoogleWorkspaceProviderAPI } from 'gworkspace-provider';
// Type should include capabilities, docs, drive, auth namespaces
```

Integration test with DWA (after 07-01):
- DWA bridge client discovers provider
- Capability handshake validates required features
- docs.readDocument returns full document structure
</verification>

<success_criteria>
1. gworkspace-provider package builds without errors
2. Extension exports GoogleWorkspaceProviderAPI with capability handshake
3. capabilities.version = "1.0" and features array includes all API methods
4. docs.readDocument returns lists, footnotes, inlineObjects (for conversion)
5. drive.fetchByUrl downloads embedded images
6. checkAvailability returns clear setup instructions when not authenticated
7. Auth uses VS Code SecretStorage (not MCP credentials directly)
</success_criteria>

<output>
After completion, create `.planning/phases/07-polish-and-extended-features/07-BRIDGE-01-SUMMARY.md`
</output>
