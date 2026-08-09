# Elevate script to configure Windows Defender Firewall for Restaurant POS
$RuleNamePort = "TYDE POS Port 3101"
$RuleNameNode = "TYDE POS Node App"
$RuleNameElectron = "TYDE POS Electron App"

# Remove any old rules
netsh advfirewall firewall delete rule name="$RuleNamePort" 2>$null
netsh advfirewall firewall delete rule name="$RuleNameNode" 2>$null
netsh advfirewall firewall delete rule name="$RuleNameElectron" 2>$null
netsh advfirewall firewall delete rule name="Restaurant POS Network Access" 2>$null
netsh advfirewall firewall delete rule name="POS Port 3101" 2>$null

# Add Inbound Rule for Ports 3101, 3100, 5175 on ALL Profiles (Domain, Private, Public)
netsh advfirewall firewall add rule name="$RuleNamePort" dir=in action=allow protocol=TCP localport=3000,3100,3101,5173,5175 profile=any enable=yes

# Add Inbound Rule for Node.js executable if found
$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($nodePath) {
    netsh advfirewall firewall add rule name="$RuleNameNode" dir=in action=allow program="$nodePath" profile=any enable=yes
}

# Add Inbound Rule for Electron executable if found
$electronProcess = Get-Process electron -ErrorAction SilentlyContinue | Select-Object -First 1
if ($electronProcess -and $electronProcess.Path) {
    netsh advfirewall firewall add rule name="$RuleNameElectron" dir=in action=allow program="$($electronProcess.Path)" profile=any enable=yes
}

Write-Host "✅ Restaurant POS Firewall Rules Applied Successfully!" -ForegroundColor Green
