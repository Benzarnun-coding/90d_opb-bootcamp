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
  // เปิด CORS ไว้ให้หน้า Supabase ดึงไฟล์ migration ไปรันได้ (ใช้เฉพาะตอน dev ในเครื่อง)
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-private-network": "true",
    "access-control-allow-headers": "*"
  };
  if(req.method === "OPTIONS"){ res.writeHead(204, cors).end(); return; }
  // dev เท่านั้น: หน้าเว็บส่งไฟล์ (เช่น รูปสไปรต์ที่วาดบน canvas) มาเก็บใน dist/ — POST /__save?name=x.png body=base64
  if(req.method === "POST" && clean === "/__save"){
    const name = path.basename(new URL(req.url, "http://x").searchParams.get("name") || "");
    if(!/^[\w.-]+$/.test(name)){ res.writeHead(400, cors).end("bad name"); return; }
    let body=""; req.on("data", c => body += c); req.on("end", () => {
      fs.mkdirSync(path.join(__dirname, "dist"), {recursive:true});
      fs.writeFileSync(path.join(__dirname, "dist", name), Buffer.from(body, "base64"));
      res.writeHead(200, cors).end("saved " + name);
    });
    return;
  }

  fs.readFile(file, (err, buf) => {
    if(err){ res.writeHead(404, {"content-type":"text/plain"}).end("not found: " + rel); return; }
    res.writeHead(200, Object.assign({
      "content-type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"
    }, cors));
    res.end(buf);
  });
}).listen(PORT, () => console.log(`\n  Creator Bootcamp → http://localhost:${PORT}\n`));
