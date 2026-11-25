#!/bin/sh
cd "$(dirname "$0")"
cat src/p1.js src/p2.js src/p3.js src/p4.js src/p5.js src/p6.js > public/app.js
node -e "new Function(require('fs').readFileSync('public/app.js','utf8'))" && echo "app.js ok ($(wc -c < public/app.js) bytes)"
