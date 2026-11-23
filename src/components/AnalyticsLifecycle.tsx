import { SEOHead } from "./SEOHead";
import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { Outlet, useLocation } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import {
  capturePageView,
  recordCampaign,
  setInternalAnalyticsUser,
  identifyUser,
  isSensitiveAnalyticsRoute,
  resetAnalyticsIdentity,
  setSessionRecordingEnabled,
} from "../lib/analytics";

function classifyRoute(pathname: string) {
  if (pathname === "/") return { route_name: "home", surface: "fan" };
  if (pathname === "/artists") return { route_name: "artists", surface: "fan" };
  if (pathname.startsWith("/artists/")) {
    return { route_name: "artist_detail", surface: "fan" };
  }
  if (pathname === "/shows") return { route_name: "shows", surface: "fan" };
  if (pathname.startsWith("/shows/")) return { route_name: "show_detail", surface: "fan" };
  if (pathname === "/venues") return { route_name: "venues", surface: "fan" };
  if (pathname.startsWith("/venues/")) return { route_name: "venue_detail", surface: "fan" };
  if (pathname === "/festivals") return { route_name: "festivals", surface: "fan" };
  if (pathname.startsWith("/festivals/")) {
    return { route_name: "festival_detail", surface: "fan" };
  }
  if (pathname === "/trending") return { route_name: "trending", surface: "fan" };
  if (pathname.startsWith("/for-artists/claim/")) {
    return { route_name: "artist_claim", surface: "artist_portal" };
  }
  if (pathname.startsWith("/for-artists/invite/")) {
    return { route_name: "artist_invite_accept", surface: "artist_portal" };
  }
  if (pathname.includes("/shows/") && pathname.startsWith("/for-artists/")) {
    return { route_name: "artist_show_demand", surface: "artist_portal" };
  }
  if (pathname.endsWith("/team") && pathname.startsWith("/for-artists/")) {
    return { route_name: "artist_team", surface: "artist_portal" };
  }
  if (pathname.startsWith("/for-artists/")) {
    return { route_name: "artist_dashboard", surface: "artist_portal" };
  }
  if (pathname === "/for-artists") {
    return { route_name: "artist_portal", surface: "artist_portal" };
  }
  if (pathname === "/signin") return { route_name: "sign_in", surface: "auth" };
  if (pathname === "/signup") return { route_name: "sign_up", surface: "auth" };
  if (pathname === "/sso-callback") return { route_name: "sso_callback", surface: "auth" };
  if (pathname === "/spotify-connect") return { route_name: "spotify_connect", surface: "auth" };
  if (pathname.startsWith("/admin")) return { route_name: "admin", surface: "admin" };
  if (pathname.startsWith("/blog/")) return { route_name: "blog_post", surface: "content" };
  if (pathname === "/blog") return { route_name: "blog", surface: "content" };
  return { route_name: "other", surface: "fan" };
}

export function AnalyticsLifecycle() {
  const location = useLocation();
  const authUser = useQuery(api.auth.loggedInUser);
  const identifiedUserId = useRef<string | null>(null);
  const identifiedUserFingerprint = useRef<string | null>(null);
  const lastTrackedNavigation = useRef<string | null>(null);
  const navigationKey = `${location.key}:${location.pathname}`;
  const authState =
    authUser === undefined
      ? "loading"
      : authUser
        ? "authenticated"
        : "anonymous";

  useEffect(() => {
    recordCampaign(location.search, location.pathname);
    setInternalAnalyticsUser(authUser?.appUser?.role === "admin");
    if (
      isSensitiveAnalyticsRoute(location.pathname) ||
      lastTrackedNavigation.current === navigationKey
    ) {
      return;
    }
    // Let route components finish their synchronous title update first.
    const timer = window.setTimeout(() => {
      if (lastTrackedNavigation.current === navigationKey) return;
      capturePageView({
        ...classifyRoute(location.pathname),
        auth_state: authState,
      });
      // Mark this navigation only after the event has actually been queued. If the
      // effect is canceled while auth resolves, the replacement can still fire.
      lastTrackedNavigation.current = navigationKey;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [authState, authUser?.appUser?.role, location.pathname, location.search, navigationKey]);

  useEffect(() => {
    setSessionRecordingEnabled(
      !isSensitiveAnalyticsRoute(location.pathname),
    );
  }, [location.pathname]);

  useEffect(() => {
    if (authUser === undefined) return;

    if (authUser) {
      const identityId = String(authUser.identity.subject);
      const identityProperties = {
        app_user_id: authUser.appUser?._id,
        account_role: authUser.appUser?.role || "user",
        has_spotify_connection: Boolean(authUser.appUser?.spotifyId),
        account_setup_complete: !authUser.needsSetup,
      };
      const fingerprint = JSON.stringify({
        identityId,
        ...identityProperties,
      });

      if (identifiedUserFingerprint.current === fingerprint) return;
      if (
        identifiedUserId.current &&
        identifiedUserId.current !== identityId
      ) {
        resetAnalyticsIdentity();
      }

      identifiedUserId.current = identityId;
      identifiedUserFingerprint.current = fingerprint;
      identifyUser(identityId, identityProperties);
      return;
    }

    if (identifiedUserId.current) {
      resetAnalyticsIdentity();
      identifiedUserId.current = null;
      identifiedUserFingerprint.current = null;
    }
  }, [authUser]);

  return <><SEOHead /><Outlet /></>;
}
