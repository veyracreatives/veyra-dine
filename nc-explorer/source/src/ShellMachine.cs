using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Windows.Forms;

namespace VeyraNC
{
    public interface IMachineLink
    {
        string Host { get; }
        string Kind { get; }
        List<RemoteEntry> List(string folder);
        void Download(string remoteFile, string localFile);
        void Upload(string localFile, string remoteFile);
        void Delete(string remoteFile);
    }

    /// <summary>
    /// Fallback: uses the "NC Explorer" folder that Mitsubishi's driver adds to Windows
    /// (C:\Users\Public\Desktop\NC Explorer). Paths look like /H4AV(192,168,200,1)/CNC MEMORY/PRG/USER.
    /// All shell calls run on one STA thread, as the Windows shell requires.
    /// </summary>
    public class ShellMachine : IMachineLink
    {
        public Action<string> Log = delegate { };
        string rootPath;
        string machineName; // e.g. H4AV(192,168,200,1)
        public string Host { get { return machineName ?? "NC Explorer"; } }
        public string Kind { get { return "NC Explorer driver"; } }

        const int CopyFlags = 4 | 16 | 512 | 1024; // no progress UI, yes-to-all, no mkdir confirm, no error UI

        public static string FindRoot()
        {
            string[] tries = {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonDesktopDirectory), "NC Explorer"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "NC Explorer"),
                @"C:\Users\Public\Desktop\NC Explorer",
            };
            foreach (string t in tries) if (Directory.Exists(t)) return t;
            return null;
        }

        public static bool Available() { return FindRoot() != null; }

        /// <summary>Opens the driver and picks the machine whose name contains the IP (192,168,200,1 style).</summary>
        public bool Open(string ip, out string detail)
        {
            rootPath = FindRoot();
            if (rootPath == null) { detail = "Mitsubishi NC Explorer is not installed on this PC."; return false; }
            string want = ip.Replace('.', ',');
            string pick = null;
            List<string> names = new List<string>();
            Sta(delegate
            {
                dynamic root = Shell().NameSpace(rootPath);
                if (root == null) return;
                dynamic items = root.Items();
                for (int i = 0; i < items.Count; i++)
                {
                    string n = items.Item(i).Name;
                    names.Add(n);
                    if (pick == null && n.Contains(want)) pick = n;
                }
            });
            if (pick == null && names.Count == 1) pick = names[0];
            if (pick == null)
            {
                detail = names.Count == 0 ? "NC Explorer shows no machine. Is the machine on?" : "NC Explorer shows: " + string.Join(", ", names) + ", none with IP " + ip + ".";
                return false;
            }
            machineName = pick;
            detail = "Using NC Explorer driver, machine " + pick;
            return true;
        }

        static dynamic Shell() { return Activator.CreateInstance(Type.GetTypeFromProgID("Shell.Application")); }

        // Runs work on a fresh STA thread and rethrows its exception here.
        static void Sta(Action work)
        {
            Exception err = null;
            Thread t = new Thread(delegate () { try { work(); } catch (Exception ex) { err = ex; } });
            t.SetApartmentState(ApartmentState.STA);
            t.IsBackground = true;
            t.Start();
            t.Join();
            if (err != null) throw err;
        }

        static void Pump(int ms)
        {
            DateTime end = DateTime.Now.AddMilliseconds(ms);
            while (DateTime.Now < end) { Application.DoEvents(); Thread.Sleep(50); }
        }

        static string[] Split(string path)
        {
            List<string> l = new List<string>();
            foreach (string s in (path ?? "").Split('/')) if (s.Length > 0) l.Add(s);
            return l.ToArray();
        }

        // Path inside the machine: "/CNC MEMORY/PRG/USER". Resolve under root/machine.
        dynamic Resolve(dynamic shell, string folder)
        {
            dynamic f = shell.NameSpace(rootPath);
            List<string> segs = new List<string>();
            segs.Add(machineName);
            segs.AddRange(Split(folder));
            foreach (string s in segs)
            {
                dynamic item = FindItem(f, s);
                if (item == null) throw new Exception("Folder not found on machine: " + s);
                f = item.GetFolder;
                if (f == null) throw new Exception("Cannot open folder: " + s);
            }
            return f;
        }

        static dynamic FindItem(dynamic folder, string name)
        {
            dynamic items = folder.Items();
            for (int i = 0; i < items.Count; i++)
            {
                dynamic it = items.Item(i);
                if (string.Equals((string)it.Name, name, StringComparison.OrdinalIgnoreCase)) return it;
            }
            return null;
        }

        public List<RemoteEntry> List(string folder)
        {
            List<RemoteEntry> result = new List<RemoteEntry>();
            Sta(delegate
            {
                dynamic sh = Shell();
                dynamic f = Resolve(sh, folder);
                // The driver can fill folders lazily: retry a few times if it comes back empty.
                dynamic items = f.Items();
                for (int r = 0; r < 4 && items.Count == 0; r++) { Pump(700); f = Resolve(Shell(), folder); items = f.Items(); }
                // Sizes: FolderItem.Size is empty with this driver, so use the Details columns (read AFTER listing).
                int sizeCol = -1, dateCol = -1;
                for (int c = 0; c < 20 && items.Count > 0; c++)
                {
                    string h = "";
                    try { h = (string)f.GetDetailsOf(null, c); } catch { break; }
                    if (string.IsNullOrEmpty(h)) continue;
                    string hl = h.ToLowerInvariant();
                    if (sizeCol < 0 && hl.Contains("size")) sizeCol = c;
                    if (dateCol < 0 && (hl.Contains("modified") || hl.Contains("update") || hl == "date")) dateCol = c;
                }
                for (int i = 0; i < items.Count; i++)
                {
                    dynamic it = items.Item(i);
                    RemoteEntry e = new RemoteEntry();
                    e.Name = it.Name;
                    e.IsFolder = it.IsFolder;
                    if (!e.IsFolder)
                    {
                        try { long sz = (long)it.Size; if (sz > 0) e.Size = sz; } catch { }
                        if (e.Size <= 0 && sizeCol >= 0)
                        {
                            try
                            {
                                string st = ((string)f.GetDetailsOf(it, sizeCol) ?? "").Trim();
                                e.SizeText = st;
                                long parsed = ParseSize(st);
                                if (parsed >= 0) e.Size = parsed;
                            }
                            catch { }
                        }
                    }
                    try { DateTime d = it.ModifyDate; if (d.Year > 1980) e.Modified = d; } catch { }
                    if (!e.Modified.HasValue && dateCol >= 0)
                    {
                        try
                        {
                            string dt = ((string)f.GetDetailsOf(it, dateCol) ?? "").Trim();
                            // Strip invisible direction marks Windows puts into dates.
                            dt = System.Text.RegularExpressions.Regex.Replace(dt, @"[\u200e\u200f]", "");
                            DateTime d2;
                            if (DateTime.TryParse(dt, out d2) && d2.Year > 1980) e.Modified = d2; else e.ModifiedText = dt;
                        }
                        catch { }
                    }
                    result.Add(e);
                }
            });
            result.Sort(delegate (RemoteEntry a, RemoteEntry b)
            {
                if (a.IsFolder != b.IsFolder) return a.IsFolder ? -1 : 1;
                return string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase);
            });
            return result;
        }

        static long ParseSize(string st)
        {
            if (string.IsNullOrEmpty(st)) return -1;
            System.Text.RegularExpressions.Match m = System.Text.RegularExpressions.Regex.Match(st.Replace(",", ""), @"([\d.]+)\s*(bytes|byte|b|kb|mb|gb)?", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (!m.Success) return -1;
            double v;
            if (!double.TryParse(m.Groups[1].Value, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out v)) return -1;
            string u = m.Groups[2].Value.ToLowerInvariant();
            if (u == "kb") v *= 1024; else if (u == "mb") v *= 1048576; else if (u == "gb") v *= 1073741824;
            return (long)v;
        }

        public void Download(string remoteFile, string localFile)
        {
            string dir = FtpMachine.Parent(remoteFile);
            string name = Split(remoteFile)[Split(remoteFile).Length - 1];
            string tmpDir = Path.Combine(Path.GetTempPath(), "VeyraNC_dl_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tmpDir);
            try
            {
                Sta(delegate
                {
                    dynamic sh = Shell();
                    dynamic f = Resolve(sh, dir);
                    dynamic item = FindItem(f, name);
                    if (item == null) throw new Exception(name + " is not on the machine.");
                    dynamic target = sh.NameSpace(tmpDir);
                    target.CopyHere(item, CopyFlags);
                    WaitForFile(tmpDir, 120000);
                });
                string[] got = Directory.GetFiles(tmpDir);
                if (got.Length == 0) throw new Exception("NC Explorer did not deliver " + name + ".");
                if (File.Exists(localFile)) File.Delete(localFile);
                File.Move(got[0], localFile);
            }
            finally { try { Directory.Delete(tmpDir, true); } catch { } }
        }

        static void WaitForFile(string dir, int timeoutMs)
        {
            DateTime end = DateTime.Now.AddMilliseconds(timeoutMs);
            long last = -1; int stable = 0;
            while (DateTime.Now < end)
            {
                Pump(300);
                string[] fs = Directory.GetFiles(dir);
                if (fs.Length == 0) continue;
                long len;
                try { using (FileStream s = File.Open(fs[0], FileMode.Open, FileAccess.Read, FileShare.None)) len = s.Length; }
                catch { stable = 0; continue; }
                if (len == last) { if (++stable >= 3) return; } else { stable = 0; last = len; }
            }
            throw new Exception("Timed out waiting for the machine.");
        }

        public void Delete(string remoteFile)
        {
            string dir = FtpMachine.Parent(remoteFile);
            string name = Split(remoteFile)[Split(remoteFile).Length - 1];
            Sta(delegate
            {
                dynamic sh = Shell();
                dynamic f = Resolve(sh, dir);
                dynamic item = FindItem(f, name);
                if (item == null) return;
                item.InvokeVerb("delete");
                // NC Explorer may ask to confirm; wait until the file is gone.
                DateTime end = DateTime.Now.AddMinutes(2);
                while (DateTime.Now < end)
                {
                    Pump(800);
                    if (FindItem(Resolve(Shell(), dir), name) == null) return;
                }
                throw new Exception(name + " is still on the machine. It may be running, open in Edit, or protected.");
            });
        }

        public void Upload(string localFile, string remoteFile)
        {
            string dir = FtpMachine.Parent(remoteFile);
            string name = Split(remoteFile)[Split(remoteFile).Length - 1];
            string tmpDir = Path.Combine(Path.GetTempPath(), "VeyraNC_up_" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tmpDir);
            string staged = Path.Combine(tmpDir, name);
            File.Copy(localFile, staged, true);
            try
            {
                Sta(delegate
                {
                    dynamic sh = Shell();
                    dynamic f = Resolve(sh, dir);
                    f.CopyHere(staged, CopyFlags);
                    // NC Explorer may show its own overwrite / upload dialogs; wait until the file is listed.
                    DateTime end = DateTime.Now.AddMinutes(3);
                    while (DateTime.Now < end)
                    {
                        Pump(1000);
                        dynamic fresh = Resolve(Shell(), dir);
                        dynamic it = FindItem(fresh, name);
                        if (it != null) { Pump(1500); return; }
                    }
                    throw new Exception("The machine did not show " + name + " after writing. Check NC Explorer for a message.");
                });
            }
            finally { try { Directory.Delete(tmpDir, true); } catch { } }
        }
    }
}
