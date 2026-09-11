// Read-only integrity check; portable across CRLF/LF checkouts.
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),assert=require("node:assert/strict");
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,"manifest.json"),"utf8"));
const hash=file=>crypto.createHash("sha256").update(fs.readFileSync(file,"utf8").replace(/\r\n/g,"\n")).digest("hex");
assert.equal(hash(path.join(__dirname,"baseline.sql")),manifest.schemaTextSha256,"Baseline changed");
for(const file of manifest.coveredMigrationFiles)assert.equal(hash(path.join(__dirname,"../migrations",file.name)),file.textSha256,file.name+" changed");
console.log("PASS: baseline and "+manifest.coveredMigrationFiles.length+" covered migrations match; no database accessed.");
