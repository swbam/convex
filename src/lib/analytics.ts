import { safeCampaignProperties } from "../../shared/showCampaign";
import type { PostHog } from "posthog-js";

export { safeCampaignProperties };

type Primitive = string | number | boolean | null | undefined;
export type AnalyticsProperties = Record<
  string,
  Primitive | Primitive[] | Record<string, Primitive>
>;

export type AnalyticsEvent =
  | "auth_started"
  | "auth_completed"
  | "auth_failed"
  | "account_created"
  | "spotify_connect_started"
  | "spotify_connect_completed"
  | "spotify_connect_failed"
  | "search_performed"
  | "search_result_selected"
  | "discovery_filter_changed"
  | "artist_viewed"
  | "artist_follow_changed"
  | "show_viewed"
  | "show_shared"
  | "venue_viewed"
  | "ticket_link_clicked"
  | "ticket_offer_viewed"
  | "song_picker_opened"
  | "song_added"
  | "song_add_rejected"
  | "song_vote_changed"
  | "anonymous_limit_reached"
  | "setlist_import_retry_requested"
  | "official_setlist_viewed"
  | "artist_portal_viewed"
  | "artist_claim_started"
  | "artist_claim_email_requested"
  | "artist_claim_email_verified"
  | "artist_claim_details_saved"
  | "artist_claim_verification_attempted"
  | "artist_claim_submitted"
  | "artist_claim_approved"
  | "artist_dashboard_viewed"
  | "artist_show_demand_viewed"
  | "artist_team_viewed"
  | "artist_team_invite_created"
  | "artist_team_invite_accepted"
  | "artist_team_invite_revoked"
  | "artist_team_member_removed"
  | "artist_team_role_changed";

type PendingOperation = (client: PostHog) => void;

type OAuthIntent = {
  auth_method: "spotify" | "google";
  auth_mode: "sign_in" | "sign_up" | "link";
  source: string;
};

const ANALYTICS_SCHEMA_VERSION = 2;
let isInternalUser = false;
let campaignProperties: AnalyticsProperties = {};
const projectToken = import.meta.env.VITE_POSTHOG_KEY?.trim();
const apiHost =
  import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

let client: PostHog | null = null;
let initialization: Promise<PostHog | null> | null = null;
let pendingOperations: PendingOperation[] = [];
let shouldRecordSession =
  typeof window !== "undefined" &&
  !isSensitiveAnalyticsRoute(window.location.pathname);

export const isAnalyticsConfigured = Boolean(projectToken);

const deviceClass = () => {
  if (typeof window === "undefined") return "unknown";
  if (window.matchMedia("(max-width: 767px)").matches) return "mobile";
  if (window.matchMedia("(max-width: 1023px)").matches) return "tablet";
  return "desktop";
};

const sharedProperties = (): AnalyticsProperties => ({
  analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
  app_name: "setlists.live",
  app_environment: import.meta.env.MODE,
  device_class: deviceClass(),
  event_source: "web",
  is_internal_user: isInternalUser,
  ...campaignProperties,
});

const OAUTH_INTENT_KEY = "setlists:analytics:oauth-intent";

export function isSensitiveAnalyticsRoute(pathname: string) {
  return /^\/for-artists\/invite\/[^/]+/.test(pathname);
}

export function sanitizeAnalyticsPath(pathname: string) {
  if (isSensitiveAnalyticsRoute(pathname)) {
    return "/for-artists/invite/:token";
  }
  return pathname;
}

export function shouldCaptureAnalyticsPath(pathname: string) {
  return !isSensitiveAnalyticsRoute(pathname);
}

function isCurrentAnalyticsRouteSensitive() {
  return (
    typeof window !== "undefined" &&
    isSensitiveAnalyticsRoute(window.location.pathname)
  );
}

function sanitizeAnalyticsUrl(value: unknown) {
  if (typeof value !== "string" || !value) return value;
  try {
    const parsed = new URL(value, window.location.origin);
    const isSameOrigin = parsed.origin === window.location.origin;
    parsed.pathname = isSameOrigin ? sanitizeAnalyticsPath(parsed.pathname) : "/";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function recordCampaign(search: string, pathname: string) {
  if (isSensitiveAnalyticsRoute(pathname)) return;
  const incoming = safeCampaignProperties(search);
  if (Object.keys(incoming).length) campaignProperties = incoming;
}
export function currentCampaign() {
  if (typeof window === "undefined" || isSensitiveAnalyticsRoute(window.location.pathname)) return {};
  const incoming = safeCampaignProperties(window.location.search);
  return Object.keys(incoming).length ? incoming : campaignProperties;
}
export function setInternalAnalyticsUser(value: boolean) { isInternalUser = value; }

export function recordOAuthIntent(intent: OAuthIntent) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    OAUTH_INTENT_KEY,
    JSON.stringify({ ...intent, recorded_at: Date.now() }),
  );
}

export function clearOAuthIntent() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(OAUTH_INTENT_KEY);
}

export function consumeOAuthIntent(): OAuthIntent | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(OAUTH_INTENT_KEY);
  window.sessionStorage.removeItem(OAUTH_INTENT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as OAuthIntent & { recorded_at?: number };
    if (
      !parsed.auth_method ||
      !parsed.auth_mode ||
      !parsed.source ||
      !parsed.recorded_at ||
      Date.now() - parsed.recorded_at > 30 * 60 * 1000
    ) {
      return null;
    }
    return {
      auth_method: parsed.auth_method,
      auth_mode: parsed.auth_mode,
      source: parsed.source,
    };
  } catch {
    return null;
  }
}

