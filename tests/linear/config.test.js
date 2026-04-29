const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

// We override HOME for each test so saveApiKey writes into a temp dir
// instead of clobbering the developer's real ~/.dwa/config.json.
const ORIGINAL_HOME = process.env.HOME;
const ORIGINAL_USERPROFILE = process.env.USERPROFILE;
const ORIGINAL_LINEAR_API_KEY = process.env.LINEAR_API_KEY;

let tmpHome;

function loadFresh() {
  // Force a fresh require so the module re-reads os.homedir() inside its functions.
  // (config.js calls os.homedir() lazily inside getConfigPath, so this isn't strictly
  // required, but it's a safety belt against future caching.)
  delete require.cache[require.resolve('../../src/linear/config')];
  return require('../../src/linear/config');
}

describe('linear/config', () => {
  beforeEach(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'dwa-config-test-'));
    process.env.HOME = tmpHome;
    process.env.USERPROFILE = tmpHome; // Windows
    delete process.env.LINEAR_API_KEY;
  });

  afterEach(async () => {
    if (ORIGINAL_HOME === undefined) delete process.env.HOME;
    else process.env.HOME = ORIGINAL_HOME;
    if (ORIGINAL_USERPROFILE === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = ORIGINAL_USERPROFILE;
    if (ORIGINAL_LINEAR_API_KEY === undefined) delete process.env.LINEAR_API_KEY;
    else process.env.LINEAR_API_KEY = ORIGINAL_LINEAR_API_KEY;
    await fs.remove(tmpHome);
  });

  describe('getConfigPath', () => {
    it('returns ~/.dwa/config.json under current HOME', () => {
      const { getConfigPath } = loadFresh();
      assert.strictEqual(getConfigPath(), path.join(tmpHome, '.dwa', 'config.json'));
    });
  });

  describe('loadApiKey', () => {
    it('returns null when no env var and no config file', async () => {
      const { loadApiKey } = loadFresh();
      assert.strictEqual(await loadApiKey(), null);
    });

    it('prefers LINEAR_API_KEY env var over file', async () => {
      const { saveApiKey, loadApiKey } = loadFresh();
      await saveApiKey('lin_api_from_file');
      process.env.LINEAR_API_KEY = 'lin_api_from_env';
      assert.strictEqual(await loadApiKey(), 'lin_api_from_env');
    });

    it('falls back to file when env var unset', async () => {
      const { saveApiKey, loadApiKey } = loadFresh();
      await saveApiKey('lin_api_from_file');
      assert.strictEqual(await loadApiKey(), 'lin_api_from_file');
    });

    it('reads namespaced shape (config.linear.apiKey)', async () => {
      const { getConfigPath, loadApiKey } = loadFresh();
      const configPath = getConfigPath();
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJSON(configPath, {
        schemaVersion: 1,
        linear: { apiKey: 'lin_api_namespaced' },
        somethingElse: { whatever: 'value' }
      });
      assert.strictEqual(await loadApiKey(), 'lin_api_namespaced');
    });

    it('returns null when config file is malformed JSON', async () => {
      const { getConfigPath, loadApiKey } = loadFresh();
      const configPath = getConfigPath();
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeFile(configPath, '{not valid json');
      assert.strictEqual(await loadApiKey(), null);
    });

    it('returns null when linear key is absent from config', async () => {
      const { getConfigPath, loadApiKey } = loadFresh();
      const configPath = getConfigPath();
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJSON(configPath, { schemaVersion: 1, other: { foo: 'bar' } });
      assert.strictEqual(await loadApiKey(), null);
    });
  });

  describe('saveApiKey', () => {
    it('writes namespaced shape with schemaVersion', async () => {
      const { saveApiKey, loadConfig } = loadFresh();
      await saveApiKey('lin_api_test');
      const cfg = await loadConfig();
      assert.deepStrictEqual(cfg, {
        schemaVersion: 1,
        linear: { apiKey: 'lin_api_test' }
      });
    });

    it('preserves other top-level keys when updating', async () => {
      const { getConfigPath, saveApiKey, loadConfig } = loadFresh();
      const configPath = getConfigPath();
      await fs.ensureDir(path.dirname(configPath));
      await fs.writeJSON(configPath, {
        schemaVersion: 1,
        linear: { apiKey: 'old_key' },
        github: { token: 'gh_token' }
      });

      await saveApiKey('lin_api_new');
      const cfg = await loadConfig();
      assert.strictEqual(cfg.linear.apiKey, 'lin_api_new');
      assert.deepStrictEqual(cfg.github, { token: 'gh_token' });
    });

    it('throws on empty key', async () => {
      const { saveApiKey } = loadFresh();
      await assert.rejects(() => saveApiKey(''), /non-empty string/);
      await assert.rejects(() => saveApiKey(null), /non-empty string/);
      await assert.rejects(() => saveApiKey(undefined), /non-empty string/);
    });

    it('sets file mode 0600 on POSIX', async (t) => {
      if (process.platform === 'win32') {
        t.skip('Windows does not honor POSIX file modes');
        return;
      }
      const { getConfigPath, saveApiKey } = loadFresh();
      await saveApiKey('lin_api_test');
      const stat = await fs.stat(getConfigPath());
      // Mask off file-type bits, compare permission bits only.
      assert.strictEqual(stat.mode & 0o777, 0o600);
    });

    it('emits a warning on Windows about ACLs', async (t) => {
      // We can't change process.platform, but we can stub console.warn
      // and call the Windows branch by mocking platform via a require-time override.
      // Simpler: simulate Windows behavior end-to-end is not portable; instead,
      // assert the source text contains the warning so a future refactor
      // doesn't silently drop it.
      const config = loadFresh();
      const src = await fs.readFile(require.resolve('../../src/linear/config'), 'utf8');
      assert.match(src, /win32/);
      assert.match(src, /not protected by OS file permissions on Windows/);
      // And a real call must not throw on either platform.
      let warned = false;
      const origWarn = console.warn;
      console.warn = () => { warned = true; };
      try {
        await config.saveApiKey('lin_api_test');
      } finally {
        console.warn = origWarn;
      }
      if (process.platform === 'win32') {
        assert.strictEqual(warned, true, 'expected console.warn on Windows');
      } else {
        assert.strictEqual(warned, false, 'expected no warn on POSIX');
      }
    });
  });
});
