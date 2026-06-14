import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const host = process.env.HOST || "0.0.0.0";
const port = Number.parseInt(process.env.PORT || "4173", 10);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const safePath = (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(join(root, normalized === sep ? "index.html" : normalized));

  if (!filePath.startsWith(root)) {
    return null;
  }

  return filePath;
};

const server = createServer((request, response) => {
  const filePath = safePath(request.url || "/");
  const target = filePath && existsSync(filePath) && statSync(filePath).isDirectory()
    ? join(filePath, "index.html")
    : filePath;

  if (!target || !existsSync(target)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": types[extname(target)] || "application/octet-stream",
  });
  createReadStream(target).pipe(response);
});

server.listen(port, host, () => {
  console.log(`拼豆小助手 is running at http://${host}:${port}/`);
});
