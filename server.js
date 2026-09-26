const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");

const app = express();
const PORT = 3000;

// Folder where received files will be saved
const receivedFolder = path.join(__dirname, "received");

if (!fs.existsSync(receivedFolder)) {
    fs.mkdirSync(receivedFolder);
}

// File storage settings
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, receivedFolder);
    },

    filename: function (req, file, cb) {
        cb(null, path.basename(file.originalname));
    }
});

const upload = multer({
    storage: storage
});

// Website files
app.use(express.static(path.join(__dirname, "public")));

// Receive file
app.post("/upload", upload.single("file"), (req, res) => {

    if (!req.file) {
        return res.status(400).json({
            success: false,
            message: "No file received"
        });
    }

    console.log("Received:", req.file.originalname);

    res.json({
        success: true,
        filename: req.file.originalname,
        size: req.file.size
    });
});

// Get received files
app.get("/files", (req, res) => {

    fs.readdir(receivedFolder, (err, files) => {

        if (err) {
            return res.status(500).json({
                error: "Unable to read files"
            });
        }

        res.json(files);
    });
});

// Download file
app.get("/download/:filename", (req, res) => {

    const filename = path.basename(req.params.filename);

    const filePath =
        path.join(receivedFolder, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found");
    }

    res.download(filePath);
});

// Find this computer's IP address
function getLocalIP() {

    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {

        for (const network of interfaces[name]) {

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

// Start server
app.listen(PORT, "0.0.0.0", () => {

    const ip = getLocalIP();

    console.log("");
    console.log("=================================");
    console.log("       LOCAL FILE SHARE");
    console.log("=================================");
    console.log("");

    console.log(`This PC: http://localhost:${PORT}`);
    console.log(`Network: http://${ip}:${PORT}`);

    console.log("");
    console.log("Server is running...");
    console.log("");
});