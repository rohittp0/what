const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const resultSection = document.getElementById('result-section');
const fileUrlEl = document.getElementById('file-url');
const filePreview = document.getElementById('file-preview');
const messagesEl = document.getElementById('messages');

function showError(message) {
    messagesEl.textContent = message;
    messagesEl.style.display = 'block';
    uploadBtn.disabled = false;
}

function clearError() {
    messagesEl.style.display = 'none';
}

uploadBtn.addEventListener('click', async () => {
    clearError();
    uploadBtn.disabled = true;

    const file = fileInput.files[0];
    if (!file) {
        showError('Please select a file before uploading.');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            showError('Failed to upload. Please try again.');
            return;
        }

        const data = await response.json();
        if (!data.imageUrl) {
            showError('No image URL returned from server.');
            return;
        }

        fileUrlEl.href = data.imageUrl;
        filePreview.src = data.imageUrl;
        resultSection.style.display = 'block';
        uploadBtn.disabled = false;

    } catch (error) {
        showError('An error occurred during upload.');
    }
});
