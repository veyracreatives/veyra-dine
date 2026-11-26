using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace VeyraNC
{
    public struct P3
    {
        public double X, Y, Z;
        public P3(double x, double y, double z) { X = x; Y = y; Z = z; }
    }

    public class Seg
    {
        public P3 A, B;
        public bool Rapid;
        public int Line;   // 0-based source line
        public int Tool;
    }

    public enum Sev { Error, Warning, Info }

    public class Issue
    {
        public Sev Severity;
        public int Line = -1; // 0-based, -1 = whole program
        public string Text;
    }

    public class ToolUse
    {
        public int Tool;
        public double CutMm;
        public double CutMin;
        public double RapidMm;
        public int FirstLine = -1;
        public double MaxS;
        public double MaxF;
        public double MinZ = double.MaxValue;
    }

    public class CheckLimits
    {
        public double MaxFeed = 10000;   // mm/min
        public double MaxSpindle = 12000; // rpm
        public int MaxTool = 40;
        public double RapidRate = 15000; // mm/min, for time estimate
    }

    /// <summary>Reads a G-code program: builds the toolpath, estimates time per tool, and checks for common mistakes.</summary>
    public class GProgram
    {
        public List<Seg> Segs = new List<Seg>();
        public List<Issue> Issues = new List<Issue>();
        public Dictionary<int, ToolUse> Tools = new Dictionary<int, ToolUse>();
        public double MinX = double.MaxValue, MinY = double.MaxValue, MinZ = double.MaxValue;
        public double MaxX = double.MinValue, MaxY = double.MinValue, MaxZ = double.MinValue;
        public double TotalMin, CutMin, RapidMin;
        public bool Inch;
        public int LineCount;
        public bool HasEnd;

        static readonly Regex Word = new Regex(@"([A-Z#])\s*([-+]?\d*\.?\d+|\[[^\]]*\])", RegexOptions.Compiled);

        public static string StripComments(string line)
        {
            StringBuilder sb = new StringBuilder();
            int depth = 0;
            foreach (char c in line)
            {
                if (c == '(') { depth++; continue; }
                if (c == ')') { if (depth > 0) depth--; continue; }
                if (depth > 0) continue;
                if (c == ';') break;
                sb.Append(c);
            }
            return sb.ToString();
        }

        public static GProgram Parse(string text, CheckLimits lim)
        {
            GProgram g = new GProgram();
            g.Run(text, lim ?? new CheckLimits());
            return g;
        }

        void Add(Sev s, int line, string t)
        {
            if (Issues.Count > 300) return;
            Issues.Add(new Issue { Severity = s, Line = line, Text = t });
        }

        void Run(string text, CheckLimits lim)
        {
            string[] lines = text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
            LineCount = lines.Length;
            double x = 0, y = 0, z = 0;
            int motion = 0; // 0,1,2,3, 80+ cycles
            bool abs = true, inch = false, metricSeen = false, inchSeen = false;
            int plane = 17;
            double f = 0, s = 0;
            bool spindleOn = false, feedPerRev = false;
            int tool = 0, pendingTool = 0;
            double cycR = 0, cycZ = 0; bool retractToR = false; double initialZ = 0;
            bool warnedMacro = false, warnedSub = false, warnedNoF = false, warnedNoSpindle = false, warnedRapidLow = false;
            int lastCodeLine = -1;
            CultureInfo ci = CultureInfo.InvariantCulture;

            for (int li = 0; li < lines.Length; li++)
            {
                string raw = lines[li];
                string code = StripComments(raw).ToUpperInvariant().Trim();
                if (code.Length == 0 || code == "%") continue;
                if (code.StartsWith("/")) code = code.Substring(1); // block delete: treat as active
                if (code.StartsWith("O") || code.StartsWith(":")) { if (!code.Contains("G") && !code.Contains("M")) continue; }
                lastCodeLine = li;

                if (!warnedMacro && (code.Contains("#") || code.Contains("IF") || code.Contains("WHILE") || code.Contains("GOTO")))
                {
                    Add(Sev.Info, li, "Uses macro variables (#) or IF/WHILE. The preview can't calculate these, so the drawing may be incomplete.");
                    warnedMacro = true;
                }

                Dictionary<char, double> w = new Dictionary<char, double>();
                List<int> gs = new List<int>(), ms = new List<int>();
                foreach (Match m in Word.Matches(code))
                {
                    char k = m.Groups[1].Value[0];
                    string vs = m.Groups[2].Value;
                    if (k == '#' || vs.StartsWith("[")) continue;
                    double v;
                    if (!double.TryParse(vs, NumberStyles.Float, ci, out v)) continue;
                    if (k == 'G') gs.Add((int)Math.Round(v * 10));
                    else if (k == 'M') ms.Add((int)v);
                    else w[k] = v;
                }

                foreach (int g10 in gs)
                {
                    int gv = g10 / 10;
                    if (g10 % 10 != 0) continue;
                    switch (gv)
                    {
                        case 0: case 1: case 2: case 3: motion = gv; break;
                        case 17: case 18: case 19: plane = gv; break;
                        case 20: inch = true; inchSeen = true; break;
                        case 21: inch = false; metricSeen = true; break;
                        case 90: abs = true; break;
                        case 91: abs = false; break;
                        case 94: feedPerRev = false; break;
                        case 95: feedPerRev = true; break;
                        case 98: retractToR = false; break;
                        case 99: retractToR = true; break;
                        case 80: motion = 0; break;
                        case 73: case 74: case 76: case 81: case 82: case 83: case 84: case 85: case 86: case 87: case 88: case 89:
                            motion = gv; initialZ = z; break;
                    }
                }
                bool nonModalMove = gs.Contains(280) || gs.Contains(300) || gs.Contains(530) || gs.Contains(920) || gs.Contains(100) || gs.Contains(40);

                if (w.ContainsKey('F')) f = w['F'];
                if (w.ContainsKey('S')) s = w['S'];
                if (w.ContainsKey('T')) { pendingTool = (int)w['T']; if (pendingTool > lim.MaxTool) Add(Sev.Warning, li, "Tool T" + pendingTool + " is higher than " + lim.MaxTool + ". Check the tool number exists in the magazine."); }
                foreach (int mv in ms)
                {
                    if (mv == 6) { tool = pendingTool; Tool(tool, li); }
                    if (mv == 3 || mv == 4) spindleOn = true;
                    if (mv == 5) spindleOn = false;
                    if (mv == 30 || mv == 2) HasEnd = true;
                    if (mv == 98 && !warnedSub) { Add(Sev.Info, li, "Calls a sub-program (M98). Moves inside the sub-program are not shown."); warnedSub = true; }
                }
                if (tool == 0 && pendingTool != 0 && !ms.Contains(6)) { /* tool preselect only */ }

                if (s > 0 && s > lim.MaxSpindle) Add(Sev.Warning, li, "Spindle speed S" + s.ToString(ci) + " is above " + lim.MaxSpindle + " rpm.");
                double fmm = inch ? f * 25.4 : f;
                if (w.ContainsKey('F') && !feedPerRev && fmm > lim.MaxFeed) Add(Sev.Warning, li, "Feed F" + f.ToString(ci) + " is above " + lim.MaxFeed + " mm/min.");

                if (nonModalMove) continue; // G28/G30/G53/G92/G10/G4: not drawn

                bool hasAxis = w.ContainsKey('X') || w.ContainsKey('Y') || w.ContainsKey('Z');
                if (!hasAxis) continue;
                double sc = 1; // keep drawing in program units
                double nx = w.ContainsKey('X') ? (abs ? w['X'] * sc : x + w['X'] * sc) : x;
                double ny = w.ContainsKey('Y') ? (abs ? w['Y'] * sc : y + w['Y'] * sc) : y;
                double nz = w.ContainsKey('Z') ? (abs ? w['Z'] * sc : z + w['Z'] * sc) : z;

                if (motion >= 73)
                {
                    // Canned drilling cycle: rapid to XY, rapid to R, feed to Z, rapid back.
                    if (w.ContainsKey('R')) cycR = abs ? w['R'] : z + w['R'];
                    if (w.ContainsKey('Z')) cycZ = nz;
                    if (!spindleOn && !warnedNoSpindle) { Add(Sev.Error, li, "Drilling with the spindle off (no M3/M4 before this)."); warnedNoSpindle = true; }
                    if (f <= 0 && !warnedNoF) { Add(Sev.Error, li, "Drilling with no feed (F) set."); warnedNoF = true; }
                    Move(x, y, z, nx, ny, z, true, li, tool, f, s, inch, feedPerRev, lim);
                    Move(nx, ny, z, nx, ny, cycR, true, li, tool, f, s, inch, feedPerRev, lim);
                    Move(nx, ny, cycR, nx, ny, cycZ, false, li, tool, f, s, inch, feedPerRev, lim);
                    double back = retractToR ? cycR : Math.Max(initialZ, cycR);
                    Move(nx, ny, cycZ, nx, ny, back, true, li, tool, f, s, inch, feedPerRev, lim);
                    x = nx; y = ny; z = back;
                    continue;
                }

                if (motion == 0)
                {
                    if (nz < 0 && nz < z && !warnedRapidLow)
                    {
                        Add(Sev.Warning, li, "Rapid (G0) move down to Z" + nz.ToString("0.###", ci) + ", below Z0. Check this isn't a rapid into the part.");
                        warnedRapidLow = true;
                    }
                    Move(x, y, z, nx, ny, nz, true, li, tool, f, s, inch, feedPerRev, lim);
                }
                else
                {
                    if (!spindleOn && !warnedNoSpindle) { Add(Sev.Error, li, "Cutting move with the spindle off (no M3/M4 before this)."); warnedNoSpindle = true; }
                    if (f <= 0 && !warnedNoF) { Add(Sev.Error, li, "Cutting move with no feed (F) set."); warnedNoF = true; }
                    if (motion == 1) Move(x, y, z, nx, ny, nz, false, li, tool, f, s, inch, feedPerRev, lim);
                    else Arc(x, y, z, nx, ny, nz, w, motion == 2, plane, abs, li, tool, f, s, inch, feedPerRev, lim);
                }
                x = nx; y = ny; z = nz;
            }

            Inch = inch;
            if (!HasEnd) Add(Sev.Error, -1, "No M30 (or M02) at the end. The program will not finish and rewind properly.");
            if (inchSeen && metricSeen) Add(Sev.Error, -1, "The program switches between inch (G20) and mm (G21). Check which units it should use.");
            else if (inchSeen) Add(Sev.Warning, -1, "Program is in INCH (G20). Make sure that's intended; most programs here are mm.");
            else if (!metricSeen) Add(Sev.Info, -1, "No G21 (mm) at the start. The machine will use its current units.");
            if (Segs.Count == 0) Add(Sev.Info, -1, "No moves found to draw.");
            if (Tools.Count == 0 && Segs.Count > 0) Add(Sev.Info, -1, "No tool change (T.. M6) found. The program uses whatever tool is in the spindle.");
            if (lastCodeLine < 0) Add(Sev.Error, -1, "The file has no G-code in it.");
            if (MinX == double.MaxValue) { MinX = MinY = MinZ = 0; MaxX = MaxY = MaxZ = 0; }
        }

        ToolUse Tool(int t, int line)
        {
            ToolUse tu;
            if (!Tools.TryGetValue(t, out tu)) { tu = new ToolUse { Tool = t, FirstLine = line }; Tools[t] = tu; }
            return tu;
        }

        void Move(double x0, double y0, double z0, double x1, double y1, double z1, bool rapid, int line, int tool, double f, double s, bool inch, bool perRev, CheckLimits lim)
        {
            if (x0 == x1 && y0 == y1 && z0 == z1) return;
            Seg sg = new Seg { A = new P3(x0, y0, z0), B = new P3(x1, y1, z1), Rapid = rapid, Line = line, Tool = tool };
            Segs.Add(sg);
            Grow(x0, y0, z0); Grow(x1, y1, z1);
            double len = Math.Sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0) + (z1 - z0) * (z1 - z0));
            double mm = inch ? len * 25.4 : len;
            ToolUse tu = Tool(tool, line);
            if (rapid)
            {
                double t = mm / lim.RapidRate;
                tu.RapidMm += mm; RapidMin += t; TotalMin += t;
            }
            else
            {
                double feed = perRev ? f * s : f;
                if (inch) feed *= 25.4;
                double t = feed > 0 ? mm / feed : 0;
                tu.CutMm += mm; tu.CutMin += t; CutMin += t; TotalMin += t;
                if (s > tu.MaxS) tu.MaxS = s;
                if (f > tu.MaxF) tu.MaxF = f;
                if (Math.Min(z0, z1) < tu.MinZ) tu.MinZ = Math.Min(z0, z1);
            }
        }

        void Arc(double x0, double y0, double z0, double x1, double y1, double z1, Dictionary<char, double> w, bool cw, int plane, bool abs,
                 int line, int tool, double f, double s, bool inch, bool perRev, CheckLimits lim)
        {
            // Work in plane coordinates (u,v) with linear axis h.
            double u0, v0, h0, u1, v1, h1; char cu, cv;
            if (plane == 18) { u0 = z0; v0 = x0; h0 = y0; u1 = z1; v1 = x1; h1 = y1; cu = 'K'; cv = 'I'; }
            else if (plane == 19) { u0 = y0; v0 = z0; h0 = x0; u1 = y1; v1 = z1; h1 = x1; cu = 'J'; cv = 'K'; }
            else { u0 = x0; v0 = y0; h0 = z0; u1 = x1; v1 = y1; h1 = z1; cu = 'I'; cv = 'J'; }
            double cu0, cv0;
            if (w.ContainsKey('R'))
            {
                double r = w['R'];
                double dx = u1 - u0, dy = v1 - v0, d = Math.Sqrt(dx * dx + dy * dy);
                if (d < 1e-9 || Math.Abs(r) < d / 2 - 1e-6) { Move(x0, y0, z0, x1, y1, z1, false, line, tool, f, s, inch, perRev, lim); Add(Sev.Warning, line, "Arc radius R is too small for this move."); return; }
                double hgt = Math.Sqrt(Math.Max(0, r * r - d * d / 4));
                double mx = (u0 + u1) / 2, my = (v0 + v1) / 2;
                double sgn = (cw ? 1 : -1) * (r > 0 ? 1 : -1);
                cu0 = mx + sgn * hgt * dy / d;
                cv0 = my - sgn * hgt * dx / d;
            }
            else
            {
                cu0 = u0 + (w.ContainsKey(cu) ? w[cu] : 0);
                cv0 = v0 + (w.ContainsKey(cv) ? w[cv] : 0);
            }
            double rad = Math.Sqrt((u0 - cu0) * (u0 - cu0) + (v0 - cv0) * (v0 - cv0));
            double a0 = Math.Atan2(v0 - cv0, u0 - cu0), a1 = Math.Atan2(v1 - cv0, u1 - cu0);
            double sweep = a1 - a0;
            if (cw) { if (sweep >= -1e-9) sweep -= 2 * Math.PI; }
            else { if (sweep <= 1e-9) sweep += 2 * Math.PI; }
            if (Math.Abs(u0 - u1) < 1e-9 && Math.Abs(v0 - v1) < 1e-9) sweep = cw ? -2 * Math.PI : 2 * Math.PI;
            int n = Math.Max(4, (int)(Math.Abs(sweep) / (Math.PI / 36)));
            double pu = u0, pv = v0, ph = h0;
            for (int i = 1; i <= n; i++)
            {
                double a = a0 + sweep * i / n;
                double qu = i == n ? u1 : cu0 + rad * Math.Cos(a);
                double qv = i == n ? v1 : cv0 + rad * Math.Sin(a);
                double qh = h0 + (h1 - h0) * i / n;
                double ax, ay, az, bx, by, bz;
                Unplane(plane, pu, pv, ph, out ax, out ay, out az);
                Unplane(plane, qu, qv, qh, out bx, out by, out bz);
                Move(ax, ay, az, bx, by, bz, false, line, tool, f, s, inch, perRev, lim);
                pu = qu; pv = qv; ph = qh;
            }
        }

        static void Unplane(int plane, double u, double v, double h, out double x, out double y, out double z)
        {
            if (plane == 18) { z = u; x = v; y = h; }
            else if (plane == 19) { y = u; z = v; x = h; }
            else { x = u; y = v; z = h; }
        }

        void Grow(double x, double y, double z)
        {
            if (x < MinX) MinX = x; if (x > MaxX) MaxX = x;
            if (y < MinY) MinY = y; if (y > MaxY) MaxY = y;
            if (z < MinZ) MinZ = z; if (z > MaxZ) MaxZ = z;
        }

        public static string FmtMin(double min)
        {
            if (min < 1) return Math.Max(1, (int)Math.Round(min * 60)) + " s";
            int t = (int)Math.Round(min * 60);
            if (t < 3600) return (t / 60) + " min " + (t % 60).ToString("00") + " s";
            return (t / 3600) + " h " + ((t % 3600) / 60).ToString("00") + " min";
        }

        public int Count(Sev s) { int n = 0; foreach (Issue i in Issues) if (i.Severity == s) n++; return n; }
    }
}
