using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.RegularExpressions;

namespace VeyraNC
{
    public class RemoteEntry
    {
        public string Name;
        public bool IsFolder;
        public long Size = -1;
        public DateTime? Modified;
        public string SizeText;
        public string ModifiedText;
    }

    /// <summary>
    /// Talks to the M80 directly over FTP, only when asked. No background polling, no broadcast search.
    /// </summary>
    public class FtpMachine : IMachineLink
    {
        public string Host { get; set; }
        public string Kind { get { return "direct"; } }
        public int Port = 21;
        public string User = "";
        public string Password = "";
        public bool Passive = true;
        public int TimeoutMs = 15000;

        public Action<string> Log = delegate { };
        public List<string> LastRaw = new List<string>();

        string BaseUri { get { return "ftp://" + Host + ":" + Port; } }

        public static string Join(string folder, string name)
        {
            if (string.IsNullOrEmpty(folder) || folder == "/") return "/" + name;
            return folder.TrimEnd('/') + "/" + name;
        }

        public static string Parent(string folder)
        {
            if (string.IsNullOrEmpty(folder) || folder == "/") return "/";
            string f = folder.TrimEnd('/');
            int i = f.LastIndexOf('/');
            return i <= 0 ? "/" : f.Substring(0, i);
        }

        Uri MakeUri(string path, bool isFolder)
        {
            string p = string.IsNullOrEmpty(path) ? "/" : path;
            if (!p.StartsWith("/")) p = "/" + p;
            // Keep path segments as-is; escape only what URIs cannot carry.
            StringBuilder sb = new StringBuilder();
            foreach (string seg in p.Split('/'))
            {
                if (seg.Length == 0) continue;
                sb.Append('/').Append(Uri.EscapeDataString(seg));
            }
            string s = sb.Length == 0 ? "/" : sb.ToString();
            if (isFolder && !s.EndsWith("/")) s += "/";
            // %2F prefix makes the path absolute from the server root.
            return new Uri(BaseUri + "/%2F" + s.TrimStart('/'));
        }

        FtpWebRequest Make(Uri uri, string method)
        {
            FtpWebRequest r = (FtpWebRequest)WebRequest.Create(uri);
            r.Method = method;
            r.Credentials = new NetworkCredential(string.IsNullOrEmpty(User) ? "anonymous" : User,
                                                  string.IsNullOrEmpty(User) ? "nc@explorer" : Password);
            r.UsePassive = Passive;
            r.UseBinary = true;
            r.KeepAlive = false;
            r.Proxy = null; // never route machine traffic through a web proxy
            r.Timeout = TimeoutMs;
            r.ReadWriteTimeout = TimeoutMs;
            return r;
        }

        public static readonly int[] CandidatePorts = { 21, 683, 2121, 20, 990, 64758, 5001, 8021, 1021, 10021 };

        /// <summary>Probes likely ports. Returns the first port that greets like an FTP server ("220"), or -1. Logs every open port.</summary>
        public int FindFtpPort(List<string> openPorts)
        {
            int found = -1;
            foreach (int p in CandidatePorts)
            {
                try
                {
                    using (TcpClient c = new TcpClient())
                    {
                        IAsyncResult ar = c.BeginConnect(Host, p, null, null);
                        if (!ar.AsyncWaitHandle.WaitOne(1500)) continue;
                        c.EndConnect(ar);
                        string banner = "";
                        NetworkStream ns = c.GetStream();
                        ns.ReadTimeout = 2000;
                        try
                        {
                            byte[] buf = new byte[256];
                            int n = ns.Read(buf, 0, buf.Length);
                            banner = Encoding.ASCII.GetString(buf, 0, Math.Max(0, n)).Trim();
                        }
                        catch { }
                        string clean = Regex.Replace(banner, @"[^\x20-\x7E]", ".");
                        if (clean.Length > 60) clean = clean.Substring(0, 60);
                        openPorts.Add(p + (clean.Length > 0 ? " (" + clean + ")" : " (no greeting)"));
                        Log("Port " + p + " is open" + (clean.Length > 0 ? ", says: " + clean : ", no greeting"));
                        if (found < 0 && banner.StartsWith("220")) found = p;
                    }
                }
                catch { }
            }
            return found;
        }

