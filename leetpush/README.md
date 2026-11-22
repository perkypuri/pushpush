# LeetPush

Chrome extension (Manifest V3) that pushes your accepted solutions to a GitHub repo.
Supports LeetCode, Codeforces, CodeChef, HackerRank and GeeksforGeeks.

## For users

1. Download this repo (Code > Download ZIP) and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and pick the `leetpush` folder (the one containing `manifest.json`).
3. Click the LeetPush icon and press **Connect GitHub**. A code appears: click **Open GitHub**, enter the code, and approve.
4. Click **Create "dsa-solutions" repo** (or type an existing repo into the Repository box), then **Save** and **Test repo**.
5. Submit a solution on a supported site. When it is accepted, the icon badge shows OK and the files appear in your repo.

"Public repos only" is the safer choice. Pick "Private repos too" only if you want a private solutions repo; GitHub's permission for that covers all your private repos.
Your login token is stored only in your browser and goes only to GitHub.

Prefer not to log in? Open **Advanced** in the popup and paste a fine-grained personal access token (Contents: read/write on one repo) instead.

## For the developer: one-time GitHub OAuth app

The login uses GitHub's device flow, so there is no server and no secret in the extension.

1. GitHub > Settings > Developer settings > OAuth Apps > **New OAuth App**.
2. Application name: `LeetPush`. Homepage URL and Authorization callback URL: your repo URL (the callback is not used, but GitHub requires one).
3. After creating it, tick **Enable Device Flow** and save.
4. Copy the **Client ID** into `config.js`. The Client ID is public; never put a client secret anywhere.

All users share your one OAuth app, so they do not need to create their own.

## Output layout

```
<folder>/LeetCode/0001-two-sum/two-sum.py
<folder>/Codeforces/4A-watermelon/watermelon.cpp
<folder>/HackerRank/solve-me-first/solve-me-first.py
<folder>/GeeksforGeeks/<problem-slug>/<problem-slug>.java
<folder>/CodeChef/<PROBLEMCODE>/<problemcode>.cpp
```

Each folder also gets a small `README.md` with the problem link, language and stats.

## How each platform is detected

| Platform | Method | Confidence |
|---|---|---|
| LeetCode | Watches the submission result poll, then reads details via GraphQL | Most reliable |
| Codeforces | Watches your own status page (`/my`) for a row turning Accepted, then reads the source from the submission page | DOM selectors, may need tweaks |
| HackerRank | Watches `/rest/contests/.../submissions/<id>` for status "Accepted" | Verify |
| GeeksforGeeks | Remembers the code sent to their API, then treats "Problem Solved Successfully" as accepted | Heuristic, verify |
| CodeChef | Remembers code sent to their API, then looks for an accepted result code | Heuristic, least certain |

Codeforces only pushes submissions that turn Accepted while the status page is open, so old accepted rows are never re-pushed. After submitting, stay on the `/my` page until the verdict appears.

## If a platform doesn't push

Open the site, press F12, go to Console, and filter for `[LeetPush]`. The HackerRank and CodeChef scripts log the verdicts they see, which shows what to adjust in the matching `inject-<site>.js` file. Errors also show in the popup under "Last".

## Notes

- Sites change their internal APIs now and then.
- To revoke access completely: GitHub > Settings > Applications > Authorized OAuth Apps.
