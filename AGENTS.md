<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


# General guidance

Before changing frontend code in this repo, read and follow both local skills:

- `.agents/skills/design-ui-with-restraint/SKILL.md`
- `.agents/skills/write-practical-copy/SKILL.md`

Ignore the `prompts` folder.


## UI validation

- Inspect affected surfaces at mobile, tablet, breakpoint-edge, and desktop widths. Include `390`, `720`, `721`, `768`, and `1440px` when relevant.
- Use the in-app browser to reproduce visual defects, inspect actual rendered elements and computed layout, and verify the smallest focused fix. Use browser developer tooling or CDP only when direct browser inspection cannot explain the issue.
- Check browser console errors, missing assets, clipping, chart dimensions, and horizontal overflow.
- Verify `document.documentElement.scrollWidth <= document.documentElement.clientWidth` at each required viewport. Record an existing failure before changing the code and check the same viewport after the fix.
- Test regional filters against the globe, new card, headline metrics, country table, and live insights.
- Capture before-and-after screenshots for user-visible changes.
- Run `pnpm run typecheck` and `pnpm run build` before publishing.
- Run browser or visual-regression tests only when their dependencies and commands exist in `package.json`.

## Pull-request visual evidence

- Capture the before screenshots before modifying a visible feature or responsive breakpoint. Capture the after screenshots on the same route, at the same viewport, and in the same filter state.
- For a screenshot-rich UI pull request, include matched evidence at `390px` mobile, `721px` failing-breakpoint edge, `768px` tablet, and `1440px` desktop. Include `720px` as an additional regression check when changing the existing mobile breakpoint.
- Keep screenshot names and locations predictable: `docs/visual-evidence/<change-slug>/before-390.png`, `after-390.png`, `before-721.png`, `after-721.png`, `before-768.png`, `after-768.png`, `before-1440.png`, and `after-1440.png`.
- For a combined feature-and-fix demonstration, separately preserve `before-card-1440.png` and `after-card-1440.png` before starting responsive debugging. Do not overwrite feature screenshots with breakpoint-fix screenshots.
- Use full-page screenshots when the changed card falls below the first viewport. Pause the animated globe or use reduced motion consistently so before-and-after images are comparable.
- When a card depends on the selected region, also capture `after-europe-1440.png` showing the `Europe` filter and the updated card.
- Embed the actual screenshots in the pull-request description using a mobile, breakpoint, tablet, and desktop before/after Markdown table. Use the actual GitHub repository and head-branch image URLs; do not leave local filesystem links, temporary paths, or placeholder image URLs in a published pull request.
- Commit screenshot evidence only when the user has requested a visual pull request; otherwise keep temporary browser captures outside the repository.

## Pull requests

- Use `<type>(<area>): <imperative summary>` for commit subjects and pull-request titles.
- Prefer the narrowest truthful scope, such as `feat(dashboard): add active engagement card` or `fix(navigation): prevent tablet overflow`.
- Follow `.github/pull_request_template.md`.
- Include the user-visible summary, motivation, actual validation commands, and before-and-after visual evidence.
- When one pull request includes both the dashboard feature and its responsive correction, use a truthful combined title such as `feat(dashboard): add active engagement and fix tablet overflow`.
- Upload each screenshot through the GitHub pull-request editor so GitHub creates a stable `https://github.com/user-attachments/assets/...` URL. Embed those uploaded assets inline in the mobile, breakpoint, tablet, and desktop before/after table with `<img>` tags; do not use private-repository `raw.githubusercontent.com` URLs, repository blob links, local filesystem links, temporary paths, or placeholder image URLs.
- Preview the pull-request body before saving and verify that every screenshot renders inline.
- Open a ready-for-review pull request unless the user explicitly requests a draft.
- After opening a pull request, verify its actual URL, body, embedded image links, and available checks. Report any pending or failing checks accurately.
- Do not merge without explicit authorization and the required approvals.

## Plans and scope

- Do not create an ExecPlan unless the user explicitly asks for one.
- Preserve unrelated user changes and avoid committing secrets or generated build output.