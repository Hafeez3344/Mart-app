param(
    [int]$Port = 5005
)

$src = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawSpooler {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static string PrintBytes(string printer, byte[] bytes) {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "CarePulse Silent Print";
        di.pDataType = "RAW";
        if (OpenPrinter(printer, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pBytes, bytes.Length);
                    int written = 0;
                    bool ok = WritePrinter(hPrinter, pBytes, bytes.Length, out written);
                    Marshal.FreeCoTaskMem(pBytes);
                    EndPagePrinter(hPrinter);
                    EndDocPrinter(hPrinter);
                    ClosePrinter(hPrinter);
                    return ok ? "SUCCESS" : "WritePrinter failed: " + Marshal.GetLastWin32Error();
                }
                EndDocPrinter(hPrinter);
                ClosePrinter(hPrinter);
                return "StartPagePrinter failed";
            }
            ClosePrinter(hPrinter);
            return "StartDocPrinter failed";
        }
        return "OpenPrinter failed for: " + printer;
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'RawSpooler').Type) {
    Add-Type -TypeDefinition $src
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$($Port)/")
$listener.Prefixes.Add("http://127.0.0.1:$($Port)/")

try {
    $listener.Start()
} catch {
    Write-Host "[ERROR] Could not start listener on port $($Port). Details: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

function Get-PrintersInfo() {
    try {
        return @(Get-CimInstance Win32_Printer | Select-Object Name, PortName, WorkOffline, Default)
    } catch {
        return @()
    }
}

Clear-Host
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " CarePulse HMS - Workstation Local Thermal Printer Bridge" -ForegroundColor Cyan
Write-Host " Running on: http://localhost:$Port" -ForegroundColor Yellow
Write-Host " Computer:   $env:COMPUTERNAME" -ForegroundColor Yellow
Write-Host " Status:     READY FOR SILENT 1-CLICK THERMAL PRINTING!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Detected Printers on THIS Computer:" -ForegroundColor White

$localPrinters = Get-PrintersInfo
foreach ($p in $localPrinters) {
    $statusText = if ($p.WorkOffline) { "[OFFLINE]" } else { "[ONLINE]" }
    $color = if ($p.WorkOffline) { "Yellow" } else { "Green" }
    $def = if ($p.Default) { " (DEFAULT)" } else { "" }
    Write-Host "  $statusText $($p.Name) -> Port: $($p.PortName)$def" -ForegroundColor $color
}
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "Keep this window open in background (you can minimize it)." -ForegroundColor Gray
Write-Host ""

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response

        # Add CORS and Chrome Private Network Access Headers
        $res.Headers.Add("Access-Control-Allow-Origin", "*")
        $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Accept")
        $res.Headers.Add("Access-Control-Allow-Private-Network", "true")

        if ($req.HttpMethod -eq "OPTIONS") {
            $res.StatusCode = 204
            $res.Close()
            continue
        }

        if ($req.Url.AbsolutePath -eq "/status") {
            $currentPrinters = Get-PrintersInfo
            $json = '{"online":true,"service":"CarePulse Workstation Bridge","computer":"' + $env:COMPUTERNAME + '"}'
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $res.ContentType = "application/json"
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            $res.Close()
            continue
        }

        if ($req.Url.AbsolutePath -eq "/printers") {
            $currentPrinters = Get-PrintersInfo
            $json = $currentPrinters | ConvertTo-Json
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
            $res.ContentType = "application/json"
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            $res.Close()
            continue
        }

        if ($req.Url.AbsolutePath -eq "/print" -and $req.HttpMethod -eq "POST") {
            $reader = New-Object System.IO.StreamReader($req.InputStream, $req.ContentEncoding)
            $body = $reader.ReadToEnd()
            $reader.Close()

            $data = $body | ConvertFrom-Json
            $requestedPrinter = if ($data.printerName) { $data.printerName.Trim() } else { "BlackCopper 80mm Series" }
            $rawBase64 = $data.rawBase64

            if (-not $rawBase64) {
                $res.StatusCode = 400
                $res.Close()
                continue
            }

            $rawBytes = [System.Convert]::FromBase64String($rawBase64)
            $printerToUse = $requestedPrinter

            # 1. Try requested printer directly
            $result = [RawSpooler]::PrintBytes($printerToUse, $rawBytes)

            # 2. If failed, try stripping (1) or (Copy 1) e.g. "BlackCopper 80mm Series(1)" -> "BlackCopper 80mm Series"
            if ($result -ne "SUCCESS") {
                $cleaned = $requestedPrinter -replace '\s*\(\d+\)', '' -replace '\s*\(Copy \d+\)', ''
                if ($cleaned -ne $requestedPrinter) {
                    Write-Host "[FALLBACK] Trying '$cleaned'..." -ForegroundColor Yellow
                    $retry = [RawSpooler]::PrintBytes($cleaned, $rawBytes)
                    if ($retry -eq "SUCCESS") {
                        $result = "SUCCESS"
                        $printerToUse = $cleaned
                    }
                }
            }

            # 3. If still failed, scan local printers on THIS computer for any matching BlackCopper or POS
            if ($result -ne "SUCCESS") {
                $localPrinters = Get-PrintersInfo
                foreach ($lp in $localPrinters) {
                    if ($lp.Name -like "*BlackCopper*" -or $lp.Name -like "*POS*" -or $lp.Name -like "*80mm*") {
                        Write-Host "[FALLBACK] Trying '$($lp.Name)'..." -ForegroundColor Yellow
                        $retry = [RawSpooler]::PrintBytes($lp.Name, $rawBytes)
                        if ($retry -eq "SUCCESS") {
                            $result = "SUCCESS"
                            $printerToUse = $lp.Name
                            break
                        }
                    }
                }
            }

            # 4. If still failed, try default printer
            if ($result -ne "SUCCESS") {
                $def = (Get-PrintersInfo | Where-Object { $_.Default -eq $true } | Select-Object -First 1)
                if ($def) {
                    Write-Host "[FALLBACK] Trying Default Printer '$($def.Name)'..." -ForegroundColor Yellow
                    $retry = [RawSpooler]::PrintBytes($def.Name, $rawBytes)
                    if ($retry -eq "SUCCESS") {
                        $result = "SUCCESS"
                        $printerToUse = $def.Name
                    }
                }
            }

            Write-Host "[PRINT] Dispatched to '$printerToUse' -> $result" -ForegroundColor $(if ($result -eq 'SUCCESS') { 'Green' } else { 'Red' })

            if ($result -eq "SUCCESS") {
                Write-Host "  -> Successfully sent $($rawBytes.Length) bytes to printer hardware!" -ForegroundColor Green
            } else {
                Write-Host "  -> Error details: $result" -ForegroundColor Red
            }

            $respJson = if ($result -eq "SUCCESS") {
                '{"success":true,"printer":"' + $printerToUse + '","message":"Printed successfully to ' + $printerToUse + '"}'
            } else {
                '{"success":false,"printer":"' + $printerToUse + '","message":"' + $result + '"}'
            }

            $bytes = [System.Text.Encoding]::UTF8.GetBytes($respJson)
            $res.ContentType = "application/json"
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
            $res.Close()
            continue
        }

        $res.StatusCode = 404
        $res.Close()
    } catch {
        Write-Host "[EXCEPTION] $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
