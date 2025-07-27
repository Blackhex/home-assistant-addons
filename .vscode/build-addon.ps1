
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Name,

    [Parameter(Position = 1)]
    [string[]]$Arguments = @()
)

# For each argument add --build-arg key=value parameter
$BuildArguments = @()
foreach ($Argument in $Arguments) {
    $key, $value = $Argument -split '=', 2
    if ($value) {
        $BuildArguments += "--build-arg $key=$value "
    } else {
        $BuildArguments += "--build-arg $key "
    }
}

docker stop `
  $Name

docker rm `
  --force `
  --volumes `
  $Name

docker image prune `
  --force `
  --filter='dangling=true'

docker build `
  --debug `
  --no-cache `
  --progress=plain `
  --tag=$Name `
  @BuildArguments `
  $Name

docker run `
  --name $Name `
  --interactive `
  $Name
