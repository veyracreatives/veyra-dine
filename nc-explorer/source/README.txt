Veyra NC Explorer 1.2.0 - read and write programs on a Mitsubishi M80 over the network cable.

HOW TO USE
1. Open "NC Explorer (Veyra)" from the desktop.
2. Machine IP is 192.168.200.1. Press Connect.
3. Left side = machine, right side = this PC (Documents\NC Programs).
4. Select programs and press Read (machine to PC) or Write (PC to machine). Drag and drop also works.
5. Double-click a program to open it: coloured G-code, 2D/3D toolpath, run time per tool and a safety check.
6. Compare: select a machine program and a PC program (or same names) and press Compare.
7. Before every Write the app runs the safety check (missing M30, units, tool numbers, feed/speed, spindle off, rapid below Z0).

MORE
- Program library: every program on this PC and in backups, search by name, note or text inside.
- Machine IP box keeps a list of machines; pick one and press Connect.
- Daily backup: the first Connect each day copies all machine programs to Documents\NC Programs Backups\Daily (last 30 kept). Read only.

SAFETY
- Before a program on the machine is replaced, the machine copy is saved to Documents\NC Programs Backups\Machine.
  If that backup fails, nothing is replaced.
- After writing, the app reads the program back and checks it matches.
- Delete (button or Delete key) saves a copy to Documents\NC Programs Backups\Deleted first. If that backup fails, nothing is deleted.
- Do not write a program that is running or open in Edit on the machine.

HOW IT CONNECTS
- Your M80 only accepts Mitsubishi's own protocol (port 683). So the app uses the Mitsubishi NC Explorer driver
  that is already installed on this PC. Keep NC Explorer installed.

WHY IT DOES NOT SLOW YOUR INTERNET
- It only talks to the machine IP you typed, only after you press Connect.
- No background service, no network scanning, nothing runs at Windows start-up.
- "Network check" tells you if the machine cable adapter has a gateway set, which is a common cause of slow internet.

If connection fails, run in a command prompt:  "C:\Program Files\Veyra NC Explorer\NCExplorer.exe" --diag 192.168.200.1
and send the file %APPDATA%\Veyra NC Explorer\diag.txt.
