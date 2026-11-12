# Garment Model Management — Next.js + TypeScript + Prisma + PostgreSQL

## Included
- JWT authentication in HTTP-only cookies; bcrypt password hashes
- Dynamic role and permission matrix, user-role assignments, protected APIs and sidebar
- Garment categories, custom measurement fields and reusable size templates
- Product auto serial numbers (configurable prefix, digits, counter)
- Product measurements by size, 15 product images, model profile photos
- Multi-item model assignments, partial returns, model-wise outstanding quantities
- Audit log for CRUD and return actions; React Hot Toast notifications
- Zod validation for new records, role-based backend permission enforcement

## Quick start (Node.js 20+, PostgreSQL 14+)
1. Copy `.env.example` to `.env` and edit DATABASE_URL, JWT_SECRET, ADMIN_EMAIL and ADMIN_PASSWORD. Set a long random JWT_SECRET.
2. `npm install`
3. `npm run db:generate`
4. `npm run db:push`
5. `npm run db:seed`
6. `npm run dev`
7. Visit http://localhost:3000/login and sign in with ADMIN_EMAIL / ADMIN_PASSWORD.

## Workflow
1. Create garment categories and measurement fields.
2. Create templates, selecting a category, sizes and measurement fields.
3. Create a product using a template, enter measurements, upload images; SN is generated automatically.
4. Create model profiles.
5. Assign one or more products/sizes and quantities to a model.
6. Use Assignments or Returns to record partial/full returns; Quantity Tracking shows outstanding items.
7. Use Roles & Permissions to create roles and assign them to users.

## Production notes
- Local uploads in `public/uploads` are suitable for a persistent server. For Vercel/serverless deployments replace local uploads with S3/Cloudinary and image optimization.
- Use HTTPS, backups, rate limiting, monitoring, object-storage malware scanning, and a PostgreSQL migration workflow before production.
- This is an MVP. Assignment issue/return is tracked; it does not enforce physical warehouse stock limits. Warehouse stock requires an additional receipts/adjustments ledger.
- Serial number changes affect future products only. Concurrent serial allocation uses a serializable transaction; production systems should retry serialization conflicts.
- The admin password is set only when the initial account is created; changing ADMIN_PASSWORD later does not reset an existing account.
