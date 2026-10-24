import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execAsync = promisify(exec);

const root = process.cwd();
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mtl": "text/plain; charset=utf-8",
  ".obj": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");

  if (request.method === "POST" && request.url === "/api/publish") {
    let body = "";
    for await (const chunk of request) body += chunk;
    try {
      const { archive } = JSON.parse(body);
      if (!Array.isArray(archive)) throw new Error("expected archive array");
      const jsonPath = path.join(root, "data", "archive.json");
      await writeFile(jsonPath, JSON.stringify(archive, null, 2) + "\n", "utf8");
      const { stdout, stderr } = await execAsync(
        'git add data/archive.json && git commit -m "cms: publish archive update" && git push origin main',
        { cwd: root }
      );
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true, output: stdout + stderr }));
    } catch (err) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  const url = new URL(request.url || "/", "http://localhost");
  const pathname = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(root, pathname));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, { "content-type": types[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("not found");
  }
}).listen(4173, "0.0.0.0", () => {
  console.log("wev archive static server listening on 4173");
});
