# Circle USDC Auto-Claim Automation
# 
This repository automates daily USDC claims on Ethereum Sepolia using the Circle Faucet API. It is designed for scheduled, unattended operation via GitHub Actions.

## Features
- **Automated Claims:** Runs every 2.4 hours (10 times/day) to maximize daily USDC claims.
- **Result Logging:** Each claim attempt (success/failure) is recorded in `claim-results.json`.
- **API Key & Wallet Security:** Uses GitHub Secrets for sensitive values.
- **Pushes Results:** Workflow commits and pushes updated logs to the repository.

## Setup
1. **Fork or clone this repo.**
2. **Add GitHub Secrets:**
   - `CIRCLE_API_KEY` – Your Circle TEST_API_KEY (format: `TEST_API_KEY:xxx:xxx`)
   - `WALLET_ADDRESS` – Your Ethereum Sepolia wallet address (0x...)
3. **Enable GitHub Actions:**
   - Ensure workflow permissions are set to "Read and write".
4. **Review `.github/workflows/claim-usdc.yml`:**
   - The workflow is scheduled to run 10 times per day.

## Files
- `.github/workflows/claim-usdc.yml` – GitHub Actions workflow for automation
- `scripts/auto-claim.mjs` – Node.js script to claim USDC and log results
- `claim-results.json` – Log file for all claim attempts

## How It Works
- On each scheduled run, the workflow:
  1. Runs the claim script
  2. Updates `claim-results.json` with the outcome
  3. Commits and pushes the log file
  4. Prints a summary in the Actions run page

## Example Log Entry
```
{
  "timestamp": "2026-02-22T00:00:00Z",
  "status": "success",
  "http_status": 200,
  "transaction_id": "abc123...",
  "message": "Claim accepted"
}
```

## License
MIT
