import * as assert from "assert";

/**
 * Lightweight in-memory Apple Binary Property List (bplist00) decoder
 * specialized for extracting WebResourceURL from com.apple.webarchive buffers.
 */
export class BplistParser {
  static extractSourceUrl(buf: Buffer): string {
    try {
      if (!buf || buf.length < 40) return "";
      if (buf.subarray(0, 8).toString("ascii") !== "bplist00") {
        // Fallback: If not bplist00, try regex search in buffer
        return this.fallbackRegexUrl(buf);
      }

      const trailerOffset = buf.length - 32;
      const offsetIntSize = buf.readUInt8(trailerOffset + 6);
      const objectRefSize = buf.readUInt8(trailerOffset + 7);
      const numObjects = Number(buf.readBigUInt64BE(trailerOffset + 8));
      const topObject = Number(buf.readBigUInt64BE(trailerOffset + 16));
      const offsetTableOffset = Number(buf.readBigUInt64BE(trailerOffset + 24));

      if (offsetIntSize === 0 || objectRefSize === 0 || numObjects === 0) {
        return this.fallbackRegexUrl(buf);
      }

      const getOffset = (objIndex: number): number => {
        const ptr = offsetTableOffset + objIndex * offsetIntSize;
        if (ptr + offsetIntSize > trailerOffset) return -1;
        if (offsetIntSize === 1) return buf.readUInt8(ptr);
        if (offsetIntSize === 2) return buf.readUInt16BE(ptr);
        if (offsetIntSize === 4) return buf.readUInt32BE(ptr);
        return Number(buf.readBigUInt64BE(ptr));
      };

      const parseObject = (objIndex: number, depth = 0): any => {
        if (depth > 10) return null; // recursion guard
        const offset = getOffset(objIndex);
        if (offset < 8 || offset >= offsetTableOffset) return null;

        const marker = buf.readUInt8(offset);
        const objType = marker & 0xf0;
        let count = marker & 0x0f;
        let dataStart = offset + 1;

        // Count extension if count == 0x0F
        if (count === 0x0f) {
          const intMarker = buf.readUInt8(dataStart);
          const intBytes = 1 << (intMarker & 0x0f);
          dataStart += 1;
          if (intBytes === 1) count = buf.readUInt8(dataStart);
          else if (intBytes === 2) count = buf.readUInt16BE(dataStart);
          else if (intBytes === 4) count = buf.readUInt32BE(dataStart);
          dataStart += intBytes;
        }

        // ASCII String (0x50)
        if (objType === 0x50) {
          if (dataStart + count > buf.length) return null;
          return buf.subarray(dataStart, dataStart + count).toString("ascii");
        }

        // UTF-16BE String (0x60)
        if (objType === 0x60) {
          const byteLen = count * 2;
          if (dataStart + byteLen > buf.length) return null;
          return buf.subarray(dataStart, dataStart + byteLen).swap16().toString("utf16le");
        }

        // Dictionary (0xD0)
        if (objType === 0xd0) {
          const dict: Record<string, any> = {};
          const keysStart = dataStart;
          const valsStart = dataStart + count * objectRefSize;

          const readRef = (pos: number) => {
            if (objectRefSize === 1) return buf.readUInt8(pos);
            if (objectRefSize === 2) return buf.readUInt16BE(pos);
            return buf.readUInt32BE(pos);
          };

          for (let i = 0; i < count; i++) {
            const keyIndex = readRef(keysStart + i * objectRefSize);
            const valIndex = readRef(valsStart + i * objectRefSize);
            const key = parseObject(keyIndex, depth + 1);
            if (typeof key === "string") {
              // Optimization: only traverse values if relevant to WebArchive source URL
              if (key === "WebMainResource" || key === "WebResourceURL") {
                dict[key] = parseObject(valIndex, depth + 1);
              }
            }
          }
          return dict;
        }

        // Array (0xA0)
        if (objType === 0xa0) {
          // If needed in future
          return null;
        }

        return null;
      };

      const root = parseObject(topObject);
      const url = root?.WebMainResource?.WebResourceURL ?? root?.WebResourceURL;
      if (typeof url === "string" && url.trim().startsWith("http")) {
        return url.trim();
      }
    } catch (e) {
      console.warn("BplistParser exception, falling back to regex:", e);
    }

    // Secondary fallback: regex scan across the raw buffer
    return this.fallbackRegexUrl(buf);
  }

