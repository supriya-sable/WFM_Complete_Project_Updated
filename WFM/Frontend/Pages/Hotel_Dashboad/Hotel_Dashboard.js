document.addEventListener('DOMContentLoaded', () => {
    
    // --- Configuration ---
    const API_BASE_URL = 'http://127.0.0.1:8000';
    const hotelPostForm = document.querySelector('.food-post-form');
    
    // Modal Elements
    const editModal = document.getElementById('editModal');
    const modalCloseBtn = document.getElementById('modalClose');
    const modalCancelBtn = document.getElementById('modalCancel');
    const modalSaveBtn = document.getElementById('modalSave');
    const editForm = document.getElementById('editForm');
    const editPostIdInput = document.getElementById('edit-post-id');

    // Attempt to get the User_ID from session storage
    const loggedInUserIdString = sessionStorage.getItem('user_id'); 
    const loggedInUserId = parseInt(loggedInUserIdString) || 1; 

    if (loggedInUserId === 1 && loggedInUserIdString !== "1") {
        console.error("User ID not found in session storage. Defaulting to User ID 1. Please ensure login saves 'user_id' correctly.");
    }
    
    // Function to format DateTime objects
    const formatExpiryTime = (isoString) => {
        if (!isoString) return 'N/A';
        const date = new Date(isoString);
        return date.toLocaleString();
    };


    // --- Core API Update Function (Edit/Cancel) ---
    const updateFoodPost = async (foodId, updatePayload) => {
        try {
            const response = await fetch(`${API_BASE_URL}/food/update/${foodId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatePayload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Failed to update post.');
            }

            alert(`Post ID ${foodId} updated successfully!`);
            fetchMyListings(); 
            fetchDashboardStats(); 
        } catch (error) {
            alert(`Error updating post: ${error.message}`);
            console.error('Update API Error:', error);
        }
    };
    
    // --- NEW: Function to Handle Accept/Reject API Calls ---
    const updateRequestStatus = async (requestId, newStatus, foodPostId) => {
        try {
            // This calls the PUT /pickup/request/update/{request_id} API
            const response = await fetch(`${API_BASE_URL}/pickup/request/update/${requestId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                // Food_Post_ID is required by the backend to update the status of the food item
                body: JSON.stringify({ Request_Status: newStatus, Food_Post_ID: parseInt(foodPostId) })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Failed to ${newStatus.toLowerCase()} request.`);
            }

            alert(`Request ${requestId} successfully marked as ${newStatus}!`);
            fetchHotelPickupRequests(); // Refresh the requests table
            fetchMyListings(); // Refresh listings to show status change
            fetchDashboardStats(); // Refresh stats
        } catch (error) {
            alert(`Error: ${error.message}`);
            console.error('Request Update API Error:', error);
        }
    };


    // --- Dashboard Stats Fetching (Analytics) ---
    async function fetchDashboardStats() {
        if (!loggedInUserId) return;

        try {
            const response = await fetch(`${API_BASE_URL}/hotel/stats/${loggedInUserId}`);
            if (!response.ok) throw new Error('Failed to fetch dashboard stats.');
            const stats = await response.json();
            document.getElementById('totalDonations').textContent = stats.total_donations || 0;
            document.getElementById('pendingRequests').textContent = stats.pending_requests || 0;
            document.getElementById('completedDonations').textContent = stats.completed_donations || 0;
            document.getElementById('notificationsCount').textContent = 0; 
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            document.getElementById('totalDonations').textContent = 0;
            document.getElementById('pendingRequests').textContent = 0;
            document.getElementById('completedDonations').textContent = 0;
        }
    }


    // --- Profile Fetching ---
    async function fetchUserProfile() {
        if (!loggedInUserId) {
            document.getElementById('hotelName').textContent = 'Guest';
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/user/profile/${loggedInUserId}`);
            if (!response.ok) throw new Error('Failed to fetch user profile.');
            const userProfile = await response.json();
            console.log(userProfile)
            document.getElementById('hotelName').textContent = userProfile.Name || 'Hotel/Restaurant';
            document.querySelector('.hotel-tagline').textContent = `Address: ${userProfile.Adress || 'N/A'}`;
            document.getElementById('profile-name').value = userProfile.Name || '';
            document.getElementById('profile-address').value = userProfile.Adress || '';
            document.getElementById('profile-contact').value = userProfile.Phone_No || '';
        } catch (error) {
            console.error('Error fetching profile:', error);
            // document.getElementById('hotelName').textContent = 'Error Loading Profile';
        }
    }


    // --- Function to Fetch and Populate My Listings ---
    async function fetchMyListings() {
        const tableBody = document.getElementById('myListingsTableBody');
        tableBody.innerHTML = ''; 

        if (!loggedInUserId) {
             tableBody.innerHTML = '<tr><td colspan="7">Please log in to view your listings.</td></tr>';
             return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/food/mylisting/${loggedInUserId}`);
            if (!response.ok) throw new Error('Failed to fetch listings.');
            const listings = await response.json();

            if (listings.length === 0) {
                 tableBody.innerHTML = '<tr><td colspan="7">You have no active food listings.</td></tr>';
                 return;
            }

            listings.forEach(listing => {
                const row = document.createElement('tr');
                
                let actionsHtml = '';
                // Only allow Edit/Cancel if status is not Finalized (e.g., Collected/Cancelled)
                if (listing.Food_Status === 'Available' || listing.Food_Status === 'Claimed' || listing.Food_Status === 'Ready for Delivery') {
                    actionsHtml = `
                        <button class="action-btn btn-edit" data-id="${listing.ID}" data-name="${listing.Food_Name}" data-quantity="${listing.Food_Quantity}" data-quality="${listing.Food_Quality}">Edit</button>
                        <button class="action-btn btn-cancel" data-id="${listing.ID}">Cancel</button>
                    `;
                } else {
                    actionsHtml = `<span class="text-gray-500">No actions</span>`;
                }
                
                const fullImageUrl = listing.Food_Image_URL ? 
                                     `${API_BASE_URL}/${listing.Food_Image_URL}` : 
                                     'https://placehold.co/50x50/cccccc/333333?text=No+Img';
                
                const expiryDisplay = formatExpiryTime(listing.Expiry_Time);

                row.innerHTML = `
                    <td><img src="${fullImageUrl}" alt="${listing.Food_Name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;"></td>
                    <td>${listing.ID}</td>
                    <td>${listing.Food_Name} (${listing.Food_Quality})</td>
                    <td>${listing.Food_Quantity}</td>
                    <td>${expiryDisplay}</td>
                    <td>${listing.Food_Status}</td>
                    <td>${actionsHtml}</td>
                `;
                tableBody.appendChild(row);
            });
            
            attachListingActionListeners();
        } catch (error) {
            console.error('Error fetching user listings:', error);
            tableBody.innerHTML = '<tr><td colspan="7">Error loading listings. Server connection failed.</td></tr>';
        }
    }

    // --- Function to Fetch and Populate PICKUP REQUESTS ---
    async function fetchHotelPickupRequests() {
        const tableBody = document.getElementById('pickupRequestsTableBody');
        tableBody.innerHTML = '<tr><td colspan="6">Fetching pending pickup requests...</td></tr>'; 

        if (!loggedInUserId) {
             tableBody.innerHTML = '<tr><td colspan="6">Please log in to view requests.</td></tr>';
             return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/pickup/requests/hotel/${loggedInUserId}`);
            if (!response.ok) throw new Error('Failed to fetch pickup requests.');

            const requests = await response.json();
            tableBody.innerHTML = ''; 

            if (requests.length === 0) {
                 tableBody.innerHTML = '<tr><td colspan="6">No pending pickup requests at this time.</td></tr>';
                 return;
            }
            
            requests.forEach(request => {
                const row = document.createElement('tr');
                const ngoName = request.ngo_user ? request.ngo_user.Name : 'N/A';
                const foodName = request.food_item ? request.food_item.Food_Name : request.Food_Post_ID;

                let actionsHtml = '';
                if (request.Request_Status === 'Pending') {
                    actionsHtml = `
                        <button class="action-btn btn-accept" data-id="${request.ID}" data-food-id="${request.Food_Post_ID}">Accept</button>
                        <button class="action-btn btn-reject" data-id="${request.ID}" data-food-id="${request.Food_Post_ID}">Reject</button>
                    `;
                } else {
                    actionsHtml = `<span>${request.Request_Status}</span>`;
                }

                row.innerHTML = `
                    <td>${request.ID}</td>
                    <td>${ngoName}</td>
                    <td>${foodName}</td>
                    <td>${formatExpiryTime(request.Request_Time)}</td>
                    <td>${request.Request_Status}</td>
                    <td>${actionsHtml}</td>
                `;
                tableBody.appendChild(row);
            });

            attachRequestActionListeners();
        } catch (error) {
            console.error('Error fetching pickup requests:', error);
            tableBody.innerHTML = '<tr><td colspan="6">Error loading requests. Server connection failed.</td></tr>';
        }
    }

    // --- Action Listeners for My Listings Table (Edit/Cancel) ---
    function attachListingActionListeners() {
        document.getElementById('myListingsTableBody').removeEventListener('click', handleActionClick); 
        document.getElementById('myListingsTableBody').addEventListener('click', handleActionClick);
    }
    
    const handleActionClick = (event) => {
        const target = event.target;
        const foodId = target.getAttribute('data-id');

        if (!foodId) return;

        if (target.classList.contains('btn-cancel')) {
            if (confirm(`Are you sure you want to cancel post ID ${foodId}? This cannot be undone.`)) {
                updateFoodPost(foodId, { Food_Status: 'Cancelled' });
            }
        } else if (target.classList.contains('btn-edit')) {
            const foodName = target.getAttribute('data-name');
            const foodQuantity = target.getAttribute('data-quantity');
            const foodQuality = target.getAttribute('data-quality');

            editPostIdInput.value = foodId; 
            document.getElementById('edit-food-name').value = foodName;
            document.getElementById('edit-food-quantity').value = foodQuantity;
            document.getElementById('edit-food-quality').value = foodQuality;
            
            document.getElementById('modalFoodIdDisplay').textContent = `(ID: ${foodId})`;

            editModal.classList.add('active'); 
        }
    };
    
    // --- Action Listeners for Pickup Requests Table (Accept/Reject) ---
    function attachRequestActionListeners() {
        document.getElementById('pickupRequestsTableBody').removeEventListener('click', handleRequestActionClick); 
        document.getElementById('pickupRequestsTableBody').addEventListener('click', handleRequestActionClick);
    }
    
    const handleRequestActionClick = (event) => {
        const target = event.target;
        const requestId = target.getAttribute('data-id');
        const foodPostId = target.getAttribute('data-food-id');

        if (!requestId) return;

        if (target.classList.contains('btn-accept')) {
            if (confirm(`Accept request ${requestId}? This will schedule pickup.`)) {
                updateRequestStatus(requestId, 'Accepted', foodPostId);
            }
        } else if (target.classList.contains('btn-reject')) {
            if (confirm(`Reject request ${requestId}? The food will become available again.`)) {
                updateRequestStatus(requestId, 'Rejected', foodPostId);
            }
        }
    };


    // --- MODAL EVENT HANDLERS ---
    
    const closeModal = () => {
        editModal.classList.remove('active');
        editForm.reset();
    };

    modalCloseBtn.addEventListener('click', closeModal);
    modalCancelBtn.addEventListener('click', closeModal);
    
    modalSaveBtn.addEventListener('click', () => {
        const foodId = editPostIdInput.value;
        
        const newName = document.getElementById('edit-food-name').value.trim();
        const newQuantity = document.getElementById('edit-food-quantity').value.trim();
        const newQuality = document.getElementById('edit-food-quality').value.trim();
        
        if (!newName || !newQuantity || !newQuality) {
            alert('All fields must be filled out to save changes.');
            return;
        }

        const updatePayload = {
            Food_Name: newName,
            Food_Quantity: newQuantity,
            Food_Quality: newQuality
        };

        updateFoodPost(foodId, updatePayload);
        
        closeModal();
    });


    // --- CORE LOGIC: Post Food Availability (UNCHANGED) ---
    if (hotelPostForm) {
        const foodNameInput = document.getElementById('food-name');
        const foodDescriptionInput = document.getElementById('food-description');
        const foodQuantityInput = document.getElementById('food-quantity');
        const foodQualityInput = document.getElementById('food-quality');
        const expiryTimeInput = document.getElementById('expiry-time-hours');
        const foodImageFileInput = document.getElementById('food-image-file');

        hotelPostForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const formData = new FormData();
            
            formData.append('Food_Name', foodNameInput.value.trim());
            formData.append('Food_Description', foodDescriptionInput.value.trim());
            formData.append('Food_Quantity', foodQuantityInput.value.trim());
            formData.append('Food_Quality', foodQualityInput.value.trim());
            formData.append('User_ID', loggedInUserId);
            
            if (expiryTimeInput.value) {
                formData.append('Expiry_Time_Hours', expiryTimeInput.value); 
            }

            if (foodImageFileInput.files.length > 0) {
                formData.append('food_image_file', foodImageFileInput.files[0]); 
            }
            
            if (!foodNameInput.value || !foodQuantityInput.value || !foodQualityInput.value) {
                alert("Please fill in all required text fields.");
                return;
            }

            try {
                const response = await fetch(`${API_BASE_URL}/food/post`, {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    alert(`Food donation posted successfully! ID: ${data.ID}`);
                    hotelPostForm.reset(); 
                    fetchMyListings();
                    fetchDashboardStats(); 
                } else {
                    const errorResponse = data; 
                    let errorMessage = 'Post Failed: ';

                    if (errorResponse.detail && Array.isArray(errorResponse.detail)) {
                        const missingFields = errorResponse.detail
                            .map(error => {
                                return error.loc[error.loc.length - 1]; 
                            })
                            .join(', ');

                        errorMessage = `Post Failed (422): Please fill out the required fields: ${missingFields}`;
                    } else {
                        errorMessage = `Post Failed: ${errorResponse.detail || 'Unknown server error.'}`;
                    }
                    
                    alert(errorMessage);
                    console.error('API Error Details:', data);
                }

            } catch (error) {
                console.error('Network or Fetch Error:', error);
                alert("Could not connect to the API server. Please check your backend connection.");
            }
        });
    }


    // --- Initial function calls to populate the page ---
    fetchUserProfile();
    fetchMyListings();
    fetchDashboardStats(); 
    fetchHotelPickupRequests(); // Fetch pending pickup requests on load
});