# Bedaya — Member 4 backend

Read [the Member 4 handoff](docs/MEMBER4_HANDOFF.md) for implemented features, API contracts, database setup, test results, source provenance and deployment limits. M1 data and M5 modules are pinned to the commit in docs/M5_UPSTREAM_COMMIT.txt.

The Arabic `/backend` page is a developer demo bench; `/` provides account access. Copy `.env.example` to `.env.local`, configure Supabase, and follow the migration/seed instructions in the handoff. Never commit local environment files. Keep external AI disabled for the demo.

Validated commands: `npm.cmd run check:data`, `npm.cmd run test:platform`, `npm.cmd run test:features`, `npm.cmd run test:assistant`, `npm.cmd run lint`, `npm.cmd run build`. Start with `npm.cmd run start -- --port 3011 --hostname 127.0.0.1`, then run `npm.cmd run test:http`. Database assertions are in supabase/tests/member4.sql.

The original Next.js starter instructions follow.

## Getting Started

First, run the development server:

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

## Bedaya backend
See [BACKEND_GUIDE.md](BACKEND_GUIDE.md) for Supabase setup, API contracts, security checks, and the two-account isolation test.
