---
status: approved
---

# Show Reddit post titles as "<post title> - r/<subreddit>"

With **Link Label** on *Page title*, a paste from a Reddit post is labeled just "Reddit". This change makes it read `<post title> - r/<subreddit>`, as the post appears on the site.

The cause is what Reddit sends to a plain request for a post page. It's a small JavaScript bot check whose only `<title>` is "Reddit", with no Open Graph tags. The real page loads only in a browser that runs the check. Reddit's JSON API refuses requests that aren't signed in. Its oEmbed endpoint, `https://www.reddit.com/oembed?url=<post URL>`, still answers with JSON that holds the post's title, and its embed HTML links to the subreddit. Both of those were confirmed by hand with `curl` against public posts.

## User Review Required

> [!IMPORTANT]
> **A Reddit post's title is requested from Reddit's oEmbed endpoint, not from the post page.** It's still one request to reddit.com, made only when **Link Label** is *Page title*, or when the template uses `{title}`, as for any other page. The README's **Network Use** section will say so.

> [!NOTE]
> **The rest of reddit.com changes too.**
> - **A subreddit page** (`/r/<subreddit>/`) is titled `r/<subreddit>` from its URL, with no request, because oEmbed doesn't cover subreddit pages.
> - **Any other Reddit page** still goes through the normal lookup, but a title of exactly "Reddit" counts as no title. That covers share links (`/r/<subreddit>/s/<code>`), `redd.it` short links and user pages. The URL stays in place instead of the label "Reddit".

> [!NOTE]
> **The separator is a plain hyphen** (` - `), as you wrote it. With the default preset, a citation reads `From: [Post title - r/subreddit](https://www.reddit.com/r/…) – www.reddit.com`.

## Open Questions

None at this time.

**Decided:** when the oEmbed request fails, for example because Reddit blocks it, rate-limits it or the post was removed, the label stays the URL. That's what happens for any page without a usable title. Guessing from the URL's slug was rejected, because Reddit's slugs are lowercased and cut short, with punctuation dropped, so the guess would rarely match the real title.

## Proposed Changes

### Title fetching

#### [MODIFY] `main.ts`
- [x] **TASK-1:** Add `redditTarget(url: string)`, documented in TSDoc. It recognizes Reddit URLs and returns one of three things:
  - **A post**, `{ kind: "post"; postUrl: string; subreddit: string }`:
    - It matches `reddit.com`, `www.`, `old.`, `new.`, `np.` or `m.reddit.com`, with a path of `/r/<subreddit>/comments/<id>` followed by anything. That includes comment permalinks, which oEmbed answers with the post's own title.
    - `postUrl` is rebuilt as `https://www.reddit.com/r/<subreddit>/comments/<id>/`, which drops the slug, the query string and the fragment.
  - **A subreddit**, `{ kind: "subreddit"; subreddit: string }`, for a path of exactly `/r/<subreddit>` with an optional trailing slash.
  - **`undefined`** for anything else, including other Reddit paths and other sites.
- [x] **TASK-2:** Add `parseRedditOembed(text: string): { title: string; subreddit?: string } | undefined`, documented in TSDoc.
  - It parses the JSON, and requires a non-empty string `title`, which it trims and whose whitespace it collapses.
  - It reads the subreddit from the first `reddit.com/r/<name>` link in `html`, which carries the subreddit's own capitalization.
  - It returns undefined for anything that isn't JSON or has no title.
  - If a test against a real post shows oEmbed escapes HTML entities such as `&amp;` in `title`, it decodes them. Otherwise it leaves the title alone. The walkthrough will say which.
- [ ] **TASK-3:** In `fetchPageTitle`, consult `redditTarget` first:
  - **A subreddit** resolves to `r/<subreddit>` at once.
  - **A post** requests `https://www.reddit.com/oembed?url=<encodeURIComponent(postUrl)>` through the same `request` and timeout. On a 2xx response that `parseRedditOembed` accepts, it resolves to `<title> - r/<subreddit>`, using oEmbed's subreddit and falling back to the URL's. Otherwise it resolves to undefined. The generic HTML check is skipped, because oEmbed answers JSON.
  - **Anything else** keeps the current path, except that on a Reddit host a resulting title of exactly "Reddit", ignoring case, counts as undefined.
  - The function's TSDoc covers the Reddit cases.

### Tests

#### [MODIFY] `test-page-title.ts`
- [ ] **TASK-4:** Add a "Reddit" group. All of it uses synthetic data, with names like `r/ExampleSub` and made-up titles, and the existing fake requester, so nothing goes over the network.
  - **`redditTarget` recognizes:**
    - a post URL, and the post URL rebuilt from it
    - the host variants
    - a comment permalink
    - share-tracking query parameters dropped
    - a subreddit page, with and without a trailing slash
    - `undefined` for a share link, a user page and a non-Reddit host
  - **`parseRedditOembed` handles:**
    - a title, with the subreddit taken from the embed HTML's capitalization
    - no subreddit link
    - malformed JSON and a missing title
  - **`fetchPageTitle` gives:**
    - a post, as `<title> - r/<Sub>`, with one request to the oEmbed URL
    - a subreddit page, as `r/<sub>`, with no request
    - a 404 from oEmbed, as undefined
    - a Reddit share link whose page is titled "Reddit", as undefined
    - a non-Reddit page titled "Reddit", which keeps that title

### Docs

#### [MODIFY] `README.md`, `CHANGELOG.md`
- [ ] **TASK-5:** Docs:
  - The README's **Network Use** section says Reddit post titles come from Reddit's oEmbed endpoint.
  - The **Link Label** row, or the template variables' `{title}` entry, notes the `<post title> - r/<subreddit>` form.
  - The CHANGELOG gets an `Added` entry under `[Unreleased]`.

## Verification Plan

### Automated Tests
`npm test` builds the project and runs every test file. It verifies:
1. The Reddit group from TASK-4.
2. Every existing page title check passes unchanged.
3. All other test files pass unchanged.

During implementation, a few separate `curl` requests to the oEmbed endpoint for public posts confirm that it still answers this way. Their output isn't committed.

### Manual Verification
In the test vault, with **Link Label** on *Page title*, copy text from Reddit pages in Chrome or Edge and paste it:
1. **Post:** Paste from a post. The URL shows first, then becomes `<post title> - r/<subreddit>`, matching the post's title and the subreddit's capitalization on the site.
2. **Comment link:** Paste from a comment's permalink page. It gets the post's title.
3. **Subreddit:** Paste from a subreddit's front page. The label reads `r/<subreddit>` at once.
4. **Other sites:** Paste from a Wikipedia article. It still gets its page title.

## Visual design application
No UI changes.
