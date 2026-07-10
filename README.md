# Saree Collections App

A full-stack saree storefront built with React and Vite on the frontend, and Express with PostgreSQL on the backend.

## Project overview

This project showcases saree collections with a polished customer experience and real administrative workflows.

### What is built in this app

- Customer storefront with product discovery, browsing, and collection navigation.
- Persistent cart and booking flow for products.
- Payment proof upload for verification-based bookings.
- Returns and exchange request flow with file uploads and admin review.
- Admin panel for booking review, collection management, and request processing.
- Email-driven flows for signup verification and password reset.
- Responsive and animated UI with a modern landing experience.

### Frontend features

- Product grid and category scroller.
- Shopping cart with quantity updates.
- Booking flow with user information capture.
- Payment screenshot upload for verification.
- Return/exchange request form.
- Admin returns page for approval and rejection.
- Dark mode support and animated interface.

### Backend features

- Express API server with PostgreSQL data persistence.
- User authentication, signup, login, and JWT session handling.
- Password reset and verification email support.
- Booking records stored with user, product, payment, and status details.
- Returns table with document upload support and admin notes.
- File uploads handled with Multer and served from `/uploads`.
- CORS origin validation and rate limiting on auth routes.

## Tech stack

- Frontend: React 17, Vite, React Router DOM
- Backend: Node.js, Express, PostgreSQL, JWT
- File uploads: Multer
- Email service: Nodemailer / hosted mail provider
- Dev tooling: Vite, npm

## Repository structure

- `/src` — React application source and UI components
- `/src/components` — cart, product cards, payment modal, admin returns page, and forms
- `/src/data` — sample saree product seed data
- `/server` — API server, database client, email helper, and uploads handling
- `/server/db` — SQL schema and seed data
- `/uploads` — runtime storage for file uploads
- `/public` — static assets served by Vite

## Local setup

1. Install root dependencies:

```powershell
npm install
```

2. Install backend dependencies:

```powershell
cd server
npm install
cd ..
```

3. Configure backend environment:

```powershell
cd server
copy .env.example .env
```

4. Update `server/.env` with your database, JWT, and email values.

5. Initialize the database:

```powershell
# Run these in your PostgreSQL client or pgAdmin
server/db/init.sql
server/db/seed_products.sql
```

6. Start the application:

```powershell
npm run dev
```

This launches:
- Backend API on `http://localhost:4000`
- Frontend Vite app on `http://localhost:3000`

### Run only one service

- Frontend only: `npm run dev:client`
- Backend only: `npm run dev:server`

## Database setup

- Create a PostgreSQL database matching `PGDATABASE` in `server/.env`.
- Run the schema script at `server/db/init.sql`.
- Seed sample sarees with `server/db/seed_products.sql`.

## Environment Variables

Backend variables used by [server/index.js](server/index.js):

- `DATABASE_URL` (preferred for hosted DB services)
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`
- `JWT_SECRET`
- `PORT`
- `MAIL_PROVIDER`
- `MAIL_API_URL`
- `MAIL_API_KEY`
- `MAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
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