        /// <summary>Quick TCP check so we fail fast instead of hanging.</summary>
        public bool Reachable(out string why)
        {
            why = null;
            try
            {
                using (TcpClient c = new TcpClient())
                {
                    IAsyncResult ar = c.BeginConnect(Host, Port, null, null);
                    if (!ar.AsyncWaitHandle.WaitOne(3000))
                    {
                        why = "No answer from " + Host + " on port " + Port + ". Check the cable and that the machine is switched on.";
                        return false;
                    }
                    c.EndConnect(ar);
                    return true;
                }
            }
            catch (Exception ex)
            {
                why = "Cannot reach " + Host + ": " + ex.Message;
                return false;
            }
        }

        public List<RemoteEntry> List(string folder)
        {
            List<string> lines = new List<string>();
            FtpWebRequest r = Make(MakeUri(folder, true), WebRequestMethods.Ftp.ListDirectoryDetails);
            using (FtpWebResponse resp = (FtpWebResponse)r.GetResponse())
            using (StreamReader sr = new StreamReader(resp.GetResponseStream(), Encoding.Default))
            {
                string line;
                while ((line = sr.ReadLine()) != null) if (line.Trim().Length > 0) lines.Add(line);
            }
            LastRaw = lines;
            List<RemoteEntry> result = new List<RemoteEntry>();
            bool parsedAny = false;
            foreach (string l in lines)
            {
                RemoteEntry e = ParseLine(l);
                if (e == null) continue;
                parsedAny = true;
                if (e.Name == "." || e.Name == "..") continue;
                result.Add(e);
            }
            if (!parsedAny && lines.Count > 0)
            {
                // Unknown listing style: fall back to bare names.
                foreach (string l in lines)
                {
                    string n = l.Trim();
                    if (n == "." || n == "..") continue;
                    result.Add(new RemoteEntry { Name = n, IsFolder = false });
                }
            }
            result.Sort(delegate (RemoteEntry a, RemoteEntry b)
            {
                if (a.IsFolder != b.IsFolder) return a.IsFolder ? -1 : 1;
                return string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase);
            });
            return result;
        }

        static readonly Regex Unix = new Regex(
            @"^(?<type>[dl\-])[rwxsStT\-]{9}\S*\s+\S+\s+\S+\s+\S+\s+(?<size>\d+)\s+(?<mon>\w{3})\s+(?<day>\d{1,2})\s+(?<ty>\d{1,2}:\d{2}|\d{4})\s+(?<name>.+)$");
        static readonly Regex Dos = new Regex(
            @"^(?<date>\d{1,2}-\d{1,2}-\d{2,4})\s+(?<time>\d{1,2}:\d{2}\s*(AM|PM)?)\s+(?<dir><DIR>|\d+)\s+(?<name>.+)$", RegexOptions.IgnoreCase);
        static readonly Regex DosNoTime = new Regex(
            @"^(?<date>\d{2,4}[/-]\d{1,2}[/-]\d{1,4})\s+(?<time>\d{1,2}:\d{2}(:\d{2})?)\s+(?<dir><DIR>|\d+)\s+(?<name>.+)$", RegexOptions.IgnoreCase);

