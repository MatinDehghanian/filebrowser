const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "out");
const placeholderPath = path.join(outDir, "placeholder.txt");
const content = "Frontend static export placeholder for go:embed.\n";

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(placeholderPath, content, "utf8");
