import type { HomeLandingContent } from "./home-landing-content";

export interface PublishedHomeContent {
  landing: HomeLandingContent;
  founder: { data?: Record<string, unknown> } | null;
}

declare const __PUBLISHED_HOME_CONTENT__: PublishedHomeContent | null;

export const publishedHomeContent = typeof __PUBLISHED_HOME_CONTENT__ === "undefined"
  ? null
  : __PUBLISHED_HOME_CONTENT__;
