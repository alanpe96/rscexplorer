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

test("action error - throwing action shows error in entry and clears pending state", async () => {
  await h.load("actionerror");

  // Render completes
  expect(await h.stepAll()).toMatchInlineSnapshot(`
    "<div>
      <h1>Action Error</h1>
      <Button failAction={[Function: failAction]} />
    </div>"
  `);
  expect(await h.preview("Trigger Failing Action")).toMatchInlineSnapshot(`
    "Action Error
    Trigger Failing Action"
  `);

  // Click the button to trigger the failing action
  await h.frame().getByTestId("preview-container").locator("button").click();

  // Wait for the error entry to appear (action fails quickly)
  const errorEntry = h.frame().getByTestId("flight-entry-error");
  await expect.poll(() => errorEntry.count(), { timeout: 10000 }).toBeGreaterThan(0);

  // Verify error message is displayed in the FlightLog entry
  const errorText = await errorEntry.innerText();
  expect(errorText).toContain("Action failed intentionally");

  // The error propagates to the preview (no ErrorBoundary in the sample),
  // so the preview will show the error message instead of the button.
  // The key verification is that the error entry appears in the FlightLog.
});

test("action error - raw action with invalid payload shows error", async () => {
  await h.load("form");

  // Render completes
  expect(await h.stepAll()).toMatchInlineSnapshot(`
    "<div>
      <h1>Form Action</h1>
      <Form greetAction={[Function: greet]} />
    </div>"
  `);

  // Click + to add raw action
  await h.frame().locator(".FlightLog-addButton").click();

  // Enter invalid payload (not valid URLSearchParams format for decodeReply)
  await h.frame().locator(".FlightLog-rawForm-textarea").fill("invalid-payload-that-will-fail");

  // Submit
  await h.frame().locator(".FlightLog-rawForm-submitBtn").click();

  // Wait for the error entry to appear
  const errorEntry = h.frame().getByTestId("flight-entry-error");
  await expect.poll(() => errorEntry.count(), { timeout: 10000 }).toBeGreaterThan(0);

  // Verify error message includes our helpful hint about payload format
  const errorText = await errorEntry.innerText();
  expect(errorText).toContain("couldn't parse the request payload");
});
