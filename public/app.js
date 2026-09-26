let currentShareCode = null;
let scannerStream = null;
let scannerInterval = null;

// Load Vercel Blob client uploader
let blobUpload;

(async () => {
    try {
        const blobClient = await import(
            "https://esm.sh/@vercel/blob/client"
        );

        blobUpload = blobClient.upload;

        console.log("Vercel Blob uploader ready");

    } catch (error) {
        console.error(
            "Could not load Vercel Blob uploader:",
            error
        );
    }
})();

// ==========================================
// ELEMENTS
// ==========================================

const createShareBtn =
    document.getElementById("createShareBtn");

const senderArea =
    document.getElementById("senderArea");

const shareCode =
    document.getElementById("shareCode");

const fileInput =
    document.getElementById("fileInput");

const uploadBtn =
    document.getElementById("uploadBtn");

const uploadStatus =
    document.getElementById("uploadStatus");

const senderFiles =
    document.getElementById("senderFiles");

const codeInput =
    document.getElementById("codeInput");

const findShareBtn =
    document.getElementById("findShareBtn");

const scanBtn =
    document.getElementById("scanBtn");

const scannerArea =
    document.getElementById("scannerArea");

const scannerVideo =
    document.getElementById("scannerVideo");

const scannerStatus =
    document.getElementById("scannerStatus");

const stopScannerBtn =
    document.getElementById("stopScannerBtn");

const receiverArea =
    document.getElementById("receiverArea");

const receiverFiles =
    document.getElementById("receiverFiles");


// ==========================================
// CREATE SHARE
// ==========================================

createShareBtn.addEventListener(
    "click",
    async () => {

        try {

            createShareBtn.disabled = true;
            createShareBtn.textContent =
                "Creating...";

            const response =
                await fetch("/api/create-share", {
                    method: "POST"
                });

            const data =
                await response.json();

            if (!data.success) {
                throw new Error(
                    "Could not create share"
                );
            }

            currentShareCode =
                data.code;

            shareCode.textContent =
                currentShareCode;

            senderArea.classList.remove(
                "hidden"
            );

            createQRCode(
                currentShareCode
            );

            createShareBtn.textContent =
                "Share Created";

            loadSenderFiles();

        } catch (error) {

            console.error(error);

            alert(
                "Unable to create share."
            );

            createShareBtn.disabled = false;

            createShareBtn.textContent =
                "Create Share";
        }
    }
);


// ==========================================
// CREATE QR CODE
// ==========================================

function createQRCode(code) {

    const qrContainer =
        document.getElementById("qrcode");

    qrContainer.innerHTML = "";

    const shareURL =
        window.location.origin +
        "/?code=" +
        code;

    new QRCode(
        qrContainer,
        {
            text: shareURL,
            width: 200,
            height: 200
        }
    );
}


// ==========================================
// UPLOAD FILES TO VERCEL BLOB
// ==========================================

uploadBtn.addEventListener(
    "click",
    async () => {

        if (!currentShareCode) {

            alert(
                "Create a share first."
            );

            return;
        }

        if (
            !fileInput.files ||
            fileInput.files.length === 0
        ) {

            alert(
                "Please select at least one file."
            );

            return;
        }

        if (!blobUpload) {

            alert(
                "Upload system is still loading. Please wait a few seconds and try again."
            );

            return;
        }

        try {

            uploadBtn.disabled = true;

            uploadBtn.textContent =
                "Uploading...";

            const files =
                Array.from(fileInput.files);

            for (
                let i = 0;
                i < files.length;
                i++
            ) {

                const file =
                    files[i];

                uploadStatus.textContent =
                    `Uploading ${i + 1} of ${files.length}: ${file.name}`;

                const pathname =
                    `shares/${currentShareCode}/${file.name}`;

                await blobUpload(
                    pathname,
                    file,
                    {
                        access: "private",

                        handleUploadUrl:
                            `/api/upload/${currentShareCode}`,

                        clientPayload:
                            JSON.stringify({
                                code:
                                    currentShareCode
                            }),

                        multipart: true,

                        onUploadProgress:
                            (progress) => {

                                const percent =
                                    Math.round(
                                        progress.percentage
                                    );

                                uploadStatus.textContent =
                                    `Uploading ${i + 1} of ${files.length}: ${file.name} — ${percent}%`;
                            }
                    }
                );
            }

            uploadStatus.textContent =
                "✅ Files uploaded successfully!";

            fileInput.value = "";

            loadSenderFiles();

        } catch (error) {

            console.error(
                "Upload error:",
                error
            );

            uploadStatus.textContent =
                "❌ Upload failed.";

            alert(
                error.message ||
                "Upload failed."
            );

        } finally {

            uploadBtn.disabled = false;

            uploadBtn.textContent =
                "Upload Files";
        }
    }
);


// ==========================================
// LOAD SENDER FILES
// ==========================================

async function loadSenderFiles() {

    if (!currentShareCode) {
        return;
    }

    try {

        const response =
            await fetch(
                `/api/share/${currentShareCode}`
            );

        const data =
            await response.json();

        if (
            !data.success ||
            data.files.length === 0
        ) {

            senderFiles.textContent =
                "No files uploaded yet.";

            return;
        }

        senderFiles.innerHTML = "";

        data.files.forEach(
            file => {

                const div =
                    document.createElement(
                        "div"
                    );

                div.className =
                    "file-item";

                div.innerHTML = `
                    <span>
                        📄 ${escapeHTML(file.name)}
                    </span>

                    <span>
                        ${formatBytes(file.size)}
                    </span>
                `;

                senderFiles.appendChild(
                    div
                );
            }
        );

    } catch (error) {

        console.error(error);
    }
}


