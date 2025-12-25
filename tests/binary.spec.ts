import { test, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createHelpers, launchBrowser, type TestHelpers } from "./helpers.ts";
import type { Browser, Page } from "playwright";

let browser: Browser;
let page: Page;
let h: TestHelpers;

beforeAll(async () => {
  browser = await launchBrowser();
  page = await browser.newPage();
  h = createHelpers(page);
});

afterAll(async () => {
  await browser.close();
});

afterEach(async () => {
  await h.checkNoRemainingSteps();
});

test("binary sample - TypedArray serialization", async () => {
  await h.load("binary");
  await h.stepAll();

  // Verify the preview shows decoded values for various types
  expect(await h.preview("ArrayBuffer:")).toContain("0xca");
  expect(await h.preview("Int32Array:")).toContain("305419896"); // 0x12345678
  expect(await h.preview("Float64Array:")).toContain("3.14159");
});

test("binary sample - rows show hex bytes", async () => {
  await h.load("binary");
  await h.stepAll();

  const rows = await h.getRows();

  // Uint8Array([0xDE, 0xAD, 0xBE, 0xEF])
  expect(rows.some((r) => r.text && /de ad be ef/i.test(r.text))).toBe(true);
  // ArrayBuffer with 0xCA, 0xFE, 0xBA, 0xBE
  expect(rows.some((r) => r.text && /ca fe ba be/i.test(r.text))).toBe(true);
});
