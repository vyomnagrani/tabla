# Online Tabla

Interactive tabla loop builder with drag-and-drop pattern editing, live tempo control, and dynamic sample speed-up at high tempos.

## Features

- Choose loop length (4, 8, 12, 16 beats)
- Drag/drop sounds: Full, High, Low, Hollow
- Empty beats are allowed
- One-click looping playback
- Tempo controls stay active while playing
- Default tempo: 60 BPM (1.00 BPS)
- Automatic playback rate increase for fast tempos

## Run locally

Requirements: Node.js 20+

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Docker

```bash
docker build -t online-tabla:local .
docker run --rm -p 3000:3000 online-tabla:local
```

## Push to GitHub

```bash
git init
git remote add origin https://github.com/vyomnagrani/tabla.git
git add .
git commit -m "Initial Online Tabla implementation"
git branch -M main
git push -u origin main
```

## Recommended image registry for Azure Container Apps

Use **Azure Container Registry (ACR)** on Basic tier for this app.

Why this is best here:

- Native integration with Azure Container Apps
- Stable pull performance from Azure region
- Private image hosting and RBAC support
- Easy CI/CD from GitHub Actions

## ACA deployment (manual path)

```bash
# Variables
RG=rg-online-tabla
LOC=eastus
ACR=onlineTablaAcr
APP=online-tabla
ENV=online-tabla-env

az group create -n $RG -l $LOC
az acr create -g $RG -n $ACR --sku Basic
az extension add --name containerapp --upgrade
az containerapp env create -n $ENV -g $RG -l $LOC

az acr login -n $ACR
docker build -t $ACR.azurecr.io/online-tabla:v1 .
docker push $ACR.azurecr.io/online-tabla:v1

az containerapp create \
  -n $APP \
  -g $RG \
  --environment $ENV \
  --image $ACR.azurecr.io/online-tabla:v1 \
  --target-port 3000 \
  --ingress external \
  --registry-server $ACR.azurecr.io

# Allow ACA to pull from ACR using managed identity (recommended)
PRINCIPAL_ID=$(az containerapp show -n $APP -g $RG --query identity.principalId -o tsv)
ACR_ID=$(az acr show -n $ACR -g $RG --query id -o tsv)
az role assignment create --assignee-object-id $PRINCIPAL_ID --assignee-principal-type ServicePrincipal --scope $ACR_ID --role AcrPull
```

## GitHub Actions path

Workflow file: `.github/workflows/deploy-aca.yml`

Set these repository secrets:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `ACR_NAME`
- `ACR_LOGIN_SERVER` (example: myacr.azurecr.io)
- `ACA_APP_NAME`
- `ACA_RESOURCE_GROUP`

## Cost note for personal account

- GitHub Actions minutes may be limited for private repositories depending on your plan.
- Start with Actions for convenience.
- If you hit limits, use the manual local Docker push path above.
