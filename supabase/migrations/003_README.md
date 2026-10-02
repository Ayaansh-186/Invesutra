# Holding Corrections

Apply `003_verified_holding_repairs.sql` once in the existing project's Supabase SQL Editor, after the base schema and earlier migrations. The script runs in a transaction and supports retries.

This enables the authenticated `repair_fund_purchase` RPC, an owner-readable correction audit, and additional parent-ownership checks for transactions, reports and analysis snapshots. It does not change existing holdings automatically.

The server verifies the exact scheme, recent NAV and allotment-date NAV before calling the RPC. The RPC preserves holding and purchase IDs, calculates amounts, rejects scheme substitutions and multi-transaction corrections, and saves both records atomically. Its SQL is not an external NAV verification service.

Until the migration is applied, the correction API returns a clear 503 message and leaves records unchanged. No service-role credential should be put in a browser or committed to Git.

Local QA used an isolated PostgreSQL-compatible engine with synthetic users to check ownership, duplicate and scheme guards, bounds, audit visibility, retry behavior and rollback after a transaction-write failure. Live Supabase activation must be confirmed separately.
