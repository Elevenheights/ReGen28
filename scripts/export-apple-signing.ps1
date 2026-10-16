$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$signingDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'certs/rotation-20261015'
$outputPath = Join-Path $signingDirectory 'regen28-distribution-20261015.p12'
if (Test-Path -LiteralPath $outputPath) { throw 'A signing export already exists. No file was overwritten.' }

$form = [Windows.Forms.Form]::new()
$form.Text = 'ReGen28 - protect your new signing file'
$form.ClientSize = [Drawing.Size]::new(500, 235)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.TopMost = $true
$message = [Windows.Forms.Label]::new()
$message.Text = "Choose a new password (12+ characters). You'll enter it again in Appflow.`nIt is not saved in the project or sent to the chat. Keep it in your password manager."
$message.SetBounds(20, 15, 460, 45)
$form.Controls.Add($message)
$password = [Windows.Forms.TextBox]::new()
$password.UseSystemPasswordChar = $true
$password.SetBounds(20, 75, 460, 25)
$password.PlaceholderText = 'New export password'
$form.Controls.Add($password)
$confirmation = [Windows.Forms.TextBox]::new()
$confirmation.UseSystemPasswordChar = $true
$confirmation.PlaceholderText = 'Repeat the password'
$confirmation.SetBounds(20, 110, 460, 25)
$form.Controls.Add($confirmation)
$errorLabel = [Windows.Forms.Label]::new()
$errorLabel.ForeColor = [Drawing.Color]::Firebrick
$errorLabel.SetBounds(20, 145, 460, 25)
$form.Controls.Add($errorLabel)
$export = [Windows.Forms.Button]::new()
$export.Text = 'Create signing file'
$export.SetBounds(300, 185, 180, 30)
$export.Add_Click({
  if ($password.Text.Length -lt 12 -or $password.Text -cne $confirmation.Text) {
    $errorLabel.Text = 'Use at least 12 characters, with both entries matching.'
    return
  }
  $form.DialogResult = [Windows.Forms.DialogResult]::OK
  $form.Close()
})
$form.Controls.Add($export)
$form.AcceptButton = $export
if ($form.ShowDialog() -ne [Windows.Forms.DialogResult]::OK) { $form.Dispose(); exit }

$rsa = [Security.Cryptography.RSA]::Create()
$certificate = $null
$withPrivateKey = $null
try {
  $rsa.ImportFromPem([IO.File]::ReadAllText((Join-Path $signingDirectory 'apple-distribution-private.key')))
  $certificate = [Security.Cryptography.X509Certificates.X509Certificate2]::new((Join-Path $signingDirectory 'apple-distribution.cer'))
  $withPrivateKey = [Security.Cryptography.X509Certificates.RSACertificateExtensions]::CopyWithPrivateKey($certificate, $rsa)
  $bytes = $withPrivateKey.Export([Security.Cryptography.X509Certificates.X509ContentType]::Pkcs12, $password.Text)
  [IO.File]::WriteAllBytes($outputPath, $bytes)
  [Array]::Clear($bytes, 0, $bytes.Length)
  [Windows.Forms.MessageBox]::Show('Your protected signing file is ready. Use this same password when adding it to Appflow.', 'ReGen28 signing file ready') | Out-Null
} catch {
  [Windows.Forms.MessageBox]::Show('The export could not be completed. No password was logged. Please tell Codex the export failed.', 'ReGen28 signing export') | Out-Null
  throw
} finally {
  $password.Clear()
  $confirmation.Clear()
  $form.Dispose()
  if ($null -ne $withPrivateKey) { $withPrivateKey.Dispose() }
  if ($null -ne $certificate) { $certificate.Dispose() }
  $rsa.Dispose()
}
