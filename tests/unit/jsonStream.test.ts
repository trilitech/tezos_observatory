import {describe, expect, it} from "vitest";
import {JsonStreamDecoder} from "../../src/rpc/jsonStream";

const bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("JsonStreamDecoder", () => {
  it("decodes concatenated values split at arbitrary boundaries", () => {
    const decoder = new JsonStreamDecoder();
    expect(decoder.push(bytes(" {\"a\":\"x}"))).toEqual([]);
    expect(decoder.push(bytes("y\"}[1,{\"b\":2}]"))).toEqual([{a: "x}y"}, [1, {b: 2}]]);
  });

  it("preserves UTF8, escape and nested-container state at every byte boundary", () => {
    const values = [{text: 'é 🌌 "quoted" \\ slash } [', nested: [{ok: true}, [1, 2]]}, ["next", {text: "終"}]];
    const input = bytes(values.map(value => JSON.stringify(value)).join("\n"));
    for (let split = 0; split <= input.length; split += 1) {
      const decoder = new JsonStreamDecoder();
      expect([...decoder.push(input.subarray(0, split)), ...decoder.push(input.subarray(split), true)]).toEqual(values);
    }
    const decoder = new JsonStreamDecoder();
    const actual: unknown[] = [];
    for (const byte of input) actual.push(...decoder.push(Uint8Array.of(byte)));
    expect(actual).toEqual(values);
  });

  it("compacts complete frames while retaining a fragmented following frame", () => {
    const decoder = new JsonStreamDecoder();
    expect(decoder.push(bytes('{"first":1}\n{"second":"a\\'))).toEqual([{first: 1}]);
    expect(decoder.push(bytes('"b"}\n[1,'))).toEqual([{second: 'a"b'}]);
    expect(decoder.push(bytes('2]\n'), true)).toEqual([[1, 2]]);
    expect(decoder.push(bytes('{}'))).toEqual([{}]);
  });

  it("retains the existing 4MB incomplete-frame limit across fragments", () => {
    const decoder = new JsonStreamDecoder();
    const limit = bytes('["' + 'x'.repeat(3_999_998));
    expect(decoder.push(limit.subarray(0, 2_000_000))).toEqual([]);
    expect(decoder.push(limit.subarray(2_000_000))).toEqual([]);
    expect(() => decoder.push(bytes('x'))).toThrow('RPC stream frame exceeds 4 MB');
  });
});
