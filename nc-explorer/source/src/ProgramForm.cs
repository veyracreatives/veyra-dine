using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows.Forms;

namespace VeyraNC
{
    /// <summary>2D/3D toolpath drawing. Drag = rotate (3D) or pan (2D), right-drag = pan, wheel = zoom.</summary>
    public class ToolpathView : Control
    {
        public GProgram Prog;
        public int HighlightLine = -1;
        public string Mode = "3D"; // Top, Front, Side, 3D
        double yaw = -0.6, pitch = 0.6, zoom = 1, panX, panY;
        Point last; MouseButtons dragBtn;
        static readonly Color[] ToolColors = { Color.FromArgb(242, 106, 33), Color.FromArgb(37, 128, 222), Color.FromArgb(28, 158, 92), Color.FromArgb(160, 80, 200), Color.FromArgb(214, 55, 55), Color.FromArgb(0, 150, 160), Color.FromArgb(200, 150, 0) };

        public ToolpathView()
        {
            DoubleBuffered = true; BackColor = Color.FromArgb(24, 26, 31);
            SetStyle(ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
        }

        public void Fit() { zoom = 1; panX = panY = 0; Invalidate(); }

        void Project(P3 p, out float sx, out float sy)
        {
            double cx = (Prog.MinX + Prog.MaxX) / 2, cy = (Prog.MinY + Prog.MaxY) / 2, cz = (Prog.MinZ + Prog.MaxZ) / 2;
            double x = p.X - cx, y = p.Y - cy, z = p.Z - cz, u, v;
            if (Mode == "Top") { u = x; v = y; }
            else if (Mode == "Front") { u = x; v = z; }
            else if (Mode == "Side") { u = y; v = z; }
            else
            {
                double x1 = x * Math.Cos(yaw) - y * Math.Sin(yaw);
                double y1 = x * Math.Sin(yaw) + y * Math.Cos(yaw);
                u = x1; v = z * Math.Cos(pitch) + y1 * Math.Sin(pitch);
            }
            double span = Math.Max(Math.Max(Prog.MaxX - Prog.MinX, Prog.MaxY - Prog.MinY), Prog.MaxZ - Prog.MinZ);
            if (span < 1e-6) span = 1;
            double k = Math.Min(Width, Height) * 0.8 / span * zoom;
            sx = (float)(Width / 2 + panX + u * k);
            sy = (float)(Height / 2 + panY - v * k);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.Clear(BackColor);
            if (Prog == null || Prog.Segs.Count == 0)
            {
                TextRenderer.DrawText(g, "No toolpath to show", Theme.UI, ClientRectangle, Color.Gray, TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
                return;
            }
            g.SmoothingMode = Prog.Segs.Count < 40000 ? SmoothingMode.AntiAlias : SmoothingMode.None;
            using (Pen rapid = new Pen(Color.FromArgb(110, 120, 130, 145), 1) { DashStyle = DashStyle.Dash })
            {
                Dictionary<int, Pen> pens = new Dictionary<int, Pen>();
                foreach (Seg s in Prog.Segs)
                {
                    float ax, ay, bx, by;
                    Project(s.A, out ax, out ay); Project(s.B, out bx, out by);
                    Pen p;
                    if (s.Rapid) p = rapid;
                    else if (!pens.TryGetValue(s.Tool, out p)) { p = new Pen(ToolColors[Math.Abs(s.Tool) % ToolColors.Length], 1.4f); pens[s.Tool] = p; }
                    g.DrawLine(p, ax, ay, bx, by);
                }
                foreach (Pen p in pens.Values) p.Dispose();
            }
            if (HighlightLine >= 0)
            {
                using (Pen hp = new Pen(Color.White, 3.5f))
                    foreach (Seg s in Prog.Segs)
                        if (s.Line == HighlightLine)
                        {
                            float ax, ay, bx, by;
                            Project(s.A, out ax, out ay); Project(s.B, out bx, out by);
                            g.DrawLine(hp, ax, ay, bx, by);
                            g.FillEllipse(Brushes.Yellow, bx - 5, by - 5, 10, 10);
                        }
            }
            // origin marker and axis triad
            float ox, oy; Project(new P3(0, 0, 0), out ox, out oy);
            g.DrawEllipse(Pens.White, ox - 4, oy - 4, 8, 8);
            DrawAxis(g, ox, oy, new P3(1, 0, 0), "X", Color.FromArgb(230, 80, 80));
            DrawAxis(g, ox, oy, new P3(0, 1, 0), "Y", Color.FromArgb(80, 200, 110));
            DrawAxis(g, ox, oy, new P3(0, 0, 1), "Z", Color.FromArgb(90, 150, 240));
            string hint = Mode == "3D" ? "Drag to turn · Right-drag to move · Wheel to zoom" : "Drag to move · Wheel to zoom";
            TextRenderer.DrawText(g, Mode + " view   " + hint, Theme.Small, new Point(10, Height - 24), Color.FromArgb(150, 156, 168));
        }

        void DrawAxis(Graphics g, float ox, float oy, P3 dir, string label, Color c)
        {
            double span = Math.Max(Math.Max(Prog.MaxX - Prog.MinX, Prog.MaxY - Prog.MinY), Prog.MaxZ - Prog.MinZ);
            double l = Math.Max(span * 0.08, 1e-3);
            float ex, ey; Project(new P3(dir.X * l, dir.Y * l, dir.Z * l), out ex, out ey);
            float zx, zy; Project(new P3(0, 0, 0), out zx, out zy);
            ex = ox + (ex - zx); ey = oy + (ey - zy);
            if (Math.Abs(ex - ox) + Math.Abs(ey - oy) < 2) return;
            using (Pen p = new Pen(c, 2)) g.DrawLine(p, ox, oy, ex, ey);
            using (Brush b = new SolidBrush(c)) g.DrawString(label, Theme.Small, b, ex + 2, ey - 8);
        }

        protected override void OnMouseDown(MouseEventArgs e) { last = e.Location; dragBtn = e.Button; Focus(); }
        protected override void OnMouseUp(MouseEventArgs e) { dragBtn = MouseButtons.None; }
        protected override void OnMouseMove(MouseEventArgs e)
        {
            if (dragBtn == MouseButtons.None) return;
            int dx = e.X - last.X, dy = e.Y - last.Y; last = e.Location;
            if (dragBtn == MouseButtons.Left && Mode == "3D") { yaw += dx * 0.01; pitch = Math.Max(-1.5, Math.Min(1.5, pitch + dy * 0.01)); }
            else { panX += dx; panY += dy; }
            Invalidate();
        }
        protected override void OnMouseWheel(MouseEventArgs e)
        {
            zoom *= e.Delta > 0 ? 1.2 : 1 / 1.2;
            zoom = Math.Max(0.05, Math.Min(200, zoom));
            Invalidate();
        }
    }

    /// <summary>Program window: coloured editor, toolpath, safety check and tool times.</summary>
    public class ProgramForm : Form
    {
        string file; bool editable; bool dirty; bool loading;
        RichTextBox box = new RichTextBox();
        ToolpathView view = new ToolpathView();
        ListView checks = new ListView();
        ListView tools = new ListView();
        Label summary = new Label();
        Label pos = new Label();
        GProgram prog;
        Timer reparse = new Timer { Interval = 700 };
        public static CheckLimits Limits = new CheckLimits();

        public ProgramForm(string file, string title, bool editable)
        {
            this.file = file; this.editable = editable;
            Text = title + (editable ? "" : "  (read-only copy from machine)");
            Size = new Size(1300, 820); StartPosition = FormStartPosition.CenterParent; BackColor = Theme.Bg; Font = Theme.UI;
            KeyPreview = true;

            // Toolbar
            FlowLayoutPanel bar = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 52, Padding = new Padding(10, 8, 10, 6), BackColor = Theme.Bg, WrapContents = false };
            if (editable) { FlatBtn save = new FlatBtn("Save", true) { Width = 90 }; save.Click += delegate { Save(); }; bar.Controls.Add(save); }
            foreach (string m in new[] { "3D", "Top", "Front", "Side" })
            {
                FlatBtn b = new FlatBtn(m, false) { Width = 70, Margin = new Padding(m == "3D" ? 16 : 0, 0, 4, 0) };
                string mm = m; b.Click += delegate { view.Mode = mm; view.Fit(); };
                bar.Controls.Add(b);
            }
            FlatBtn fit = new FlatBtn("Fit", false) { Width = 60 }; fit.Click += delegate { view.Fit(); }; bar.Controls.Add(fit);
            summary.AutoSize = true; summary.Margin = new Padding(16, 9, 0, 0); summary.ForeColor = Theme.Ink; summary.Font = Theme.UIBold;
            bar.Controls.Add(summary);

            // Editor
            box.Font = Theme.Mono; box.WordWrap = false; box.ReadOnly = !editable; box.BackColor = Color.White;
            box.BorderStyle = BorderStyle.None; box.Dock = DockStyle.Fill; box.DetectUrls = false; box.HideSelection = false;
            box.ScrollBars = RichTextBoxScrollBars.Both;
            pos.Dock = DockStyle.Bottom; pos.Height = 22; pos.ForeColor = Theme.Muted; pos.Font = Theme.Small; pos.Padding = new Padding(6, 3, 0, 0);
            Panel left = new Panel { Dock = DockStyle.Fill, Padding = new Padding(10, 0, 5, 10) };
            Panel edWrap = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(6) };
            edWrap.Controls.Add(box); edWrap.Controls.Add(pos);
            left.Controls.Add(edWrap);

            // Right: view on top, tabs below
            view.Dock = DockStyle.Fill;
            TabControl tabs = new TabControl { Dock = DockStyle.Bottom, Height = 230, Font = Theme.UI };
            TabPage tc = new TabPage("Safety check"), tt = new TabPage("Tools and time");
            SetupList(checks, new[] { "", "Line", "What to check" }, new[] { 28, 60, 520 });
            SetupList(tools, new[] { "Tool", "Cutting time", "Cutting length", "Max S", "Max F", "Lowest Z" }, new[] { 70, 110, 120, 80, 80, 90 });
            tc.Controls.Add(checks); tt.Controls.Add(tools);
            tabs.TabPages.Add(tc); tabs.TabPages.Add(tt);
            Panel right = new Panel { Dock = DockStyle.Fill, Padding = new Padding(5, 0, 10, 10) };
            right.Controls.Add(view); right.Controls.Add(tabs);

            TableLayoutPanel split = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 2 };
            split.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 42)); split.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 58));
            split.Controls.Add(left, 0, 0); split.Controls.Add(right, 1, 0);
            Controls.Add(split); Controls.Add(bar);

            string text = File.ReadAllText(file, Encoding.Default).Replace("\r\n", "\n").Replace("\r", "\n");
            loading = true; box.Text = text.Replace("\n", "\r\n"); loading = false;
            Colorize();
            Analyse();

            box.TextChanged += delegate { if (loading) return; dirty = true; reparse.Stop(); reparse.Start(); };
            box.SelectionChanged += delegate { CaretMoved(); };
            reparse.Tick += delegate { reparse.Stop(); Colorize(); Analyse(); };
            checks.DoubleClick += delegate { if (checks.SelectedItems.Count == 1) GoLine((int)checks.SelectedItems[0].Tag); };
            KeyDown += (s, e) => { if (e.Control && e.KeyCode == Keys.S && editable) { Save(); e.SuppressKeyPress = true; } };
            FormClosing += (s, e) =>
            {
                if (editable && dirty)
                {
                    DialogResult r = MessageBox.Show(this, "Save changes?", "Program", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
                    if (r == DialogResult.Cancel) e.Cancel = true; else if (r == DialogResult.Yes) Save();
                }
            };
        }

        static void SetupList(ListView l, string[] cols, int[] widths)
        {
            l.Dock = DockStyle.Fill; l.View = View.Details; l.FullRowSelect = true; l.BorderStyle = BorderStyle.None; l.Font = Theme.UI;
            for (int i = 0; i < cols.Length; i++) l.Columns.Add(cols[i], widths[i]);
        }

        void Analyse()
        {
            prog = GProgram.Parse(box.Text, Limits);
            view.Prog = prog; view.Invalidate();
            int er = prog.Count(Sev.Error), wa = prog.Count(Sev.Warning);
            summary.Text = "Run time ≈ " + GProgram.FmtMin(prog.TotalMin) + "   ·   " + prog.Tools.Count + " tool(s)   ·   " +
                (er > 0 ? er + " problem(s)" : wa > 0 ? wa + " warning(s)" : "Check OK ✓");
            summary.ForeColor = er > 0 ? Theme.Bad : wa > 0 ? Theme.AccentDark : Theme.Good;
            checks.BeginUpdate(); checks.Items.Clear();
            if (prog.Issues.Count == 0) checks.Items.Add(new ListViewItem(new[] { "✓", "", "No problems found." }) { Tag = -1, ForeColor = Theme.Good });
            foreach (Issue i in prog.Issues.OrderBy(x => x.Severity))
            {
                string icon = i.Severity == Sev.Error ? "✖" : i.Severity == Sev.Warning ? "!" : "i";
                ListViewItem it = new ListViewItem(new[] { icon, i.Line >= 0 ? (i.Line + 1).ToString() : "", i.Text }) { Tag = i.Line };
                it.ForeColor = i.Severity == Sev.Error ? Theme.Bad : i.Severity == Sev.Warning ? Theme.AccentDark : Theme.Muted;
                checks.Items.Add(it);
            }
            checks.EndUpdate();
            tools.BeginUpdate(); tools.Items.Clear();
            string unit = prog.Inch ? " in" : " mm";
            foreach (ToolUse t in prog.Tools.Values.OrderBy(x => x.FirstLine))
                tools.Items.Add(new ListViewItem(new[] { t.Tool == 0 ? "(none)" : "T" + t.Tool, GProgram.FmtMin(t.CutMin), (t.CutMm).ToString("0") + " mm", t.MaxS.ToString("0"), t.MaxF.ToString("0"), t.MinZ == double.MaxValue ? "" : t.MinZ.ToString("0.###") + unit }));
            tools.EndUpdate();
        }

        void CaretMoved()
        {
            int line = box.GetLineFromCharIndex(box.SelectionStart);
            pos.Text = "Line " + (line + 1) + " of " + box.Lines.Length + "   ·   Click a line to see it on the drawing";
            if (view.HighlightLine != line) { view.HighlightLine = line; view.Invalidate(); }
        }

        void GoLine(int line)
        {
            if (line < 0) return;
            int idx = box.GetFirstCharIndexFromLine(line);
            if (idx < 0) return;
            box.Focus(); box.Select(idx, 0); box.ScrollToCaret();
        }

        // Colours via RTF: fast enough for large programs.
        void Colorize()
        {
            string text = box.Text;
            if (text.Length > 1500000) return; // very large: skip colours
            StringBuilder rtf = new StringBuilder();
            rtf.Append(@"{\rtf1\ansi\deff0{\fonttbl{\f0 Consolas;}}{\colortbl ;");
            // 1 comment,2 G,3 M,4 T,5 S/F,6 XYZ,7 N,8 other,9 IJKR
            foreach (Color c in new[] { Color.FromArgb(120, 130, 140), Color.FromArgb(37, 99, 205), Color.FromArgb(200, 60, 60), Color.FromArgb(150, 70, 190), Color.FromArgb(0, 140, 120), Color.FromArgb(20, 24, 29), Color.FromArgb(170, 175, 185), Color.FromArgb(90, 95, 105), Color.FromArgb(190, 120, 0) })
                rtf.Append(@"\red" + c.R + @"\green" + c.G + @"\blue" + c.B + ";");
            rtf.Append(@"}\f0\fs21 ");
            int depth = 0; bool semi = false; int cur = -1;
            for (int i = 0; i < text.Length; i++)
            {
                char ch = text[i];
                if (ch == '\n') { semi = false; depth = 0; rtf.Append(@"\par" + "\n"); continue; }
                if (ch == '\r') continue;
                int col;
                if (semi || depth > 0 || ch == '(' || ch == ';')
                {
                    if (ch == '(') depth++;
                    if (ch == ';') semi = true;
                    col = 1;
                    if (ch == ')' && depth > 0) depth--;
                }
                else
                {
                    char u = char.ToUpperInvariant(ch);
                    if (char.IsLetter(u))
                    {
                        col = u == 'G' ? 2 : u == 'M' ? 3 : u == 'T' ? 4 : (u == 'S' || u == 'F') ? 5 : (u == 'X' || u == 'Y' || u == 'Z') ? 6 : u == 'N' || u == 'O' ? 7 : (u == 'I' || u == 'J' || u == 'K' || u == 'R') ? 9 : 8;
                        // colour the number that follows with the same colour
                        int j = i + 1;
                        while (j < text.Length && (char.IsDigit(text[j]) || text[j] == '.' || text[j] == '-' || text[j] == '+')) j++;
                        if (col != cur) { rtf.Append(@"\cf" + col + " "); cur = col; }
                        AppendEsc(rtf, text.Substring(i, j - i));
                        i = j - 1;
                        continue;
                    }
                    col = 8;
                }
                if (col != cur) { rtf.Append(@"\cf" + col + " "); cur = col; }
                AppendEsc(rtf, ch.ToString());
            }
            rtf.Append("}");
            int sel = box.SelectionStart;
            loading = true;
            box.Rtf = rtf.ToString();
            box.SelectionStart = Math.Min(sel, box.TextLength);
            loading = false;
        }

        static void AppendEsc(StringBuilder sb, string s)
        {
            foreach (char c in s)
            {
                if (c == '\\' || c == '{' || c == '}') sb.Append('\\').Append(c);
                else if (c > 126) sb.Append(@"\u" + (int)c + "?");
                else sb.Append(c);
            }
        }

        void Save()
        {
            File.WriteAllText(file, box.Text.Replace("\r\n", "\n").Replace("\n", "\r\n"), Encoding.ASCII);
            dirty = false;
            Text = Text.TrimEnd('*');
        }
    }

    /// <summary>Side-by-side compare with changed lines highlighted.</summary>
    public class DiffForm : Form
    {
        public DiffForm(string leftTitle, string leftText, string rightTitle, string rightText)
        {
            Text = "Compare"; Size = new Size(1200, 760); StartPosition = FormStartPosition.CenterParent; BackColor = Theme.Bg; Font = Theme.UI;
            string[] a = Norm(leftText), b = Norm(rightText);
            List<string[]> rows = Diff(a, b); // [left, right, kind] kind: =, -, +, ~
            int changes = rows.Count(r => r[2] != "=");
            Label head = new Label { Dock = DockStyle.Top, Height = 40, Padding = new Padding(12, 10, 0, 0), Font = Theme.UIBold,
                Text = changes == 0 ? "Same program ✓ (ignoring blank lines and spaces at line ends)" : changes + " line(s) differ. Red = only on the left, green = only on the right.",
                ForeColor = changes == 0 ? Theme.Good : Theme.AccentDark };
            ListView lv = new ListView { Dock = DockStyle.Fill, View = View.Details, FullRowSelect = true, Font = Theme.Mono, BorderStyle = BorderStyle.None };
            lv.Columns.Add("#", 60); lv.Columns.Add(leftTitle, 540); lv.Columns.Add(rightTitle, 540);
            lv.BeginUpdate();
            int n = 0;
            foreach (string[] r in rows)
            {
                n++;
                ListViewItem it = new ListViewItem(new[] { n.ToString(), r[0], r[1] }) { UseItemStyleForSubItems = true };
                if (r[2] == "-") it.BackColor = Color.FromArgb(253, 226, 226);
                else if (r[2] == "+") it.BackColor = Color.FromArgb(220, 245, 228);
                else if (r[2] == "~") it.BackColor = Color.FromArgb(255, 243, 205);
                lv.Items.Add(it);
            }
            lv.EndUpdate();
            Panel wrap = new Panel { Dock = DockStyle.Fill, Padding = new Padding(12, 0, 12, 12) };
            wrap.Controls.Add(lv);
            Controls.Add(wrap); Controls.Add(head);
        }

        static string[] Norm(string t)
        {
            return t.Replace("\r", "").Split('\n').Select(l => l.TrimEnd()).Where(l => l.Length > 0 && l != "%").ToArray();
        }

        static List<string[]> Diff(string[] a, string[] b)
        {
            List<string[]> rows = new List<string[]>();
            if ((long)a.Length * b.Length > 16000000)
            {
                int n = Math.Max(a.Length, b.Length);
                for (int i = 0; i < n; i++)
                {
                    string l = i < a.Length ? a[i] : "", r = i < b.Length ? b[i] : "";
                    rows.Add(new[] { l, r, l == r ? "=" : "~" });
                }
                return rows;
            }
            int[,] L = new int[a.Length + 1, b.Length + 1];
            for (int i = a.Length - 1; i >= 0; i--)
                for (int j = b.Length - 1; j >= 0; j--)
                    L[i, j] = a[i] == b[j] ? L[i + 1, j + 1] + 1 : Math.Max(L[i + 1, j], L[i, j + 1]);
            int x = 0, y = 0;
            while (x < a.Length && y < b.Length)
            {
                if (a[x] == b[y]) { rows.Add(new[] { a[x], b[y], "=" }); x++; y++; }
                else if (L[x + 1, y] >= L[x, y + 1]) { rows.Add(new[] { a[x], "", "-" }); x++; }
                else { rows.Add(new[] { "", b[y], "+" }); y++; }
            }
            while (x < a.Length) rows.Add(new[] { a[x++], "", "-" });
            while (y < b.Length) rows.Add(new[] { "", b[y++], "+" });
            return rows;
        }
    }
}
