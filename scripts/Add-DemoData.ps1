param(
    [string]$BaseUrl = 'http://localhost:5211'
)

$ErrorActionPreference = 'Stop'
$url = $BaseUrl.TrimEnd('/') + '/postings'
$records = Invoke-RestMethod -Uri $url -Method Get
if ($records.Count -gt 0) {
    Write-Host 'У списку вже є відправлення. Приклади можна додати через форму.'
    return
}

$examples = @(
    @{ from = 'Київ'; to = 'Львів'; content = 'Книги'; deliveryType = 'Department'; weight = 2 },
    @{ from = 'Одеса'; to = 'Дніпро'; content = 'Документи'; deliveryType = 'Courier'; weight = 2 },
    @{ from = 'Луцьк'; to = 'Київ'; content = 'Одяг'; deliveryType = 'ExpressCourier'; weight = 2 }
)
foreach ($example in $examples) {
    $example.width = 20.5
    $example.height = 15.25
    $example.depth = 2.5
    $record = Invoke-RestMethod -Uri $url -Method Post -ContentType 'application/json; charset=utf-8' -Body ($example | ConvertTo-Json)
    Write-Host "Створено відправлення № $($record.id)."
}
