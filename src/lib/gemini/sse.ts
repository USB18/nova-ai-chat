/**
 * Incremental Server-Sent-Events parser.
 *
 * Feed it the growing response text (or deltas); it emits each complete event's
 * `data` payload once. Handles \n and \r\n line endings, multi-line data fields,
 * comments, and events split across network chunks.
 */
export class SSEParser {
  private buffer = '';
  private consumed = 0;

  constructor(private readonly onData: (data: string) => void) {}

  /** Pass the full accumulated responseText; only new characters are processed. */
  pushCumulative(fullText: string): void {
    if (fullText.length <= this.consumed) {
      return;
    }
    this.push(fullText.slice(this.consumed));
    this.consumed = fullText.length;
  }

  /** Pass a delta chunk. */
  push(chunk: string): void {
    this.buffer += chunk;
    // Events are separated by a blank line.
    const re = /\r?\n\r?\n/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(this.buffer)) !== null) {
      this.dispatch(this.buffer.slice(lastIndex, match.index));
      lastIndex = match.index + match[0].length;
    }
    this.buffer = this.buffer.slice(lastIndex);
  }

  /** Flush a trailing event that wasn't terminated by a blank line. */
  end(): void {
    if (this.buffer.trim()) {
      this.dispatch(this.buffer);
    }
    this.buffer = '';
  }

  private dispatch(rawEvent: string): void {
    const dataLines: string[] = [];
    for (const line of rawEvent.split(/\r?\n/)) {
      if (!line || line.startsWith(':')) {
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^ /, ''));
      }
    }
    if (dataLines.length) {
      this.onData(dataLines.join('\n'));
    }
  }
}
