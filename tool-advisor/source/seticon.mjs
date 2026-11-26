import * as ResEdit from 'resedit'; import * as PE from 'pe-library'; import fs from 'fs';
const exe = process.argv[2]; const data = fs.readFileSync(exe);
const e = PE.NtExecutable.from(data, { ignoreCert: true }); const res = PE.NtExecutableResource.from(e);
const ico = ResEdit.Data.IconFile.from(fs.readFileSync('build/icon.ico'));
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 1033, ico.icons.map(i => i.data));
const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
if (vi) { vi.setStringValues({ lang: 1033, codepage: 1200 }, { ProductName: 'Veyra Tool Advisor', FileDescription: 'Veyra Tool Advisor', CompanyName: 'Veyra Creatives' }); vi.outputToResourceEntries(res.entries); }
res.outputResource(e); fs.writeFileSync(exe, Buffer.from(e.generate())); console.log('icon set');
