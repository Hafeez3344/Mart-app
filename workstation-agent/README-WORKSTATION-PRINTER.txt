=================================================================================
  CAREPULSE HMS - LOCAL WORKSTATION THERMAL PRINTER SETUP
=================================================================================

PROBLEM SOLVED:
When multiple computers (Server PC, Front Desk PC, Pharmacy PC) each have their own 
USB BlackCopper thermal printer, clicking "Print" from Front Desk will now print 
directly to the Front Desk's own USB printer (NOT the Server PC's printer)!

---------------------------------------------------------------------------------
HOW TO SET UP ON YOUR FRONT DESK / PHARMACY COMPUTER:
---------------------------------------------------------------------------------

METHOD 1 (Recommended - 100% Silent with Windows Drivers):
1. Copy the "workstation-agent" folder to the Front Desk computer (or access it over shared folder).
2. Double-click "start-workstation-printer.bat".
   You will see: "Ready for silent 1-click thermal printing!"
3. In Chrome/Edge on the Front Desk computer, go to the HMS system:
   Settings -> Printer Settings -> Choose "Local PC Agent".
4. Click "Print Test Ticket on THIS Computer".
   Your receipt will print instantly and silently on your local BlackCopper printer!
5. (Optional) Right-click "start-workstation-printer.bat", choose "Create Shortcut",
   and put it into Windows Startup folder (press Win+R, type "shell:startup")
   so it runs automatically whenever this computer turns on!

---------------------------------------------------------------------------------
METHOD 2 (Direct WebUSB - Built into Google Chrome / Microsoft Edge):
1. On the Front Desk computer, open Chrome or Edge and go to HMS Settings -> Printer Settings.
2. Select "Direct WebUSB".
3. Click "Pair This PC's USB Printer".
4. A browser popup will appear -> Select "BlackCopper 80mm Series" and click Connect.
5. Click "Print Test Ticket on THIS Computer" to verify!

---------------------------------------------------------------------------------
ON THE SERVER COMPUTER:
- In Settings -> Printer Settings, select "Server / Shared Spooler" -> "BlackCopper 80mm Series".
- Now Server prints to Server's printer, and Front Desk prints to Front Desk's printer!
=================================================================================