  /**
   * Fast scan fallback looking for WebResourceURL followed by an http(s) URL
   */
  private static fallbackRegexUrl(buf: Buffer): string {
    try {
      const text = buf.toString("latin1");
      const keyPos = text.indexOf("WebResourceURL");
      if (keyPos !== -1) {
        const slice = text.substring(keyPos, keyPos + 1000);
        const match = slice.match(/https?:\/\/[^\s<>"'\0\x01-\x1f]+/);
        if (match) {
          return match[0].trim();
        }
      }
      // General URL search fallback in buffer
      const generalMatch = text.match(/https?:\/\/[^\s<>"'\0\x01-\x1f]+/);
      if (generalMatch) {
        return generalMatch[0].trim();
      }
    } catch {
      // ignore
    }
    return "";
  }
}

// ---------------------------------------------------------------------------
// Unit Test Suite
// ---------------------------------------------------------------------------

function buildTestBplist(url: string): Buffer {
  // Let's construct a valid bplist00 containing:
  // Root Dict (obj 0): WebMainResource -> Dict (obj 1)
  // Dict (obj 1): WebResourceURL -> url (obj 2)
  // Obj 3: "WebMainResource"
  // Obj 4: "WebResourceURL"

  const chunks: Buffer[] = [];
  chunks.push(Buffer.from("bplist00", "ascii")); // 0..7 (len 8)

  const offsets: number[] = [];
  let curOffset = 8;

  // Obj 0: Root Dict (1 pair): key = Obj 3 ("WebMainResource"), val = Obj 1 (Child Dict)
  offsets.push(curOffset);
  const obj0 = Buffer.from([0xd1, 3, 1]); // dict with 1 item, key ref 3, val ref 1
  chunks.push(obj0);
  curOffset += obj0.length;

  // Obj 1: Child Dict (1 pair): key = Obj 4 ("WebResourceURL"), val = Obj 2 (URL)
  offsets.push(curOffset);
  const obj1 = Buffer.from([0xd1, 4, 2]); // dict with 1 item, key ref 4, val ref 2
  chunks.push(obj1);
  curOffset += obj1.length;

  // Obj 2: URL String
  offsets.push(curOffset);
  const urlBuf = Buffer.from(url, "ascii");
  let obj2Header: Buffer;
  if (urlBuf.length < 15) {
    obj2Header = Buffer.from([0x50 | urlBuf.length]);
  } else {
    obj2Header = Buffer.from([0x5f, 0x10, urlBuf.length]); // extended count byte
  }
  const obj2 = Buffer.concat([obj2Header, urlBuf]);
  chunks.push(obj2);
  curOffset += obj2.length;

  // Obj 3: String "WebMainResource" (length 15)
  offsets.push(curOffset);
  const obj3 = Buffer.concat([Buffer.from([0x5f, 0x10, 15]), Buffer.from("WebMainResource", "ascii")]);
  chunks.push(obj3);
  curOffset += obj3.length;

  // Obj 4: String "WebResourceURL" (length 14)
  offsets.push(curOffset);
  const obj4 = Buffer.concat([Buffer.from([0x5e]), Buffer.from("WebResourceURL", "ascii")]);
  chunks.push(obj4);
  curOffset += obj4.length;

  // Offset Table
  const offsetTableOffset = curOffset;
  const offsetTableBuf = Buffer.from(offsets);
  chunks.push(offsetTableBuf);
  curOffset += offsetTableBuf.length;

  // Trailer (32 bytes)
  const trailer = Buffer.alloc(32);
  trailer.writeUInt8(1, 6); // offsetIntSize = 1 byte
  trailer.writeUInt8(1, 7); // objectRefSize = 1 byte
  trailer.writeBigUInt64BE(BigInt(5), 8); // numObjects = 5
  trailer.writeBigUInt64BE(BigInt(0), 16); // topObject = 0
  trailer.writeBigUInt64BE(BigInt(offsetTableOffset), 24); // offsetTableOffset
  chunks.push(trailer);

  return Buffer.concat(chunks);
}

function runTests() {
  console.log("Running BplistParser unit tests...");

  // Test 1: Valid Safari WebArchive
  const targetUrl = "https://developer.apple.com/documentation/webkit";
  const buf = buildTestBplist(targetUrl);
  const extracted = BplistParser.extractSourceUrl(buf);
  assert.strictEqual(extracted, targetUrl, `Expected ${targetUrl}, got ${extracted}`);
  console.log("  [PASS] Test 1: Valid Safari WebArchive extraction");

  // Test 2: Invalid/Empty buffer
  assert.strictEqual(BplistParser.extractSourceUrl(Buffer.alloc(0)), "");
  assert.strictEqual(BplistParser.extractSourceUrl(Buffer.from("invalid-short")), "");
  console.log("  [PASS] Test 2: Empty/Invalid buffer handling");

  // Test 3: Non-bplist buffer with embedded WebResourceURL regex fallback
  const rawTextBuf = Buffer.from("Some raw header WebResourceURL: https://example.org/test-page more text", "utf-8");
  const extractedFallback = BplistParser.extractSourceUrl(rawTextBuf);
  assert.strictEqual(extractedFallback, "https://example.org/test-page");
  console.log("  [PASS] Test 3: Raw text regex fallback");

  // Test 4: bplist with non-http URL (should be rejected)
  const nonHttpBuf = buildTestBplist("file:///Users/john/doc.html");
  assert.strictEqual(BplistParser.extractSourceUrl(nonHttpBuf), "");
  console.log("  [PASS] Test 4: Non-http URL filtered out");

  console.log("\nRunning Windows CF_HTML parser unit tests...");

  function parseWindowsSourceUrl(buf: Buffer): string {
    try {
      const text = buf.toString("utf8");
      const match = text.match(/SourceURL:(https?:\/\/[^\r\n]+)/i);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch {
      // ignore
    }
    return "";
  }

  // Windows Test 1: Standard Chromium CF_HTML header
  const sampleCfHtml = Buffer.from(
    "Version:0.9\r\nStartHTML:0000000105\r\nEndHTML:0000000780\r\nStartFragment:0000000141\r\nEndFragment:0000000744\r\nSourceURL:https://en.wikipedia.org/wiki/Obsidian_(software)\r\n<html><body><!--StartFragment-->Obsidian<!--EndFragment--></body></html>",
    "utf-8"
  );
  assert.strictEqual(
    parseWindowsSourceUrl(sampleCfHtml),
    "https://en.wikipedia.org/wiki/Obsidian_(software)"
  );
  console.log("  [PASS] Win Test 1: Standard CF_HTML with CRLF");

  // Windows Test 2: CF_HTML with LF only and lowercase sourceurl
  const sampleLfHtml = Buffer.from(
    "Version:0.9\nSourceUrl:https://example.com/page?id=123&ref=test\n<html><body>Fragment</body></html>",
    "utf-8"
  );
  assert.strictEqual(
    parseWindowsSourceUrl(sampleLfHtml),
    "https://example.com/page?id=123&ref=test"
  );
  console.log("  [PASS] Win Test 2: Case-insensitive SourceUrl with LF");

  // Windows Test 3: HTML content missing SourceURL header
  const noSourceHtml = Buffer.from("<html><body><p>Hello world without source</p></body></html>", "utf-8");
  assert.strictEqual(parseWindowsSourceUrl(noSourceHtml), "");
  console.log("  [PASS] Win Test 3: Missing SourceURL header returns empty string");

  // Windows Test 4: Empty buffer
  assert.strictEqual(parseWindowsSourceUrl(Buffer.alloc(0)), "");
  console.log("  [PASS] Win Test 4: Empty buffer returns empty string");

  // Performance benchmark: 10,000 parses
  const iterations = 10000;
  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) {
    parseWindowsSourceUrl(sampleCfHtml);
  }
  const end = process.hrtime.bigint();
  const totalMs = Number(end - start) / 1_000_000;
  const perOpUs = (totalMs / iterations) * 1000;
  console.log(`  [BENCHMARK] ${iterations} operations in ${totalMs.toFixed(2)}ms (${perOpUs.toFixed(3)} µs per operation)`);

  console.log("\nAll unit tests and benchmarks passed successfully! 🎉");
}

runTests();
