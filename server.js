const express = require("express");
const path = require("path");
const crypto = require("crypto");

const {
  list,
  get,
} = require("@vercel/blob");

const {
  handleUpload,
} = require("@vercel/blob/client");

const app = express();

app.use(express.json());

const isVercel = Boolean(process.env.VERCEL);

// Serve website locally
if (!isVercel) {
  app.use(express.static(path.join(__dirname, "public")));
}

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "Local File Share is running",
    vercel: isVercel,
  });
});

// --------------------------------------------------
// CREATE 6-DIGIT SHARE
// --------------------------------------------------

app.post("/api/create-share", (req, res) => {
  const code = String(
    crypto.randomInt(100000, 1000000)
  );

  res.json({
    success: true,
    code,
  });
});

// --------------------------------------------------
// VERCEL BLOB CLIENT UPLOAD TOKEN
// --------------------------------------------------

app.post("/api/upload/:code", async (req, res) => {
  const code = req.params.code;

  // Make sure the code is exactly 6 digits
  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({
      error: "Invalid share code",
    });
  }

  try {
    const body = req.body;

    const jsonResponse = await handleUpload({
      body,
      request: req,

      onBeforeGenerateToken: async (pathname, clientPayload) => {
        return {
          access: "private",

          addRandomSuffix: true,

          allowedPathnamePrefix: `shares/${code}/`,

          tokenPayload: JSON.stringify({
            code,
            clientPayload,
          }),
        };
      },

      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log(
          "Upload completed:",
          blob.pathname
        );
      },
    });

    return res.json(jsonResponse);

  } catch (error) {
    console.error("Blob upload error:", error);

    return res.status(400).json({
      error: error.message || "Upload failed",
    });
  }
});

// --------------------------------------------------
// LIST FILES FOR A SHARE CODE
// --------------------------------------------------

app.get("/api/share/:code", async (req, res) => {
  const code = req.params.code;

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({
      error: "Invalid share code",
    });
  }

  try {
    const prefix = `shares/${code}/`;

    const result = await list({
      prefix,
      limit: 1000,
    });

    const files = result.blobs.map((blob) => ({
      id: Buffer.from(blob.pathname).toString("base64url"),
      name: blob.pathname.split("/").pop(),
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    }));

    return res.json({
      success: true,
      code,
      files,
    });

  } catch (error) {
    console.error("List error:", error);

    return res.status(500).json({
      error: "Could not load files",
    });
  }
});

// --------------------------------------------------
// DOWNLOAD FILE
// --------------------------------------------------

app.get("/api/download/:code/:fileId", async (req, res) => {
  const code = req.params.code;
  const fileId = req.params.fileId;

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).send("Invalid share code");
  }

  try {
    const pathname = Buffer.from(
      fileId,
      "base64url"
    ).toString("utf8");

    // Security check:
    // File must belong to this share code
    if (!pathname.startsWith(`shares/${code}/`)) {
      return res.status(403).send("Access denied");
    }

    const result = await get(pathname, {
      access: "private",
    });

    if (!result || result.statusCode !== 200) {
      return res.status(404).send("File not found");
    }

    res.setHeader(
      "Content-Type",
      result.blob.contentType || "application/octet-stream"
    );

    res.setHeader(
      "Content-Disposition",
      result.blob.contentDisposition ||
        `attachment; filename="${path.basename(pathname)}"`
    );

    return res.send(result.stream);

  } catch (error) {
    console.error("Download error:", error);

    return res.status(500).send(
      "Could not download file"
    );
  }
});

// --------------------------------------------------
// LOCAL SERVER
// --------------------------------------------------

if (!isVercel) {
  const PORT = 3000;

  app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("LOCAL FILE SHARE");
    console.log("");
    console.log(
      `This PC: http://localhost:${PORT}`
    );
    console.log("");
    console.log("Server is running...");
  });
}

// VERCEL
module.exports = app;