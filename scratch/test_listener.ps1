try {
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:5005/")
    $l.Start()
    Write-Host "LISTENER_SUCCESS"
    $l.Stop()
} catch {
    Write-Host "LISTENER_ERROR: $_"
}
