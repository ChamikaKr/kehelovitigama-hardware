# Kehelovitigama Hardware — Cheque Module Local Preview

## What changed
- Added a Cheque Calendar page as the first item under Financial Management.
- Added date selection, month navigation, selected-day cheque list, account filter, and Add Cheque form.
- Added a combined Bank Accounts & OD page with two account cards and linked cheque-book settings.
- Added responsive layouts for narrow Android screens and desktop.
- Matched the existing application's current light visual theme, typography, borders, and button styling.
- Removed the old standalone Cheque Management navigation item.

## Important preview limitation
This is a front-end UI preview only. Cheque entries and account edits are held in React component state and are not persisted to Supabase. The uploaded project did not contain a bank/cheque schema or an existing bank-account integration. Do not use this preview to record real cheque payments. Before production use, the database schema, row-level security, atomic cheque reservation/clearance operations, audit history, reminders, and reconciliation must be implemented and tested.

## Local setup
1. Copy the existing `.env` file from your current working project into this project root. Do not share or commit it.
2. Use Node.js 22 or later (the included GitHub Actions workflow uses Node 22).
3. Run `npm install`.
4. Run `npm run build` and resolve any reported errors before testing.
5. Run `npm run dev -- --host 0.0.0.0`.
6. Open the Vite URL on the PC. To test from an Android phone on the same Wi-Fi, open `http://<PC-LAN-IP>:5173`.

## Push to existing GitHub repository
The uploaded ZIP did not include `.git` metadata. Apply these changed files to your existing local clone so its `.git` folder and `origin` remote are preserved. Then run:

```bash
git status
git add src/App.tsx src/ChequeManagement.tsx src/ChequeManagement.css CHEQUE_MODULE_LOCAL_PREVIEW_NOTES.md
git commit -m "Add responsive cheque calendar UI"
git push origin main
```

Do not push `.env` or any service-role key. The repository's GitHub Actions workflow expects the Supabase URL and publishable key to be configured as repository secrets.
