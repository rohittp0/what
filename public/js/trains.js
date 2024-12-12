const token = localStorage.getItem('token');

// If no token, redirect to login page
if (!token) {
    window.location.href = '/';
}

const waitInput = document.getElementById('wait-input');
const searchBtn = document.getElementById('search-btn');
const messageContainer = document.getElementById('message-container')
const resultsSection = document.querySelector('.results-section');
const resultsTable = document.getElementById('results-table').querySelector('tbody');

// Utility to clear existing messages
function clearMessages() {
    const existingInfo = document.querySelector('.info-message');
    const existingError = document.querySelector('.error-message');
    if (existingInfo) existingInfo.remove();
    if (existingError) existingError.remove();
}

// Show an info message
function showInfoMessage(message) {
    clearMessages();
    const msgEl = document.createElement('div');
    msgEl.classList.add('info-message');
    msgEl.textContent = message;
    messageContainer.appendChild(msgEl);
}

// Show an error message
function showErrorMessage(message) {
    clearMessages();
    const msgEl = document.createElement('div');
    msgEl.classList.add('error-message');
    msgEl.textContent = message;
    messageContainer.appendChild(msgEl);
}

function formatTimeDiff(seconds) {
    const totalSeconds = Math.floor(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours} hours ${minutes} minutes`;
}

// Populate the table with data
function populateTable(data) {
    // Clear existing rows
    resultsTable.innerHTML = '';

    if (data.length === 0) {
        showInfoMessage('No trains found for the given wait time.');
        return;
    }

    data.forEach(item => {
        const tr = document.createElement('tr');

        const tdTrain = document.createElement('td');
        tdTrain.textContent = item.train;

        const tdStation = document.createElement('td');
        tdStation.textContent = item.cur_stn;

        const tdArrival = document.createElement('td');
        tdArrival.textContent = new Date(item.train_time).toLocaleString();

        const tdEvent = document.createElement('td');
        tdEvent.textContent = item.event.name;

        const tdWait = document.createElement('td');
        tdWait.textContent = formatTimeDiff(item.time_diff);

        tr.appendChild(tdTrain);
        tr.appendChild(tdStation);
        tr.appendChild(tdArrival);
        tr.appendChild(tdEvent);
        tr.appendChild(tdWait);

        resultsTable.appendChild(tr);
    });

    resultsSection.style.display = 'block';
}

// Fetch trains
async function fetchTrains(wait) {
    clearMessages();

    try {
        const response = await fetch(`/get_trains?wait=${wait}`, {
            headers: {
                'authorization': token
            }
        });

        if (response.status === 401) {
            // Unauthorised - remove token and redirect
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
        }

        if (!response.ok) {
            // Some other error
            showErrorMessage('Failed to fetch trains. Please try again.');
            return;
        }

        const data = await response.json();
        populateTable(data.matched_trains || []);
    } catch (error) {
        showErrorMessage('An error occurred while fetching trains.');
    }
}

// Event listener for search
searchBtn.addEventListener('click', () => {
    const waitVal = waitInput.value.trim();
    if (!waitVal || isNaN(waitVal) || parseInt(waitVal) < 0) {
        showErrorMessage('Please enter a valid wait time in minutes.');
        return;
    }
    searchBtn.disabled = true
    fetchTrains(waitVal).finally(() => searchBtn.disabled = false)
});