function enqueue(operation: PendingOperation) {
  if (
    !isAnalyticsConfigured ||
    typeof window === "undefined" ||
    isCurrentAnalyticsRouteSensitive()
  ) {
    return;
  }

  if (client) {
    operation(client);
    return;
  }

  // Keep a small bounded queue for interactions that happen while the SDK's
  // deferred chunk is loading. Analytics must never consume unbounded memory.
  pendingOperations.push(operation);
  if (pendingOperations.length > 100) pendingOperations.shift();
  void initializeAnalytics();
}

export async function initializeAnalytics(): Promise<PostHog | null> {
  if (
    !isAnalyticsConfigured ||
    typeof window === "undefined" ||
    isCurrentAnalyticsRouteSensitive()
  ) {
    return null;
  }
  if (client) return client;
  if (initialization) return initialization;

  initialization = import("posthog-js")
    .then(({ default: posthog }) => {
      const initialized = posthog.init(projectToken!, {
        api_host: apiHost,
        ui_host: "https://us.posthog.com",
        defaults: "2026-05-30",
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: false,
        capture_exceptions: true,
        capture_dead_clicks: true,
        capture_performance: {
          web_vitals: true,
          web_vitals_allowed_metrics: ["LCP", "CLS", "FCP", "INP"],
          web_vitals_attribution: ["LCP", "INP"],
        },
        disable_session_recording: isSensitiveAnalyticsRoute(
          window.location.pathname,
        ),
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: "body",
          blockSelector: "[data-analytics-block], .ph-no-capture",
          collectFonts: false,
          recordCrossOriginIframes: false,
          slimDOMOptions: "all",
        },
        persistence: "localStorage+cookie",
        cross_subdomain_cookie: false,
        respect_dnt: true,
        mask_personal_data_properties: true,
        custom_personal_data_properties: [
          "email",
          "code",
          "token",
          "invite",
          "password",
        ],
        property_denylist: [
          "email",
          "password",
          "verification_code",
          "invite_token",
          "authorization",
        ],
        before_send: (event) => {
          // Invite URLs contain bearer-like claim tokens. Suppress every event
          // while one is visible, including SDK-generated performance events.
          if (!event || isCurrentAnalyticsRouteSensitive()) return null;
          const properties = { ...event.properties };
          for (const key of [
            "$current_url",
            "$initial_current_url",
            "$referrer",
            "$initial_referrer",
          ]) {
            if (key in properties) {
              properties[key] = sanitizeAnalyticsUrl(properties[key]);
            }
          }
          for (const key of [
            "page_path",
            "$pathname",
            "$initial_pathname",
            "$prev_pageview_pathname",
            "return_to",
          ]) {
            if (key in properties) {
              properties[key] = sanitizeAnalyticsPath(
                String(properties[key]),
              );
            }
          }
          return { ...event, properties };
        },
        __preview_deferred_init_extensions: true,
        internal_or_test_user_hostname: /^(localhost|127\.0\.0\.1)$/,
        loaded: (instance) => {
          instance.register(sharedProperties());
        },
      });

      client = initialized;
      if (shouldRecordSession) {
        initialized.startSessionRecording();
      } else {
        initialized.stopSessionRecording();
      }
      const queued = pendingOperations;
      pendingOperations = [];
      if (!isCurrentAnalyticsRouteSensitive()) {
        queued.forEach((operation) => operation(initialized));
      }
      return initialized;
    })
    .catch((error) => {
      pendingOperations = [];
      initialization = null;
      if (import.meta.env.DEV) {
        console.warn("PostHog failed to initialize", error);
      }
      return null;
    });

  return initialization;
}

export function capture(
  event: AnalyticsEvent,
  properties: AnalyticsProperties = {},
) {
  const snapshot = { ...sharedProperties(), ...properties };
  enqueue((posthog) => posthog.capture(event, snapshot));
}

export function capturePageView(properties: AnalyticsProperties) {
  const cleanPath = sanitizeAnalyticsPath(window.location.pathname);
  const snapshot = {
    ...sharedProperties(), ...properties,
    $current_url: `${window.location.origin}${cleanPath}`,
    page_path: cleanPath, page_title: document.title,
  };
  enqueue((posthog) => posthog.capture("$pageview", snapshot));
}

export function identifyUser(
  userId: string,
  properties: AnalyticsProperties = {},
) {
  enqueue((posthog) => {
    posthog.identify(userId, {
      ...sharedProperties(),
      ...properties,
    });
    posthog.register({ auth_state: "authenticated" });
  });
}

export function resetAnalyticsIdentity() {
  isInternalUser = false;
  enqueue((posthog) => {
    posthog.reset();
    posthog.register({ ...sharedProperties(), auth_state: "anonymous" });
  });
}

export function captureException(
  error: unknown,
  properties: AnalyticsProperties = {},
) {
  enqueue((posthog) => {
    posthog.captureException(error, { ...sharedProperties(), ...properties });
  });
}

export function getAnalyticsSessionReplayUrl(): string | null {
  return client?.get_session_replay_url() ?? null;
}

export function optOutAnalytics() {
  enqueue((posthog) => posthog.opt_out_capturing());
}

export function optInAnalytics() {
  enqueue((posthog) => posthog.opt_in_capturing());
}

export function hasOptedOutOfAnalytics() {
  return client?.has_opted_out_capturing() ?? false;
}

export function setSessionRecordingEnabled(enabled: boolean) {
  shouldRecordSession = enabled;
  if (!client) return;
  if (enabled) {
    client.startSessionRecording();
  } else {
    client.stopSessionRecording();
  }
}
