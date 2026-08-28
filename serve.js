/* เซิร์ฟเวอร์เล็ก ๆ ไว้เปิดดูในเครื่องก่อน deploy
   วิธีใช้:  node serve.js   แล้วเปิด http://localhost:5173
   (เปิดไฟล์ index.html ตรง ๆ ด้วย file:// ไม่ได้ เพราะ config.js จะไม่ถูกโหลด) */
const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5173;
const TYPES = {".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".json":"application/json", ".svg":"image/svg+xml",
  ".png":"image/png", ".ico":"image/x-icon", ".sql":"text/plain; charset=utf-8",
  ".md":"text/plain; charset=utf-8"};

http.createServer((req, res) => {
  const clean = decodeURIComponent(req.url.split("?")[0]);
  const rel   = clean === "/" ? "index.html" : clean.replace(/^\/+/, "");
  const file  = path.join(__dirname, rel);
  if(!file.startsWith(__dirname)){ res.writeHead(403).end("forbidden"); return; }
  fs.readFile(file, (err, buf) => {
    if(err){ res.writeHead(404, {"content-type":"text/plain"}).end("not found: " + rel); return; }
    res.writeHead(200, {"content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
                        "cache-control":"no-store"});
    res.end(buf);
  });
}).listen(PORT, () => console.log(`\n  Creator Bootcamp → http://localhost:${PORT}\n`));
