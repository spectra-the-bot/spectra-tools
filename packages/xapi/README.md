# @spectra-the-bot/xapi-cli

X (Twitter) API v2 CLI for spectra-the-bot, built with [incur](https://github.com/wevm/incur).

## Setup

```bash
export X_BEARER_TOKEN=your_bearer_token_here
npx @spectra-the-bot/xapi-cli --help
```

## Commands

### Posts

```bash
xapi posts get <id>
xapi posts search <query> [-n 10] [--sort recency|relevancy]
xapi posts create --text "Hello world!" [--reply-to <id>] [--quote <id>]
xapi posts delete <id>
xapi posts likes <id>
xapi posts retweets <id>
```

### Users

```bash
xapi users get <username|id>
xapi users followers <username> [-n 100]
xapi users following <username>
xapi users posts <username> [-n 10]
xapi users mentions <username>
xapi users search <query>
```

### Timeline

```bash
xapi timeline home [-n 25]
xapi timeline mentions [-n 25]
```

### Lists

```bash
xapi lists get <id>
xapi lists members <id>
xapi lists posts <id> [-n 25]
```

### Trends

```bash
xapi trends places
xapi trends location <woeid>
```

### DMs

```bash
xapi dm conversations [-n 20]
xapi dm send <participant-id> --text "Hello!"
```

## Common Options

- `--verbose` — Show full text without truncation
- `-n, --max-results` — Control result count
- `--format json` — JSON output
- `--help` — Show help

## Auth

All read endpoints use `X_BEARER_TOKEN`. Write endpoints (create post, delete, DMs) require OAuth 2.0 user context. Requests are automatically retried on 429 rate limit responses.
