# Incidents and lessons

What went wrong while building and running this storefront, why, how it was fixed, and what now
stops it from happening again. Newest first. Add to it whenever something breaks: the guard column
is the point. If a mistake has no guard yet, write one (a test, a check, a rule below).

## Guards that run on their own

| Guard | Where | Catches |
| --- | --- | --- |
| CI on every pull request and push to main: lint, types, tests, build, per-request route check | `.github/workflows/ci.yml` | broken builds, type errors, the regressions in `tests/` |
| `tests/safe-path.test.ts` | CI | any return path that leads to another site (open redirect) |
| `tests/deploy-guards.test.ts` | CI | Netlify without the Next.js runtime, webhooks forcing paid regenerations, secrets reaching dependency installs, a prerendered sign-in route |
| `scripts/check-build.mjs` | CI, after the build | sign-in, webhook and tracking routes prerendered instead of running per request |
| Site health (`scripts/check-site.mjs`) | `.github/workflows/site-health.yml`: twice an hour and after every push to main | pages down, one image everywhere, webhook secret missing, sign-in not going to Shopify, open redirects. A failed run emails the repository owner |
| Deploy preview before merging | Netlify, on every pull request | anything visible, tested by hand before production |
| `generate.mjs --dry-run` / `--check` before a real pipeline run | habit, and the Action's first step | the pipeline spending credits on products that do not need it |
| Pipeline smoke test (Action input `smoke`) | by hand, after changing `tools/` | the optimiser or renderer failing in GitHub's machines |

## Incident log

