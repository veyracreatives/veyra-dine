using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Windows.Forms;

namespace VeyraNC
{
    /// <summary>Program library: every program on this PC (your folder + backups), searchable by name, content or note.</summary>
    public class LibraryForm : Form
    {
        static readonly string[] Ext = { ".NC", ".TAP", ".TXT", ".GCODE", ".NGC", ".CNC", ".EIA", ".MPF", ".PRG", ".PTP", "" };
        TextBox search = new TextBox();
        CheckBox inside = new CheckBox { Text = "Also search inside programs", AutoSize = true };
        ListView list = new ListView();
        Label count = new Label();
        List<FileInfo> all = new List<FileInfo>();
        Dictionary<string, string> notes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        string notesFile = Path.Combine(Settings.Dir(), "notes.txt");
        Timer t = new Timer { Interval = 300 };

        public LibraryForm(params string[] roots)
        {
            Text = "Program library"; Size = new Size(1100, 700); StartPosition = FormStartPosition.CenterParent; BackColor = Theme.Bg; Font = Theme.UI;
            FlowLayoutPanel bar = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 54, Padding = new Padding(12, 10, 12, 6), WrapContents = false };
            Label sl = new Label { Text = "Search", AutoSize = true, Margin = new Padding(0, 8, 8, 0) };
            search.Width = 320; search.Font = new Font("Segoe UI", 11f);
            inside.Margin = new Padding(12, 8, 0, 0);
            FlatBtn note = new FlatBtn("Add / edit note", false) { Width = 140, Margin = new Padding(16, 0, 6, 0) };
            FlatBtn open = new FlatBtn("Open", true) { Width = 90 };
            FlatBtn show = new FlatBtn("Show in folder", false) { Width = 130, Margin = new Padding(6, 0, 0, 0) };
            count.AutoSize = true; count.ForeColor = Theme.Muted; count.Margin = new Padding(14, 9, 0, 0);
            bar.Controls.AddRange(new Control[] { sl, search, inside, note, open, show, count });
            list.Dock = DockStyle.Fill; list.View = View.Details; list.FullRowSelect = true; list.BorderStyle = BorderStyle.None;
            list.Columns.Add("Program", 220); list.Columns.Add("Note", 300); list.Columns.Add("Size", 80, HorizontalAlignment.Right);
            list.Columns.Add("Modified", 130); list.Columns.Add("Folder", 340);
            Panel wrap = new Panel { Dock = DockStyle.Fill, Padding = new Padding(12, 0, 12, 12) };
            wrap.Controls.Add(list);
            Controls.Add(wrap); Controls.Add(bar);

            LoadNotes();
            foreach (string r in roots) Scan(r, 0);
            all = all.GroupBy(f => f.FullName, StringComparer.OrdinalIgnoreCase).Select(g => g.First()).OrderByDescending(f => f.LastWriteTime).ToList();
            Fill();

            search.TextChanged += delegate { t.Stop(); t.Start(); };
            inside.CheckedChanged += delegate { Fill(); };
            t.Tick += delegate { t.Stop(); Fill(); };
            list.DoubleClick += delegate { Open(); };
            open.Click += delegate { Open(); };
            note.Click += delegate { EditNote(); };
            show.Click += delegate { FileInfo f = Sel(); if (f != null) System.Diagnostics.Process.Start("explorer.exe", "/select,\"" + f.FullName + "\""); };
        }

        void Scan(string dir, int depth)
        {
            if (depth > 6 || string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) return;
            try
            {
                foreach (string f in Directory.GetFiles(dir))
                {
                    FileInfo fi = new FileInfo(f);
                    string ext = fi.Extension.ToUpperInvariant();
                    if (Array.IndexOf(Ext, ext) < 0 || fi.Length > 20000000 || fi.Name.EndsWith(".part")) continue;
                    if (ext == "" && fi.Length > 5000000) continue;
                    all.Add(fi);
                    if (all.Count > 20000) return;
                }
                foreach (string d in Directory.GetDirectories(dir)) Scan(d, depth + 1);
            }
            catch { }
        }

        void Fill()
        {
            string q = search.Text.Trim();
            list.BeginUpdate(); list.Items.Clear();
            int n = 0;
            foreach (FileInfo f in all)
            {
                string nt; notes.TryGetValue(f.FullName, out nt);
                bool hit = q.Length == 0 || f.Name.IndexOf(q, StringComparison.OrdinalIgnoreCase) >= 0 || (nt ?? "").IndexOf(q, StringComparison.OrdinalIgnoreCase) >= 0;
                if (!hit && inside.Checked && f.Length < 3000000)
                {
                    try { hit = File.ReadAllText(f.FullName).IndexOf(q, StringComparison.OrdinalIgnoreCase) >= 0; } catch { }
                }
                if (!hit) continue;
                if (++n > 3000) break;
                ListViewItem it = new ListViewItem(new[] { f.Name, nt ?? "", (f.Length / 1024.0).ToString("0.0") + " KB", f.LastWriteTime.ToString("dd-MM-yyyy HH:mm"), f.DirectoryName }) { Tag = f };
                list.Items.Add(it);
            }
            list.EndUpdate();
            count.Text = n + " of " + all.Count + " programs";
        }

        FileInfo Sel() { return list.SelectedItems.Count == 1 ? (FileInfo)list.SelectedItems[0].Tag : null; }

        void Open() { FileInfo f = Sel(); if (f != null) new ProgramForm(f.FullName, f.FullName, true).Show(this); }

        void EditNote()
        {
            FileInfo f = Sel(); if (f == null) return;
            string cur; notes.TryGetValue(f.FullName, out cur);
            using (Form d = new Form { Text = "Note for " + f.Name, ClientSize = new Size(460, 130), FormBorderStyle = FormBorderStyle.FixedDialog, StartPosition = FormStartPosition.CenterParent, MaximizeBox = false, MinimizeBox = false, Font = Theme.UI })
            {
                TextBox tb = new TextBox { Text = cur ?? "", Location = new Point(14, 16), Width = 430 };
                Label hint = new Label { Text = "For example: part name, customer, job number, material", Location = new Point(14, 44), AutoSize = true, ForeColor = Theme.Muted };
                FlatBtn ok = new FlatBtn("Save", true) { Location = new Point(344, 80), Width = 100 };
                ok.Click += delegate { d.DialogResult = DialogResult.OK; };
                d.Controls.AddRange(new Control[] { tb, hint, ok }); d.AcceptButton = ok;
                if (d.ShowDialog(this) != DialogResult.OK) return;
                if (tb.Text.Trim().Length == 0) notes.Remove(f.FullName); else notes[f.FullName] = tb.Text.Trim().Replace("\t", " ").Replace("\n", " ");
                SaveNotes(); Fill();
            }
        }

        void LoadNotes()
        {
            try { foreach (string l in File.ReadAllLines(notesFile)) { int i = l.IndexOf('\t'); if (i > 0) notes[l.Substring(0, i)] = l.Substring(i + 1); } } catch { }
        }
        void SaveNotes()
        {
            try { File.WriteAllLines(notesFile, notes.Select(k => k.Key + "\t" + k.Value).ToArray()); } catch { }
        }
    }
}
