Sinery System — sistema operacional inteligente para clínicas. Este é o
projeto Next.js do produto SaaS (não o site institucional da Sinery, que é
um projeto separado).

## Getting Started

First, configure the database — see [docs/setup-database.md](./docs/setup-database.md)
for the full walkthrough (Docker or a free hosted Postgres, migrations, seed,
Prisma Studio, `/api/health`). Quick version:

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and AUTH_SECRET
npm run db:push
npm run db:seed
```

For login, sessions, and the AUTH_SECRET/provisional-password flow, see
[docs/authentication.md](./docs/authentication.md).

**Going to staging/production?** Start with the
[V1 release checklist](./docs/v1-release-checklist.md) and the
[environment variables reference](./docs/environment-variables.md).

**Operating the SaaS (founder panel)?** See
[docs/founder-admin.md](./docs/founder-admin.md) — the internal `/founder` area to
create clinics, plans, subscriptions, invoices and suspensions manually.

Then, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
