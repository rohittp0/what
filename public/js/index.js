const errorMessageEl = document.getElementById('error-message');
const phoneSection = document.getElementById('phone-section');
const otpSection = document.getElementById('otp-section');
const phoneInput = document.getElementById('phone-input');
const otpInput = document.getElementById('otp-input');
const sendOtpBtn = document.getElementById('send-otp-btn');
const loginBtn = document.getElementById('login-btn');

// Check if token already in local storage
const existingToken = localStorage.getItem('token');
if (existingToken) {
    // Already logged in
    window.location.href = '/trains.html';
}

// Show an error message
function showError(message) {
    errorMessageEl.textContent = message;
    errorMessageEl.style.display = 'block';
}

// Hide error message
function hideError() {
    errorMessageEl.style.display = 'none';
}

// Validate phone number (10 digit)
function validatePhone(phone) {
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone);
}

// Send OTP
sendOtpBtn.addEventListener('click', async () => {
    hideError();
    const phone = phoneInput.value.trim();

    // Validate phone
    if (!validatePhone(phone)) {
        showError('Please enter a valid 10-digit phone number.');
        return;
    }

    try {
        const response = await fetch('/send_otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '+91' + phone })
        });

        if (!response.ok) {
            showError('Failed to send OTP. Please try again.');
            return;
        }

        const data = await response.json();
        // If OTP sent successfully, show OTP input
        phoneSection.style.display = 'none';
        otpSection.style.display = 'block';

    } catch (error) {
        showError('An error occurred while sending OTP.');
    }
});

// Login with OTP
loginBtn.addEventListener('click', async () => {
    hideError();
    const phone = phoneInput.value.trim();
    const otp = otpInput.value.trim();

    if (!otp) {
        showError('Please enter the OTP.');
        return;
    }

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: '+91' + phone, otp: otp })
        });

        if (!response.ok) {
            const errorData = await response.json();
            showError(errorData.error || 'Failed to login. Check OTP and try again.');
            return;
        }

        const data = await response.json();
        // Save token in localStorage
        localStorage.setItem('token', data.token);
        // Redirect to trains page
        window.location.href = '/trains.html';

    } catch (error) {
        showError('An error occurred while logging in.');
    }
});
