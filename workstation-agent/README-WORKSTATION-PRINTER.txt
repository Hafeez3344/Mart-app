=================================================================================
  SUPER MART POS - LOCAL CASHIER WORKSTATION THERMAL PRINTER SETUP
=================================================================================

PROBLEM SOLVED:
When multiple computers (Server PC, Checkout Counter 1, Checkout Counter 2) each have their own 
USB thermal receipt printer (BlackCopper, Xprinter, Epson, etc.), clicking "Print Receipt" from Counter 1 will print 
directly to Counter 1's own USB printer (NOT the Server PC's printer)!

---------------------------------------------------------------------------------
HOW TO SET UP ON YOUR CASHIER / CHECKOUT COMPUTER:
---------------------------------------------------------------------------------

METHOD 1 (Recommended - 100% Silent with Windows Drivers):
1. Copy the "workstation-agent" folder to the Cashier computer.
2. Double-click "start-workstation-printer.bat".
   You will see: "Ready for silent 1-click thermal printing!"
3. In Chrome/Edge on the Cashier computer, go to Super Mart POS:
   Settings -> Printer Settings -> Choose "Local PC Agent".
4. Click "Print Test Ticket on THIS Computer".
   Your receipt will print instantly and silently on your local thermal printer!
5. (Optional) Run "install-autostart.bat" so it runs automatically whenever this computer turns on!

---------------------------------------------------------------------------------
METHOD 2 (Direct WebUSB - Built into Google Chrome / Microsoft Edge):
1. On the Cashier computer, open Chrome or Edge and go to Super Mart POS Settings -> Printer Settings.
2. Select "Direct WebUSB".
3. Click "Pair This PC's USB Printer".
4. A browser popup will appear -> Select your USB printer and click Connect.
5. Click "Print Test Receipt on THIS Computer" to verify!

---------------------------------------------------------------------------------
ON THE SERVER COMPUTER:
- In Settings -> Printer Settings, select "Server / Shared Spooler" or use Electron native printing.
- Each checkout counter prints to its own connected thermal printer!
=================================================================================
