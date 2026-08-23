# PayD Project Issues Board

This board tracks the breakdown of 100 issues for the PayD platform across Contract, Backend, and Frontend development.

## 📊 Summary

- **Total Issues**: 100
- **Contract**: 33
- **Backend**: 33
- **Frontend**: 34

---

## ⛓ [CONTRACT] Stellar / Smart Contract

_Focuses on asset issuance, trustlines, payment batching, and Soroban logic._

| ID   | Issue Title                                                                               | Difficulty | Status  |
| :--- | :---------------------------------------------------------------------------------------- | :--------: | :-----: |
| #001 | [Issue ORGUSD Custom Asset on Stellar Testnet](docs/issues/001-issue-orgusd-asset.md)     |   ● HARD   | ⏳ TODO |
| #002 | [Implement Trustline Acceptance Flow](docs/issues/002-trustline-flow.md)                  |  ● MEDIUM  | ⏳ TODO |
| #003 | [Build Bulk Payment Transaction Batching](docs/issues/003-bulk-payment-batching.md)       |   ● HARD   | ⏳ TODO |
| #004 | [Set Up Horizon Client & Config](docs/issues/004-horizon-client-setup.md)                 |   ● EASY   | ⏳ TODO |
| #005 | [Integrate Anchor SEP-24 Protocol](docs/issues/005-sep-24-integration.md)                 |   ● HARD   | ⏳ TODO |
| #006 | [Implement Stellar Wallet Kit Integration](docs/issues/006-wallet-kit-integration.md)     |  ● MEDIUM  | ⏳ TODO |
| #007 | [Build On-Chain Tx Verification & Logging](docs/issues/007-tx-verification-logging.md)    |  ● MEDIUM  | ⏳ TODO |
| #008 | [Implement Account Balance Preflight Checks](docs/issues/008-balance-preflight-checks.md) |   ● EASY   | ⏳ TODO |
| #009 | [Design Soroban Smart Contract](docs/issues/009-soroban-escrow-contract.md)               |   ● HARD   | ⏳ TODO |
| #010 | [Write Stellar Tx Signing Unit Tests](docs/issues/010-stellar-signing-tests.md)           |  ● MEDIUM  | ⏳ TODO |
| #031 | [Multi-Sig for Issuer Account](docs/issues/031-multi-sig-issuer.md)                       |   ● HARD   | ⏳ TODO |
| #032 | [Clawback Support for ORGUSD](docs/issues/032-clawback-support.md)                        |  ● MEDIUM  | ⏳ TODO |
| #033 | [Revenue Split Logic via Soroban](docs/issues/033-soroban-revenue-split.md)               |   ● HARD   | ⏳ TODO |
| #034 | [Asset Metadata SEP-1 Implementation](docs/issues/034-sep-1-metadata.md)                  |   ● EASY   | ⏳ TODO |
| #035 | [Transaction Throttling Mechanism](docs/issues/035-tx-throttling.md)                      |  ● MEDIUM  | ⏳ TODO |
| #036 | [Support for Multiple Stablecoins](docs/issues/036-multi-stablecoin-support.md)           |  ● MEDIUM  | ⏳ TODO |
| #037 | [Emergency Freeze Logic](docs/issues/037-emergency-freeze.md)                             |  ● MEDIUM  | ⏳ TODO |
| #038 | [Fee Estimation Service](docs/issues/038-fee-estimation.md)                               |   ● EASY   | ⏳ TODO |
| #039 | [SDS API Integration](docs/issues/039-sds-integration.md)                                 |   ● HARD   | ⏳ TODO |
| #040 | [Claimable Balances for Unregistered Users](docs/issues/040-claimable-balances.md)        |  ● MEDIUM  | ⏳ TODO |
| #041 | [Transaction Simulation for Validation](docs/issues/041-tx-simulation.md)                 |  ● MEDIUM  | ⏳ TODO |
| #042 | [Ledger Observer for Real-time Events](docs/issues/042-ledger-observer.md)                |   ● HARD   | ⏳ TODO |
| #043 | [SEP-31 Cross-Asset Payments](docs/issues/043-sep-31-payments.md)                         |   ● HARD   | ⏳ TODO |
| #086 | [Implement Contract State Archival Strategy](docs/issues/086-archival-strategy.md)        |   ● HARD   | ⏳ TODO |
| #087 | [Optimize Gas Fees for Bulk Execution](docs/issues/087-gas-optimization.md)               |  ● MEDIUM  | ⏳ TODO |
| #088 | [Implement Account-Level Transaction Limits](docs/issues/088-tx-limits.md)                |  ● MEDIUM  | ⏳ TODO |
| #089 | [Add Support for Asset Path Payments](docs/issues/089-path-payments.md)                   |   ● HARD   | ⏳ TODO |
| #090 | [Formal Verification of Multi-Sig Logic](docs/issues/090-formal-verification.md)          |   ● HARD   | ⏳ TODO |
| #091 | [Implement Graceful Revert with Refund](docs/issues/091-graceful-revert.md)               |  ● MEDIUM  | ⏳ TODO |
| #092 | [Add SECP256K1 Signature Support](docs/issues/092-secp256k1-support.md)                   |  ● MEDIUM  | ⏳ TODO |
| #093 | [Implement Contract Metadata (SEP-0034)](docs/issues/093-contract-metadata.md)            |   ● EASY   | ⏳ TODO |
| #094 | [Build On-Chain Audit Trail for Bonuses](docs/issues/094-bonus-audit.md)                  |  ● MEDIUM  | ⏳ TODO |
| #095 | [Implement Emergency Pause (Circuit Breaker)](docs/issues/095-circuit-breaker.md)         |   ● EASY   | ⏳ TODO |

