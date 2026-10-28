/** Probe answers (head header, /version) are a few hundred bytes. */
export const PROBE_BODY_LIMIT = 1_048_576;
/**
 * NetworkData reads (header, protocols, constants, rights, pending_operations). Measured on
 * 2026-10-28: mainnet pending_operations 0.49-0.52 MB and attestation_rights at head 20 KB;
 * the largest unit-test fixture body 0.52 MB (10,000 operations). 32 MiB is over 60 times that.
 */
export const RPC_BODY_LIMIT = 33_554_432;

export class BodyTooLargeError extends Error {
  override readonly name = "BodyTooLargeError";
  constructor(readonly limit: number) {super(`RPC response too large: over ${limit} bytes`);}
}

/** JSON body of `response`, refused once it declares or delivers more than `limit` bytes. */
export async function readJsonWithin(response: Response, limit: number): Promise<unknown> {
  // No readable stream to bound: none (204, HEAD), already consumed, or a wrapping fetch
  // shim that installed its own json() (instrumentation, test fixtures). A browser-made
  // Response never has an own json property, so a node cannot reach this path.
  if (!response.body || response.bodyUsed || Object.hasOwn(response, "json")) return response.json() as Promise<unknown>;
  const declared = response.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared.trim()) && Number(declared) > limit) {
    void response.body.cancel().catch(() => undefined);
    throw new BodyTooLargeError(limit);
  }
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let bytes = 0, text = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) throw new BodyTooLargeError(limit);
      text += decoder.decode(chunk.value, {stream: true});
    }
  } finally {void reader.cancel().catch(() => undefined);}
  return JSON.parse(text + decoder.decode()) as unknown;
}
