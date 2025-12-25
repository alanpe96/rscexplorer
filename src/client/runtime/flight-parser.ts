// React Flight Protocol Row Parser
//
// This is a framing parser that splits the RSC byte stream into discrete rows.
// It does NOT interpret row contents, it only determines row boundaries.
// (We want to keep knowledge of implementation details as little as possible.)
//
// Two framing modes based on tag byte after "ID:":
//   - Binary framing: ID:TAG + HEX_LENGTH + "," + BINARY_DATA (no terminator)
//   - Text framing:   ID:TAG + DATA + "\n" (newline terminated)
//
// The parser must know which tags use binary framing to correctly find row
// boundaries. If a binary tag is missing from BINARY_TAGS, the parser will
// treat it as text, scan for newline, and corrupt subsequent parsing.

// Check if byte is a hex digit (0-9, a-f, A-F)
function isHexDigit(b: number): boolean {
  return (b >= 0x30 && b <= 0x39) || (b >= 0x61 && b <= 0x66) || (b >= 0x41 && b <= 0x46);
}

// Parse hex digit to value (0-15)
function hexValue(b: number): number {
  if (b >= 0x30 && b <= 0x39) return b - 0x30; // 0-9
  if (b >= 0x61 && b <= 0x66) return b - 0x57; // a-f
  return b - 0x37; // A-F
}

// Tags that use binary (length-prefixed) framing
const BINARY_TAGS = new Set([
  0x54, // T - long text
  0x41, // A - ArrayBuffer
  0x4f, // O - Int8Array
  0x6f, // o - Uint8Array
  0x55, // U - Uint8ClampedArray
  0x53, // S - Int16Array
  0x73, // s - Uint16Array
  0x4c, // L - Int32Array
  0x6c, // l - Uint32Array
  0x47, // G - Float32Array
  0x67, // g - Float64Array
  0x4d, // M - BigInt64Array
  0x6d, // m - BigUint64Array
  0x56, // V - DataView
  0x62, // b - byte stream chunk
]);

export type RowSegment = { type: "text" | "binary"; data: Uint8Array };

export interface ParsedRow {
  id: string;
  segment: RowSegment;
  raw: Uint8Array;
}

export interface ParseResult {
  rows: ParsedRow[];
  remainder: Uint8Array;
}

export function parseRows(buffer: Uint8Array, final: boolean = false): ParseResult {
  const rows: ParsedRow[] = [];
  let i = 0;

  while (i < buffer.length) {
    const rowStart = i;

    // Row ID: hex digits until ':'
    while (i < buffer.length && buffer[i] !== 0x3a) {
      const b = buffer[i]!;
      if (!isHexDigit(b)) {
        throw new Error(`Expected hex digit in row ID, got 0x${b.toString(16)}`);
      }
      i++;
    }
    if (i >= buffer.length) {
      if (final) {
        throw new Error(`Truncated row ID at end of stream`);
      }
      return { rows, remainder: buffer.slice(rowStart) };
    }

    const id = decodeAscii(buffer, rowStart, i);
    // buffer[i] is guaranteed to be colon here (while loop exit condition)
    i++;

    if (i >= buffer.length) {
      if (final) {
        throw new Error(`Row ${id} truncated after colon`);
      }
      return { rows, remainder: buffer.slice(rowStart) };
    }

    const tag = buffer[i]!;

    if (BINARY_TAGS.has(tag)) {
      // Binary framing: TAG + HEX_LENGTH + "," + DATA
      i++;

      let length = 0;
      while (i < buffer.length && buffer[i] !== 0x2c) {
        const b = buffer[i]!;
        if (!isHexDigit(b)) {
          throw new Error(
            `Expected hex digit in binary length for row ${id}, got 0x${b.toString(16)}`,
          );
        }
        length = (length << 4) | hexValue(b);
        i++;
      }

      if (i >= buffer.length) {
        if (final) {
          throw new Error(`Row ${id} truncated in binary length`);
        }
        return { rows, remainder: buffer.slice(rowStart) };
      }
      // buffer[i] is guaranteed to be comma here (while loop exit condition)
      i++;

      if (i + length > buffer.length) {
        if (final) {
          throw new Error(
            `Row ${id} truncated in binary data (need ${length} bytes, have ${buffer.length - i})`,
          );
        }
        return { rows, remainder: buffer.slice(rowStart) };
      }

      const data = buffer.slice(i, i + length);
      const raw = buffer.slice(rowStart, i + length);
      rows.push({ id, segment: { type: "binary", data }, raw });
      i += length;
    } else {
      // Text framing: scan for newline
      const contentStart = i + 1; // after the tag byte
      while (i < buffer.length && buffer[i] !== 0x0a) {
        i++;
      }

      if (i >= buffer.length) {
        if (!final) {
          // Incomplete row, wait for more data
          return { rows, remainder: buffer.slice(rowStart) };
        }
        throw new Error(`Text row ${id} missing trailing newline at end of stream`);
      } else {
        const data = buffer.slice(contentStart, i);
        const raw = buffer.slice(rowStart, i + 1);
        rows.push({ id, segment: { type: "text", data }, raw });
        i++;
      }
    }
  }

  return { rows, remainder: new Uint8Array(0) };
}

function decodeAscii(buffer: Uint8Array, start: number, end: number): string {
  let s = "";
  for (let i = start; i < end; i++) {
    s += String.fromCharCode(buffer[i]!);
  }
  return s;
}
