# Walkthrough: Reddit Post Titles

With **Link Label** on *Page title*, a citation for a Reddit post now reads `<post title> - r/<subreddit>`, not "Reddit". The title comes from Reddit's oEmbed endpoint, because a plain request for a post gets a bot check titled just "Reddit". A subreddit's front page reads `r/<subreddit>`, and other Reddit pages keep the URL in place of the label "Reddit".

## What Was Implemented

### 1. Title fetching
- **`main.ts`, `redditTarget()`** (33d7861): Recognizes a post, `/r/<subreddit>/comments/<id>…`, on `reddit.com` and its `www`, `old`, `new`, `np` and `m` hosts. It rebuilds the canonical post URL, `https://www.reddit.com/r/<subreddit>/comments/<id>/`, which drops the slug, the query string, the fragment, and a comment's id after the post's. It also recognizes a subreddit's front page, `/r/<subreddit>` with an optional trailing slash. Anything else gives undefined.
- **`main.ts`, `parseRedditOembed()`** (dd399e8): Reads `title` from the oEmbed JSON, collapsing whitespace, and takes the subreddit from the first `reddit.com/r/<name>` link in its embed HTML. It gives undefined for a body that isn't JSON or has no title.
- **`main.ts`, `fetchPageTitle()`** (7ce8c0e):
  - A subreddit resolves to `r/<subreddit>` with no request.
  - A post requests `https://www.reddit.com/oembed?url=<post URL>` through the same requester and timeout. It resolves to `<title> - r/<subreddit>`, using oEmbed's subreddit and falling back to the URL's. Any other answer resolves to undefined, so the citation keeps the URL.
  - Any other page takes the usual path, but on a Reddit host, `redd.it` included, a title of just "Reddit" counts as no title.

### 2. Tests
- **`test-page-title.ts`** (5aef6e4): A "Reddit" group of 18 checks, all with made-up data such as `r/ExampleSub`, and with fake requesters, so nothing goes over the network.

### 3. Docs
- **`README.md`** (2d233b7): **Network Use** has a Reddit entry, and the `{title}` row mentions the Reddit form.
- **`CHANGELOG.md`** (2d233b7): an `Added` entry under `[Unreleased]`.

## Verification & Test Results

### Automated Tests
Ran `npm test`, which builds the project and runs every test file. The Reddit group:
- `redditTarget` on a post URL, the host variants, a comment permalink, share-tracking parameters, and a subreddit page with and without a trailing slash: **Passed**
- `redditTarget` gives undefined for a share link, a user page, a short link and another site: **Passed**
- `parseRedditOembed` gives the title and the subreddit's capitalization, just the title when there's no subreddit link, and undefined for malformed JSON, a missing title and a blank one: **Passed**
- `fetchPageTitle` titles a post `<title> - r/<Sub>`, with one request to the oEmbed URL for the rebuilt post URL: **Passed**
- It falls back to the URL's subreddit when oEmbed's HTML has no subreddit link: **Passed**
- It titles a subreddit page `r/<sub>` with no request: **Passed**
- It gives undefined for a 404 from oEmbed, and for a share link and a short link whose page is titled "Reddit": **Passed**
- A page on another site titled "Reddit" keeps that title: **Passed**

**Mutation check.** Four small breaks were made in `main.ts`, one at a time:
- Keeping a bare "Reddit" title failed 2 checks.
- Preferring the URL's subreddit to oEmbed's failed 1.
- Keeping the slug in the post URL failed 5.
- Dropping the subreddit shortcut was refused by the compiler, since a subreddit target has no post URL to request.

`main.ts` was restored afterwards and the suite passed again.

**Live checks.** Run by hand against public posts, with nothing committed:
- **The endpoint answers:** oEmbed returns JSON with `title` and `html`, including with the plugin's `Accept: text/html` header.
- **It corrects the subreddit:** given a URL naming the wrong subreddit, it answers with the post's real one. That's why the subreddit is taken from its answer.
- **No entity decoding:** the JSON `title` is plain text. Quotes and apostrophes come back as-is, and only the embed HTML escapes them, as `&#34;` and `&#39;`. So `parseRedditOembed` leaves the title alone.
- **A subreddit is required:** a URL without one, `/comments/<id>/`, is refused as an invalid URL. A post id with no post behind it gives a body that isn't JSON.
- **Reddit filters by client:** Python's HTTP client got "403 Blocked" where `curl` didn't. Manual step 1 confirms Obsidian's requests get through.

### Regression Testing
Every other page title check passed unchanged, and so did every other test file: unit, deploy, paste position guard, TemplateEngine and presets, and Windows clipboard. **Passed**

## Manual Verification
In the test vault, by the user, with **Link Label** on *Page title*, copying from Reddit pages in Chrome or Edge:
1. **Post:** the URL showed first, then became `<post title> - r/<subreddit>`, matching the site: **Passed**
2. **Comment link:** a paste from a comment's permalink page got the post's title: **Passed**
3. **Subreddit:** a paste from a subreddit's front page read `r/<subreddit>` at once: **Passed**
4. **Other sites:** a Wikipedia article still got its page title: **Passed**

## Follow-ups
- **Deleted posts:** oEmbed titles a deleted post `[deleted by user]`, so its citation reads `[deleted by user] - r/<subreddit>`. Treating that title as no title would keep the URL instead.