        public static RemoteEntry ParseLine(string line)
        {
            Match m = Unix.Match(line);
            if (m.Success)
            {
                RemoteEntry e = new RemoteEntry();
                e.IsFolder = m.Groups["type"].Value == "d";
                e.Size = long.Parse(m.Groups["size"].Value);
                e.Name = m.Groups["name"].Value.Trim();
                if (m.Groups["type"].Value == "l" && e.Name.Contains(" -> ")) e.Name = e.Name.Substring(0, e.Name.IndexOf(" -> "));
                string ty = m.Groups["ty"].Value;
                string ds = m.Groups["mon"].Value + " " + m.Groups["day"].Value + " " + (ty.Contains(":") ? DateTime.Now.Year.ToString() + " " + ty : ty);
                DateTime d;
                string[] fm = { "MMM d yyyy HH:mm", "MMM d yyyy H:mm", "MMM d yyyy" };
                if (DateTime.TryParseExact(ds, fm, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out d))
                {
                    if (d > DateTime.Now.AddDays(2)) d = d.AddYears(-1);
                    e.Modified = d;
                }
                return e;
            }
            foreach (Regex rx in new Regex[] { Dos, DosNoTime })
            {
                m = rx.Match(line);
                if (!m.Success) continue;
                RemoteEntry e = new RemoteEntry();
                string dir = m.Groups["dir"].Value;
                e.IsFolder = dir.ToUpperInvariant() == "<DIR>";
                if (!e.IsFolder) e.Size = long.Parse(dir);
                e.Name = m.Groups["name"].Value.Trim();
                DateTime d;
                if (DateTime.TryParse(m.Groups["date"].Value + " " + m.Groups["time"].Value, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out d))
                    e.Modified = d;
                return e;
            }
            return null;
        }

        public void Download(string remoteFile, string localFile)
        {
            string tmp = localFile + ".part";
            FtpWebRequest r = Make(MakeUri(remoteFile, false), WebRequestMethods.Ftp.DownloadFile);
            using (FtpWebResponse resp = (FtpWebResponse)r.GetResponse())
            using (Stream s = resp.GetResponseStream())
            using (FileStream fs = File.Create(tmp))
            {
                s.CopyTo(fs);
            }
            if (File.Exists(localFile)) File.Delete(localFile);
            File.Move(tmp, localFile);
        }

        public void Delete(string remoteFile)
        {
            FtpWebRequest r = Make(MakeUri(remoteFile, false), WebRequestMethods.Ftp.DeleteFile);
            using (FtpWebResponse resp = (FtpWebResponse)r.GetResponse()) { }
        }

        public void Upload(string localFile, string remoteFile)
        {
            FtpWebRequest r = Make(MakeUri(remoteFile, false), WebRequestMethods.Ftp.UploadFile);
            byte[] data = File.ReadAllBytes(localFile);
            r.ContentLength = data.Length;
            using (Stream s = r.GetRequestStream()) s.Write(data, 0, data.Length);
            using (FtpWebResponse resp = (FtpWebResponse)r.GetResponse()) { }
        }

        /// <summary>Tries the saved login first, then the known Mitsubishi defaults. Returns true on success.</summary>
        public bool AutoLogin(out string detail)
        {
            List<string[]> tries = new List<string[]>();
            tries.Add(new string[] { User, Password });
            string[][] defaults = {
                new string[] { "", "" },                     // anonymous
                new string[] { "Administrator", "CNC" },
                new string[] { "M800", "CNC" },
                new string[] { "M80", "CNC" },
                new string[] { "MELDAS", "CNC" },
                new string[] { "admin", "admin" },
            };
            foreach (string[] d in defaults)
            {
                bool dup = false;
                foreach (string[] t in tries) if (t[0] == d[0] && t[1] == d[1]) dup = true;
                if (!dup) tries.Add(d);
            }
            string lastErr = "";
            foreach (string[] t in tries)
            {
                User = t[0]; Password = t[1];
                try
                {
                    List("/");
                    detail = "Logged in as " + (User.Length == 0 ? "anonymous" : User);
                    return true;
                }
                catch (WebException wex)
                {
                    lastErr = Describe(wex);
                    Log("Login " + (User.Length == 0 ? "anonymous" : User) + ": " + lastErr);
                    FtpWebResponse fr = wex.Response as FtpWebResponse;
                    // Anything other than a login failure means the login itself worked or the server is unusable.
                    if (fr != null && fr.StatusCode != FtpStatusCode.NotLoggedIn && fr.StatusCode != FtpStatusCode.NeedLoginAccount)
                    {
                        if (fr.StatusCode == FtpStatusCode.ActionNotTakenFileUnavailable) { detail = "Logged in as " + User; return true; }
                    }
                    if (wex.Status == WebExceptionStatus.ConnectFailure || wex.Status == WebExceptionStatus.Timeout) break;
                }
                catch (Exception ex) { lastErr = ex.Message; }
            }
            detail = lastErr;
            return false;
        }

