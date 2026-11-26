Veyra Tool Advisor — build (Linux)
npm i  (three@0.170.0 occt-import-js@0.0.23; dev: electron@33.2.1 electron-builder@25.1.8 resedit pe-library)
npx electron-builder --win --x64 --dir        # makes dist/win-unpacked
node seticon.mjs "dist/win-unpacked/Veyra Tool Advisor.exe"
makensis installer.nsi                         # dist/VeyraToolAdvisor-Setup-x.y.z.exe (apt install nsis)
Test UI in browser: python3 -m http.server 8765 -d ui ; node shot.cjs samples/bracket.step
Test engine: node test.mjs samples/bracket.step +Z alu
Files: ui/analyze.js (feature detection), ui/plan.js (tools/clamping/steps), ui/data.js (materials, default library), ui/app.js (UI, 3D, PDF)
