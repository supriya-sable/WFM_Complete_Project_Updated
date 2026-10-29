document.addEventListener('DOMContentLoaded', () => {
    
    // --- Configuration ---
    const API_BASE_URL = 'http://127.0.0.1:8000';
    
    // Attempt to get the User_ID from session storage
    const loggedInUserIdString = sessionStorage.getItem('user_id'); 
    const loggedInUserId = Number.parseInt(loggedInUserIdString || '', 10); 

    if (!Number.isInteger(loggedInUserId) || loggedInUserId <= 0) {
        alert('Please log in as an NGO to use the dashboard.');
        window.location.href = '../Login/Login_page.html';
        return;
    }
    
    // Function to format DateTime objects
    const formatExpiryTime = (isoString) => {
        if (!isoString || isoString === 'N/A') return 'N/A';
        const date = new Date(isoString);
        return date.toLocaleString();
    };

    // --- Helper Function: Fetches Donor Name by ID ---
    const fetchDonorProfile = async (userId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/user/profile/${userId}`);
            if (response.ok) {
                const profile = await response.json();
                return { Name: profile.Name, Adress: profile.Adress };
            }
        } catch (e) {
            console.error(`Failed to fetch profile for user ${userId}`);
        }
        return { Name: "Unknown Donor", Adress: "N/A" };
    };

    // --- Core API: Request Pickup (POST) ---
    const requestPickup = async (foodPostId) => {
        if (!loggedInUserId || loggedInUserId === 1) {
            alert("Error: Please log in as a registered NGO to request a pickup.");
            return;
        }

        const requestPayload = {
            Food_Post_ID: foodPostId,
            NGO_User_ID: loggedInUserId,
        };

        try {
            const response = await fetch(`${API_BASE_URL}/pickup/request`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            });

            const data = await response.json();

            if (!response.ok) {
                const errorMessage = data.detail || 'Failed to submit pickup request.';
                alert(`Request Failed: ${errorMessage}`);
                throw new Error(errorMessage);
            }

            alert(`Pickup request for Food ID ${foodPostId} submitted successfully! Status updated to Claimed.`);
            fetchAvailableDonations();
            fetchMyPickups();
            fetchNGODashboardStats();
        } catch (error) {
            console.error('Pickup Request API Error:', error);
        }
    };

    // --- NEW: Mark Collected (PUT) Function ---
    const markCollected = async (requestId, foodPostId) => {
        try {
            const newStatus = 'Collected';
            // Calls the PUT /pickup/request/update/{request_id} API
            const response = await fetch(`${API_BASE_URL}/pickup/request/update/${requestId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                // Payload includes both IDs and the final status
                body: JSON.stringify({ Request_Status: newStatus, Food_Post_ID: foodPostId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to mark as collected.');
            }

            alert(`Pickup Request ID ${requestId} successfully marked as COLLECTED!`);
            fetchMyPickups(); // Refresh the pickups list
            fetchNGODashboardStats(); // Update stats
        } catch (error) {
            alert(`Error: ${error.message}`);
            console.error('Mark Collected API Error:', error);
        }
    };
    // --- END Mark Collected Function ---


    // --- Dashboard Stats Fetching (Analytics) ---
    async function fetchNGODashboardStats() {
        if (!loggedInUserId) return;

        try {
            const response = await fetch(`${API_BASE_URL}/ngo/stats/${loggedInUserId}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch dashboard stats.');
            }

            const stats = await response.json();
            
            // Populate the stat cards
            document.getElementById('completedPickups').textContent = stats.completed_pickups || 0;
            document.getElementById('ongoingPickups').textContent = stats.ongoing_pickups || 0;
            document.getElementById('pendingRequests').textContent = stats.pending_requests || 0;
            document.getElementById('newDonations').textContent = stats.new_donations || 0; 
            
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            document.getElementById('completedPickups').textContent = 0;
            document.getElementById('ongoingPickups').textContent = 0;
            document.getElementById('pendingRequests').textContent = 0;
            document.getElementById('newDonations').textContent = 0;
        }
    }

    // --- Profile Fetching (NGO Name/Address) ---
    async function fetchNGOProfile() {
        if (!loggedInUserId) return;

        try {
            const response = await fetch(`${API_BASE_URL}/user/profile/${loggedInUserId}`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch user profile.');
            }

            const userProfile = await response.json();
            
            document.getElementById('ngoName').textContent = userProfile.Name || 'NGO Name';
            document.querySelector('.ngo-tagline').textContent = userProfile.Adress || 'Feeding Communities, One Meal at a Time';
        } catch (error) {
            console.error('Error fetching profile:', error);
            document.getElementById('ngoName').textContent = 'Error Loading Profile';
        }
    }


    // --- 1. Available Food Donations (Fetches NEW Posts) ---
    async function fetchAvailableDonations() {
        const tableBody = document.getElementById('availableDonationsTableBody');
        tableBody.innerHTML = '<tr><td colspan="6">Fetching available food listings...</td></tr>'; 

        try {
            const response = await fetch(`${API_BASE_URL}/food/available`);
            
            if (!response.ok) {
                throw new Error('Failed to fetch available food listings.');
            }

            const availablePosts = await response.json();

            tableBody.innerHTML = ''; 

            if (availablePosts.length === 0) {
                 tableBody.innerHTML = '<tr><td colspan="6">No food is currently available for donation. Check back later!</td></td>';
                 return;
            }
            
            for (const post of availablePosts) {
                const donor = await fetchDonorProfile(post.User_ID);
                
                const row = document.createElement('tr');
                const expiryDisplay = post.Expiry_Time ? formatExpiryTime(post.Expiry_Time) : 'N/A';
                
                row.innerHTML = `
                    <td>${donor.Name}</td>
                    <td>${post.Food_Name} (${post.Food_Quality})</td>
                    <td>${post.Food_Quantity}</td>
                    <td>${donor.Adress}</td>
                    <td>${expiryDisplay}</td>
                    <td>
                        <button class="action-btn btn-view" data-id="${post.ID}">View Details</button>
                        <button class="action-btn btn-request" data-id="${post.ID}">Send Request</button>
                    </td>
                `;
                tableBody.appendChild(row);
            }

            attachDonationActionListeners();

        } catch (error) {
            console.error('Error fetching available donations:', error);
            tableBody.innerHTML = '<tr><td colspan="6">Error loading donations. Please check the backend server.</td></tr>';
        }
    }

    
    // --- 2. My Pickup Requests (Shows NGO's Status Tracking) ---
    async function fetchMyPickups() {
        const tableBody = document.getElementById('myPickupsTableBody'); 
        tableBody.innerHTML = '<tr><td colspan="8">Loading your pickup requests...</td></tr>'; 

        if (!loggedInUserId) {
             tableBody.innerHTML = '<tr><td colspan="8">Please log in to view your requests.</td></tr>';
             return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/pickup/myrequests/${loggedInUserId}`);
            if (!response.ok) {
                throw new Error('Failed to fetch pickup history.');
            }
            
            const requests = await response.json();
            console.log(requests)
            tableBody.innerHTML = ''; 

            if (requests.length === 0) {
                 tableBody.innerHTML = '<tr><td colspan="8">You have no active or historical pickup requests.</td></tr>';
                 return;
            }
            
            // The response schema does not always include food_item.donor.
            // Resolve each donor through /user/profile/{User_ID} instead.
            const requestsWithDonors = await Promise.all(requests.map(async (request) => {
                const food = request.food_item || {};
                const donorId = food.User_ID;
                const donor = donorId ? await fetchDonorProfile(donorId) : { Name: "Unknown Donor", Adress: "N/A" };
                return { ...request, _donor: donor };
            }));

            requestsWithDonors.forEach(request => {
                const row = document.createElement('tr');
                const food = request.food_item || {};
                const donorName = request._donor?.Name || 'Unknown Donor';
                const foodName = food.Food_Name || 'N/A';
                const foodQuantity = food.Food_Quantity || 'N/A';
                const foodPostId = request.Food_Post_ID;
                const requestId = request.ID;
                const requestStatus = request.Request_Status || 'Pending';

                let actionsHtml = '';
                if (requestStatus === 'Accepted' || requestStatus === 'Ready for Delivery') {
                    actionsHtml = `<button class="action-btn btn-collected" data-id="${escapeHTML(requestId)}" data-food-id="${escapeHTML(foodPostId)}">Mark Collected</button>`;
                } else if (requestStatus === 'Collected') {
                    actionsHtml = `<span class="text-green-500 font-bold">Completed</span>`;
                } else if (requestStatus === 'Rejected') {
                    actionsHtml = `<span class="text-gray-500">Rejected</span>`;
                } else {
                    actionsHtml = `<span class="text-orange-500">Pending</span>`;
                }

                const imagePath = food.Food_Image_URL;
                const fullImageUrl = imagePath
                    ? (imagePath.startsWith('http') ? imagePath : `${API_BASE_URL}/${imagePath.replace(/^\//, '')}`)
                    : 'https://placehold.co/50x50/cccccc/333333?text=No+Img';

                row.innerHTML = `
                    <td><img src="${escapeHTML(fullImageUrl)}" alt="${escapeHTML(foodName)}" style="width:50px;height:50px;object-fit:cover;border-radius:4px;"></td>
                    <td>${escapeHTML(requestId)}</td>
                    <td>${escapeHTML(foodName)}</td>
                    <td>${escapeHTML(donorName)}</td>
                    <td>${escapeHTML(foodQuantity)}</td>
                    <td>${escapeHTML(formatExpiryTime(request.Request_Time))}</td>
                    <td>${escapeHTML(requestStatus)}</td>
                    <td>${actionsHtml}</td>
                `;
                tableBody.appendChild(row);
            });
            attachMyPickupsActionListeners();

        } catch (error) {
            console.error('Error fetching pickup history:', error);
            tableBody.innerHTML = '<tr><td colspan="8">Error loading pickup history.</td></tr>';
        }
    }


    // --- Action Listener for Available Donations (Request Pickup) ---
    function attachDonationActionListeners() {
        document.getElementById('availableDonationsTableBody').removeEventListener('click', handleDonationActionClick); 
        document.getElementById('availableDonationsTableBody').addEventListener('click', handleDonationActionClick);
    }
    
    const handleDonationActionClick = (event) => {
        const target = event.target;
        const foodPostId = parseInt(target.getAttribute('data-id'));

        if (!foodPostId) return;

        if (target.classList.contains('btn-request')) {
            if (confirm(`Do you want to submit a pickup request for this food item (ID: ${foodPostId})?`)) {
                requestPickup(foodPostId);
            }
        } else if (target.classList.contains('btn-view')) {
            alert(`Viewing details for Food ID ${foodPostId}. Status: Available.`);
        }
    };
    
    // --- Action Listener for Mark Collected (NEW) ---
    function attachMyPickupsActionListeners() {
        document.getElementById('myPickupsTableBody').removeEventListener('click', handleMyPickupsActionClick); 
        document.getElementById('myPickupsTableBody').addEventListener('click', handleMyPickupsActionClick);
    }
    
    const handleMyPickupsActionClick = (event) => {
        const target = event.target;
        const requestId = target.getAttribute('data-id');
        const foodPostId = target.getAttribute('data-food-id');

        if (!requestId || !foodPostId) return;

        if (target.classList.contains('btn-collected')) {
            if (confirm(`Confirm collection for Request ID ${requestId}? This will finalize the donation.`)) {
                // Call the markCollected function
                markCollected(parseInt(requestId), parseInt(foodPostId));
            }
        }
    };


    // Escape values before inserting API data into HTML.
    function escapeHTML(value) {
        return String(value ?? '').replace(/[&<>"']/g, character => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    // Logout links in the header/sidebar.
    document.querySelectorAll('a').forEach(link => {
        if (link.textContent.trim().toLowerCase() === 'logout') {
            link.addEventListener('click', event => {
                event.preventDefault();
                sessionStorage.removeItem('user_id');
                sessionStorage.removeItem('user_type');
                window.location.href = '../Welcome/Welcome_page.html';
            });
        }
    });

    // --- Initial function calls ---
    fetchNGOProfile();
    fetchNGODashboardStats();
    fetchAvailableDonations();
    fetchMyPickups();
});