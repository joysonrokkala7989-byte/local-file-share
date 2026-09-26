const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// STORAGE
// ==========================================

const receivedFolder = process.env.VERCEL
    ? path.join("/tmp", "received")
    : path.join(__dirname, "received");

if (!fs.existsSync(receivedFolder)) {
    fs.mkdirSync(receivedFolder, { recursive: true });
}

// ==========================================
// SHARE DATA
// ==========================================

const shares = new Map();

// ==========================================
// MULTER
// ==========================================

const storage = multer.diskStorage({

    destination: function (req, file, cb) {
        cb(null, receivedFolder);
    },

    filename: function (req, file, cb) {

        const safeName = path.basename(file.originalname);

        const uniqueName =
            crypto.randomBytes(8).toString("hex") +
            "-" +
            safeName;

        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage
});

// ==========================================
// WEBSITE
// ==========================================

app.use(express.static(path.join(__dirname, "public")));

app.use(express.json());

// ==========================================
// CREATE SHARE
// ==========================================

app.post("/api/create-share", (req, res) => {

    let code;

    do {
        code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (shares.has(code));

    shares.set(code, {
        files: [],
        createdAt: Date.now()
    });

    console.log("Created share:", code);

    res.json({
        success: true,
        code: code
    });
});

// ==========================================
// UPLOAD FILE TO SHARE
// ==========================================

app.post(
    "/api/upload/:code",
    upload.array("files"),
    (req, res) => {

        const code = req.params.code;

        const share = shares.get(code);

        if (!share) {
            return res.status(404).json({
                success: false,
                message: "Share code not found"
            });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No files received"
            });
        }

        req.files.forEach(file => {

            share.files.push({
                id: file.filename,
                name: file.originalname,
                size: file.size
            });

        });

        console.log(
            "Uploaded",
            req.files.length,
            "file(s) to",
            code
        );

        res.json({
            success: true,
            files: share.files
        });
    }
);

// ==========================================
// GET SHARE
// ==========================================

app.get("/api/share/:code", (req, res) => {

    const code = req.params.code;

    const share = shares.get(code);

    if (!share) {
        return res.status(404).json({
            success: false,
            message: "Invalid or expired code"
        });
    }

    res.json({
        success: true,
        code: code,
        files: share.files
    });
});

// ==========================================
// DOWNLOAD FILE
// ==========================================

app.get(
    "/api/download/:code/:fileId",
    (req, res) => {

        const code = req.params.code;
        const fileId = path.basename(req.params.fileId);

        const share = shares.get(code);

        if (!share) {
            return res.status(404).send(
                "Share code not found"
            );
        }

        const file = share.files.find(
            item => item.id === fileId
        );

        if (!file) {
            return res.status(404).send(
                "File not found"
            );
        }

        const filePath = path.join(
            receivedFolder,
            file.id
        );

        if (!fs.existsSync(filePath)) {
            return res.status(404).send(
                "File no longer exists"
            );
        }

        res.download(
            filePath,
            file.name
        );
    }
);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/api/health", (req, res) => {

    res.json({
        success: true,
        message: "Local File Share is running"
    });

});

// ==========================================
// LOCAL SERVER
// ==========================================

if (!process.env.VERCEL) {

    function getLocalIP() {

        const interfaces =
            os.networkInterfaces();

        for (
            const name of Object.keys(interfaces)
        ) {

            for (
                const network of interfaces[name]
            ) {

                if (
                    network.family === "IPv4" &&
                    !network.internal
                ) {
                    return network.address;
                }

            }
        }

        return "localhost";
    }

    app.listen(
        PORT,
        "0.0.0.0",
        () => {

            const ip = getLocalIP();

            console.log("");
            console.log(
                "================================="
            );
            console.log(
                "       LOCAL FILE SHARE"
            );
            console.log(
                "================================="
            );
            console.log("");

            console.log(
                `This PC: http://localhost:${PORT}`
            );

            console.log(
                `Network: http://${ip}:${PORT}`
            );

            console.log("");
            console.log(
                "Server is running..."
            );
            console.log("");
        }
    );
}

module.exports = app;