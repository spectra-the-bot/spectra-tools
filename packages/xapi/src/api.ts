import { createHttpClient, withRetry } from '@spectra-the-bot/cli-shared';

const BASE_URL = 'https://api.x.com/2';

const RETRY_OPTIONS = { maxRetries: 3, baseMs: 500, maxMs: 10000 };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface XPost {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
}

export interface XUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
    listed_count: number;
  };
  created_at?: string;
}

export interface XList {
  id: string;
  name: string;
  description?: string;
  owner_id?: string;
  member_count?: number;
}

export interface XDmConversation {
  dm_conversation_id: string;
  participant_ids: string[];
}

export interface XDmEvent {
  id: string;
  text: string;
  sender_id: string;
  created_at?: string;
}

export interface XMeta {
  next_token?: string;
  result_count?: number;
  newest_id?: string;
  oldest_id?: string;
}

export interface XPagedResponse<T> {
  data: T[];
  meta?: XMeta;
}

export interface XSingleResponse<T> {
  data: T;
}

// ── Client factory ────────────────────────────────────────────────────────────

export function createXApiClient(bearerToken: string) {
  const http = createHttpClient({
    baseUrl: BASE_URL,
    defaultHeaders: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  function get<T>(path: string, query?: Record<string, string | number | boolean | undefined | null>): Promise<T> {
    return withRetry(() => http.request<T>(path, query !== undefined ? { query } : {}), RETRY_OPTIONS);
  }

  function post<T>(path: string, body?: unknown): Promise<T> {
    return withRetry(() => http.request<T>(path, { method: 'POST', body }), RETRY_OPTIONS);
  }

  function del<T>(path: string): Promise<T> {
    return withRetry(() => http.request<T>(path, { method: 'DELETE' }), RETRY_OPTIONS);
  }

  // ── Posts ──────────────────────────────────────────────────────────────────

  const POST_FIELDS = 'id,text,author_id,created_at,public_metrics';

  function getPost(id: string) {
    return get<XSingleResponse<XPost>>(`/tweets/${id}`, {
      'tweet.fields': POST_FIELDS,
    });
  }

  function searchPosts(query: string, maxResults: number, sort: string, nextToken?: string) {
    return get<XPagedResponse<XPost>>('/tweets/search/recent', {
      query,
      max_results: maxResults,
      sort_order: sort,
      'tweet.fields': POST_FIELDS,
      ...(nextToken ? { next_token: nextToken } : {}),
    });
  }

  function createPost(text: string, replyTo?: string, quote?: string) {
    const body: Record<string, unknown> = { text };
    if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo };
    if (quote) body.quote_tweet_id = quote;
    return post<{ data: { id: string; text: string } }>('/tweets', body);
  }

  function deletePost(id: string) {
    return del<{ data: { deleted: boolean } }>(`/tweets/${id}`);
  }

  function getPostLikes(id: string, maxResults: number, nextToken?: string) {
    return get<XPagedResponse<XUser>>(`/tweets/${id}/liking_users`, {
      max_results: maxResults,
      'user.fields': 'id,name,username,public_metrics',
      ...(nextToken ? { pagination_token: nextToken } : {}),
    });
  }

  function getPostRetweets(id: string, maxResults: number, nextToken?: string) {
    return get<XPagedResponse<XUser>>(`/tweets/${id}/retweeted_by`, {
      max_results: maxResults,
      'user.fields': 'id,name,username,public_metrics',
      ...(nextToken ? { pagination_token: nextToken } : {}),
    });
  }

  // ── Users ──────────────────────────────────────────────────────────────────

  const USER_FIELDS = 'id,name,username,description,public_metrics,created_at';

  function getUserByUsername(username: string) {
    return get<XSingleResponse<XUser>>(`/users/by/username/${username}`, {
      'user.fields': USER_FIELDS,
    });
  }

  function getUserById(id: string) {
    return get<XSingleResponse<XUser>>(`/users/${id}`, {
      'user.fields': USER_FIELDS,
    });
  }

  function getUserFollowers(id: string, maxResults: number, nextToken?: string) {
    return get<XPagedResponse<XUser>>(`/users/${id}/followers`, {
      max_results: maxResults,
      'user.fields': USER_FIELDS,
      ...(nextToken ? { pagination_token: nextToken } : {}),
    });
  }

  function getUserFollowing(id: string, maxResults: number, nextToken?: string) {
    return get<XPagedResponse<XUser>>(`/users/${id}/following`, {
      max_results: maxResults,
      'user.fields': USER_FIELDS,
      ...(nextToken ? { pagination_token: nextToken } : {}),
    });
  }

  function getUserPosts(id: string, maxResults: number, nextToken?: string) {
    return get<XPagedResponse<XPost>>(`/users/${id}/tweets`, {
      max_results: maxResults,
      'tweet.fields': POST_FIELDS,
      ...(nextToken ? { pagination_token: nextToken } : {}),
    });
  }

  function getUserMentions(id: string, maxResults: number, nextToken?: string) {
    return get<XPagedResponse<XPost>>(`/users/${id}/mentions`, {
      max_results: maxResults,
      'tweet.fields': POST_FIELDS,
      ...(nextToken ? { pagination_token: nextToken } : {}),
    });
  }

  function searchUsers(query: string) {
    return get<XPagedResponse<XUser>>('/users/search', {
      query,
      'user.fields': USER_FIELDS,
    });
  }

  // ── Timeline ───────────────────────────────────────────────────────────────

  function getHomeTimeline(userId: string, maxResults: number, nextToken?: string) {
    return get<XPagedResponse<XPost>>(`/users/${userId}/timelines/reverse_chronological`, {
      max_results: maxResults,
      'tweet.fields': POST_FIELDS,
      ...(nextToken ? { pagination_token: nextToken } : {}),
    });
  }

  function getMentionsTimeline(userId: string, maxResults: number, nextToken?: string) {
    return get<XPagedResponse<XPost>>(`/users/${userId}/mentions`, {
      max_results: maxResults,
      'tweet.fields': POST_FIELDS,
      ...(nextToken ? { pagination_token: nextToken } : {}),
    });
  }

  // ── Lists ──────────────────────────────────────────────────────────────────

  function getList(id: string) {
    return get<XSingleResponse<XList>>(`/lists/${id}`, {
      'list.fields': 'id,name,description,owner_id,member_count',
    });
  }

  function getListMembers(id: string, maxResults: number, nextToken?: string) {
    return get<XPagedResponse<XUser>>(`/lists/${id}/members`, {
      max_results: maxResults,
      'user.fields': USER_FIELDS,
      ...(nextToken ? { pagination_token: nextToken } : {}),
    });
  }

  function getListPosts(id: string, maxResults: number, nextToken?: string) {
    return get<XPagedResponse<XPost>>(`/lists/${id}/tweets`, {
      max_results: maxResults,
      'tweet.fields': POST_FIELDS,
      ...(nextToken ? { pagination_token: nextToken } : {}),
    });
  }

  // ── Trends ─────────────────────────────────────────────────────────────────

  function getTrendingPlaces() {
    return get<{ data: Array<{ woeid: number; name: string; country: string }> }>('/trends/available');
  }

  function getTrendsByLocation(woeid: number) {
    return get<{ data: Array<{ name: string; query: string; tweet_volume?: number }> }>(`/trends/place/${woeid}`);
  }

  // ── DMs ────────────────────────────────────────────────────────────────────

  function getDmConversations(userId: string, maxResults: number, nextToken?: string) {
    return get<XPagedResponse<XDmConversation>>(`/users/${userId}/dm_conversations`, {
      max_results: maxResults,
      ...(nextToken ? { pagination_token: nextToken } : {}),
    });
  }

  function sendDm(participantId: string, text: string) {
    return post<{ data: { dm_conversation_id: string; dm_event_id: string } }>(
      `/dm_conversations/with/${participantId}/messages`,
      { text },
    );
  }

  // ── Me ─────────────────────────────────────────────────────────────────────

  function getMe() {
    return get<XSingleResponse<XUser>>('/users/me', { 'user.fields': USER_FIELDS });
  }

  return {
    getPost,
    searchPosts,
    createPost,
    deletePost,
    getPostLikes,
    getPostRetweets,
    getUserByUsername,
    getUserById,
    getUserFollowers,
    getUserFollowing,
    getUserPosts,
    getUserMentions,
    searchUsers,
    getHomeTimeline,
    getMentionsTimeline,
    getList,
    getListMembers,
    getListPosts,
    getTrendingPlaces,
    getTrendsByLocation,
    getDmConversations,
    sendDm,
    getMe,
  };
}

export type XApiClient = ReturnType<typeof createXApiClient>;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function truncateText(text: string, max = 100): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}
