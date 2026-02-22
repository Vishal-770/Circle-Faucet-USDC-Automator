/**
 * auto-claim.mjs
 * Automatically claims USDC on ETH-Sepolia via Circle Faucet API.
 * Logs every attempt (pass/fail) to claim-results.json in the repo root.
 *
 * Environment variables (set as GitHub Secrets):
 *   CIRCLE_API_KEY   - Your Circle API key  (format: TEST_API_KEY:xxx:xxx)
 *   WALLET_ADDRESS   - Your Ethereum Sepolia wallet address (0x...)
 */

import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESULTS_FILE = path.resolve(__dirname, "..", "claim-results.json");

// ── Validate env ──────────────────────────────────────────────────────────────
const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY;
const WALLET_ADDRESS = process.env.WALLET_ADDRESS;

if (!CIRCLE_API_KEY) {
  console.error("[FATAL] CIRCLE_API_KEY env variable is not set.");
  process.exit(1);
}
if (!WALLET_ADDRESS) {
  console.error("[FATAL] WALLET_ADDRESS env variable is not set.");
  process.exit(1);
}

// ── Circle API helper ─────────────────────────────────────────────────────────
function callCircleFaucet(apiKey, address) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      address,
      blockchain: "ETH-SEPOLIA",
      usdc: true,
    });

    const options = {
      hostname: "api.circle.com",
      port: 443,
      path: "/v1/faucet/drips",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk) => {
        raw += chunk;
      });
      res.on("end", () => {
        let data;
        try {
          data = JSON.parse(raw);
        } catch {
          data = { raw: raw.slice(0, 500) };
        }
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out after 15 s"));
    });

    req.write(payload);
    req.end();
  });
}

// ── Results file helpers ──────────────────────────────────────────────────────
function loadResults() {
  if (!fs.existsSync(RESULTS_FILE)) {
    return {
      meta: {
        description: "Automated USDC claim log – ETH Sepolia via Circle Faucet",
        wallet: WALLET_ADDRESS,
        blockchain: "ETH-SEPOLIA",
        schedule: "Every 2.4 hours (10 times/day)",
      },
      summary: {
        total_attempts: 0,
        total_success: 0,
        total_failed: 0,
        success_rate_pct: 0,
        last_updated: null,
      },
      claims: [],
    };
  }
  return JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
}

function saveResults(results) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2), "utf8");
}

function appendClaim(results, entry) {
  results.claims.push(entry);
  // Keep at most 500 entries to avoid unbounded growth
  if (results.claims.length > 500) {
    results.claims = results.claims.slice(results.claims.length - 500);
  }
  const s = results.summary;
  s.total_attempts++;
  if (entry.status === "success") s.total_success++;
  else s.total_failed++;
  s.success_rate_pct = parseFloat(
    ((s.total_success / s.total_attempts) * 100).toFixed(2),
  );
  s.last_updated = new Date().toISOString();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Starting USDC claim on ETH-SEPOLIA…`);
  console.log(
    `  Wallet : ${WALLET_ADDRESS.slice(0, 8)}…${WALLET_ADDRESS.slice(-6)}`,
  );

  const results = loadResults();
  // Ensure wallet is always up-to-date in meta (in case it changes)
  results.meta.wallet = WALLET_ADDRESS;

  let entry;

  try {
    const { statusCode, data } = await callCircleFaucet(
      CIRCLE_API_KEY,
      WALLET_ADDRESS,
    );
    const isSuccess = statusCode >= 200 && statusCode < 300;

    entry = {
      timestamp,
      status: isSuccess ? "success" : "failed",
      http_status: statusCode,
      transaction_id: data.transactionId ?? data.id ?? null,
      message: data.message ?? (isSuccess ? "Claim accepted" : "Unknown error"),
      error_code: data.code ?? null,
      raw_response: isSuccess ? undefined : data, // only keep raw on failure
    };

    if (isSuccess) {
      console.log(
        `  ✔ SUCCESS  – status ${statusCode} – txId: ${entry.transaction_id}`,
      );
    } else {
      console.warn(
        `  ✖ FAILED   – status ${statusCode} – ${entry.message} (code: ${entry.error_code})`,
      );
    }
  } catch (err) {
    console.error(`  ✖ ERROR    – ${err.message}`);
    entry = {
      timestamp,
      status: "failed",
      http_status: null,
      transaction_id: null,
      message: err.message,
      error_code: "NETWORK_ERROR",
      raw_response: null,
    };
  }

  appendClaim(results, entry);
  saveResults(results);

  console.log(
    `  Summary  – total: ${results.summary.total_attempts} | ok: ${results.summary.total_success} | fail: ${results.summary.total_failed} | rate: ${results.summary.success_rate_pct}%`,
  );
  console.log(`  Results saved to claim-results.json\n`);

  // Exit with non-zero on failure so the workflow shows a warning step (not fatal)
  if (entry.status === "failed") process.exit(0); // still exit 0 so commit step runs
}

main().catch((err) => {
  console.error("[UNEXPECTED]", err);
  process.exit(1);
});
