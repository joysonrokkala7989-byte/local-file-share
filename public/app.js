const fileInput = document.getElementById("fileInput");
const dropArea = document.getElementById("dropArea");
const uploadButton = document.getElementById("uploadButton");

const selectedFile = document.getElementById("selectedFile");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("status");

let file = null;


// Select file
fileInput.addEventListener("change", () => {

    if (fileInput.files.length > 0) {

        file = fileInput.files[0];

        showSelectedFile();
    }

});


// Drag and drop
dropArea.addEventListener("dragover", (event) => {

    event.preventDefault();

    dropArea.classList.add("dragover");

});


dropArea.addEventListener("dragleave", () => {

    dropArea.classList.remove("dragover");

});


dropArea.addEventListener("drop", (event) => {

    event.preventDefault();

    dropArea.classList.remove("dragover");

    if (event.dataTransfer.files.length > 0) {

        file = event.dataTransfer.files[0];

        showSelectedFile();
    }

});


// Show selected file
function showSelectedFile() {

    selectedFile.innerHTML =
        `📄 <strong>${file.name}</strong>
        (${formatSize(file.size)})`;

}


// Send file
uploadButton.addEventListener("click", () => {

    if (!file) {

        statusText.textContent =
            "Please select a file first.";

        return;
    }


    const formData = new FormData();

    formData.append("file", file);


    const xhr = new XMLHttpRequest();

    xhr.open("POST", "/upload");


    // Upload progress
    xhr.upload.addEventListener("progress", (event) => {

        if (event.lengthComputable) {

            const percent =
                (event.loaded / event.total) * 100;

            progressBar.style.width =
                percent + "%";

            statusText.textContent =
                `Uploading ${Math.round(percent)}%`;
        }

    });


    // Upload finished
    xhr.addEventListener("load", () => {

        if (xhr.status === 200) {

            statusText.textContent =
                "✅ File sent successfully!";

            progressBar.style.width = "100%";

            loadFiles();

        } else {

            statusText.textContent =
                "❌ Upload failed.";

        }

    });


    // Network error
    xhr.addEventListener("error", () => {

        statusText.textContent =
            "❌ Network error.";

    });


    xhr.send(formData);

});


// Load received files
async function loadFiles() {

    try {

        const response =
            await fetch("/files");

        const files =
            await response.json();


        const fileList =
            document.getElementById("fileList");


        if (files.length === 0) {

            fileList.innerHTML =
                "No files received yet.";

            return;
        }


        fileList.innerHTML = "";


        files.forEach((filename) => {

            const item =
                document.createElement("div");

            item.className =
                "file-item";


            item.innerHTML = `

                <span>📄 ${filename}</span>

                <a
                    class="download-button"
                    href="/download/${encodeURIComponent(filename)}"
                >
                    Download
                </a>

            `;


            fileList.appendChild(item);

        });


    } catch (error) {

        console.error(error);

    }

}


// Format file size
function formatSize(bytes) {

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


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (
        bytes /
        Math.pow(1024, index)
    ).toFixed(2) +
    " " +
    units[index];

}


// Load files when page opens
loadFiles();
