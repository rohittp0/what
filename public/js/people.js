const token = localStorage.getItem('token');
if (!token) {
    window.location.href = '/';
}

const messagesEl = document.getElementById('messages');
const membersGrid = document.getElementById('members-grid');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

let currentPage = 1;

// Store invalid pages in localStorage
let invalidPages = JSON.parse(localStorage.getItem('invalid_pages')) || [];

// Load details cache from localStorage
let memberDetailsCache = {};
try {
    const cachedDetails = localStorage.getItem('member_details_cache');
    if (cachedDetails) {
        memberDetailsCache = JSON.parse(cachedDetails);
    }
} catch (e) {
    // If parsing error, reset cache
    memberDetailsCache = {};
}

function saveInvalidPages() {
    localStorage.setItem('invalid_pages', JSON.stringify(invalidPages));
}

function saveDetailsCache() {
    localStorage.setItem('member_details_cache', JSON.stringify(memberDetailsCache));
}

function clearMessages() {
    messagesEl.innerHTML = '';
}

function showInfoMessage(message) {
    clearMessages();
    const msg = document.createElement('div');
    msg.classList.add('info-message');
    msg.textContent = message;
    messagesEl.appendChild(msg);
}

function showErrorMessage(message) {
    clearMessages();
    const msg = document.createElement('div');
    msg.classList.add('error-message');
    msg.textContent = message;
    messagesEl.appendChild(msg);
}

async function fetchPage(page) {
    // Skip invalid pages
    while (invalidPages.includes(page)) {
        return null;
    }

    try {
        const response = await fetch(`/members/${page}`, {
            headers: {
                'authorization': token
            }
        });

        if (response.status === 401) {
            // Unauth - remove token and redirect
            localStorage.removeItem('token');
            window.location.href = '/';
            return null;
        }

        if (!response.ok) {
            showErrorMessage('Failed to fetch members. Please try again.');
            return null;
        }

        const data = await response.json();
        // If data is null or empty, return null
        if (!data || data.length === 0) return null;

        return data;
    } catch (error) {
        showErrorMessage('An error occurred while fetching members.');
        return null;
    }
}

async function fetchMemberDetails(uid) {
    if (memberDetailsCache[uid]) {
        // Return from localStorage cache if available
        return memberDetailsCache[uid];
    }

    try {
        const response = await fetch(`/member/${uid}`, {
            headers: {
                'authorization': token
            }
        });
        if (response.status === 401) {
            // Unauth - remove token and redirect
            localStorage.removeItem('token');
            window.location.href = '/';
            return null;
        }

        if (!response.ok) {
            // Some error, just return null
            return null;
        }

        const data = await response.json();
        // Cache the details in memory and localStorage
        memberDetailsCache[uid] = data;
        saveDetailsCache();
        return data;
    } catch {
        return null;
    }
}

function createCallButton(phoneNumber) {
    const callBtn = document.createElement('a');
    callBtn.href = `tel:${phoneNumber}`;
    callBtn.textContent = 'Call';
    callBtn.classList.add('call-button');
    return callBtn;
}

function createCard(member, details) {
    const card = document.createElement('div');
    card.classList.add('card');

    // If details with avatar and name
    if (details && details.avatar) {
        const avatarImg = document.createElement('img');
        avatarImg.src = details.avatar;
        avatarImg.alt = details.name || 'Avatar';
        avatarImg.classList.add('avatar');
        card.appendChild(avatarImg);
    }

    const name = document.createElement('h2');
    name.textContent = (details && details.name) || member.inviteeName || 'Unknown';
    card.appendChild(name);

    // Call button instead of showing the phone number
    if (member.inviteePhoneNumber) {
        const callBtn = createCallButton(member.inviteePhoneNumber);
        card.appendChild(callBtn);
    }

    const status = document.createElement('p');
    status.textContent = `Status: ${member.status || 'N/A'}`;
    card.appendChild(status);

    // If we have details, show them properly
    if (details) {
        const bio = document.createElement('p');
        bio.textContent = details.bio ? `Bio: ${details.bio}` : 'No bio available';
        card.appendChild(bio);

        const interests = document.createElement('p');
        interests.textContent = details.interests ? `Interests: ${details.interests}` : 'No interests listed';
        card.appendChild(interests);

        // Show social links if available
        const socials = [];
        if (details.github) socials.push(`GitHub: ${details.github}`);
        if (details.instagram) socials.push(`Instagram: ${details.instagram}`);
        if (details.linkedin) socials.push(`LinkedIn: ${details.linkedin}`);
        if (details.twitter) socials.push(`Twitter: ${details.twitter}`);

        if (socials.length > 0) {
            const socialsEl = document.createElement('p');
            socialsEl.textContent = socials.join(' | ');
            card.appendChild(socialsEl);
        }
    }

    return card;
}

async function loadPage(page) {
    clearMessages();
    membersGrid.innerHTML = '';

    const data = await fetchPage(page);
    if (!data) {
        // Mark this page invalid if not already
        if (!invalidPages.includes(page)) {
            invalidPages.push(page);
            saveInvalidPages();
        }
        showInfoMessage(`No data found for page ${page}, skipping...`);
        return false;
    }

    for (const member of data) {
        let details = null;
        if (member.inviteeUniqueId) {
            details = await fetchMemberDetails(member.inviteeUniqueId);
        }

        const card = createCard(member, details);
        membersGrid.appendChild(card);
    }

    return true;
}

async function loadValidPage(page, direction) {
    // direction = 'next' or 'prev'
    // Try to load the page, if invalid skip, move next/prev until we find a valid one or can't
    let tries = 0;
    const maxTries = 50; // safety limit
    let loaded = await loadPage(page);
    while (!loaded && tries < maxTries) {
        tries++;
        page = direction === 'next' ? page + 1 : page - 1;
        if (page <= 0) {
            showInfoMessage('No more pages available.');
            return null;
        }
        if (!invalidPages.includes(page)) {
            loaded = await loadPage(page);
        }
    }

    return loaded ? page : null;
}

(async () => {
    const loadedPage = await loadValidPage(currentPage, 'next');
    if (loadedPage) currentPage = loadedPage;
})();

nextBtn.addEventListener('click', async () => {
    const nextPage = currentPage + 1;
    const loadedPage = await loadValidPage(nextPage, 'next');
    if (loadedPage) currentPage = loadedPage;
});

prevBtn.addEventListener('click', async () => {
    if (currentPage <= 1) {
        showInfoMessage('You are already at the first page.');
        return;
    }

    const prevPage = currentPage - 1;
    const loadedPage = await loadValidPage(prevPage, 'prev');
    if (loadedPage) currentPage = loadedPage;
    else {
        showInfoMessage('No previous valid page found.');
    }
});
