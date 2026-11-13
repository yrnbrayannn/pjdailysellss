// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

describe("app boot", () => {
  it("sends a logged-out visitor to the sign-in screen", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.history.pushState({}, "", "/orders");

    const { default: App } = await import("../App");
    const host = document.createElement("div");
    document.body.appendChild(host);
    await act(async () => { createRoot(host).render(createElement(App)); });
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });

    expect(window.location.pathname).toBe("/login");
    expect(host.textContent).toContain("Sign in");
    expect(host.textContent).toContain("PJ's Stock");
  });
});