---

## 🛠 [BACKEND] Node.js / API / Database

_Focuses on project structure, database schema, payroll scheduling, and API logic._

| ID   | Issue Title                                                                                           | Difficulty | Status  |
| :--- | :---------------------------------------------------------------------------------------------------- | :--------: | :-----: |
| #011 | [Set Up Express.js Project Structure](docs/issues/011-express-ts-setup.md)                            |  ● MEDIUM  | ⏳ TODO |
| #012 | [Design & Migrate PostgreSQL Schema](docs/issues/012-db-schema-migrations.md)                         |  ● MEDIUM  | ⏳ TODO |
| #013 | [Build Payroll Scheduling Engine](docs/issues/013-payroll-scheduler.md)                               |   ● HARD   | ⏳ TODO |
| #014 | [Implement JWT Auth & RBAC](docs/issues/014-jwt-rbac-auth.md)                                         |   ● EASY   | ⏳ TODO |
| #015 | [Build CSV Bulk Import Parser & Validator](docs/issues/015-csv-importer.md)                           |   ● HARD   | ⏳ TODO |
| #016 | [Integrate FX Rate API](docs/issues/016-fx-rate-api.md)                                               |  ● MEDIUM  | ⏳ TODO |
| #017 | [Build Employee CRUD API Endpoints](docs/issues/017-employee-crud-api.md)                             |   ● EASY   | ⏳ TODO |
| #018 | [Set Up Notification Service](docs/issues/018-notification-service.md)                                |  ● MEDIUM  | ⏳ TODO |
| #019 | [Implement Payroll Run Audit Log & Reporting](docs/issues/019-audit-reporting-api.md)                 |   ● HARD   | ⏳ TODO |
| #020 | [Dockerize Backend Service](docs/issues/020-docker-setup.md)                                          |   ● EASY   | ⏳ TODO |
| #044 | [OAuth2 Social Login Integration](docs/issues/044-oauth2-social-login.md)                             |  ● MEDIUM  | ⏳ TODO |
| #045 | [Multi-tenant Architecture Support](docs/issues/045-multi-tenant-architecture.md)                     |   ● HARD   | ⏳ TODO |
| #046 | [Two-Factor Authentication (2FA)](docs/issues/046-2fa-support.md)                                     |  ● MEDIUM  | ⏳ TODO |
| #047 | [Data Export System (PDF/Excel)](docs/issues/047-data-export-system.md)                               |  ● MEDIUM  | ⏳ TODO |
| #048 | [Webhook System for Integrations](docs/issues/048-webhook-system.md)                                  |   ● HARD   | ⏳ TODO |
| #049 | [Support for Performance Bonuses](docs/issues/049-performance-bonuses.md)                             |   ● EASY   | ⏳ TODO |
| #050 | [Employee Profile Management](docs/issues/050-employee-profile-mgmt.md)                               |   ● EASY   | ⏳ TODO |
| #051 | [Advanced Search & Filtering](docs/issues/051-advanced-search-filtering.md)                           |  ● MEDIUM  | ⏳ TODO |
| #052 | [API Versioning Strategy](docs/issues/052-api-versioning.md)                                          |   ● EASY   | ⏳ TODO |
| #053 | [Email/System Monitoring (ELK Stack)](docs/issues/053-monitoring-logging.md)                          |   ● HARD   | ⏳ TODO |
| #054 | [API Rate Limiting](docs/issues/054-api-rate-limiting.md)                                             |   ● EASY   | ⏳ TODO |
| #055 | [Health Dashboard API](docs/issues/055-health-api.md)                                                 |   ● EASY   | ⏳ TODO |
| #056 | [Custom Tax Calculations Support](docs/issues/056-tax-calculations.md)                                |  ● MEDIUM  | ⏳ TODO |
| #077 | [Contract Event Indexer Service](docs/issues/077-contract-event-indexer.md)                           |   ● HARD   | ⏳ TODO |
| #078 | [Contract Address Registry API](docs/issues/078-contract-address-registry-api.md)                     |  ● MEDIUM  | ⏳ TODO |
| #041 | [Preflight Balance Check Service](docs/issues/041-preflight-balance-check.md)                         |  ● MEDIUM  | ⏳ TODO |
| #042 | [Transaction History Backend Integration](docs/issues/042-transaction-history-backend-integration.md) |  ● MEDIUM  | ⏳ TODO |
| #043 | [Payroll Scheduler Backend Wiring](docs/issues/043-payroll-scheduler-backend-wiring.md)               |   ● HARD   | ⏳ TODO |
| #096 | [OAuth2 Social Login Integration Expansion](docs/issues/096-oauth2-social-login.md)                   |  ● MEDIUM  | ⏳ TODO |
| #097 | [Add Swagger/OpenAPI Documentation](docs/issues/097-openapi-docs.md)                                  |   ● EASY   | ⏳ TODO |
| #098 | [Implement Redis-Based Queue for Payroll](docs/issues/098-redis-queue.md)                             |   ● HARD   | ⏳ TODO |
| #099 | [Build Advanced Reporting Engine (PDF/Excel)](docs/issues/099-reporting-engine.md)                    |  ● MEDIUM  | ⏳ TODO |
| #100 | [Implement Webhook Notification System](docs/issues/100-webhook-system.md)                            |   ● HARD   | ⏳ TODO |

