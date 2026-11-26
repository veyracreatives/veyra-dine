using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace VeyraNC
{
    public static class Theme
    {
        public static Color Ink = Color.FromArgb(22, 24, 29);
        public static Color Ink2 = Color.FromArgb(38, 41, 48);
        public static Color Accent = Color.FromArgb(242, 106, 33);
        public static Color AccentDark = Color.FromArgb(205, 84, 18);
        public static Color Bg = Color.FromArgb(244, 245, 247);
        public static Color Card = Color.White;
        public static Color Line = Color.FromArgb(223, 226, 231);
        public static Color Muted = Color.FromArgb(108, 114, 126);
        public static Color Good = Color.FromArgb(28, 158, 92);
        public static Color Bad = Color.FromArgb(214, 55, 55);
        public static Font UI = new Font("Segoe UI", 9.75f);
        public static Font UIBold = new Font("Segoe UI Semibold", 10f);
        public static Font Title = new Font("Segoe UI Semibold", 15f);
        public static Font Small = new Font("Segoe UI", 8.75f);
        public static Font Mono = new Font("Consolas", 10.5f);
    }

    public class FlatBtn : Button
    {
        public FlatBtn(string text, bool primary)
        {
            Text = text;
            FlatStyle = FlatStyle.Flat;
            Font = Theme.UIBold;
            Cursor = Cursors.Hand;
            Height = 36;
            Padding = new Padding(10, 0, 10, 0);
            FlatAppearance.BorderSize = primary ? 0 : 1;
            FlatAppearance.BorderColor = Theme.Line;
            BackColor = primary ? Theme.Accent : Color.White;
            ForeColor = primary ? Color.White : Theme.Ink;
            FlatAppearance.MouseOverBackColor = primary ? Theme.AccentDark : Color.FromArgb(240, 241, 244);
            UseVisualStyleBackColor = false;
        }
    }

    public class Pane : Panel
    {
        public Label Heading = new Label();
        public Label PathLabel = new Label();
        public FlatBtn UpBtn = new FlatBtn("↑ Up", false);
        public FlatBtn ExtraBtn;
        public ListView List = new ListView();

        public Pane(string heading, string extra)
        {
            BackColor = Theme.Card;
            Padding = new Padding(1);
            Dock = DockStyle.Fill;
            Margin = new Padding(0);

            Panel top = new Panel { Dock = DockStyle.Top, Height = 76, BackColor = Theme.Card, Padding = new Padding(14, 10, 14, 6) };
            Heading.Text = heading; Heading.Font = Theme.UIBold; Heading.ForeColor = Theme.Ink;
            Heading.AutoSize = false; Heading.Dock = DockStyle.Top; Heading.Height = 24;
            Panel bar = new Panel { Dock = DockStyle.Top, Height = 34, Padding = new Padding(0, 2, 0, 0) };
            UpBtn.Dock = DockStyle.Left; UpBtn.Width = 64; UpBtn.Height = 30;
            PathLabel.Dock = DockStyle.Fill; PathLabel.TextAlign = ContentAlignment.MiddleLeft;
            PathLabel.Font = Theme.UI; PathLabel.ForeColor = Theme.Muted; PathLabel.AutoEllipsis = true;
            PathLabel.Padding = new Padding(8, 0, 0, 0);
            bar.Controls.Add(PathLabel);
            if (extra != null)
            {
                ExtraBtn = new FlatBtn(extra, false) { Dock = DockStyle.Right, Width = 92, Height = 30 };
                bar.Controls.Add(ExtraBtn);
            }
            bar.Controls.Add(UpBtn);
            top.Controls.Add(bar);
            top.Controls.Add(Heading);

            List.Dock = DockStyle.Fill;
            List.View = View.Details;
            List.FullRowSelect = true;
            List.HideSelection = false;
            List.BorderStyle = BorderStyle.None;
            List.Font = Theme.UI;
            List.AllowDrop = true;
            List.Columns.Add("Name", 230);
            List.Columns.Add("Size", 90, HorizontalAlignment.Right);
            List.Columns.Add("Modified", 150);
            Panel sep = new Panel { Dock = DockStyle.Top, Height = 1, BackColor = Theme.Line };

            Controls.Add(List);
            Controls.Add(sep);
            Controls.Add(top);
            Resize += delegate { FitColumns(); };
        }

        public void FitColumns()
        {
            int w = List.ClientSize.Width;
            if (w < 200) return;
            List.Columns[1].Width = 90;
            List.Columns[2].Width = 150;
            List.Columns[0].Width = Math.Max(120, w - 90 - 150 - 4);
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (Pen p = new Pen(Theme.Line)) e.Graphics.DrawRectangle(p, 0, 0, Width - 1, Height - 1);
        }
    }

    public class MainForm : Form
    {
        Settings S = Settings.Load();
        FtpMachine M;
        bool connected;
        bool busy;
        string remoteDir = "/";
        string localDir;
        List<RemoteEntry> remoteItems = new List<RemoteEntry>();

        TextBox ipBox = new TextBox();
        FlatBtn connectBtn = new FlatBtn("Connect", true);
        Label statusDot = new Label();
        Label statusText = new Label();
        Pane machinePane = new Pane("Machine", "Refresh");
        Pane pcPane = new Pane("This PC", "Browse…");
        FlatBtn readBtn = new FlatBtn("Read  →", true);
        FlatBtn writeBtn = new FlatBtn("←  Write", true);
        FlatBtn viewBtn = new FlatBtn("View", false);
        FlatBtn backupsBtn = new FlatBtn("Backups", false);
        FlatBtn netBtn = new FlatBtn("Network check", false);
        FlatBtn settingsBtn = new FlatBtn("Settings", false);
        TextBox logBox = new TextBox();
        ProgressBar progress = new ProgressBar();
        ImageList icons = new ImageList();

        public MainForm()
        {
            Text = "Veyra NC Explorer";
            Font = Theme.UI;
            BackColor = Theme.Bg;
            MinimumSize = new Size(960, 620);
            Size = new Size(1220, 780);
            StartPosition = FormStartPosition.CenterScreen;
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }

            localDir = Directory.Exists(S.LocalFolder) ? S.LocalFolder : Settings.DefaultLocal();
            Directory.CreateDirectory(localDir);

            BuildIcons();
            BuildUi();
            WireEvents();
            RefreshLocal();
            SetConnected(false, "Not connected");
            Log("Ready. Machine IP " + S.Host + ". Nothing is sent to the network until you press Connect.");
        }

        void BuildIcons()
        {
            icons.ColorDepth = ColorDepth.Depth32Bit;
            icons.ImageSize = new Size(18, 18);
            Bitmap folder = new Bitmap(18, 18);
            using (Graphics g = Graphics.FromImage(folder))
            {
                g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
                using (Brush b = new SolidBrush(Color.FromArgb(246, 190, 70))) { g.FillRectangle(b, 1, 3, 7, 3); g.FillRectangle(b, 1, 5, 16, 11); }
            }
            Bitmap file = new Bitmap(18, 18);
            using (Graphics g = Graphics.FromImage(file))
            {
                using (Brush b = new SolidBrush(Color.White)) g.FillRectangle(b, 3, 1, 12, 16);
                using (Pen p = new Pen(Color.FromArgb(150, 156, 168))) g.DrawRectangle(p, 3, 1, 12, 16);
                using (Pen p = new Pen(Theme.Accent, 2)) { g.DrawLine(p, 6, 6, 12, 6); g.DrawLine(p, 6, 10, 12, 10); g.DrawLine(p, 6, 14, 10, 14); }
            }
            icons.Images.Add("folder", folder);
            icons.Images.Add("file", file);
            machinePane.List.SmallImageList = icons;
            pcPane.List.SmallImageList = icons;
        }

        void BuildUi()
        {
            // Header
            Panel header = new Panel { Dock = DockStyle.Top, Height = 72, BackColor = Theme.Ink, Padding = new Padding(20, 0, 20, 0) };
            Label title = new Label { Text = "NC Explorer", Font = Theme.Title, ForeColor = Color.White, AutoSize = true, Location = new Point(20, 11) };
            Label sub = new Label { Text = "Mitsubishi M80  ·  read and write programs", Font = Theme.Small, ForeColor = Color.FromArgb(170, 176, 188), AutoSize = true, Location = new Point(22, 43) };
            Panel accent = new Panel { Dock = DockStyle.Bottom, Height = 3, BackColor = Theme.Accent };

            FlowLayoutPanel right = new FlowLayoutPanel { Dock = DockStyle.Right, Width = 560, FlowDirection = FlowDirection.LeftToRight, WrapContents = false, Padding = new Padding(0, 18, 0, 0), BackColor = Theme.Ink };
            Label ipLbl = new Label { Text = "Machine IP", ForeColor = Color.FromArgb(170, 176, 188), AutoSize = true, Margin = new Padding(0, 9, 8, 0) };
            ipBox.Text = S.Host; ipBox.Width = 140; ipBox.Font = new Font("Segoe UI", 11f); ipBox.Margin = new Padding(0, 4, 10, 0);
            ipBox.BorderStyle = BorderStyle.FixedSingle;
            connectBtn.Width = 120; connectBtn.Margin = new Padding(0, 1, 16, 0);
            statusDot.Size = new Size(12, 12); statusDot.Margin = new Padding(0, 12, 6, 0);
            statusText.AutoSize = true; statusText.ForeColor = Color.White; statusText.Margin = new Padding(0, 9, 0, 0);
            right.Controls.AddRange(new Control[] { ipLbl, ipBox, connectBtn, statusDot, statusText });
            header.Controls.Add(right);
            header.Controls.Add(title);
            header.Controls.Add(sub);
            header.Controls.Add(accent);

            // Middle action column
            FlowLayoutPanel mid = new FlowLayoutPanel { Dock = DockStyle.Fill, FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(10, 90, 10, 0), BackColor = Theme.Bg };
            foreach (FlatBtn b in new FlatBtn[] { readBtn, writeBtn, viewBtn })
            {
                b.Width = 128; b.Height = 40; b.Margin = new Padding(0, 0, 0, 10);
                mid.Controls.Add(b);
            }
            Label hint = new Label { Text = "Select files, then press Read or Write. You can also drag and drop.", Width = 128, Height = 70, ForeColor = Theme.Muted, Font = Theme.Small, Margin = new Padding(0, 6, 0, 0) };
            mid.Controls.Add(hint);

            TableLayoutPanel body = new TableLayoutPanel { Dock = DockStyle.Fill, ColumnCount = 3, RowCount = 1, Padding = new Padding(16, 16, 16, 8), BackColor = Theme.Bg };
            body.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            body.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150));
            body.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
            body.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
            body.Controls.Add(machinePane, 0, 0);
            body.Controls.Add(mid, 1, 0);
            body.Controls.Add(pcPane, 2, 0);

            // Bottom: tools + log
            Panel bottom = new Panel { Dock = DockStyle.Bottom, Height = 190, BackColor = Theme.Bg, Padding = new Padding(16, 0, 16, 12) };
            FlowLayoutPanel tools = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 46, BackColor = Theme.Bg, Padding = new Padding(0, 2, 0, 0) };
            foreach (FlatBtn b in new FlatBtn[] { backupsBtn, netBtn, settingsBtn }) { b.AutoSize = true; b.Margin = new Padding(0, 0, 8, 0); tools.Controls.Add(b); }
            progress.Width = 260; progress.Height = 10; progress.Margin = new Padding(16, 14, 0, 0); progress.Style = ProgressBarStyle.Continuous; progress.Visible = false;
            tools.Controls.Add(progress);
            logBox.Multiline = true; logBox.ReadOnly = true; logBox.ScrollBars = ScrollBars.Vertical;
            logBox.Dock = DockStyle.Fill; logBox.BackColor = Color.White; logBox.Font = new Font("Consolas", 9f);
            logBox.BorderStyle = BorderStyle.FixedSingle; logBox.ForeColor = Theme.Ink2;
            bottom.Controls.Add(logBox);
            bottom.Controls.Add(tools);

            Controls.Add(body);
            Controls.Add(bottom);
            Controls.Add(header);
        }

        void WireEvents()
        {
            connectBtn.Click += delegate { if (connected) Disconnect(); else Connect(); };
            ipBox.KeyDown += (s, e) => { if (e.KeyCode == Keys.Enter) { e.SuppressKeyPress = true; Connect(); } };
            machinePane.UpBtn.Click += delegate { if (connected && remoteDir != "/") ListRemote(FtpMachine.Parent(remoteDir)); };
            machinePane.ExtraBtn.Click += delegate { if (connected) ListRemote(remoteDir); };
            machinePane.List.DoubleClick += delegate { OpenRemoteSelection(); };
            machinePane.List.KeyDown += (s, e) => { if (e.KeyCode == Keys.Enter) OpenRemoteSelection(); if (e.KeyCode == Keys.Back) machinePane.UpBtn.PerformClick(); if (e.KeyCode == Keys.F5) machinePane.ExtraBtn.PerformClick(); };
            pcPane.UpBtn.Click += delegate { DirectoryInfo p = Directory.GetParent(localDir); if (p != null) { localDir = p.FullName; RefreshLocal(); } };
            pcPane.ExtraBtn.Click += delegate { BrowseLocal(); };
            pcPane.List.DoubleClick += delegate { OpenLocalSelection(); };
            pcPane.List.KeyDown += (s, e) => { if (e.KeyCode == Keys.Enter) OpenLocalSelection(); if (e.KeyCode == Keys.Back) pcPane.UpBtn.PerformClick(); if (e.KeyCode == Keys.F5) RefreshLocal(); };
            readBtn.Click += delegate { ReadSelected(); };
            writeBtn.Click += delegate { WriteSelected(null); };
            viewBtn.Click += delegate { ViewSelected(); };
            backupsBtn.Click += delegate { Directory.CreateDirectory(BackupRoot()); Process.Start("explorer.exe", "\"" + BackupRoot() + "\""); };
            netBtn.Click += delegate { RunNetCheck(true); };
            settingsBtn.Click += delegate { ShowSettings(); };

            // Drag and drop
            machinePane.List.ItemDrag += (s, e) => { if (connected && !busy) machinePane.List.DoDragDrop("veyra:machine", DragDropEffects.Copy); };
            pcPane.List.ItemDrag += (s, e) =>
            {
                List<string> files = SelectedLocalFiles();
                if (files.Count > 0) pcPane.List.DoDragDrop(new DataObject(DataFormats.FileDrop, files.ToArray()), DragDropEffects.Copy);
            };
            machinePane.List.DragEnter += (s, e) => { e.Effect = e.Data.GetDataPresent(DataFormats.FileDrop) && connected ? DragDropEffects.Copy : DragDropEffects.None; };
            machinePane.List.DragDrop += (s, e) =>
            {
                string[] files = e.Data.GetData(DataFormats.FileDrop) as string[];
                if (files != null) WriteSelected(files.Where(File.Exists).ToList());
            };
            pcPane.List.DragEnter += (s, e) => { e.Effect = (e.Data.GetDataPresent(DataFormats.StringFormat) && (e.Data.GetData(DataFormats.StringFormat) as string) == "veyra:machine") ? DragDropEffects.Copy : DragDropEffects.None; };
            pcPane.List.DragDrop += (s, e) => ReadSelected();
            FormClosing += delegate { S.Host = ipBox.Text.Trim(); S.LocalFolder = localDir; S.Save(); };
        }

        // ---------- helpers ----------
        void Log(string msg)
        {
            if (InvokeRequired) { BeginInvoke(new Action<string>(Log), msg); return; }
            logBox.AppendText(DateTime.Now.ToString("HH:mm:ss") + "  " + msg + Environment.NewLine);
            try { File.AppendAllText(Path.Combine(Settings.Dir(), "log.txt"), DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + msg + Environment.NewLine); } catch { }
        }

        void SetConnected(bool on, string text)
        {
            connected = on;
            statusDot.BackColor = on ? Theme.Good : Color.FromArgb(120, 126, 138);
            statusText.Text = text;
            connectBtn.Text = on ? "Disconnect" : "Connect";
            machinePane.Heading.Text = on ? "Machine  ·  " + M.Host : "Machine";
            if (!on) { machinePane.List.Items.Clear(); machinePane.PathLabel.Text = "Press Connect to see the machine's files"; }
            UpdateButtons();
        }

        void SetBusy(bool b, string what)
        {
            busy = b;
            progress.Visible = b;
            progress.Style = b ? ProgressBarStyle.Marquee : ProgressBarStyle.Continuous;
            UseWaitCursor = b;
            if (b && what != null) statusText.Text = what;
            else if (!b && connected) statusText.Text = "Connected";
            UpdateButtons();
        }

        void UpdateButtons()
        {
            readBtn.Enabled = connected && !busy;
            writeBtn.Enabled = connected && !busy;
            connectBtn.Enabled = !busy;
            machinePane.UpBtn.Enabled = connected && !busy;
            machinePane.ExtraBtn.Enabled = connected && !busy;
        }

        void Run(string what, Action work, Action done)
        {
            SetBusy(true, what);
            Task.Factory.StartNew(work).ContinueWith(t =>
            {
                SetBusy(false, null);
                if (t.Exception != null)
                {
                    Exception ex = t.Exception.GetBaseException();
                    Log("Error: " + FtpMachine.Describe(ex));
                    MessageBox.Show(this, FtpMachine.Describe(ex), "NC Explorer", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
                if (done != null) done();
            }, TaskScheduler.FromCurrentSynchronizationContext());
        }

        static string FmtSize(long n)
        {
            if (n < 0) return "";
            if (n < 1024) return n + " B";
            if (n < 1024 * 1024) return (n / 1024.0).ToString("0.0") + " KB";
            return (n / 1048576.0).ToString("0.0") + " MB";
        }

        string BackupRoot() { return S.BackupFolder(); }

        // ---------- connection ----------
        void Connect()
        {
            if (busy) return;
            string ip = ipBox.Text.Trim();
            if (ip.Length == 0) return;
            S.Host = ip; S.Save();
            M = new FtpMachine { Host = ip, Port = S.Port, User = S.User, Password = S.Password, Passive = S.Passive, Log = Log };
            string detail = null; bool ok = false; List<RemoteEntry> root = null; string start = "/";
            Log("Connecting to " + ip + "…");
            Run("Connecting…", delegate
            {
                bool problem;
                foreach (string n in NetCheck.Check(ip, out problem)) Log("Network: " + n);
                string why;
                if (!M.Reachable(out why)) { detail = why; return; }
                ok = M.AutoLogin(out detail);
                if (!ok) return;
                // Remember the login that worked.
                S.User = M.User; S.Password = M.Password; S.Save();
                start = string.IsNullOrEmpty(S.LastRemoteDir) ? "/" : S.LastRemoteDir;
                try { root = M.List(start); }
                catch { start = "/"; root = M.List("/"); }
            }, delegate
            {
                if (!ok)
                {
                    SetConnected(false, "Not connected");
                    Log("Could not connect: " + detail);
                    MessageBox.Show(this, "Could not connect to the machine.\n\n" + detail +
                        "\n\nTips:\n• Check the network cable and that the machine is on.\n• Press \"Network check\" below.\n• If the machine needs a login, enter it in Settings.",
                        "NC Explorer", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    return;
                }
                SetConnected(true, "Connected");
                Log(detail + ".");
                ShowRemote(start, root);
            });
        }

        public void AutoConnect() { Connect(); }

        void Disconnect()
        {
            SetConnected(false, "Not connected");
            Log("Disconnected. No more traffic to the machine.");
        }

        // ---------- machine side ----------
        void ListRemote(string dir)
        {
            List<RemoteEntry> items = null;
            Run("Loading…", delegate { items = M.List(dir); }, delegate { if (items != null) ShowRemote(dir, items); });
        }

        void ShowRemote(string dir, List<RemoteEntry> items)
        {
            remoteDir = dir;
            remoteItems = items;
            S.LastRemoteDir = dir; S.Save();
            machinePane.PathLabel.Text = dir;
            ListView lv = machinePane.List;
            lv.BeginUpdate();
            lv.Items.Clear();
            foreach (RemoteEntry e in items)
            {
                ListViewItem it = new ListViewItem(e.Name, e.IsFolder ? "folder" : "file");
                it.SubItems.Add(e.IsFolder ? "" : FmtSize(e.Size));
                it.SubItems.Add(e.Modified.HasValue ? e.Modified.Value.ToString("dd-MM-yyyy HH:mm") : "");
                it.Tag = e;
                lv.Items.Add(it);
            }
            lv.EndUpdate();
            machinePane.FitColumns();
            if (items.Count == 0) Log("Folder " + dir + " is empty.");
        }

        List<RemoteEntry> SelectedRemote()
        {
            List<RemoteEntry> l = new List<RemoteEntry>();
            foreach (ListViewItem it in machinePane.List.SelectedItems) l.Add((RemoteEntry)it.Tag);
            return l;
        }

        void OpenRemoteSelection()
        {
            if (!connected || busy) return;
            List<RemoteEntry> sel = SelectedRemote();
            if (sel.Count != 1) return;
            RemoteEntry e = sel[0];
            string path = FtpMachine.Join(remoteDir, e.Name);
            if (e.IsFolder) { ListRemote(path); return; }
            if (e.Size < 0)
            {
                // Listing style unknown: try it as a folder first.
                List<RemoteEntry> items = null;
                Run("Opening…", delegate { try { items = M.List(path); } catch { items = null; } }, delegate
                {
                    if (items != null && items.Count > 0) ShowRemote(path, items); else ViewRemote(e);
                });
                return;
            }
            ViewRemote(e);
        }

        void ViewRemote(RemoteEntry e)
        {
            string cache = Path.Combine(Path.GetTempPath(), "VeyraNC");
            Directory.CreateDirectory(cache);
            string tmp = Path.Combine(cache, e.Name);
            string path = FtpMachine.Join(remoteDir, e.Name);
            Run("Opening " + e.Name + "…", delegate { M.Download(path, tmp); }, delegate
            {
                if (File.Exists(tmp)) new ViewerForm(tmp, "Machine: " + path, false).Show(this);
            });
        }

        // ---------- PC side ----------
        void RefreshLocal()
        {
            pcPane.PathLabel.Text = localDir;
            ListView lv = pcPane.List;
            lv.BeginUpdate();
            lv.Items.Clear();
            try
            {
                foreach (string d in Directory.GetDirectories(localDir).OrderBy(x => x, StringComparer.OrdinalIgnoreCase))
                {
                    DirectoryInfo di = new DirectoryInfo(d);
                    if ((di.Attributes & FileAttributes.Hidden) != 0) continue;
                    ListViewItem it = new ListViewItem(di.Name, "folder");
                    it.SubItems.Add(""); it.SubItems.Add(di.LastWriteTime.ToString("dd-MM-yyyy HH:mm"));
                    it.Tag = d; lv.Items.Add(it);
                }
                foreach (string f in Directory.GetFiles(localDir).OrderBy(x => x, StringComparer.OrdinalIgnoreCase))
                {
                    FileInfo fi = new FileInfo(f);
                    if ((fi.Attributes & FileAttributes.Hidden) != 0 || fi.Name.EndsWith(".part")) continue;
                    ListViewItem it = new ListViewItem(fi.Name, "file");
                    it.SubItems.Add(FmtSize(fi.Length)); it.SubItems.Add(fi.LastWriteTime.ToString("dd-MM-yyyy HH:mm"));
                    it.Tag = f; lv.Items.Add(it);
                }
            }
            catch (Exception ex) { Log("Cannot open " + localDir + ": " + ex.Message); }
            lv.EndUpdate();
            pcPane.FitColumns();
        }

        void BrowseLocal()
        {
            using (FolderBrowserDialog d = new FolderBrowserDialog { SelectedPath = localDir, Description = "Choose the folder on this PC for NC programs" })
                if (d.ShowDialog(this) == DialogResult.OK) { localDir = d.SelectedPath; S.LocalFolder = localDir; S.Save(); RefreshLocal(); }
        }

        List<string> SelectedLocalFiles()
        {
            List<string> l = new List<string>();
            foreach (ListViewItem it in pcPane.List.SelectedItems) if (File.Exists((string)it.Tag)) l.Add((string)it.Tag);
            return l;
        }

        void OpenLocalSelection()
        {
            if (pcPane.List.SelectedItems.Count != 1) return;
            string p = (string)pcPane.List.SelectedItems[0].Tag;
            if (Directory.Exists(p)) { localDir = p; RefreshLocal(); }
            else if (File.Exists(p)) new ViewerForm(p, "This PC: " + p, true).Show(this);
        }

        void ViewSelected()
        {
            if (pcPane.List.Focused || machinePane.List.SelectedItems.Count == 0) { if (pcPane.List.SelectedItems.Count > 0) { OpenLocalSelection(); return; } }
            if (machinePane.List.SelectedItems.Count == 1 && connected && !busy)
            {
                RemoteEntry e = (RemoteEntry)machinePane.List.SelectedItems[0].Tag;
                if (!e.IsFolder) ViewRemote(e);
            }
        }

        // ---------- Read: machine -> PC ----------
        void ReadSelected()
        {
            if (!connected || busy) return;
            List<RemoteEntry> sel = SelectedRemote().Where(x => !x.IsFolder).ToList();
            if (sel.Count == 0) { MessageBox.Show(this, "Select one or more programs on the Machine side first.", "Read", MessageBoxButtons.OK, MessageBoxIcon.Information); return; }
            string dir = remoteDir, target = localDir;
            string stamp = DateTime.Now.ToString("yyyy-MM-dd_HHmmss");
            int ok = 0;
            Run("Reading " + sel.Count + " file(s)…", delegate
            {
                foreach (RemoteEntry e in sel)
                {
                    string local = Path.Combine(target, e.Name);
                    if (File.Exists(local))
                    {
                        string bdir = Path.Combine(S.BackupFolder(), "PC", stamp);
                        Directory.CreateDirectory(bdir);
                        File.Copy(local, Path.Combine(bdir, e.Name), true);
                        Log("Kept old PC copy of " + e.Name + " in Backups\\PC\\" + stamp);
                    }
                    M.Download(FtpMachine.Join(dir, e.Name), local);
                    ok++;
                    Log("Read " + e.Name + " → " + local);
                }
            }, delegate
            {
                RefreshLocal();
                if (ok > 0) Log("Read finished: " + ok + " file(s).");
            });
        }

        // ---------- Write: PC -> machine (always backs up first) ----------
        void WriteSelected(List<string> files)
        {
            if (!connected || busy) return;
            if (files == null) files = SelectedLocalFiles();
            if (files.Count == 0) { MessageBox.Show(this, "Select one or more programs on the This PC side first.", "Write", MessageBoxButtons.OK, MessageBoxIcon.Information); return; }

            string dir = remoteDir;
            HashSet<string> existing = new HashSet<string>(remoteItems.Where(x => !x.IsFolder).Select(x => x.Name), StringComparer.OrdinalIgnoreCase);
            List<string[]> plan = new List<string[]>(); // local, ncName
            List<string> replacing = new List<string>();
            List<string> renamed = new List<string>();
            foreach (string f in files)
            {
                string n = NcName.Fix(Path.GetFileName(f));
                if (n != Path.GetFileName(f)) renamed.Add(Path.GetFileName(f) + "  →  " + n);
                if (existing.Contains(n)) replacing.Add(n);
                plan.Add(new string[] { f, n });
            }

            string msg = "Write " + plan.Count + " file(s) to the machine folder " + dir + "?";
            if (renamed.Count > 0) msg += "\n\nThe machine only accepts capital letters, no spaces. These will be renamed:\n  " + string.Join("\n  ", renamed.Take(8));
            if (replacing.Count > 0) msg += "\n\nThese already exist on the machine and will be REPLACED:\n  " + string.Join("\n  ", replacing.Take(8)) +
                "\n\nThe machine's current copy is saved to Backups on this PC first. If that backup fails, nothing is replaced.";
            msg += "\n\nDo not write a program that is running or open in Edit on the machine.";
            if (MessageBox.Show(this, msg, "Write to machine", MessageBoxButtons.OKCancel, replacing.Count > 0 ? MessageBoxIcon.Warning : MessageBoxIcon.Question) != DialogResult.OK) return;

            string stamp = DateTime.Now.ToString("yyyy-MM-dd_HHmmss");
            int ok = 0;
            List<string> problems = new List<string>();
            Run("Writing " + plan.Count + " file(s)…", delegate
            {
                foreach (string[] p in plan)
                {
                    string remote = FtpMachine.Join(dir, p[1]);
                    try
                    {
                        if (existing.Contains(p[1]))
                        {
                            string bdir = Path.Combine(S.BackupFolder(), "Machine", stamp + "_" + dir.Trim('/').Replace('/', '_'));
                            Directory.CreateDirectory(bdir);
                            string bfile = Path.Combine(bdir, p[1]);
                            M.Download(remote, bfile);
                            if (!File.Exists(bfile)) throw new Exception("backup was not saved, so the machine copy was left alone");
                            Log("Backed up machine copy of " + p[1] + " → " + bfile);
                        }
                        M.Upload(p[0], remote);
                        // Verify: read it back and compare.
                        string check = Path.Combine(Path.GetTempPath(), "VeyraNC_verify_" + Guid.NewGuid().ToString("N"));
                        M.Download(remote, check);
                        bool same = Normalise(File.ReadAllBytes(check)) == Normalise(File.ReadAllBytes(p[0]));
                        File.Delete(check);
                        if (same) Log("Wrote " + p[1] + " to " + dir + " (checked, matches PC copy).");
                        else { Log("Wrote " + p[1] + " but the machine copy differs from the PC copy. Please check it on the machine."); problems.Add(p[1] + ": machine copy differs, please check"); }
                        ok++;
                    }
                    catch (Exception ex)
                    {
                        string d = FtpMachine.Describe(ex);
                        Log("Write " + p[1] + " failed: " + d);
                        problems.Add(p[1] + ": " + d);
                    }
                }
            }, delegate
            {
                ListRemote(dir);
                Log("Write finished: " + ok + " of " + plan.Count + " file(s).");
                if (problems.Count > 0)
                    MessageBox.Show(this, "Some files need attention:\n\n" + string.Join("\n", problems) +
                        "\n\nCommon causes: the program is running or open in Edit, edit lock or data protection key is on, or the memory is full.",
                        "Write to machine", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            });
        }

        static string Normalise(byte[] b)
        {
            // The control may change line endings or trailing blanks/'%'; compare the meaningful text only.
            string s = System.Text.Encoding.ASCII.GetString(b).Replace("\r", "");
            s = string.Join("\n", s.Split('\n').Select(l => l.TrimEnd()).Where(l => l.Length > 0 && l != "%"));
            return s;
        }

        // ---------- tools ----------
        void RunNetCheck(bool show)
        {
            bool problem;
            List<string> notes = NetCheck.Check(ipBox.Text.Trim(), out problem);
            foreach (string n in notes) Log("Network: " + n);
            if (show)
                MessageBox.Show(this, string.Join("\n\n", notes) + (problem ? "" : "\n\nLooks good: the machine cable does not carry your internet traffic."),
                    "Network check", MessageBoxButtons.OK, problem ? MessageBoxIcon.Warning : MessageBoxIcon.Information);
        }

        void ShowSettings()
        {
            using (SettingsForm f = new SettingsForm(S))
                if (f.ShowDialog(this) == DialogResult.OK)
                {
                    S.Save();
                    ipBox.Text = S.Host;
                    Log("Settings saved.");
                    if (connected) Disconnect();
                }
        }
    }

    public class ViewerForm : Form
    {
        string file; bool editable; TextBox box = new TextBox(); bool dirty;
        public ViewerForm(string file, string title, bool editable)
        {
            this.file = file; this.editable = editable;
            Text = title + (editable ? "" : "  (read-only copy)");
            Size = new Size(900, 700); StartPosition = FormStartPosition.CenterParent; BackColor = Theme.Bg;
            box.Multiline = true; box.ScrollBars = ScrollBars.Both; box.WordWrap = false; box.Dock = DockStyle.Fill;
            box.Font = Theme.Mono; box.BorderStyle = BorderStyle.None; box.ReadOnly = !editable; box.BackColor = Color.White;
            string text = File.ReadAllText(file, System.Text.Encoding.Default);
            box.Text = text.Replace("\r\n", "\n").Replace("\n", "\r\n");
            box.TextChanged += delegate { dirty = true; };
            Panel bar = new Panel { Dock = DockStyle.Top, Height = 50, Padding = new Padding(12, 8, 12, 8), BackColor = Theme.Bg };
            Label info = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft, ForeColor = Theme.Muted,
                Text = box.Lines.Length + " lines  ·  " + new FileInfo(file).Length + " bytes" + (editable ? "" : "  ·  To change it, Read it to the PC, edit, then Write.") };
            bar.Controls.Add(info);
            if (editable)
            {
                FlatBtn save = new FlatBtn("Save", true) { Dock = DockStyle.Right, Width = 100 };
                save.Click += delegate { Save(); };
                bar.Controls.Add(save);
            }
            Panel wrap = new Panel { Dock = DockStyle.Fill, Padding = new Padding(12, 0, 12, 12), BackColor = Theme.Bg };
            wrap.Controls.Add(box);
            Controls.Add(wrap); Controls.Add(bar);
            KeyPreview = true;
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
        void Save()
        {
            File.WriteAllText(file, box.Text, System.Text.Encoding.ASCII);
            dirty = false;
        }
    }

    public class SettingsForm : Form
    {
        public SettingsForm(Settings s)
        {
            Text = "Settings"; FormBorderStyle = FormBorderStyle.FixedDialog; MaximizeBox = false; MinimizeBox = false;
            StartPosition = FormStartPosition.CenterParent; ClientSize = new Size(440, 330); BackColor = Color.White; Font = Theme.UI;
            TableLayoutPanel t = new TableLayoutPanel { Dock = DockStyle.Top, Height = 250, ColumnCount = 2, Padding = new Padding(18) };
            t.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150)); t.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
            TextBox host = new TextBox { Text = s.Host, Dock = DockStyle.Fill };
            NumericUpDown port = new NumericUpDown { Minimum = 1, Maximum = 65535, Value = s.Port, Dock = DockStyle.Fill };
            TextBox user = new TextBox { Text = s.User, Dock = DockStyle.Fill };
            TextBox pass = new TextBox { Text = s.Password, Dock = DockStyle.Fill, UseSystemPasswordChar = true };
            CheckBox pasv = new CheckBox { Text = "Passive mode (leave on)", Checked = s.Passive, Dock = DockStyle.Fill };
            Label note = new Label { Text = "Leave user and password empty to try the usual Mitsubishi logins automatically.", ForeColor = Theme.Muted, Dock = DockStyle.Fill, Height = 40 };
            AddRow(t, "Machine IP", host); AddRow(t, "Port", port); AddRow(t, "User", user); AddRow(t, "Password", pass); AddRow(t, "", pasv);
            t.Controls.Add(note, 0, 5); t.SetColumnSpan(note, 2);
            FlatBtn ok = new FlatBtn("Save", true) { Width = 100, Location = new Point(220, 274) };
            FlatBtn cancel = new FlatBtn("Cancel", false) { Width = 100, Location = new Point(326, 274) };
            ok.Click += delegate { s.Host = host.Text.Trim(); s.Port = (int)port.Value; s.User = user.Text; s.Password = pass.Text; s.Passive = pasv.Checked; DialogResult = DialogResult.OK; };
            cancel.Click += delegate { DialogResult = DialogResult.Cancel; };
            Controls.Add(t); Controls.Add(ok); Controls.Add(cancel);
            AcceptButton = ok; CancelButton = cancel;
        }
        static void AddRow(TableLayoutPanel t, string label, Control c)
        {
            int r = t.RowCount++;
            t.RowStyles.Add(new RowStyle(SizeType.Absolute, 36));
            t.Controls.Add(new Label { Text = label, TextAlign = ContentAlignment.MiddleLeft, Dock = DockStyle.Fill }, 0, r);
            t.Controls.Add(c, 1, r);
        }
    }

    public class Settings
    {
        public string Host = "192.168.200.1";
        public int Port = 21;
        public string User = "";
        public string Password = "";
        public bool Passive = true;
        public string LocalFolder = "";
        public string LastRemoteDir = "";

        public static string Dir()
        {
            string d = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Veyra NC Explorer");
            Directory.CreateDirectory(d);
            return d;
        }
        public static string DefaultLocal()
        {
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "NC Programs");
        }
        public string BackupFolder()
        {
            return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "NC Programs Backups");
        }
        static string File_() { return Path.Combine(Dir(), "settings.txt"); }

        public static Settings Load()
        {
            Settings s = new Settings();
            try
            {
                if (File.Exists(File_()))
                    foreach (string line in File.ReadAllLines(File_()))
                    {
                        int i = line.IndexOf('='); if (i < 0) continue;
                        string k = line.Substring(0, i), v = line.Substring(i + 1);
                        switch (k)
                        {
                            case "host": s.Host = v; break;
                            case "port": int p; if (int.TryParse(v, out p)) s.Port = p; break;
                            case "user": s.User = v; break;
                            case "pass": s.Password = Unprotect(v); break;
                            case "passive": s.Passive = v != "0"; break;
                            case "local": s.LocalFolder = v; break;
                            case "remote": s.LastRemoteDir = v; break;
                        }
                    }
            }
            catch { }
            return s;
        }
        public void Save()
        {
            try
            {
                File.WriteAllLines(File_(), new string[] {
                    "host=" + Host, "port=" + Port, "user=" + User, "pass=" + Protect(Password),
                    "passive=" + (Passive ? "1" : "0"), "local=" + LocalFolder, "remote=" + LastRemoteDir });
            }
            catch { }
        }
        static string Protect(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            try { return Convert.ToBase64String(System.Security.Cryptography.ProtectedData.Protect(System.Text.Encoding.UTF8.GetBytes(s), null, System.Security.Cryptography.DataProtectionScope.CurrentUser)); }
            catch { return ""; }
        }
        static string Unprotect(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            try { return System.Text.Encoding.UTF8.GetString(System.Security.Cryptography.ProtectedData.Unprotect(Convert.FromBase64String(s), null, System.Security.Cryptography.DataProtectionScope.CurrentUser)); }
            catch { return ""; }
        }
    }

    static class Program
    {
        [STAThread]
        static int Main(string[] args)
        {
            if (args.Length > 0 && args[0] == "--diag") return Diag.Run(args);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            MainForm f = new MainForm();
            if (Array.IndexOf(args, "--connect") >= 0) f.Shown += delegate { f.AutoConnect(); };
            Application.Run(f);
            return 0;
        }
    }

    static class Diag
    {
        // NCExplorer.exe --diag [ip] [outfile] : connection test without the window, for support.
        public static int Run(string[] args)
        {
            string ip = args.Length > 1 ? args[1] : Settings.Load().Host;
            string outFile = args.Length > 2 ? args[2] : Path.Combine(Settings.Dir(), "diag.txt");
            List<string> lines = new List<string>();
            Action<string> log = s => { lines.Add(s); Console.WriteLine(s); };
            log("Veyra NC Explorer diagnostics " + DateTime.Now);
            bool problem;
            foreach (string n in NetCheck.Check(ip, out problem)) log("Network: " + n);
            FtpMachine m = new FtpMachine { Host = ip, Log = log };
            string why;
            if (!m.Reachable(out why)) { log("Port 21: " + why); }
            else
            {
                log("Port 21: open");
                string d;
                bool ok = m.AutoLogin(out d);
                log("Login: " + (ok ? d : "FAILED " + d));
                if (ok)
                {
                    try { m.List("/"); log("Raw root listing:"); foreach (string r in m.LastRaw) log("  | " + r); } catch { }
                    Walk(m, "/", 0, log);
                }
            }
            File.WriteAllLines(outFile, lines);
            return 0;
        }
        static void Walk(FtpMachine m, string dir, int depth, Action<string> log)
        {
            if (depth > 2) return;
            try
            {
                foreach (RemoteEntry e in m.List(dir))
                {
                    log(new string(' ', depth * 2) + (e.IsFolder ? "[D] " : "    ") + FtpMachine.Join(dir, e.Name) + (e.IsFolder ? "" : "  " + e.Size));
                    if (e.IsFolder) Walk(m, FtpMachine.Join(dir, e.Name), depth + 1, log);
                }
            }
            catch (Exception ex) { log(new string(' ', depth * 2) + "list " + dir + " failed: " + FtpMachine.Describe(ex)); }
        }
    }
}
