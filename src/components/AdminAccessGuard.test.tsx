import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConvexAuth, useQuery } from "convex/react";
import { AdminAccessGuard } from "./AdminAccessGuard";

vi.mock("convex/react", () => ({ useConvexAuth: vi.fn(), useQuery: vi.fn() }));

const mountRestrictedDashboard = vi.fn(() => <div>Restricted dashboard</div>);
function renderGuard() {
  return renderToStaticMarkup(
    <MemoryRouter><AdminAccessGuard>{React.createElement(mountRestrictedDashboard)}</AdminAccessGuard></MemoryRouter>,
  );
}

describe("admin entry flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useConvexAuth).mockReturnValue({ isRefreshing: false, isLoading: false, isAuthenticated: false });
    vi.mocked(useQuery).mockReturnValue(undefined);
  });

  it("does not mount restricted subscriptions while authentication initializes", () => {
    vi.mocked(useConvexAuth).mockReturnValue({ isRefreshing: false, isLoading: true, isAuthenticated: false });
    expect(renderGuard()).toContain("Checking admin access");
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
    expect(mountRestrictedDashboard).not.toHaveBeenCalled();
  });

  it("offers signed-out visitors a sign-in link that returns to administration", () => {
    expect(renderGuard()).toContain('/signin?returnTo=%2Fadmin');
    expect(useQuery).toHaveBeenCalledWith(expect.anything(), "skip");
    expect(mountRestrictedDashboard).not.toHaveBeenCalled();
  });

  it.each([undefined, { needsSetup: true }])("waits for the app user before mounting restricted queries (%j)", user => {
    vi.mocked(useConvexAuth).mockReturnValue({ isRefreshing: false, isLoading: false, isAuthenticated: true });
    vi.mocked(useQuery).mockReturnValue(user);
    expect(renderGuard()).toContain("Checking admin access");
    expect(mountRestrictedDashboard).not.toHaveBeenCalled();
  });

  it("denies non-admin accounts without mounting restricted queries", () => {
    vi.mocked(useConvexAuth).mockReturnValue({ isRefreshing: false, isLoading: false, isAuthenticated: true });
    vi.mocked(useQuery).mockReturnValue({ needsSetup: false, appUser: { role: "user" } });
    expect(renderGuard()).toContain("Administrator access required");
    expect(mountRestrictedDashboard).not.toHaveBeenCalled();
  });

  it("mounts the dashboard only after the database confirms the admin role", () => {
    vi.mocked(useConvexAuth).mockReturnValue({ isRefreshing: false, isLoading: false, isAuthenticated: true });
    vi.mocked(useQuery).mockReturnValue({ needsSetup: false, appUser: { role: "admin" } });
    expect(renderGuard()).toContain("Restricted dashboard");
    expect(mountRestrictedDashboard).toHaveBeenCalledOnce();
  });
});
