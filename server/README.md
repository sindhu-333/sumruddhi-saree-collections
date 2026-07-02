Server setup and pgAdmin instructions

1. Create the PostgreSQL database in pgAdmin:
   - Open pgAdmin and connect to your PostgreSQL server.
   - Right-click on "Databases" → Create → Database.
   - Name it `saree_collections` (or match `PGDATABASE` in .env).
   - Optionally create a dedicated DB user and set password.

2. Run SQL to create schema and seed data:
   - Open Query Tool in pgAdmin, load `server/db/init.sql` and run it.
   - Then run `server/db/seed_products.sql` to add a sample product.

3. Configure server environment:
   - Copy `server/.env.example` to `server/.env` and fill in values (host, user, password, database, JWT_SECRET).

4. Install and start server:

```powershell
cd server
npm install
npm run start
```

The server will listen on the port in `.env` (default 4000).

5. Connect frontend to backend:
   - Update the frontend to use the API base URL (e.g. `http://localhost:4000/api`).
   - In Vite, create `.env.local` with `VITE_API_BASE_URL=http://localhost:4000/api` and restart dev server.

6. Endpoints:
   - `GET /api/products`
   - `GET /api/products/:id`
   - `POST /api/auth/signup` { email, password, first_name, last_name }
   - `POST /api/auth/login` { email, password }
   - `POST /api/bookings` { user_id, product_id, status }
   - `GET /api/bookings?userId=`
   - `POST /api/ratings` { booking_id, product_id, user_id, rating, review }
   - `GET /api/ratings?productId=`

If you want, I can now update the frontend to fetch products and submit ratings/bookings/auth to this API. Reply "Update frontend" to proceed with code edits. For production, secure the JWT secret and use HTTPS.
