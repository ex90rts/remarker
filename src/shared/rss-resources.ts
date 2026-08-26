export interface RssResource {
  /** A stable name makes it easy to identify a failing feed in diagnostics. */
  name: string;
  url: string;
}

/**
 * Reading-oriented RSS/Atom feeds used by the Feeling Lucky action.
 * Keep this list curated: every resource must publish direct article links.
 */
export const RSS_RESOURCES: readonly RssResource[] = [
  { name: "Towards Data Science", url: "https://towardsdatascience.com/feed/"},
  { name: "OpenAI Blog", url: "https://openai.com/news/rss.xml"},
  { name: "Google AI", url: "https://blog.google/innovation-and-ai/technology/ai/rss/"},
  { name: "BBC News", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  { name: "NPR News", url: "https://feeds.npr.org/1001/rss.xml" },
  { name: "The Conversation", url: "https://theconversation.com/global/articles.atom" },
];

export const RSS_ARTICLE_CACHE_LIMIT = 200;
