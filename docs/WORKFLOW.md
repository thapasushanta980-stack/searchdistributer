# How we change the site

Two or more people work on this codebase. To keep `main` deployable and avoid overwriting each other:

## Every change

1. **Start from the latest `main`:** `git checkout main && git pull`.
2. **Make a branch** named for the change: `git checkout -b fix-registration-city`.
3. Commit there, then **push the branch**: `git push -u origin fix-registration-city`.
4. **Open a pull request** on GitHub into `main`. CI runs automatically: typecheck, all tests against a real Postgres, the build, and the production Docker image.
5. **Merge only when CI is green.** If someone else merged first, update your branch (`git pull origin main`) and let CI run again.
6. **Never push straight to `main`**, and don't deploy unmerged branches.

## Deploying

- `main` is what production runs. After a merge, deploy from Coolify (searchdistributor > Deploy), or let CI do it (below).
- **Automatic deploys:** in GitHub > Settings > Secrets and variables > Actions, add `COOLIFY_URL` (e.g. `https://coolify.searchdistributor.online`), `COOLIFY_TOKEN` (a Coolify API token with deploy permission) and `COOLIFY_APP_UUID` (the application's UUID). CI then deploys every green push to `main`. Add these only once the Coolify panel is on HTTPS, so the token never travels unencrypted.
- A release that adds a database migration should be additive (new tables, new nullable columns). Take a backup first if it changes or removes data.

## Protect main (repository owner, once)

GitHub > Settings > Branches > Add rule for `main`:
- Require a pull request before merging.
- Require status checks to pass: **Typecheck, test, build** and **Production image builds**.

## Running the checks locally

```bash
npm run typecheck
docker run -d --rm --name sdtest -e POSTGRES_USER=u -e POSTGRES_PASSWORD=p -e POSTGRES_DB=sdtest -p 5444:5432 postgres:16-alpine
export TEST_DATABASE_URL="postgresql://u:p@localhost:5444/sdtest?schema=public"
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy --schema server/prisma/schema.prisma
DATABASE_URL=$TEST_DATABASE_URL npx tsx server/prisma/seed.ts
npm test -w server
```
