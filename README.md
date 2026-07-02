# Saree Collections App

A React + Vite storefront with an Express + PostgreSQL backend for saree browsing, bookings, admin collection management, and verification flows.

## What this project includes

- Storefront with collection browsing, cart, booking, and payment proof upload.
- Admin dashboard for order tracking, booking verification, revenue view, and collection management.
- Email flows for signup verification and password reset.
- Responsive UI with dark mode support.

## Tech Stack

- Frontend: React 17, Vite, React Router
- Backend: Node.js, Express
- Database: PostgreSQL
- File uploads: Multer
- Email: Nodemailer

## Local Setup

1. Install dependencies at the project root.

```powershell
npm install
```

2. Install backend dependencies if needed.

```powershell
cd server
npm install
cd ..
```

3. Create your backend environment file.

- Copy [server/.env.example](server/.env.example) to [server/.env](server/.env)
- Fill in your own PostgreSQL, JWT, SMTP, and admin values
- Never commit [server/.env](server/.env)

4. Start the full app locally.

```powershell
npm run dev
```

This starts the backend on port `4000` and the Vite frontend on port `3000`.

## Database Setup

1. Create a PostgreSQL database that matches `PGDATABASE` in [server/.env](server/.env).
2. Run the schema file: [server/db/init.sql](server/db/init.sql)
3. Seed sample products with: [server/db/seed_products.sql](server/db/seed_products.sql)

## Environment Variables

Backend variables used by [server/index.js](server/index.js):

- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `JWT_SECRET`
- `PORT`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `ADMIN_NOTIFICATION_EMAIL`
- `FRONTEND_BASE_URL`
- `ADMIN_DEFAULT_PASSWORD`

## Secure Hosting Recommendation

For a secure public deployment, use two hosted services:

- Frontend: Vercel or Netlify for automatic HTTPS
- Backend: Render, Railway, or Fly.io for the API
- Database: Neon, Supabase, or a managed PostgreSQL instance

Production checklist:

- Set `NODE_ENV=production` on the backend host.
- Set `FRONTEND_BASE_URL` to your real HTTPS frontend URL.
- Set `CORS_ORIGIN` to the same HTTPS frontend URL if needed.
- Use a long random `JWT_SECRET`.
- Use app passwords or a secure SMTP provider secret, not your normal email password.
- Do not commit `.env` files.

### Example deployment flow

1. Push the repo to GitHub.
2. Deploy the frontend from the GitHub repo to Vercel or Netlify.
3. Deploy the backend from the same GitHub repo to Render or Railway.
4. Add your production environment variables in the hosting dashboard.
5. Point `FRONTEND_BASE_URL` to the deployed frontend URL.
6. Point the frontend API config to the deployed backend URL.

## Pushing to GitHub

```powershell
git init
git add .
git commit -m "Initial saree collections app"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

## Notes

- The root script [package.json](package.json) runs both frontend and backend during development.
- [scripts/dev.js](scripts/dev.js) starts the API first and then Vite.
- If you only want the frontend, use `npm run dev:client`.
- If you only want the backend, use `npm run dev:server`.