| Date (UTC) | What happened | Impact | Cause | Fix | Guard |
| --- | --- | --- | --- | --- | --- |
| 2026-10-23 | The asset pipeline was said to start within 5 minutes of a new photo without the dispatch token | Wrong expectation: a new product could wait hours for its 3D model and views | GitHub delays and drops scheduled runs when busy; the 10-minute schedule actually ran every 3 to 5 hours (seen in the Actions history) | Docs no longer promise the schedule; the webhook dispatch (`GITHUB_DISPATCH_TOKEN`) is the trigger to rely on; the schedule is off the top of the hour | Check a schedule's real run history before promising its timing |
| 2026-10-23 | Sign-in on the site gave Shopify the deploy's own address (`<deploy-id>--site.netlify.app`) as its callback | Live for ~10 minutes right after customer sign-in was switched on: "Sign in" would have ended on Shopify's "redirect_uri mismatch". Found by checking production, rolled back to the hosted-account version, publishing locked until fixed | Netlify hands functions the deploy address; the routes built Shopify's addresses (and their own redirects) from the request | Shopify's addresses come from the public URL (`publicOrigin`: `NEXT_PUBLIC_SITE_URL`, else Netlify's `URL`); redirects within the site are relative (`localRedirect`), so the shopper stays on the host with their cookies | `tests/site-origin.test.ts`, route guard in `tests/deploy-guards.test.ts`, strict callback check in site health |
| 2026-10-22/23 | `/account/refresh?to=…` could send a shopper to another site, first with `/\t/evil.com`, then (after a first fix) with `/.//evil.com` | Open redirect on the live site for about a day (usable in phishing links; no data exposed) | The return path was checked with prefix rules; the URL parser drops tabs and collapses dot segments, so the value checked was not the value redirected to | Resolve the value like a browser, reject tabs, newlines and backslashes, check the returned path itself and the final redirect's origin (#4, #5) | `tests/safe-path.test.ts` (23 cases), site health probes |
| 2026-10-22 | `/account/login` was built as a static page when no client ID was set at build time | Caught before release: every shopper would have shared one state and PKCE code | Next 16 prerenders a GET route handler that touches no request data | `await connection()` at the top of the route | `tests/deploy-guards.test.ts`, `scripts/check-build.mjs` |
| 2026-10-22 04:10 | The first Git build on Netlify published the raw `.next` folder | Production answered 404 on every page for ~15 minutes | The Next.js runtime (`@netlify/plugin-nextjs`) is added on its own by the CLI but not by Git builds | Rolled back (`restoreSiteDeploy`), locked publishing, declared and pinned the runtime, tested the preview, published, unlocked | `tests/deploy-guards.test.ts`, site health |
| 2026-10-22 | The asset pipeline's Shopify secrets reached `npm ci` | Risk: an install script of a dependency could read them | Secrets were set on the whole job | Secrets only in the steps that use them | `tests/deploy-guards.test.ts` |
| 2026-10-22 | A failed regeneration would have recorded the new photos as used | Risk: a product with a new photo would never be retried | The run record was written before the run succeeded | Photos are recorded only on success | Code review; `--dry-run` shows what would run |
| 2026-10-22 | A dry run showed 5 existing products about to be regenerated | Near miss: 320 Meshy credits | An older record kept `source: "site-import"` (a string), read as the list of photos | The photo record is its own field (`photos`, arrays only) | Always `--dry-run` first |
| 2026-10-22 | A webhook-started pipeline run would name the product | Risk: every edit (price, stock) forcing a paid regeneration | Runs that name products redo them even when up to date | Webhook runs never name products; only a run started by hand does | `tests/deploy-guards.test.ts` |
| 2026-10-22 02:10 | Every picture on the live site was the same cap | Production showed wrong images | `netlify build` and `netlify deploy --no-build` run separately lose the Next.js adapter's image route (`/_next/image` → Netlify Image CDN) | Rolled back; only `netlify deploy --build`, now only Git builds | Site health (images real and distinct) |
| 2026-10-22 | Local CLI builds got a 401 from Shopify | Builds failed locally | Netlify secret variables reach local CLI builds as a placeholder | The Storefront token is a regular (non-secret) variable | Git builds now; documented |
| 2026-10-21 | Storefront API 401 with a valid private token | Site could not read the store | Private tokens (`shpat_…`) go in `Shopify-Storefront-Private-Token`, not `X-Shopify-Storefront-Access-Token` | Header chosen by the token's prefix (`src/lib/catalog/shopify.ts`) | Code |
| 2026-10-22 | A collection tile showed a hidden product and an old tumbler | Outdated art on the home page | Fixed art in `tile_image` fields goes stale when products change | Tiles without their own photo show the collection's most viewed listed product | Design: art comes from products |
| 2026-10-22 | Simplified 3D models showed light and dark flecks | The 3D viewer looked dirty | The dense mesh's fine normals ended up shading whole triangles after simplification | Normals recomputed from the simplified faces (`tools/3d/lib/smooth-normals.mjs`) | Optimiser |
| 2026-10-21/22 | Meshy invented details (cap lettering, a scribble on the back, missing perforation) | Products not like the real ones | One-photo 3D models guess what they cannot see | Repaired by hand (`project-front.mjs`, `perforate-cap.mjs`) | Check every new product's views in Shopify |

## Tooling notes (cost time, no harm)

- Turbopack's dev cache can keep serving stale CSS: stop the dev server and delete `.next/dev`.
- macOS has no `timeout` command; a script piped into `| head` gets killed early (EPIPE) and may not
  write its output.
- The Netlify CLI sometimes hangs for minutes; the API answers meanwhile (`npx netlify api …`).
- zsh (the macOS shell) does not split an unquoted variable into words like bash: `set -- $line`
  passes one argument. Split with `awk` or `${=line}`; `check-site.mjs` now refuses a malformed address.
- Running `read -s` through Claude Code's `!` gives it no keyboard: secrets go in the Netlify UI or a
  real terminal tab.
- Type checks passed locally but failed in CI: Next generates the route types (`PageProps`) into
  `.next/types`, which a clean machine does not have. `npm run typecheck` is now
  `next typegen && tsc --noEmit`, as Next's docs advise.
- Loosening a check to silence a false alarm can hide a real bug: making `check-site.mjs` accept any
  of the site's Netlify names also let a wrong sign-in callback through. Where an outside system is
  strict (Shopify accepts only the exact registered callback), the check is just as strict.
- A new check must be tried on a known-good and a known-bad target before trusting it: the first
  version of `check-site.mjs` flagged a healthy preview, because Netlify serves one site under several
  names (`<deploy-id>--site`, `deploy-preview-<n>--site`). It now compares the site, not the host.

## Dates to remember

- **2027-10-23**: the GitHub token `straight-shooter-dispatch` (`GITHUB_DISPATCH_TOKEN` on Netlify)
  expires. Renew it before, or new photos wait hours for GitHub's schedule (see `tools/pipeline/README.md`).

## If production breaks

1. **Roll back first, investigate second.** Netlify → Deploys → pick the last good deploy → *Publish
   deploy* (or `npx netlify api restoreSiteDeploy --data '{"site_id":"…","deploy_id":"…"}'`).
2. **Stop auto-publishing** while fixing: Deploys → *Stop auto publishing* (`lockDeploy`). Builds
   still run; nothing is published until you publish one.
3. Fix on a branch, open a pull request, wait for CI and the deploy preview, test the preview
   (`node scripts/check-site.mjs https://deploy-preview-<n>--<site>.netlify.app`), merge.
4. Publish, *Start auto publishing* again (`unlockDeploy`), run *Site health* by hand.
5. Add the incident here, with its guard.
