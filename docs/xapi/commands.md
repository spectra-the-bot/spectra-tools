# xapi

## xapi dm

Manage X direct messages.

### xapi dm conversations

List your DM conversations.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--maxResults` | `number` | `20` | Maximum conversations to return |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `conversations` | `array` | yes |  |
| `conversations[].dm_conversation_id` | `string` | yes |  |
| `conversations[].participant_ids` | `array` | yes |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# List your DM conversations
xapi dm conversations
```

### xapi dm send

Send a direct message to a user.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `participantId` | `string` | yes | User ID to send message to |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_ACCESS_TOKEN` | `string` | yes |  | X OAuth 2.0 user access token (required for write endpoints) |
| `X_BEARER_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--text` | `string` |  | Message text |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dm_conversation_id` | `string` | yes |  |
| `dm_event_id` | `string` | yes |  |

#### Examples

```sh
# Send a DM to a user
xapi dm send 12345 --text Hey there!
```

## xapi lists

Manage and browse X lists.

### xapi lists get

Get a list by ID.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | yes | List ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes |  |
| `name` | `string` | yes |  |
| `description` | `string` | no |  |
| `owner_id` | `string` | no |  |
| `member_count` | `number` | no |  |

#### Examples

```sh
# Get list details
xapi lists get 1234567890
```

### xapi lists members

List members of an X list.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | yes | List ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--maxResults` | `number` | `100` | Maximum members to return |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `users` | `array` | yes |  |
| `users[].id` | `string` | yes |  |
| `users[].name` | `string` | yes |  |
| `users[].username` | `string` | yes |  |
| `users[].followers` | `number` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# List all members
xapi lists members 1234567890
```

### xapi lists posts

Get posts from an X list.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | yes | List ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--maxResults` | `number` | `25` | Maximum posts to return |
| `--verbose` | `boolean` |  | Show full text |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `posts` | `array` | yes |  |
| `posts[].id` | `string` | yes |  |
| `posts[].text` | `string` | yes |  |
| `posts[].author_id` | `string` | no |  |
| `posts[].created_at` | `string` | no |  |
| `posts[].likes` | `number` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# Get posts from a list
xapi lists posts 1234567890
```

## xapi posts

Manage and search X posts.

### xapi posts create

Create a new post.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_ACCESS_TOKEN` | `string` | yes |  | X OAuth 2.0 user access token (required for write endpoints) |
| `X_BEARER_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--text` | `string` |  | Post text |
| `--replyTo` | `string` |  | Reply to post ID |
| `--quote` | `string` |  | Quote post ID |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes |  |
| `text` | `string` | yes |  |

#### Examples

```sh
# Post a simple message
xapi posts create --text Hello world!

# Reply to a post
xapi posts create --text Great point! --replyTo 1234567890
```

### xapi posts delete

Delete a post by ID.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | yes | Post ID to delete |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_ACCESS_TOKEN` | `string` | yes |  | X OAuth 2.0 user access token (required for write endpoints) |
| `X_BEARER_TOKEN` | `string` | no |  |  |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deleted` | `boolean` | yes |  |
| `id` | `string` | yes |  |

#### Examples

```sh
# Delete a post
xapi posts delete 1234567890
```

### xapi posts get

Get a post by ID.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | yes | Post ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--verbose` | `boolean` |  | Show full text without truncation |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes |  |
| `text` | `string` | yes |  |
| `author_id` | `string` | no |  |
| `created_at` | `string` | no |  |
| `likes` | `number` | no |  |
| `retweets` | `number` | no |  |
| `replies` | `number` | no |  |

#### Examples

```sh
# Get a post by ID
xapi posts get 1234567890
```

### xapi posts likes

List users who liked a post.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | yes | Post ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--maxResults` | `number` | `100` | Maximum users to return |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `users` | `array` | yes |  |
| `users[].id` | `string` | yes |  |
| `users[].name` | `string` | yes |  |
| `users[].username` | `string` | yes |  |
| `users[].followers` | `number` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# See who liked a post
xapi posts likes 1234567890
```

### xapi posts retweets

List users who retweeted a post.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | yes | Post ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--maxResults` | `number` | `100` | Maximum users to return |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `users` | `array` | yes |  |
| `users[].id` | `string` | yes |  |
| `users[].name` | `string` | yes |  |
| `users[].username` | `string` | yes |  |
| `users[].followers` | `number` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# See who retweeted a post
xapi posts retweets 1234567890
```

### xapi posts search

Search recent posts.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | yes | Search query |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--maxResults` | `number` | `10` | Maximum results to return (10–100) |
| `--sort` | `string` | `recency` | Sort order |
| `--verbose` | `boolean` |  | Show full text without truncation |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `posts` | `array` | yes |  |
| `posts[].id` | `string` | yes |  |
| `posts[].text` | `string` | yes |  |
| `posts[].created_at` | `string` | no |  |
| `posts[].likes` | `number` | no |  |
| `posts[].retweets` | `number` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# Search for TypeScript posts
xapi posts search TypeScript

# Search by relevance
xapi posts search AI --sort relevancy --maxResults 20
```

