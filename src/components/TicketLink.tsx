import { ticketCampaign } from "../../shared/showCampaign";
import { useEffect, useRef, type AnchorHTMLAttributes } from "react";
import { capture, currentCampaign, type AnalyticsProperties } from "../lib/analytics";
import { resolveTicketLink } from "../utils/ticketmaster";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href?: string; placement: string; properties?: AnalyticsProperties };
export function TicketLink({ href, placement, properties = {}, onClick, children, ...rest }: Props) {
  const anchor = useRef<HTMLAnchorElement>(null);
  const campaign = ticketCampaign(currentCampaign());
  const destination = resolveTicketLink(href, {
    origin: campaign.origin,
    showId: typeof properties.show_id === "string" ? properties.show_id : undefined,
    placement,
  });
  const eventProperties = { ...properties, share_origin: campaign.origin, shared_show_id: campaign.showId };
  const latest = useRef(eventProperties);
  latest.current = eventProperties;
  const key = `${destination?.href}:${placement}`;
  const viewedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!anchor.current || !destination || viewedKey.current === key || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
      capture("ticket_offer_viewed", { ...latest.current, placement, provider: destination.provider, affiliate_tagged: destination.affiliateTagged, tracking: destination.tracking });
      viewedKey.current = key;
      observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(anchor.current);
    return () => observer.disconnect();
  }, [key, placement, destination?.provider, destination?.affiliateTagged, destination?.tracking]);
  if (!destination) return null;
  return <a {...rest} ref={anchor} href={destination.href} target="_blank" rel={`noopener noreferrer${destination.affiliateTagged ? " sponsored" : ""}`} onClick={event => {
    event.stopPropagation();
    onClick?.(event);
    if (!event.defaultPrevented) capture("ticket_link_clicked", { ...eventProperties, placement, provider: destination.provider, affiliate_tagged: destination.affiliateTagged, tracking: destination.tracking });
  }}>{children}</a>;
}