        public static string Describe(Exception ex)
        {
            WebException wex = ex as WebException;
            if (wex != null)
            {
                FtpWebResponse fr = wex.Response as FtpWebResponse;
                if (fr != null) { string sd = (fr.StatusDescription ?? "").Trim(); return sd.StartsWith(((int)fr.StatusCode).ToString()) ? sd : ((int)fr.StatusCode) + " " + sd; }
                if (wex.Status == WebExceptionStatus.Timeout) return "Machine did not answer in time.";
                if (wex.Status == WebExceptionStatus.ConnectFailure) return "Could not connect to the machine.";
                return wex.Message;
            }
            return ex.Message;
        }
    }

    public static class NetCheck
    {
        /// <summary>
        /// Finds the PC network adapter on the machine's subnet and flags setups that slow down the internet
        /// (a gateway set on the machine cable adapter makes Windows send internet traffic down the machine cable).
        /// </summary>
        public static List<string> Check(string machineIp, out bool problem)
        {
            problem = false;
            List<string> notes = new List<string>();
            IPAddress mip;
            if (!IPAddress.TryParse(machineIp, out mip)) { notes.Add("Machine IP is not valid."); problem = true; return notes; }
            byte[] mb = mip.GetAddressBytes();
            bool found = false;
            foreach (NetworkInterface ni in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != OperationalStatus.Up) continue;
                if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
                IPInterfaceProperties p = ni.GetIPProperties();
                foreach (UnicastIPAddressInformation ua in p.UnicastAddresses)
                {
                    if (ua.Address.AddressFamily != AddressFamily.InterNetwork || ua.IPv4Mask == null) continue;
                    byte[] a = ua.Address.GetAddressBytes(), k = ua.IPv4Mask.GetAddressBytes();
                    bool same = true;
                    for (int i = 0; i < 4; i++) if ((a[i] & k[i]) != (mb[i] & k[i])) same = false;
                    if (!same) continue;
                    found = true;
                    notes.Add("Machine cable is on \"" + ni.Name + "\" (this PC: " + ua.Address + ").");
                    if (ua.Address.Equals(mip)) { notes.Add("This PC has the SAME IP as the machine. Change the PC's IP."); problem = true; }
                    foreach (GatewayIPAddressInformation g in p.GatewayAddresses)
                    {
                        if (g.Address.AddressFamily != AddressFamily.InterNetwork) continue;
                        if (g.Address.ToString() == "0.0.0.0") continue;
                        notes.Add("This adapter has a default gateway (" + g.Address + "). That can push your internet through the machine cable and make it slow. Remove the gateway on this adapter (Settings > Network > Ethernet > IP settings > Edit, leave Gateway empty).");
                        problem = true;
                    }
                }
            }
            if (!found)
            {
                notes.Add("No network adapter on this PC is in the machine's range (" + mb[0] + "." + mb[1] + "." + mb[2] + ".x). Give the Ethernet adapter a fixed IP such as " + mb[0] + "." + mb[1] + "." + mb[2] + "." + (mb[3] == 10 ? 11 : 10) + ", mask 255.255.255.0, no gateway.");
                problem = true;
            }
            return notes;
        }
    }

    public static class NcName
    {
        // From the NC Explorer manual: capitals, digits and symbols; no \ / : , * ? " < > | lower-case or spaces; max 32 chars.
        public static string Fix(string name)
        {
            StringBuilder sb = new StringBuilder();
            foreach (char c in name.ToUpperInvariant())
            {
                if (c > 126 || c < 33 || "\\/:,*?\"<>|¥".IndexOf(c) >= 0) sb.Append('_');
                else sb.Append(c);
            }
            string s = sb.ToString();
            if (s.Length > 32)
            {
                string ext = Path.GetExtension(s);
                if (ext.Length > 8) ext = "";
                s = s.Substring(0, 32 - ext.Length) + ext;
            }
            return s;
        }
    }
}
