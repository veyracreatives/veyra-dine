using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace VeyraNC
{
    // ---------- native read-only live status (m70live.dll, port 683) ----------
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public struct VncStatus
    {
        public int ok, device, mode, run, alarm;
        public uint counter, tool, spindle, cycle, autotime, powertime;
        public int load, feedOverride, spindleOverride;
        public double feed;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string program;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string alarmText;
    }

    static class Native
    {
        [DllImport("m70live.dll", CallingConvention = CallingConvention.Cdecl)] public static extern IntPtr vnc_open(string ip, int port);
        [DllImport("m70live.dll", CallingConvention = CallingConvention.Cdecl)] public static extern int vnc_read(IntPtr h, ref VncStatus s);
        [DllImport("m70live.dll", CallingConvention = CallingConvention.Cdecl)] public static extern void vnc_close(IntPtr h);
    }

    // ---------- tool life store: %AppData%\Veyra NC Explorer\toollife.txt ----------
    public class ToolRec { public int T; public string Name = ""; public double LifeMin = 60; public double UsedMin; public DateTime Fitted = DateTime.Now; }

    public static class ToolLife
    {
        static readonly object L = new object();
        static string FilePath { get { return Path.Combine(Settings.Dir(), "toollife.txt"); } }
        static CultureInfo ci = CultureInfo.InvariantCulture;

        public static List<ToolRec> Load()
        {
            List<ToolRec> l = new List<ToolRec>();
            lock (L)
            {
                if (!File.Exists(FilePath)) return l;
                foreach (string line in File.ReadAllLines(FilePath))
                {
                    string[] p = line.Split('|');
                    if (p.Length < 4) continue;
                    ToolRec r = new ToolRec();
                    if (!int.TryParse(p[0], out r.T)) continue;
                    r.Name = p[1];
                    double.TryParse(p[2], NumberStyles.Float, ci, out r.LifeMin);
                    double.TryParse(p[3], NumberStyles.Float, ci, out r.UsedMin);
                    long tk; if (p.Length > 4 && long.TryParse(p[4], out tk)) r.Fitted = new DateTime(tk);
                    l.Add(r);
                }
            }
            l.Sort(delegate (ToolRec a, ToolRec b) { return a.T.CompareTo(b.T); });
            return l;
        }

        public static void Save(List<ToolRec> l)
        {
            List<string> lines = new List<string>();
            foreach (ToolRec r in l)
                lines.Add(r.T + "|" + r.Name.Replace("|", "/") + "|" + r.LifeMin.ToString(ci) + "|" + r.UsedMin.ToString("0.###", ci) + "|" + r.Fitted.Ticks);
            lock (L) { File.WriteAllLines(FilePath, lines.ToArray()); }
        }

        public static ToolRec Get(List<ToolRec> l, int t, bool create)
        {
            foreach (ToolRec r in l) if (r.T == t) return r;
            if (!create) return null;
            ToolRec n = new ToolRec { T = t };
            l.Add(n);
            return n;
        }

        public static void AddMinutes(int t, double min)
        {
            if (t <= 0 || min <= 0) return;
            List<ToolRec> l = Load();
            Get(l, t, true).UsedMin += min;
            Save(l);
        }

        public static double LeftPct(ToolRec r) { return r.LifeMin <= 0 ? 100 : Math.Max(0, 100 - r.UsedMin * 100 / r.LifeMin); }
        public static Color ColorFor(double pct) { return pct <= 10 ? Theme.Bad : pct <= 30 ? Color.FromArgb(230, 150, 20) : Theme.Good; }
        public static string Word(double pct) { return pct <= 0 ? "Worn out, change" : pct <= 10 ? "Change soon" : pct <= 30 ? "Getting worn" : "Good"; }
    }

    // ---------- Tool life window ----------
    public class ToolLifeForm : Form
    {
        ListView list = new ListView();
        List<ToolRec> tools;

        public ToolLifeForm()
        {
            Text = "Tool life - Veyra NC Explorer";
            ClientSize = new Size(820, 520); MinimumSize = new Size(700, 420);
            StartPosition = FormStartPosition.CenterParent; BackColor = Theme.Bg; Font = Theme.UI;

            Label head = new Label
            {
                Dock = DockStyle.Top, Height = 64, BackColor = Theme.Ink, ForeColor = Color.White, Padding = new Padding(16, 10, 16, 0),
                Text = "Tool life\r\nHow much life each tool has left. Time is added when the live view sees the tool cutting, or when you log program runs.",
                Font = Theme.UI
            };

            list.Dock = DockStyle.Fill; list.View = View.Details; list.FullRowSelect = true; list.OwnerDraw = true; list.Font = new Font("Segoe UI", 11f);
            list.Columns.Add("Tool", 70); list.Columns.Add("Name", 190); list.Columns.Add("Life left", 260); list.Columns.Add("Used / life (min)", 140); list.Columns.Add("Status", 160);
            list.DrawColumnHeader += delegate (object s, DrawListViewColumnHeaderEventArgs e) { e.DrawDefault = true; };
            list.DrawSubItem += DrawCell;
            list.DoubleClick += delegate { EditSel(); };
            SetRowHeight(list, 34);

            FlowLayoutPanel bar = new FlowLayoutPanel { Dock = DockStyle.Bottom, Height = 52, Padding = new Padding(12, 10, 12, 0), BackColor = Theme.Bg };
            FlatBtn add = new FlatBtn("Add tool", false), edit = new FlatBtn("Edit", false), reset = new FlatBtn("New tool fitted (reset)", true),
                    runs = new FlatBtn("Log program runs…", false), del = new FlatBtn("Remove", false);
            foreach (FlatBtn b in new[] { reset, runs, add, edit, del }) { b.AutoSize = true; b.Margin = new Padding(0, 0, 8, 0); bar.Controls.Add(b); }
            add.Click += delegate { EditTool(null); };
            edit.Click += delegate { EditSel(); };
            reset.Click += delegate
            {
                ToolRec r = Sel(); if (r == null) return;
                if (MessageBox.Show(this, "Tool T" + r.T + " was changed for a new one?\r\nIts used time goes back to 0.", "New tool", MessageBoxButtons.YesNo) != DialogResult.Yes) return;
                r.UsedMin = 0; r.Fitted = DateTime.Now; ToolLife.Save(tools); Reload();
            };
            del.Click += delegate
            {
                ToolRec r = Sel(); if (r == null) return;
                if (MessageBox.Show(this, "Remove T" + r.T + " from the list?", "Remove", MessageBoxButtons.YesNo) != DialogResult.Yes) return;
                tools.Remove(r); ToolLife.Save(tools); Reload();
            };
            runs.Click += delegate { LogRuns(); };

            Controls.Add(list); Controls.Add(bar); Controls.Add(head);
            Reload();
        }

        static void SetRowHeight(ListView lv, int h) { ImageList il = new ImageList { ImageSize = new Size(1, h) }; lv.SmallImageList = il; }

        void Reload()
        {
            tools = ToolLife.Load();
            list.BeginUpdate(); list.Items.Clear();
            foreach (ToolRec r in tools)
            {
                double pct = ToolLife.LeftPct(r);
                ListViewItem it = new ListViewItem("T" + r.T) { Tag = r };
                it.SubItems.Add(r.Name);
                it.SubItems.Add(pct.ToString("0") + "%");
                it.SubItems.Add(r.UsedMin.ToString("0.0") + " / " + r.LifeMin.ToString("0"));
                it.SubItems.Add(ToolLife.Word(pct));
                list.Items.Add(it);
            }
            list.EndUpdate();
        }

        void DrawCell(object s, DrawListViewSubItemEventArgs e)
        {
            ToolRec r = (ToolRec)e.Item.Tag;
            double pct = ToolLife.LeftPct(r);
            Rectangle b = e.Bounds;
            e.Graphics.FillRectangle(e.Item.Selected ? new SolidBrush(Color.FromArgb(255, 236, 222)) : Brushes.White, b);
            if (e.ColumnIndex == 2)
            {
                Rectangle bg = new Rectangle(b.X + 6, b.Y + 9, b.Width - 60, b.Height - 18);
                e.Graphics.FillRectangle(new SolidBrush(Theme.Line), bg);
                e.Graphics.FillRectangle(new SolidBrush(ToolLife.ColorFor(pct)), new Rectangle(bg.X, bg.Y, (int)(bg.Width * pct / 100), bg.Height));
                TextRenderer.DrawText(e.Graphics, pct.ToString("0") + "%", Theme.UIBold, new Point(bg.Right + 6, b.Y + 8), Color.Black);
                return;
            }
            Color fc = e.ColumnIndex == 4 ? ToolLife.ColorFor(pct) : Color.Black;
            Font f = e.ColumnIndex == 0 || e.ColumnIndex == 4 ? Theme.UIBold : list.Font;
            TextRenderer.DrawText(e.Graphics, e.SubItem.Text, f, new Rectangle(b.X + 6, b.Y, b.Width - 6, b.Height), fc, TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        }

        ToolRec Sel() { return list.SelectedItems.Count == 0 ? null : (ToolRec)list.SelectedItems[0].Tag; }
        void EditSel() { ToolRec r = Sel(); if (r != null) EditTool(r); }

        void EditTool(ToolRec r)
        {
            Form f = new Form { Text = r == null ? "Add tool" : "Edit T" + r.T, ClientSize = new Size(360, 210), FormBorderStyle = FormBorderStyle.FixedDialog, StartPosition = FormStartPosition.CenterParent, MaximizeBox = false, MinimizeBox = false, Font = Theme.UI, BackColor = Color.White };
            NumericUpDown t = new NumericUpDown { Minimum = 1, Maximum = 9999, Value = r == null ? 1 : r.T, Location = new Point(150, 20), Width = 180, Enabled = r == null };
            TextBox n = new TextBox { Text = r == null ? "" : r.Name, Location = new Point(150, 60), Width = 180 };
            NumericUpDown life = new NumericUpDown { Minimum = 1, Maximum = 100000, Value = (decimal)(r == null ? 60 : Math.Max(1, r.LifeMin)), Location = new Point(150, 100), Width = 180 };
            f.Controls.Add(new Label { Text = "Tool number (T)", Location = new Point(16, 23), AutoSize = true });
            f.Controls.Add(new Label { Text = "Name (e.g. 10mm end mill)", Location = new Point(16, 63), Width = 130 });
            f.Controls.Add(new Label { Text = "Life in cutting minutes", Location = new Point(16, 103), Width = 130 });
            FlatBtn ok = new FlatBtn("Save", true) { Location = new Point(150, 150), Width = 100 };
            ok.Click += delegate { f.DialogResult = DialogResult.OK; };
            f.Controls.AddRange(new Control[] { t, n, life, ok });
            f.AcceptButton = ok;
            if (f.ShowDialog(this) != DialogResult.OK) return;
            ToolRec rec = r ?? ToolLife.Get(tools, (int)t.Value, true);
            rec.Name = n.Text.Trim(); rec.LifeMin = (double)life.Value;
            ToolLife.Save(tools); Reload();
        }

        void LogRuns()
        {
            OpenFileDialog d = new OpenFileDialog { Title = "Pick the program that was run", Filter = "NC programs|*.nc;*.txt;*.tap;*.mpf;*.ptp;*.eia;*.*" };
            if (d.ShowDialog(this) != DialogResult.OK) return;
            GProgram g = GProgram.Parse(File.ReadAllText(d.FileName), new CheckLimits());
            if (g.Tools.Count == 0) { MessageBox.Show(this, "No tools (T.. M6) found in this program.", "Tool life"); return; }
            string ask = "How many parts / runs of " + Path.GetFileName(d.FileName) + "?\r\nCutting time per run:\r\n";
            foreach (ToolUse u in g.Tools.Values) ask += "  T" + u.Tool + ": " + GProgram.FmtMin(u.CutMin) + "\r\n";
            Form f = new Form { Text = "Log program runs", ClientSize = new Size(380, 140 + g.Tools.Count * 18), FormBorderStyle = FormBorderStyle.FixedDialog, StartPosition = FormStartPosition.CenterParent, MaximizeBox = false, MinimizeBox = false, Font = Theme.UI, BackColor = Color.White };
            Label l = new Label { Text = ask, Location = new Point(16, 12), Size = new Size(350, 40 + g.Tools.Count * 18) };
            NumericUpDown n = new NumericUpDown { Minimum = 1, Maximum = 100000, Value = 1, Location = new Point(16, f.ClientSize.Height - 44), Width = 120 };
            FlatBtn ok = new FlatBtn("Add", true) { Location = new Point(150, f.ClientSize.Height - 48), Width = 100 };
            ok.Click += delegate { f.DialogResult = DialogResult.OK; };
            f.Controls.AddRange(new Control[] { l, n, ok }); f.AcceptButton = ok;
            if (f.ShowDialog(this) != DialogResult.OK) return;
            tools = ToolLife.Load();
            foreach (ToolUse u in g.Tools.Values) ToolLife.Get(tools, u.Tool, true).UsedMin += u.CutMin * (double)n.Value;
            ToolLife.Save(tools); Reload();
        }
    }

    // ---------- Live machine status window (read only) ----------
    public class LiveForm : Form
    {
        string ip;
        Thread worker;
        volatile bool stop;
        Label state = new Label(), stateSub = new Label();
        Dictionary<string, Label> vals = new Dictionary<string, Label>();
        Panel loadBar = new Panel(), loadFill = new Panel();
        Label toolLife = new Label();
        DateTime runStart = DateTime.MinValue;
        DateTime lastTick = DateTime.MinValue;
        int lastTool;
        double pendingMin;

        public LiveForm(string ip)
        {
            this.ip = ip;
            Text = "Live machine status - " + ip;
            ClientSize = new Size(760, 540); MinimumSize = new Size(640, 500);
            StartPosition = FormStartPosition.CenterParent; BackColor = Theme.Bg; Font = Theme.UI;

            Panel top = new Panel { Dock = DockStyle.Top, Height = 130, BackColor = Theme.Muted, Padding = new Padding(20, 14, 20, 10) };
            state.Dock = DockStyle.Top; state.Height = 62; state.Font = new Font("Segoe UI Semibold", 30f); state.ForeColor = Color.White; state.Text = "CONNECTING…";
            stateSub.Dock = DockStyle.Top; stateSub.Height = 40; stateSub.Font = new Font("Segoe UI", 11f); stateSub.ForeColor = Color.White; stateSub.Text = "Reading the machine on port 683 (read only, nothing is changed).";
            top.Controls.Add(stateSub); top.Controls.Add(state);

            TableLayoutPanel grid = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 2, Padding = new Padding(14), BackColor = Theme.Bg };
            for (int i = 0; i < 3; i++) grid.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 33.3f));
            grid.RowStyles.Add(new RowStyle(SizeType.Percent, 50)); grid.RowStyles.Add(new RowStyle(SizeType.Percent, 50));
            foreach (string k in new[] { "Program", "Tool in spindle", "Parts made", "Running for", "Spindle", "Feed" })
                grid.Controls.Add(Card(k));

            Panel bottom = new Panel { Dock = DockStyle.Bottom, Height = 120, BackColor = Theme.Bg, Padding = new Padding(20, 0, 20, 10) };
            Label ll = new Label { Text = "Spindle load", Dock = DockStyle.Top, Height = 22, Font = Theme.UIBold };
            loadBar.Dock = DockStyle.Top; loadBar.Height = 22; loadBar.BackColor = Theme.Line;
            loadFill.Dock = DockStyle.Left; loadFill.Width = 0; loadFill.BackColor = Theme.Good; loadBar.Controls.Add(loadFill);
            toolLife.Dock = DockStyle.Top; toolLife.Height = 34; toolLife.Font = new Font("Segoe UI Semibold", 11f); toolLife.Padding = new Padding(0, 8, 0, 0);
            FlatBtn tl = new FlatBtn("Tool life…", false) { Dock = DockStyle.Right, Width = 120, Height = 32 };
            tl.Click += delegate { new ToolLifeForm().Show(this); };
            Panel row = new Panel { Dock = DockStyle.Top, Height = 34 };
            row.Controls.Add(toolLife); toolLife.Dock = DockStyle.Fill; row.Controls.Add(tl);
            bottom.Controls.Add(row); bottom.Controls.Add(loadBar); bottom.Controls.Add(ll);

            Controls.Add(grid); Controls.Add(bottom); Controls.Add(top);
            FormClosing += delegate { stop = true; FlushTool(); };
            Shown += delegate { worker = new Thread(Loop) { IsBackground = true }; worker.Start(); };
        }

        Control Card(string title)
        {
            Panel p = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Margin = new Padding(6), Padding = new Padding(14, 10, 10, 6) };
            Label v = new Label { Dock = DockStyle.Fill, Font = new Font("Segoe UI Semibold", 20f), Text = "-", AutoEllipsis = true };
            Label t = new Label { Dock = DockStyle.Top, Height = 24, Text = title, ForeColor = Theme.Muted };
            p.Controls.Add(v); p.Controls.Add(t);
            vals[title] = v;
            return p;
        }

        void Loop()
        {
            IntPtr h = IntPtr.Zero;
            int fails = 0;
            while (!stop)
            {
                VncStatus s = new VncStatus();
                string err = null;
                try
                {
                    if (h == IntPtr.Zero) h = Native.vnc_open(ip, 683);
                    if (h == IntPtr.Zero) err = "Cannot reach the machine on port 683. Is it on and is Mitsubishi NC Explorer able to see it?";
                    else if (Native.vnc_read(h, ref s) != 0 || s.ok != 1)
                    {
                        err = "The machine answered but did not give its status.";
                        Native.vnc_close(h); h = IntPtr.Zero;
                    }
                }
                catch (DllNotFoundException) { err = "m70live.dll is missing. Please reinstall Veyra NC Explorer."; stop = true; }
                catch (BadImageFormatException) { err = "m70live.dll does not match this Windows (needs 64-bit)."; stop = true; }
                catch (Exception ex) { err = ex.Message; if (h != IntPtr.Zero) { try { Native.vnc_close(h); } catch { } h = IntPtr.Zero; } }

                fails = err == null ? 0 : fails + 1;
                VncStatus copy = s; string e2 = err;
                try { if (!IsDisposed) BeginInvoke((MethodInvoker)delegate { Show(copy, e2); }); } catch { }
                for (int i = 0; i < (fails > 3 ? 20 : 4) && !stop; i++) Thread.Sleep(500);
            }
            if (h != IntPtr.Zero) try { Native.vnc_close(h); } catch { }
        }

        void Show(VncStatus s, string err)
        {
            if (IsDisposed) return;
            Panel top = (Panel)state.Parent;
            if (err != null)
            {
                top.BackColor = Theme.Muted; state.Text = "NOT CONNECTED"; stateSub.Text = err;
                runStart = DateTime.MinValue; lastTick = DateTime.MinValue;
                return;
            }
            bool running = s.run == 3 || s.device == 2;
            string word; Color c;
            if (s.run == 1) { word = "EMERGENCY STOP"; c = Theme.Bad; }
            else if (s.alarm == 1) { word = "ALARM"; c = Theme.Bad; }
            else if (s.run == 7) { word = "PAUSED (feed hold)"; c = Color.FromArgb(230, 150, 20); }
            else if (running) { word = "RUNNING"; c = Theme.Good; }
            else { word = "IDLE"; c = Color.FromArgb(70, 110, 170); }
            top.BackColor = c; state.Text = word;
            stateSub.Text = s.alarm == 1 && !string.IsNullOrEmpty(s.alarmText) ? s.alarmText.Trim() : "Updated " + DateTime.Now.ToString("HH:mm:ss") + "   •   read only";

            DateTime now = DateTime.Now;
            if (running && runStart == DateTime.MinValue) runStart = now;
            if (!running && s.run != 7) runStart = DateTime.MinValue;

            // Tool wear: count time when the program runs and the spindle turns.
            int tool = (int)s.tool;
            if (running && s.spindle > 0 && lastTick != DateTime.MinValue && tool == lastTool)
                pendingMin += (now - lastTick).TotalMinutes;
            if (tool != lastTool || pendingMin >= 0.5) FlushTool();
            lastTool = tool; lastTick = now;

            vals["Program"].Text = string.IsNullOrEmpty(s.program) ? "-" : s.program.Trim();
            vals["Tool in spindle"].Text = tool > 0 ? "T" + tool : "-";
            vals["Parts made"].Text = s.counter.ToString();
            vals["Running for"].Text = runStart == DateTime.MinValue ? "-" : Fmt(now - runStart);
            vals["Spindle"].Text = s.spindle + " rpm" + (s.spindleOverride > 0 ? "  " + s.spindleOverride + "%" : "");
            vals["Feed"].Text = s.feed.ToString("0") + " mm/min" + (s.feedOverride > 0 ? "  " + s.feedOverride + "%" : "");

            int load = Math.Max(0, Math.Min(150, s.load));
            loadFill.Width = loadBar.Width * Math.Min(100, load) / 100;
            loadFill.BackColor = load > 100 ? Theme.Bad : load > 80 ? Color.FromArgb(230, 150, 20) : Theme.Good;

            ToolRec r = tool > 0 ? ToolLife.Get(ToolLife.Load(), tool, false) : null;
            if (r == null) { toolLife.Text = tool > 0 ? "T" + tool + ": no tool life set yet. Click Tool life… to add it." : ""; toolLife.ForeColor = Theme.Muted; }
            else
            {
                double pct = ToolLife.LeftPct(r);
                double left = Math.Max(0, r.LifeMin - r.UsedMin - pendingMin);
                toolLife.Text = "T" + tool + (r.Name.Length > 0 ? " (" + r.Name + ")" : "") + ": " + pct.ToString("0") + "% life left, about " + GProgram.FmtMin(left) + " of cutting. " + ToolLife.Word(pct);
                toolLife.ForeColor = ToolLife.ColorFor(pct);
            }
        }

        void FlushTool()
        {
            if (pendingMin > 0 && lastTool > 0) { try { ToolLife.AddMinutes(lastTool, pendingMin); } catch { } }
            pendingMin = 0;
        }

        static string Fmt(TimeSpan t) { return t.TotalHours >= 1 ? ((int)t.TotalHours) + "h " + t.Minutes.ToString("00") + "m" : t.Minutes + "m " + t.Seconds.ToString("00") + "s"; }
    }
}
