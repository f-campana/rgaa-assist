/**
 * A local fixture server on two origins, for check tests and the corpus
 * harness. Nothing here makes a request off the machine.
 *
 * - Main origin: `http://127.0.0.1:<port>`.
 * - Cross origin: `http://localhost:<port>`, another site for the browser
 *   (`127.0.0.1` and `localhost` are different sites), so a frame from it is
 *   cross-site and, with the engine's launch settings, out of process.
 *
 * Both origins serve the same files. In text files (`.html`, `.htm`, `.xhtml`,
 * `.css`, `.js`, `.mjs`, `.svg`, `.json`, `.txt`, `.xml`) the placeholder
 * `__CROSS_ORIGIN__` is replaced by the cross origin (scheme, host and port,
 * no trailing slash). A path that is not in the set gives 404.
 */
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

export const CROSS_ORIGIN_PLACEHOLDER = "__CROSS_ORIGIN__";

/** Content types by extension. Anything else is `application/octet-stream`. */
export const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".xhtml": "application/xhtml+xml; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const TEXT_EXTENSIONS = new Set([".html", ".htm", ".xhtml", ".css", ".js", ".mjs", ".svg", ".json", ".txt", ".xml"]);

/** Files as a map of path (relative, `/`-separated, no leading `/`) to content. */
export type FixtureFiles = Readonly<Record<string, string | Uint8Array>>;

/** Files given as a map, or as a folder path whose files are all served. */
export type FixtureSource = FixtureFiles | string;

/** Every file under `dir`, by relative `/`-separated path. */
export function readFixtureFolder(dir: string): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile()) out[relative(dir, p).split(sep).join("/")] = readFileSync(p);
    }
  };
  if (!statSync(dir).isDirectory()) throw new Error(`not a folder: ${dir}`);
  walk(dir);
  return out;
}

function normalisePath(path: string): string {
  const clean = path.replace(/^\/+/, "");
  if (clean.split("/").some((seg) => seg === ".." || seg === ".")) throw new Error(`fixture paths must not contain '.' or '..': ${path}`);
  if (clean.length === 0) throw new Error("empty fixture path");
  return clean;
}

export interface FixtureServer {
  /** `http://127.0.0.1:<port>` */
  readonly mainOrigin: string;
  /** `http://localhost:<port>` */
  readonly crossOrigin: string;
  /** Absolute URL of `path` on the main origin, or on the cross origin. */
  url(path: string, origin?: "main" | "cross"): string;
  /** Every path requested so far, as `<origin><path>`. */
  readonly requests: readonly string[];
  close(): Promise<void>;
}

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    // Both listen on IPv4 loopback; the cross origin is addressed as `localhost`,
    // which Chromium resolves to loopback without DNS.
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") reject(new Error("no port"));
      else resolve(address.port);
    });
  });
}

/** Start serving `source` on the two origins. Close it when done. */
export async function serveFixture(source: FixtureSource): Promise<FixtureServer> {
  const raw: Record<string, string | Uint8Array> =
    typeof source === "string" ? readFixtureFolder(source) : { ...source };
  const files = new Map<string, string | Uint8Array>();
  for (const [path, content] of Object.entries(raw)) files.set(normalisePath(path), content);

  const requests: string[] = [];
  let crossOrigin = "";
  const handler =
    (origin: () => string) =>
    (req: IncomingMessage, res: ServerResponse): void => {
      const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
      requests.push(`${origin()}${pathname}`);
      let key = pathname.replace(/^\/+/, "");
      if (key === "" || key.endsWith("/")) key = `${key}index.html`;
      const content = files.get(key);
      if (content === undefined) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("not found");
        return;
      }
      const ext = extname(key).toLowerCase();
      let body: string | Uint8Array = content;
      if (TEXT_EXTENSIONS.has(ext)) {
        const text = typeof content === "string" ? content : Buffer.from(content).toString("utf8");
        body = text.split(CROSS_ORIGIN_PLACEHOLDER).join(crossOrigin);
      }
      res.writeHead(200, {
        "content-type": CONTENT_TYPES[ext] ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      res.end(body);
    };

  let mainOrigin = "";
  const main = createServer(handler(() => mainOrigin));
  const cross = createServer(handler(() => crossOrigin));
  const [mainPort, crossPort] = await Promise.all([listen(main), listen(cross)]);
  mainOrigin = `http://127.0.0.1:${mainPort}`;
  crossOrigin = `http://localhost:${crossPort}`;

  const closeServer = (s: Server): Promise<void> =>
    new Promise((resolve) => {
      s.closeAllConnections();
      s.close(() => resolve());
    });

  return {
    mainOrigin,
    crossOrigin,
    url: (path, origin = "main") => `${origin === "main" ? mainOrigin : crossOrigin}/${normalisePath(path)}`,
    requests,
    close: async () => {
      await Promise.all([closeServer(main), closeServer(cross)]);
    },
  };
}

/** A port on 127.0.0.1 where nothing listens: connections to it are refused. */
export async function refusedPort(): Promise<number> {
  const s = createServer();
  const port = await listen(s);
  await new Promise<void>((resolve) => s.close(() => resolve()));
  return port;
}
