# Guide: Social Monitoring with `xapi-cli`

Use `xapi-cli` to build lightweight social monitoring loops for accounts, topics, and engagement.

## 1) Monitor specific accounts

Start with profile + recent posts:

```bash
xapi-cli users get abstractchain --json
xapi-cli users posts abstractchain --max-results 20 --json
```

Track mentions of that account:

```bash
xapi-cli users mentions abstractchain --max-results 20 --json
```

If you want to expand to network context:

```bash
xapi-cli users followers abstractchain --max-results 100 --json
xapi-cli users following abstractchain --max-results 100 --json
```

## 2) Monitor keyword topics

Search by keyword, tag, or phrase:

```bash
xapi-cli posts search "ai agents" --sort recency --max-results 25 --json
xapi-cli posts search "#buildinpublic" --sort relevancy --max-results 25 --json
```

Tip:
- Use `recency` for monitoring new chatter.
- Use `relevancy` for higher-signal discovery.

## 3) Track engagement for specific posts

For a post ID, collect social response signals:

```bash
xapi-cli posts get 1891234567890123456 --json
xapi-cli posts likes 1891234567890123456 --max-results 100 --json
xapi-cli posts retweets 1891234567890123456 --max-results 100 --json
```

This gives you a quick engagement snapshot (reaction volume + who interacted).

## 4) Monitor timeline and list feeds

Home timeline monitoring:

```bash
xapi-cli timeline home --max-results 50 --json
xapi-cli timeline mentions --max-results 50 --json
```

List-based monitoring (useful for curated watchlists):

```bash
xapi-cli lists get 1234567890 --json
xapi-cli lists posts 1234567890 --max-results 25 --json
```

## 5) Suggested monitoring loop

A practical sequence for a periodic job:

1. Pull tracked account posts (`users posts`)
2. Pull keyword search (`posts search`)
3. Enrich top post IDs with likes/retweets (`posts likes`, `posts retweets`)
4. Store JSON output for downstream scoring/summarization

## Operational notes

- Prefer `--json` for machine parsing.
- Increase/decrease `--max-results` based on rate limits and context budget.
- For verbose text content, add `--verbose` where available.
- If an endpoint fails with bearer auth, retry with `X_ACCESS_TOKEN`.
