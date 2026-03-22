const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "out");
const placeholderPath = path.join(outDir, "placeholder.txt");
const keepPath = path.join(outDir, ".gitkeep");

fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(placeholderPath)) {
  fs.writeFileSync(
    placeholderPath,
    "Frontend static export placeholder for go:embed.\n",
    "utf8",
  );
}

if (!fs.existsSync(keepPath)) {
  fs.writeFileSync(keepPath, "", "utf8");
}
