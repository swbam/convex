import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { getFunctionName } from 'convex/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtistClaimPage } from './ArtistClaimPage';
import { ForArtistsPage } from './ForArtistsPage';
import { UserDashboard } from '../components/UserDashboard';

const state = vi.hoisted(() => ({ user: { firstName: 'Sam', externalAccounts: [] } as any, queries: {} as Record<string, any>, start: vi.fn(), action: vi.fn() }));
vi.mock('@clerk/clerk-react', () => ({ useUser: () => ({ user: state.user, isLoaded: true, isSignedIn: !!state.user }), useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock('convex/react', () => ({
  useQuery: (ref: any, args: any) => args === 'skip' ? undefined : state.queries[getFunctionName(ref)],
  useMutation: (ref: any) => getFunctionName(ref) === 'artistClaims:startClaim' ? state.start : state.action,
  useAction: () => state.action,
}));
vi.mock('../components/AppLayout', () => ({ AppLayout: ({ children }: any) => <main>{children}</main> }));
vi.mock('../components/MySpotifyArtists', () => ({ MySpotifyArtists: () => null }));
vi.mock('../lib/analytics', () => ({ capture: vi.fn(), captureException: vi.fn() }));
vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
function Location() { const location = useLocation(); return <output>{location.pathname + location.search}</output>; }
let cleanup: (() => void) | undefined;
async function render(page: React.ReactNode, url = '/for-artists/claim/artist1') {
  const el = document.createElement('div'); document.body.append(el); const root = createRoot(el);
  cleanup = () => { act(() => root.unmount()); el.remove(); };
  await act(async () => { root.render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/signin" element={<p>Sign in</p>} /><Route path="/for-artists/claim/:artistId" element={page} /><Route path="*" element={page} /></Routes><Location /></MemoryRouter>); });
  return el;
}
beforeEach(() => {
  state.user = { firstName: 'Sam', externalAccounts: [] };
  state.start.mockReset().mockResolvedValue({ success: true, claimId: 'claim1', status: 'draft' });
  state.action.mockReset().mockResolvedValue({ success: true });
  state.queries = { 'artists:getById': { _id: 'artist1', name: 'Example Artist', images: [] }, 'artistClaims:getClaim': { status: 'draft' }, 'artistAccess:getMyArtists': [], 'artistClaims:getMyClaims': [], 'users:getCurrentUser': { role: 'user' }, 'auth:loggedInUser': { appUser: { _id: 'user1' } } };
});
afterEach(() => cleanup?.());

describe('artist onboarding and dashboard states', () => {
  it('returns signed-out claim visitors to their exact claim after signing in', async () => {
    state.user = null;
    const el = await render(<ArtistClaimPage />);
    expect(el.querySelector('output')?.textContent).toBe('/signin?returnTo=%2Ffor-artists%2Fclaim%2Fartist1');
    expect(state.start).not.toHaveBeenCalled();
  });
  it('labels every progress step and the email field without sending a code on load', async () => {
    const el = await render(<ArtistClaimPage />);
    expect(el.querySelectorAll('ol[aria-label="Artist claim progress"] li')).toHaveLength(4);
    expect(el.querySelector('[aria-current="step"]')?.textContent).toContain('Email');
    expect(el.querySelector('label[for="claim-email"]')?.textContent).toBe('Email address');
    expect(state.action).not.toHaveBeenCalled();
  });
  it('resumes verification with a numeric one-time-code input', async () => {
    state.start.mockResolvedValue({ success: true, claimId: 'claim1', status: 'verifying' });
    const el = await render(<ArtistClaimPage />);
    expect(el.querySelector('[aria-current="step"]')?.textContent).toContain('Verify');
    expect(el.querySelector('#claim-code')?.getAttribute('autocomplete')).toBe('one-time-code');
    expect(el.querySelector('#claim-code')?.getAttribute('inputmode')).toBe('numeric');
    expect(el.querySelector('label[for="claim-code"]')).not.toBeNull();
  });
  it('labels the connection form and keeps role selection grouped', async () => {
    state.queries['artistClaims:getClaim'] = { status: 'verifying', emailVerified: true };
    const el = await render(<ArtistClaimPage />);
    expect(el.querySelector('fieldset legend')?.textContent).toBe('Your role');
    for (const id of ['claim-website', 'claim-social', 'claim-context']) {
      expect(el.querySelector(`label[for="${id}"]`)).not.toBeNull();
      expect(el.querySelector(`#${id}`)).not.toBeNull();
    }
  });
  it('moves through email, verification, details, and review only after explicit actions', async () => {
    const el = await render(<ArtistClaimPage />);
    const fill = async (id: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(id)!;
      await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
    };
    const click = async (text: string) => {
      const button = [...el.querySelectorAll('button')].find(b => b.textContent?.trim() === text)!;
      expect(button.disabled).toBe(false);
      await act(async () => { button.click(); });
    };
    await fill('#claim-email', 'manager@example.com');
    await click('Send verification code');
    expect(state.action).toHaveBeenLastCalledWith({ claimId: 'claim1', email: 'manager@example.com' });
    expect(el.querySelector('[aria-current="step"]')?.textContent).toContain('Verify');
    await fill('#claim-code', '123456');
    await click('Verify');
    expect(state.action).toHaveBeenLastCalledWith({ claimId: 'claim1', code: '123456' });
    expect(el.querySelector('[aria-current="step"]')?.textContent).toContain('Details');
    await click('Continue');
    expect(el.querySelector('[aria-current="step"]')?.textContent).toContain('Review');
    expect(el.textContent).toContain('Submit for manual review');
    expect(el.textContent).not.toContain('Claim submitted!');
    expect(state.action).toHaveBeenCalledTimes(3);
  });
  it('restores a saved claim when returning to edit without replacing it with defaults', async () => {
    state.queries['artistClaims:getClaim'] = {
      status: 'verifying', emailVerified: true, verificationEmail: 'team@example.com', officialRole: 'manager',
      organizationName: 'Tour Office', officialWebsite: 'https://example.com/',
      socialLinks: ['https://instagram.com/example'], additionalContext: 'We manage this tour.',
    };
    const el = await render(<ArtistClaimPage />);
    expect(el.textContent).toContain('Claim summary');
    const edit = [...el.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Back to details')
      ?? [...el.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Edit details');
    expect(edit).toBeTruthy();
    await act(async () => { edit!.click(); });
    expect(el.querySelector<HTMLInputElement>('#claim-website')?.value).toBe('https://example.com/');
    expect(el.querySelector<HTMLTextAreaElement>('#claim-social')?.value).toBe('https://instagram.com/example');
    expect(el.querySelector<HTMLTextAreaElement>('#claim-context')?.value).toBe('We manage this tour.');
    expect(el.querySelector<HTMLInputElement>('#claim-organization')?.value).toBe('Tour Office');
  });
  it('puts artist selection ahead of optional Spotify and hides admin access tools', async () => {
    const el = await render(<ForArtistsPage />, '/for-artists');
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(el.querySelector('[aria-label="Find an artist to claim"]')).not.toBeNull();
    expect(el.textContent!.indexOf('Find your artist page')).toBeLessThan(el.textContent!.indexOf('Spotify is optional'));
    expect(el.textContent).not.toContain('Admin: Quick Claim');
  });
  it('does not show an empty voting history before the history query completes', async () => {
    const el = await render(<UserDashboard onArtistClick={vi.fn()} onShowClick={vi.fn()} />, '/dashboard');
    expect(el.textContent).toContain('Loading your recent votes');
    expect(el.textContent).not.toContain('Start Voting!');
    expect(el.textContent).toContain('Open artist portal');
  });
});
