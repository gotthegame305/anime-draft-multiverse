# Vercel Deployment Guide — Anime Draft Multiverse

**Status:** ✅ Ready for Vercel Deployment  
**Build Status:** ✅ Passing (Exit Code: 0)  
**Database:** ✅ PostgreSQL (Prisma Data XL)  
**Last Updated:** February 15, 2026

---

## Critical Fixes Applied

All critical issues have been fixed:

✅ **Prisma Schema** — Fixed missing User relationships on Room model  
✅ **Debug Logging** — Removed all console.log from production code  
✅ **Type Safety** — Fixed any types and TypeScript errors  
✅ **Input Validation** — Added validation to API routes  
✅ **Git History** — All changes committed and versioned  

---

## Pre-Deployment Checklist

Before pushing to Vercel, complete these steps:

### 1. Generate NEXTAUTH_SECRET

```bash
openssl rand -base64 32
# Output example: "AbCdEf1234567890GhIjKlMnOpQrStUvWxYz=="
```

Keep this secret safely.

### 2. Get OAuth Credentials

#### Google OAuth
1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: Web application
6. Authorized redirect URIs: `https://yourdomain.com/api/auth/callback/google`
7. Copy **Client ID** and **Client Secret**

#### Discord OAuth
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Go to "OAuth2" → "General"
4. Copy **Client ID**
5. Click "Reset Secret" and copy the new **Secret**
6. Add redirect URL: `https://yourdomain.com/api/auth/callback/discord`

#### Pusher
1. Sign up at https://pusher.com/
2. Create a new app
3. Dashboard shows: **App ID**, **Key**, **Cluster**, and **Secret**

### 3. Set Up Vercel Environment Variables

1. Go to https://vercel.com/dashboard
2. Select your project (or create new)
3. Go to **Settings** → **Environment Variables**
4. Add each variable with values from above:

```
DATABASE_URL = your-prisma-data-xl-url
NEXTAUTH_SECRET = (from openssl command)
NEXTAUTH_URL = https://yourdomain.vercel.app
GOOGLE_CLIENT_ID = (from Google)
GOOGLE_CLIENT_SECRET = (from Google)
DISCORD_CLIENT_ID = (from Discord)
DISCORD_CLIENT_SECRET = (from Discord)
NEXT_PUBLIC_PUSHER_APP_ID = (from Pusher)
NEXT_PUBLIC_PUSHER_KEY = (from Pusher)
NEXT_PUBLIC_PUSHER_CLUSTER = (from Pusher)
PUSHER_SECRET = (from Pusher)
NODE_ENV = production
```

### 4. Update .env Locally (Optional for Testing)

Copy `.env.example` to `.env` and fill in your test values:

```bash
cp .env.example .env
# Then edit .env with your credentials
```

For local development, you can use:
- `NEXTAUTH_URL=http://localhost:3000`
- Any test OAuth credentials

### 5. Test Locally (Optional)

```bash
npm run dev
# Visit http://localhost:3000
# Test sign-in with OAuth
# Test game functionality
```

---

## Deployment Steps

### Option A: Push to GitHub (Recommended)

1. **Commit all changes:**
   ```bash
   git add .
   git commit -m "fix: all critical issues resolved, ready for production"
   git push origin main
   ```

2. **Connect Vercel to GitHub:**
   - Go to https://vercel.com/new
   - Select "Import Project"
   - Choose your GitHub repository
   - Framework: Next.js (auto-detected)
   - Click "Deploy"
   - Vercel will use environment variables from Settings

3. **Monitor deployment:**
   - Watch the build logs in Vercel dashboard
   - Should complete in 2-3 minutes
   - Domain assigned automatically (e.g., `anime-draft-multiverse.vercel.app`)

