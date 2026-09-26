const express = require("express");
const path = require("path");
const crypto = require("crypto");

const {
  list,
  issueSignedToken,
  presignUrl,
} = require("@vercel/blob");

const app = express();

app.use(express.json({ limit: "1mb" }));

// Always serve the website
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
// CREATE SIGNED UPLOAD URL
// ==========================================

app.post("/api/upload-url", async (req, res) => {
  try {
    const { code, filename } = req.body;

    // Check code
    if (!/^\d{6}$/.test(code || "")) {
      return res.status(400).json({
        success: false,
        error: "Invalid 6-digit share code",
      });
    }

    // Check filename
    if (
      typeof filename !== "string" ||
      filename.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid filename",
      });
    }

    // Remove dangerous path characters
    const cleanName = path
      .basename(filename.replace(/\\/g, "/"))
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .trim();

    if (!cleanName) {
      return res.status(400).json({
        success: false,
        error: "Invalid filename",
      });
    }

    // Unique file name
    const randomId = crypto
      .randomBytes(8)
      .toString("hex");

    const pathname =
      `shares/${code}/${randomId}-${cleanName}`;

    // Create a token that only allows PUT to this
    // specific pathname for 15 minutes.
    const token = await issueSignedToken({
      pathname,
      operations: ["put"],
      validUntil:
        Date.now() + 15 * 60 * 1000,
    });

    const { presignedUrl } =
      await presignUrl(token, {
        pathname,
        operation: "put",
        validUntil:
          Date.now() + 15 * 60 * 1000,
      });

    res.json({
      success: true,
      pathname,
      uploadUrl: presignedUrl,
      filename: cleanName,
    });

  } catch (error) {
    console.error(
      "Create upload URL error:",
      error
    );

    res.status(500).json({
      success: false,
      error:
        error.message ||
        "Could not create upload URL",
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
    const prefix = `shares/${code}/`;

    const result = await list({
      prefix,
      limit: 1000,
    });

    const files = result.blobs.map((blob) => {
      const fullName =
        blob.pathname.split("/").pop();

      // Remove our random ID from the displayed name
      const dashIndex =
        fullName.indexOf("-");

      const displayName =
        dashIndex !== -1
          ? fullName.substring(
              dashIndex + 1
            )
          : fullName;

      const fileId =
        Buffer.from(
          blob.pathname
        ).toString("base64url");

      return {
        id: fileId,
        name: displayName,
        size: blob.size,
        uploadedAt: blob.uploadedAt,
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
// CREATE SIGNED DOWNLOAD URL
// ==========================================

app.get(
  "/api/download/:code/:fileId",
  async (req, res) => {
    const code = req.params.code;
    const fileId = req.params.fileId;

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        error: "Invalid share code",
      });
    }

    try {
      const pathname =
        Buffer.from(
          fileId,
          "base64url"
        ).toString("utf8");

      // SECURITY CHECK
      if (
        !pathname.startsWith(
          `shares/${code}/`
        )
      ) {
        return res.status(403).json({
          error: "Access denied",
        });
      }

      // Signed URL valid for 10 minutes
      const token =
        await issueSignedToken({
          pathname,
          operations: ["get"],
          validUntil:
            Date.now() +
            10 * 60 * 1000,
        });

      const { presignedUrl } =
        await presignUrl(token, {
          pathname,
          operation: "get",
          validUntil:
            Date.now() +
            10 * 60 * 1000,

          // Make sure a newly uploaded file
          // is immediately available.
          useCache: false,
        });

      res.redirect(presignedUrl);

    } catch (error) {
      console.error(
        "Download URL error:",
        error
      );

      res.status(500).json({
        error: "Could not create download link",
      });
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