// ==========================================
// FIND SHARE USING CODE
// ==========================================

findShareBtn.addEventListener(
    "click",
    () => {

        const code =
            codeInput.value.trim();

        if (!/^\d{6}$/.test(code)) {

            alert(
                "Please enter a valid 6-digit code."
            );

            return;
        }

        loadReceiverFiles(code);
    }
);


// ==========================================
// LOAD RECEIVER FILES
// ==========================================

async function loadReceiverFiles(code) {

    try {

        findShareBtn.disabled = true;

        findShareBtn.textContent =
            "Searching...";

        const response =
            await fetch(
                `/api/share/${code}`
            );

        const data =
            await response.json();

        if (!data.success) {

            throw new Error(
                data.message ||
                "Share not found"
            );
        }

        receiverArea.classList.remove(
            "hidden"
        );

        if (
            !data.files ||
            data.files.length === 0
        ) {

            receiverFiles.innerHTML =
                "<p>No files available yet.</p>";

            return;
        }

        receiverFiles.innerHTML = "";

        data.files.forEach(
            file => {

                const div =
                    document.createElement(
                        "div"
                    );

                div.className =
                    "receiver-file";

                div.innerHTML = `
                    <div>
                        <strong>
                            📄 ${escapeHTML(file.name)}
                        </strong>

                        <br>

                        <small>
                            ${formatBytes(file.size)}
                        </small>
                    </div>

                    <a
                        class="download-btn"
                        href="/api/download/${encodeURIComponent(code)}/${encodeURIComponent(file.id)}"
                    >
                        Download
                    </a>
                `;

                receiverFiles.appendChild(
                    div
                );
            }
        );

    } catch (error) {

        console.error(error);

        receiverArea.classList.add(
            "hidden"
        );

        alert(
            error.message ||
            "Unable to find share."
        );

    } finally {

        findShareBtn.disabled = false;

        findShareBtn.textContent =
            "Find Files";
    }
}


// ==========================================
// QR SCANNER
// ==========================================

scanBtn.addEventListener(
    "click",
    startScanner
);


async function startScanner() {

    if (
        !("BarcodeDetector" in window)
    ) {

        alert(
            "QR scanning is not supported by this browser. Please use Chrome or another supported browser."
        );

        return;
    }

    try {

        scannerArea.classList.remove(
            "hidden"
        );

        scannerStatus.textContent =
            "Starting camera...";

        scannerStream =
            await navigator.mediaDevices.getUserMedia(
                {
                    video: {
                        facingMode: {
                            ideal: "environment"
                        }
                    }
                }
            );

        scannerVideo.srcObject =
            scannerStream;

        const barcodeDetector =
            new BarcodeDetector({
                formats: ["qr_code"]
            });

        scannerStatus.textContent =
            "Point your camera at the QR code.";

        scannerInterval =
            setInterval(
                async () => {

                    try {

                        const barcodes =
                            await barcodeDetector.detect(
                                scannerVideo
                            );

                        if (
                            barcodes.length === 0
                        ) {
                            return;
                        }

                        const value =
                            barcodes[0].rawValue;

                        handleScannedQR(
                            value
                        );

                    } catch (error) {

                        console.error(
                            error
                        );
                    }

                },
                500
            );

    } catch (error) {

        console.error(error);

        scannerStatus.textContent =
            "Camera permission was denied or the camera could not be opened.";
    }
}


// ==========================================
// HANDLE SCANNED QR
// ==========================================

function handleScannedQR(value) {

    stopScanner();

    try {

        const url =
            new URL(value);

        const code =
            url.searchParams.get(
                "code"
            );

        if (
            code &&
            /^\d{6}$/.test(code)
        ) {

            codeInput.value =
                code;

            loadReceiverFiles(
                code
            );

            return;
        }

    } catch (error) {

        console.log(
            "QR is not a URL"
        );
    }

    if (
        /^\d{6}$/.test(value)
    ) {

        codeInput.value =
            value;

        loadReceiverFiles(
            value
        );

        return;
    }

    alert(
        "This QR code is not a Local File Share code."
    );
}


// ==========================================
// STOP SCANNER
// ==========================================

stopScannerBtn.addEventListener(
    "click",
    stopScanner
);


function stopScanner() {

    if (scannerInterval) {

        clearInterval(
            scannerInterval
        );

        scannerInterval = null;
    }

    if (scannerStream) {

        scannerStream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

        scannerStream = null;
    }

    scannerVideo.srcObject =
        null;

    scannerArea.classList.add(
        "hidden"
    );
}


// ==========================================
// AUTO READ CODE FROM URL
// ==========================================

const urlParams =
    new URLSearchParams(
        window.location.search
    );

const urlCode =
    urlParams.get("code");

if (
    urlCode &&
    /^\d{6}$/.test(urlCode)
) {

    codeInput.value =
        urlCode;

    loadReceiverFiles(
        urlCode
    );
}


// ==========================================
// HELPERS
// ==========================================

function formatBytes(bytes) {

    if (bytes === 0) {
        return "0 Bytes";
    }

    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB",
        "TB"
    ];

    const i =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );

    return (
        parseFloat(
            (
                bytes /
                Math.pow(
                    1024,
                    i
                )
            ).toFixed(2)
        ) +
        " " +
        units[i]
    );
}


function escapeHTML(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );
}