### Option B: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Follow prompts and set environment variables
```

---

## After Deployment

### 1. Verify Build Succeeded

- Check Vercel dashboard → "Deployments" tab
- Should show green checkmark
- Click deployment to see build logs

### 2. Test Live Application

Visit your deployment URL and verify:

- [ ] Homepage loads and renders correctly
- [ ] Can click "ENTER THE DRAFT" button
- [ ] Can navigate to different pages
- [ ] Sign in with Google works
- [ ] Sign in with Discord works
- [ ] Can play a draft game
- [ ] Leaderboard loads
- [ ] No console errors in browser DevTools

### 3. Common Issues & Fixes

**Issue:** "NEXTAUTH_SECRET not set"
- **Fix:** Ensure `NEXTAUTH_SECRET` is added to Vercel environment variables

**Issue:** "Cannot find module @prisma/client"
- **Fix:** Vercel should auto-run `prisma generate` during build. If not:
  ```
  Check "postinstall" script in package.json (should run prisma generate)
  ```

**Issue:** "[PUSHER] Server initialization skipped"
- **Fix:** This is expected if Pusher variables missing. Add:
  ```
  NEXT_PUBLIC_PUSHER_APP_ID
  NEXT_PUBLIC_PUSHER_KEY
  NEXT_PUBLIC_PUSHER_CLUSTER
  PUSHER_SECRET
  ```

**Issue:** Database connection errors
- **Fix:** Verify `DATABASE_URL` is correct in environment variables

### 4. Monitor Performance

- Check Vercel Analytics (if enabled)
- Monitor database connections in Prisma Data XL dashboard
- Set up error tracking (e.g., Sentry) for production

---

## Database Migrations

The Prisma schema has been updated with proper relationships:

- Added `User` ← → relationship to `Room`
- Added indexes for performance
- Added cascading deletes for data consistency

**For existing deployments:** If your database is behind on migrations, Vercel's build process will apply them automatically during deployment.

---

## What's Next

After successful deployment:

1. **Share with users** — Direct to your Vercel domain
2. **Monitor uptime** — Set up status page or alerts
3. **Add logging** — Implement Sentry or similar for error tracking
4. **Performance testing** — Use tools like k6 or Artillery to test under load
5. **Security audit** — Run OWASP Top 10 security checks
6. **User feedback** — Collect feedback and plan v2 improvements

---

## Support & Troubleshooting

If deployment fails:

1. **Check Vercel build logs** — Click the failed deployment
2. **Review API credentials** — Ensure all OAuth secrets are correct
3. **Test locally first** — Run `npm run dev` locally and verify everything works
4. **Check environment variables** — Common issue: missing or typo'd variables
5. **Review Prisma schema** — Run `npx prisma validate` locally

---

## Rollback Plan

If something breaks after deployment:

1. **Instant rollback:** 
   - Vercel Dashboard → Deployments → Previous deployment → "Promote to Production"

2. **Full reset:**
   - Revert last commits: `git revert <commit-hash>`
   - Push to GitHub
   - Vercel will auto-redeploy

---

## Environment Variable Reference

| Variable | Example | Required | Notes |
|----------|---------|----------|-------|
| `DATABASE_URL` | `postgres://...` | ✅ | From Prisma Data XL |
| `NEXTAUTH_SECRET` | 32-char string | ✅ | Generate with openssl |
| `NEXTAUTH_URL` | `https://yourdomain.com` | ✅ | Production domain |
| `GOOGLE_CLIENT_ID` | OAuth ID | ✅ | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth secret | ✅ | Keep secret! |
| `DISCORD_CLIENT_ID` | OAuth ID | ✅ | From Discord Dev Portal |
| `DISCORD_CLIENT_SECRET` | OAuth secret | ✅ | Keep secret! |
| `NEXT_PUBLIC_PUSHER_APP_ID` | Pusher ID | ✅ | Public (safe in frontend) |
| `NEXT_PUBLIC_PUSHER_KEY` | Pusher key | ✅ | Public (safe in frontend) |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | `mt1` etc | ✅ | From Pusher dashboard |
| `PUSHER_SECRET` | Pusher secret | ✅ | Keep secret! |
| `NODE_ENV` | `production` | ✅ | Set by Vercel |

---

*Last Updated: February 15, 2026*  
*Deployment Status: ✅ Ready*  
*Build Status: ✅ Passing*
