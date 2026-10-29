document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('.login-form');
    // Define the base API URL
    const API_BASE_URL = 'http://127.0.0.1:8000'; 
    
    // Function to show/hide the error message UI
    const displayError = (message) => {
        // Since we don't have a central message box, we use a temporary alert
        // In a real app, this should display in a dedicated error box near the form.
        alert(`Login Error: ${message}`);
    };

    if (loginForm) {
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');

        const emailError = document.getElementById('emailError');
        const passwordError = document.getElementById('passwordError');

        // Helper function to handle form submission
        const handleLogin = async (email, password) => {
            // The backend identifies the account by email and returns its stored role.
            // User_Type is included for compatibility with the Pydantic login schema.
            const loginPayload = {
                Email: email,
                User_Type: "Hotel",
                Password: password
            };

            try {
                const response = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(loginPayload)
                });

                const data = await response.json();

                if (response.ok) {
                    // --- SUCCESS ---
                    console.log('Login successful!', data);
                    
                    // Determine which dashboard to redirect to
                    const normalizedType = String(data.user_type || '').trim().toLowerCase();
                    const dashboard = normalizedType === 'ngo' ?
                                      '../NGO_Dashboard/Ngo_Dashboard.html' :
                                      '../Hotel_Dashboad/Hotel_dashboard.html';

                    // Save user info (ID, type) to session storage for dashboard access
                    sessionStorage.setItem('user_id', data.user_id);
                    sessionStorage.setItem('user_type', data.user_type);
                    
                    alert(`Login successful as ${data.user_type}! Redirecting...`);
                    window.location.href = dashboard;

                } else {
                    // --- API ERROR ---
                    // Handle FastAPI HTTPException detail
                    const errorDetail = data.detail || "An unknown error occurred.";
                    displayError(errorDetail);
                    console.error('API Error:', data);
                }
            } catch (error) {
                // --- NETWORK ERROR ---
                // Handle network issues (CORS, server not running)
                console.error('Network or Fetch Error:', error);
                displayError("Could not connect to the API server. Please check if the backend is running.");
            }
        };


        loginForm.addEventListener('submit', (event) => {
            event.preventDefault(); // Prevent the form from submitting immediately

            // Reset all error messages
            document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
            document.querySelectorAll('.form-group').forEach(el => el.classList.remove('invalid'));

            let isValid = true;

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInput.value.trim())) {
                emailError.textContent = 'Please enter a valid email address.';
                emailInput.closest('.form-group').classList.add('invalid');
                isValid = false;
            }

            // Password validation (simple check for non-empty)
            if (passwordInput.value.trim() === '') {
                passwordError.textContent = 'Password is required.';
                passwordInput.closest('.form-group').classList.add('invalid');
                isValid = false;
            }

            if (isValid) {
                handleLogin(emailInput.value.trim(), passwordInput.value);
            }
        });
    }
});

