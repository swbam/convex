import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SignInPage } from "./SignInPage";
import { SignUpPage } from "./SignUpPage";
vi.mock("@clerk/clerk-react", () => ({
  useUser: () => ({ isSignedIn: false, isLoaded: true }),
  useSignIn: () => ({ signIn: {}, isLoaded: true, setActive: vi.fn() }),
  useSignUp: () => ({ signUp: {}, isLoaded: true }),
  useClerk: () => ({ setActive: vi.fn() }),
}));
vi.mock("convex/react", () => ({ useAction: () => vi.fn() }));
vi.mock("../lib/analytics", () => ({ capture: vi.fn(), captureException: vi.fn(), clearOAuthIntent: vi.fn(), recordOAuthIntent: vi.fn() }));
function Location() { const location = useLocation(); return <output>{location.pathname + location.search}</output>; }
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());
describe("account pages", () => {
  it.each([SignInPage, SignUpPage])("provides labelled credentials and an accessible password toggle", async Page => {
    const el = document.createElement("div"); document.body.append(el);
    const root = createRoot(el);
    cleanup = () => { act(() => root.unmount()); el.remove(); };
    await act(async () => { root.render(<MemoryRouter initialEntries={["/signup?returnTo=%2Fshows%2Fexample"]}><Page /><Location /></MemoryRouter>); });
    const password = el.querySelector<HTMLInputElement>("#auth-password")!;
    expect(el.querySelector('label[for="auth-password"]')?.textContent).toBe("Password");
    expect(el.querySelector('label[for="auth-email"]')?.textContent).toBe("Email");
    expect(password.type).toBe("password");
    await act(async () => { (el.querySelector('[aria-label="Show password"]') as HTMLButtonElement).click(); });
    expect(password.type).toBe("text");
    expect(el.querySelector('[aria-label="Hide password"]')?.getAttribute("aria-pressed")).toBe("true");
    expect((el.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    const switchPage = [...el.querySelectorAll("button")].find(button => /(?:Sign in|Sign up) here/.test(button.textContent ?? ""))!;
    await act(async () => { switchPage.click(); });
    expect(el.querySelector("output")?.textContent).toContain("returnTo=%2Fshows%2Fexample");
  });
});
