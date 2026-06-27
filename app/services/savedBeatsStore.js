const { DefaultAzureCredential } = require("@azure/identity");
const { BlobServiceClient } = require("@azure/storage-blob");

const STORAGE_ACCOUNT_NAME = process.env.STORAGE_ACCOUNT_NAME || "vyomnagranirgb068";
const STORAGE_CONTAINER_NAME = process.env.STORAGE_CONTAINER_NAME || "onlinetabla";
const STORAGE_BLOB_NAME = process.env.STORAGE_BLOB_NAME || "saved-beats.json";
const STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;

let initialized = false;
let blobClient;

function buildBlobServiceClient() {
  if (STORAGE_CONNECTION_STRING) {
    return BlobServiceClient.fromConnectionString(STORAGE_CONNECTION_STRING);
  }

  const accountUrl = `https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net`;
  return new BlobServiceClient(accountUrl, new DefaultAzureCredential());
}

async function ensureInitialized() {
  if (initialized && blobClient) {
    return;
  }

  const serviceClient = buildBlobServiceClient();
  const containerClient = serviceClient.getContainerClient(STORAGE_CONTAINER_NAME);
  await containerClient.createIfNotExists();

  blobClient = containerClient.getBlockBlobClient(STORAGE_BLOB_NAME);
  const exists = await blobClient.exists();

  if (!exists) {
    await blobClient.upload("[]", 2, {
      blobHTTPHeaders: { blobContentType: "application/json" }
    });
  }

  initialized = true;
}

function parseItems(rawText) {
  try {
    const parsed = JSON.parse(rawText);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function readItems() {
  await ensureInitialized();

  const download = await blobClient.download();
  const text = await streamToString(download.readableStreamBody);
  return parseItems(text);
}

async function writeItems(items) {
  await ensureInitialized();

  const payload = JSON.stringify(items, null, 2);
  await blobClient.upload(payload, Buffer.byteLength(payload), {
    overwrite: true,
    blobHTTPHeaders: { blobContentType: "application/json" }
  });
}

async function streamToString(readableStream) {
  if (!readableStream) {
    return "";
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    readableStream.on("data", (data) => chunks.push(data.toString()));
    readableStream.on("end", () => resolve(chunks.join("")));
    readableStream.on("error", reject);
  });
}

module.exports = {
  readItems,
  writeItems,
  settings: {
    accountName: STORAGE_ACCOUNT_NAME,
    containerName: STORAGE_CONTAINER_NAME,
    blobName: STORAGE_BLOB_NAME
  }
};
