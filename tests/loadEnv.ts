// Loads tests/.env.test.local (gitignored, see .env.test.example) before any
// test file runs. Uses Node's built-in loader (22+) instead of adding a
// dotenv dependency just for this.
try {
  process.loadEnvFile(new URL('./.env.test.local', import.meta.url));
} catch {
  // Missing file surfaces as a clear "SUPABASE_SERVICE_ROLE_KEY is not set"
  // failure from the test itself -- better than a cryptic loader error here.
}
