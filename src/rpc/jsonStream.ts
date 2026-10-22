export class JsonStreamDecoder {
  private readonly decoder = new TextDecoder();
  private buffer = "";
  private start = -1;
  private depth = 0;
  private inString = false;
  private escaped = false;
  private scanned = 0;

  push(chunk: Uint8Array, final = false): unknown[] {
    this.buffer += this.decoder.decode(chunk, {stream: !final});
    const values: unknown[] = [];
    let consumed = 0;
    // A frame can span many network chunks. Resume its lexical state instead
    // of rescanning its entire prefix whenever more bytes arrive.
    for (let index = this.scanned; index < this.buffer.length; index += 1) {
      const character = this.buffer[index];
      if (this.start < 0) {
        if (character === "{" || character === "[") {
          this.start = index;
          this.depth = 1;
        }
        continue;
      }
      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (character === "\\") this.escaped = true;
        else if (character === "\"") this.inString = false;
        continue;
      }
      if (character === "\"") this.inString = true;
      else if (character === "{" || character === "[") this.depth += 1;
      else if (character === "}" || character === "]") {
        this.depth -= 1;
        if (this.depth === 0) {
          const end = index + 1;
          values.push(JSON.parse(this.buffer.slice(this.start, end)) as unknown);
          consumed = end;
          this.start = -1;
        }
      }
    }
    if (consumed > 0) {
      this.buffer = this.buffer.slice(consumed);
      if (this.start >= 0) this.start -= consumed;
    }
    this.scanned = this.buffer.length;
    if (this.buffer.length > 4_000_000) throw new Error("RPC stream frame exceeds 4 MB");
    return values;
  }
}
