import { test, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createHelpers, launchBrowser, type TestHelpers } from "./helpers.ts";
import type { Browser, Page } from "playwright";

const BINARY_MARKER_CASES = [
  "arrayBuffer: buffer",
  "int8: new Int8Array(marker)",
  "uint8: new Uint8Array(marker)",
  "uint8Clamped: new Uint8ClampedArray(marker)",
  "int16: new Int16Array(new Uint8Array(marker).buffer)",
  "uint16: new Uint16Array(new Uint8Array(marker).buffer)",
  "int32: new Int32Array(new Uint8Array(marker).buffer)",
  "uint32: new Uint32Array(new Uint8Array(marker).buffer)",
  "float32: new Float32Array(new Uint8Array(marker).buffer)",
  "float64: new Float64Array(new Uint8Array([...marker, ...marker]).buffer)",
  "bigInt64: new BigInt64Array(new Uint8Array([...marker, ...marker]).buffer)",
  "bigUint64: new BigUint64Array(new Uint8Array([...marker, ...marker]).buffer)",
  "dataView: new DataView(buffer)",
  `byteStream: new ReadableStream({
    type: 'bytes',
    start(controller) {
      controller.enqueue(new Uint8Array(marker))
      controller.close()
    }
  })`,
];

const BINARY_TAGS_SERVER = `export default function App() {
  const marker = [0xAB, 0xCD, 0xAB, 0xCD]
  const buffer = new ArrayBuffer(4)
  new Uint8Array(buffer).set(marker)

  return {
    ${BINARY_MARKER_CASES.join(",\n    ")},
    longText: 'test'.repeat(300),
  }
}`;

const BINARY_TAGS_CLIENT = `'use client'`;

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

test("all binary tags produce marker rows", async () => {
  await h.loadCode(BINARY_TAGS_SERVER, BINARY_TAGS_CLIENT);
  await h.stepAll();

  const rows = await h.getRows();

  // Count rows containing "ab cd ab cd" (binary marker)
  const binaryMarkerRows = rows.filter((r) => r.text && /ab cd ab cd/i.test(r.text));

  // Count rows containing "74 65 73 74" (ASCII for "test")
  const textRows = rows.filter((r) => r.text && /74 65 73 74/.test(r.text));

  // If any binary tag is missing from the parser, the stream will be corrupted
  expect(
    binaryMarkerRows.length,
    `Expected ${BINARY_MARKER_CASES.length} binary marker rows, got ${binaryMarkerRows.length}`,
  ).toBe(BINARY_MARKER_CASES.length);

  expect(textRows.length, `Expected 1 Text row, got ${textRows.length}`).toBe(1);
});