## xapi timeline

View your X timeline.

### xapi timeline home

View your home timeline.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--maxResults` | `number` | `25` | Maximum posts to return (5–100) |
| `--verbose` | `boolean` |  | Show full text without truncation |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `posts` | `array` | yes |  |
| `posts[].id` | `string` | yes |  |
| `posts[].text` | `string` | yes |  |
| `posts[].author_id` | `string` | no |  |
| `posts[].created_at` | `string` | no |  |
| `posts[].likes` | `number` | no |  |
| `posts[].retweets` | `number` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# View your home timeline
xapi timeline home

# View 50 posts
xapi timeline home --maxResults 50
```

### xapi timeline mentions

View your recent mentions.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--maxResults` | `number` | `25` | Maximum mentions to return |
| `--verbose` | `boolean` |  | Show full text without truncation |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `posts` | `array` | yes |  |
| `posts[].id` | `string` | yes |  |
| `posts[].text` | `string` | yes |  |
| `posts[].author_id` | `string` | no |  |
| `posts[].created_at` | `string` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# View your recent mentions
xapi timeline mentions
```

## xapi trends

Explore trending topics on X.

### xapi trends location

Get trending topics for a specific location (WOEID).

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `woeid` | `string` | yes | Where On Earth ID (from trends places) |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `trends` | `array` | yes |  |
| `trends[].name` | `string` | yes |  |
| `trends[].query` | `string` | yes |  |
| `trends[].tweet_volume` | `number` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# Get worldwide trends
xapi trends location 1

# Get trends for New York
xapi trends location 2459115
```

### xapi trends places

List places where trending topics are available.

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `places` | `array` | yes |  |
| `places[].woeid` | `number` | yes |  |
| `places[].name` | `string` | yes |  |
| `places[].country` | `string` | yes |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# List all trending places
xapi trends places
```

## xapi users

Look up X users.

### xapi users followers

List followers of a user.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `username` | `string` | yes | Username or user ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--maxResults` | `number` | `100` | Maximum followers to return |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `users` | `array` | yes |  |
| `users[].id` | `string` | yes |  |
| `users[].name` | `string` | yes |  |
| `users[].username` | `string` | yes |  |
| `users[].followers` | `number` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# List followers of jack
xapi users followers jack
```

### xapi users following

List accounts a user is following.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `username` | `string` | yes | Username or user ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--maxResults` | `number` | `100` | Maximum accounts to return |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `users` | `array` | yes |  |
| `users[].id` | `string` | yes |  |
| `users[].name` | `string` | yes |  |
| `users[].username` | `string` | yes |  |
| `users[].followers` | `number` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# List accounts jack follows
xapi users following jack
```

### xapi users get

Get a user by username or ID.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `username` | `string` | yes | Username (with or without @) or user ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--verbose` | `boolean` |  | Show full bio without truncation |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes |  |
| `name` | `string` | yes |  |
| `username` | `string` | yes |  |
| `description` | `string` | no |  |
| `followers` | `number` | no |  |
| `following` | `number` | no |  |
| `tweets` | `number` | no |  |
| `joined` | `string` | no |  |

#### Examples

```sh
# Get a user by username
xapi users get jack

# Get a user by ID
xapi users get 12345
```

### xapi users mentions

List recent mentions of a user.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `username` | `string` | yes | Username or user ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--maxResults` | `number` | `10` | Maximum mentions to return |
| `--verbose` | `boolean` |  | Show full text |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `posts` | `array` | yes |  |
| `posts[].id` | `string` | yes |  |
| `posts[].text` | `string` | yes |  |
| `posts[].created_at` | `string` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# Get mentions of jack
xapi users mentions jack
```

### xapi users posts

List a user's posts.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `username` | `string` | yes | Username or user ID |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Options

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--maxResults` | `number` | `10` | Maximum posts to return |
| `--verbose` | `boolean` |  | Show full text without truncation |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `posts` | `array` | yes |  |
| `posts[].id` | `string` | yes |  |
| `posts[].text` | `string` | yes |  |
| `posts[].created_at` | `string` | no |  |
| `posts[].likes` | `number` | no |  |
| `posts[].retweets` | `number` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# Get jack's recent posts
xapi users posts jack
```

### xapi users search

Search for users by keyword.

#### Arguments

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | yes | Search query |

#### Environment Variables

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `X_BEARER_TOKEN` | `string` | no |  |  |
| `X_ACCESS_TOKEN` | `string` | no |  |  |

#### Output

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `users` | `array` | yes |  |
| `users[].id` | `string` | yes |  |
| `users[].name` | `string` | yes |  |
| `users[].username` | `string` | yes |  |
| `users[].followers` | `number` | no |  |
| `count` | `number` | yes |  |

#### Examples

```sh
# Search for users about TypeScript
xapi users search TypeScript
```
