const express = require("express");
const path = require("path");
const crypto = require("crypto");

const { list } = require("@vercel/blob");
const { handleUpload } = require("@vercel/blob/client");

const app = express();

// Vercel Blob client-upload requests are JSON.
// Keep JSON parsing enabled.
app.use(express.json());

// Serve the website
app.use(express.static(path.join(__dirname, "public")));

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Local File Share is running",
    vercel: Boolean(process.env.VERCEL),
  });
});

// ==========================================
// CREATE 6-DIGIT SHARE CODE
// ==========================================

app.post("/api/create-share", (req, res) => {
  try {
    const code = String(
      crypto.randomInt(100000, 1000000)
    );

    res.json({
      success: true,
      code,
    });

  } catch (error) {
    console.error("Create share error:", error);

    res.status(500).json({
      success: false,
      error: "Could not create share",
    });
  }
});

// ==========================================
// VERCEL BLOB CLIENT UPLOAD
// ==========================================

app.post("/api/upload", async (req, res) => {
  try {
    const body = req.body;

    const jsonResponse = await handleUpload({
      body,
      request: req,

      onBeforeGenerateToken: async (
        pathname,
        clientPayload
      ) => {

        let payload = {};

        try {
          payload = clientPayload
            ? JSON.parse(clientPayload)
            : {};
        } catch {
          payload = {};
        }

        const code = payload.code;

        // Only allow our 6-digit share folders
        if (!/^\d{6}$/.test(code || "")) {
          throw new Error(
            "Invalid share code"
          );
        }

        // Make sure the file is stored inside
        // the correct share folder.
        if (
          !pathname.startsWith(
            `shares/${code}/`
          )
        ) {
          throw new Error(
            "Invalid upload path"
          );
        }

        return {
          access: "private",

          addRandomSuffix: true,

          allowedPathnamePrefix:
            `shares/${code}/`,

          tokenPayload: JSON.stringify({
            code,
          }),
        };
      },

      onUploadCompleted: async ({
        blob,
        tokenPayload,
      }) => {
        console.log(
          "Upload completed:",
          blob.pathname
        );

        console.log(
          "Share:",
          tokenPayload
        );
      },
    });

    return res.json(jsonResponse);

  } catch (error) {
    console.error(
      "Vercel Blob upload error:",
      error
    );

    return res.status(400).json({
      success: false,
      error:
        error.message ||
        "Could not prepare upload",
    });
  }
});

// ==========================================
// LIST FILES FOR SHARE CODE
// ==========================================

app.get("/api/share/:code", async (req, res) => {
  const code = req.params.code;

  if (!/^\d{6}$/.test(code)) {
    return res.status(400).json({
      success: false,
      error: "Invalid share code",
    });
  }

  try {
    const result = await list({
      prefix: `shares/${code}/`,
      limit: 1000,
    });

    const files = result.blobs.map((blob) => {

      const filename =
        blob.pathname
          .split("/")
          .pop();

      const fileId =
        Buffer.from(
          blob.pathname
        ).toString("base64url");

      return {
        id: fileId,
        name: filename,
        size: blob.size,
        uploadedAt:
          blob.uploadedAt,
      };
    });

    res.json({
      success: true,
      code,
      files,
    });

  } catch (error) {
    console.error(
      "List files error:",
      error
    );

    res.status(500).json({
      success: false,
      error: "Could not load files",
    });
  }
});

// ==========================================
// DOWNLOAD
// ==========================================

app.get(
  "/api/download/:code/:fileId",
  async (req, res) => {

    const code =
      req.params.code;

    const fileId =
      req.params.fileId;

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).send(
        "Invalid share code"
      );
    }

    try {

      const pathname =
        Buffer.from(
          fileId,
          "base64url"
        ).toString("utf8");

      // Security check
      if (
        !pathname.startsWith(
          `shares/${code}/`
        )
      ) {
        return res.status(403).send(
          "Access denied"
        );
      }

      // Redirect the browser to a temporary
      // signed Blob download URL.
      const { createReadStream } =
        await import("@vercel/blob");

      const result =
        await createReadStream(
          pathname,
          {
            access: "private",
          }
        );

      if (!result) {
        return res.status(404).send(
          "File not found"
        );
      }

      res.setHeader(
        "Content-Type",
        "application/octet-stream"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${path.basename(
          pathname
        )}"`
      );

      result.pipe(res);

    } catch (error) {

      console.error(
        "Download error:",
        error
      );

      res.status(500).send(
        "Could not download file"
      );
    }
  }
);

// ==========================================
// VERCEL
// ==========================================

module.exports = app;

// ==========================================
// LOCAL DEVELOPMENT
// ==========================================

if (!process.env.VERCEL) {

  const PORT = 3000;

  app.listen(
    PORT,
    "0.0.0.0",
    () => {

      console.log("");
      console.log(
        "LOCAL FILE SHARE"
      );
      console.log("");

      console.log(
        `This PC: http://localhost:${PORT}`
      );

      console.log("");
      console.log(
        "Server is running..."
      );
    }
  );
}