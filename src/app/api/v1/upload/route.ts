import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { isR2Configured, uploadFileToR2 } from "@/lib/storage";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    // Enforce authentication: only logged-in Admin or SuperAdmin or Agents can upload
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // 1. File Type Validation (PNG/JPG/JPEG only)
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only PNG and JPG are allowed." }, { status: 400 });
    }

    // 2. File Size Validation (<= 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json({ error: "File too large. Maximum size is 5MB." }, { status: 400 });
    }

    // 3. Buffer file content
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let fileUrl = "";

    // 4. Upload to R2 if configured, otherwise fallback to local public/uploads directory
    if (isR2Configured()) {
      fileUrl = await uploadFileToR2(buffer, file.name, file.type);
    } else {
      const uploadDir = join(process.cwd(), "public", "uploads");
      
      // Ensure upload directory exists
      await mkdir(uploadDir, { recursive: true });

      // Sanitize filename and prepend timestamp to prevent naming collisions
      const sanitizedFileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const filePath = join(uploadDir, sanitizedFileName);

      await writeFile(filePath, buffer);
      fileUrl = `/uploads/${sanitizedFileName}`;
    }

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      url: fileUrl,
    });
  } catch (error: any) {
    console.error("Upload API Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