---

## 🎨 [FRONTEND] React / TypeScript / UI

_Focuses on dashboard layout, wallet connection, management UI, and analytics._

| ID   | Issue Title                                                                               | Difficulty | Status  |
| :--- | :---------------------------------------------------------------------------------------- | :--------: | :-----: |
| #011 | [Scaffold React 19 + Vite Project](docs/issues/011-react-vite-setup.md)                   |  ● MEDIUM  | ⏳ TODO |
| #012 | [Build Employer Dashboard Layout](docs/issues/012-dashboard-layout.md)                    |   ● EASY   | ⏳ TODO |
| #013 | [Implement Wallet Connect Flow](docs/issues/013-wallet-connect-ui.md)                     |   ● HARD   | ⏳ TODO |
| #014 | [Build Employee Management Table](docs/issues/014-employee-table-ui.md)                   |  ● MEDIUM  | ⏳ TODO |
| #015 | [Build CSV Upload UI](docs/issues/015-csv-upload-ui.md)                                   |  ● MEDIUM  | ⏳ TODO |
| #016 | [Build Payroll Analytics Dashboard](docs/issues/016-analytics-dashboard.md)               |   ● HARD   | ⏳ TODO |
| #017 | [Build Employee Portal History View](docs/issues/017-employee-portal.md)                  |   ● EASY   | ⏳ TODO |
| #018 | [Implement QR Code Onboarding](docs/issues/018-employee-onboarding-ui.md)                 |  ● MEDIUM  | ⏳ TODO |
| #019 | [Add Toast Notification System](docs/issues/019-toast-notification-system.md)             |   ● EASY   | ⏳ TODO |
| #020 | [Build Payroll Scheduling Config UI](docs/issues/020-payroll-scheduling-ui.md)            |   ● HARD   | ⏳ TODO |
| #021 | [Theme Switcher (Light/Dark Mode)](docs/issues/021-theme-switcher.md)                     |   ● EASY   | ⏳ TODO |
| #022 | [Multi-language Support (i18n)](docs/issues/022-multi-language-support.md)                |  ● MEDIUM  | ⏳ TODO |
| #023 | [Interactive Onboarding Tour](docs/issues/023-interactive-onboarding.md)                  |  ● MEDIUM  | ⏳ TODO |
| #024 | [Advanced Filter UI for Transactions](docs/issues/024-advanced-filter-ui.md)              |  ● MEDIUM  | ⏳ TODO |
| #025 | [WebSocket Integration for Real-time Updates](docs/issues/025-websocket-integration.md)   |   ● HARD   | ⏳ TODO |
| #026 | [Organization Settings Page](docs/issues/026-org-settings-page.md)                        |   ● EASY   | ⏳ TODO |
| #027 | [Custom Report Builder UI](docs/issues/027-custom-report-builder.md)                      |   ● HARD   | ⏳ TODO |
| #028 | [Drag-and-Drop Employee Reordering](docs/issues/028-employee-reordering.md)               |   ● EASY   | ⏳ TODO |
| #029 | [Session Timeout Warnings](docs/issues/029-session-timeout-ui.md)                         |   ● EASY   | ⏳ TODO |
| #030 | [Mobile Responsive Optimization](docs/issues/030-mobile-responsive.md)                    |  ● MEDIUM  | ⏳ TODO |
| #031 | [Profile Pictures / Gravatar Support](docs/issues/031-profile-pictures.md)                |   ● EASY   | ⏳ TODO |
| #032 | [Interactive Documentation Page](docs/issues/032-documentation-page.md)                   |  ● MEDIUM  | ⏳ TODO |
| #033 | [Form Autosave for Configurations](docs/issues/033-form-autosave.md)                      |  ● MEDIUM  | ⏳ TODO |
| #034 | [Error Boundaries & Crash Reporting](docs/issues/034-error-boundaries.md)                 |  ● MEDIUM  | ⏳ TODO |
| #035 | [Soroban Contract Invocation Hook](docs/issues/035-soroban-contract-invocation-hook.md)   |   ● HARD   | ⏳ TODO |
| #036 | [Vesting Escrow UI Component](docs/issues/036-vesting-escrow-ui.md)                       |  ● MEDIUM  | ⏳ TODO |
| #037 | [Bulk Payment Status Tracker](docs/issues/037-bulk-payment-status-tracker.md)             |  ● MEDIUM  | ⏳ TODO |
| #038 | [Revenue Split Dashboard](docs/issues/038-revenue-split-dashboard.md)                     |   ● HARD   | ⏳ TODO |
| #039 | [Cross-Asset Payment Integration](docs/issues/039-cross-asset-payment-integration.md)     |   ● HARD   | ⏳ TODO |
| #040 | [Wallet Session Persistence](docs/issues/040-wallet-session-persistence.md)               |  ● MEDIUM  | ⏳ TODO |
| #044 | [Contract Error Parsing UI](docs/issues/044-contract-error-parsing-ui.md)                 |  ● MEDIUM  | ⏳ TODO |
| #045 | [Employee Payout Claim Integration](docs/issues/045-employee-payout-claim-integration.md) |   ● HARD   | ⏳ TODO |
| #046 | [Contract Upgrade Migration UI](docs/issues/046-contract-upgrade-migration-ui.md)         |   ● HARD   | ⏳ TODO |
| #047 | [Network Switch (Testnet/Mainnet)](docs/issues/047-network-switch-testnet-mainnet.md)     |  ● MEDIUM  | ⏳ TODO |
