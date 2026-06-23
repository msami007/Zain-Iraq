import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const endpoint = process.env.R2_ENDPOINT;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = process.env.R2_PUBLIC_URL;

// Initialize the S3 client configured for Cloudflare R2
const s3Client = new S3Client({
  region: "auto",
  endpoint: endpoint,
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
});

/**
 * Checks if the R2 environment variables are fully configured.
 */
export function isR2Configured(): boolean {
  return !!(endpoint && accessKeyId && secretAccessKey && bucketName && publicUrl);
}

/**
 * Uploads a file buffer to Cloudflare R2 and returns its absolute public URL.
 */
export async function uploadFileToR2(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  if (!isR2Configured()) {
    throw new Error("Cloudflare R2 is not fully configured in environment variables.");
  }

  // Sanitize filename and prepend unique timestamp
  const sanitizedFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: sanitizedFileName,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Clean trailing slash if present in publicUrl
  const baseUrl = publicUrl!.endsWith("/") ? publicUrl!.slice(0, -1) : publicUrl;

  return `${baseUrl}/${sanitizedFileName}`;
}
