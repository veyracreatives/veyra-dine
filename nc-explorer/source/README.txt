Veyra NC Explorer 1.0.0 - read and write programs on a Mitsubishi M80 over the network cable.

HOW TO USE
1. Open "NC Explorer (Veyra)" from the desktop.
2. Machine IP is 192.168.200.1. Press Connect.
3. Left side = machine, right side = this PC (Documents\NC Programs).
4. Select programs and press Read (machine to PC) or Write (PC to machine). Drag and drop also works.
5. Double-click a program to view it.

SAFETY
- Before a program on the machine is replaced, the machine copy is saved to Documents\NC Programs Backups\Machine.
  If that backup fails, nothing is replaced.
- After writing, the app reads the program back and checks it matches.
- The app never deletes or renames anything on the machine.
- Do not write a program that is running or open in Edit on the machine.

WHY IT DOES NOT SLOW YOUR INTERNET
- It only talks to the machine IP you typed, only after you press Connect.
- No background service, no network scanning, nothing runs at Windows start-up.
- "Network check" tells you if the machine cable adapter has a gateway set, which is a common cause of slow internet.

If connection fails, run in a command prompt:  "C:\Program Files\Veyra NC Explorer\NCExplorer.exe" --diag 192.168.200.1
and send the file %APPDATA%\Veyra NC Explorer\diag.txt.
