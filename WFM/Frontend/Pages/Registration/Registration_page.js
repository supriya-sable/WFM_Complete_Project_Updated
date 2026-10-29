document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', () => {
            const input = document.getElementById(button.dataset.target);
            if (!input) return;
            const showing = input.type === 'password';
            input.type = showing ? 'text' : 'password';
            button.innerHTML = showing ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
            button.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
        });
    });


    // --- Registration Form Logic and API Call ---
    const userTypeHeading = document.getElementById('userTypeHeading');
    const registrationForm = document.querySelector('.registration-form');
    const API_BASE_URL = 'http://127.0.0.1:8000';
    
    // 1. Get and Display User Type from URL
    const urlParams = new URLSearchParams(window.location.search);
    const userType = (urlParams.get('type') || '').trim().toLowerCase(); // 'ngo' or 'hotel'

    if (userTypeHeading) {
        if (userType) {
            const formattedUserType = userType === 'ngo' ? 'NGO' : 'Hotel';
            userTypeHeading.textContent = `You are registering as a ${formattedUserType}.`;
        } else {
            // Display an error if the user type is missing from the URL
            userTypeHeading.textContent = 'ERROR: User Type Missing.';
        }
    }


    if (registrationForm) {
        // 2. Select form elements and error containers
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const phoneInput = document.getElementById('phone');
        const addressTextarea = document.getElementById('address');

        const nameError = document.getElementById('nameError');
        const emailError = document.getElementById('emailError');
        const passwordError = document.getElementById('passwordError');
        const confirmPasswordError = document.getElementById('confirmPasswordError');
        const phoneError = document.getElementById('phoneError');
        const addressError = document.getElementById('addressError');
        
        // Helper function to mark a field as invalid
        const markInvalid = (inputElement, errorMessageElement, message) => {
            errorMessageElement.textContent = message;
            inputElement.closest('.form-group').classList.add('invalid');
            isValid = false;
        };

        // 3. Form Submission Handler
        registrationForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            // Reset all error messages and classes
            document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
            document.querySelectorAll('.form-group').forEach(el => el.classList.remove('invalid'));

            let isValid = true;

            // --- CRITICAL CHECK: Ensure User Type is available ---
            if (!userType || (userType !== 'ngo' && userType !== 'hotel')) {
                alert("Registration failed: Missing or invalid user type (must be 'ngo' or 'hotel'). Please go back to the welcome page and choose a registration type.");
                return; // Stop the function immediately
            }
            // --- End CRITICAL CHECK ---
            
            // --- Validation Checks ---
            if (nameInput.value.trim() === '') {
                markInvalid(nameInput, nameError, 'Name/Organization name is required.');
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInput.value.trim())) {
                markInvalid(emailInput, emailError, 'Please enter a valid email address.');
            }
            if (passwordInput.value.trim() === '') {
                markInvalid(passwordInput, passwordError, 'Password is required.');
            }
            if (passwordInput.value !== confirmPasswordInput.value) {
                markInvalid(confirmPasswordInput, confirmPasswordError, 'Passwords do not match.');
            }
            const phoneRegex = /^[0-9]{10,15}$/;
            if (!phoneRegex.test(phoneInput.value.trim())) {
                markInvalid(phoneInput, phoneError, 'Please enter a valid phone number (10-15 digits).');
            }
            if (addressTextarea.value.trim() === '') {
                markInvalid(addressTextarea, addressError, 'Address is required.');
            }

            // 4. If all validations pass, send data to the API
            if (isValid) {
                const registrationPayload = {
                    Name: nameInput.value.trim(),
                    // User_Type is guaranteed to be 'ngo' or 'hotel' here
                    User_Type: userType.charAt(0).toUpperCase() + userType.slice(1), 
                    Email: emailInput.value.trim(),
                    Password: passwordInput.value,
                    Phone_No: phoneInput.value.trim(),
                    Adress: addressTextarea.value.trim()
                };
                
                // IMPORTANT: Ensure the User_Type sent to the DB is capitalized (Hotel or NGO)
                // as your DB table shows capitalized values.
                
                try {
                    const response = await fetch(`${API_BASE_URL}/register`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(registrationPayload)
                    });

                    const data = await response.json();

                    if (response.ok) {
                        // --- SUCCESSFUL REGISTRATION ---
                        alert('Registration successful! Redirecting to login...');
                        
                        setTimeout(() => {
                            window.location.href = '../Login/Login_page.html';
                        }, 1000);

                    } else {
                        // --- API ERROR ---
                        const errorDetail = data.detail || 'An unknown error occurred during registration.';
                        alert(`Registration failed: ${errorDetail}`);
                    }
                } catch (error) {
                    // --- NETWORK ERROR ---
                    console.error('Network or Fetch Error:', error);
                    alert('Could not connect to the API server. Please check your backend connection.');
                }
            }
        });
    }
});
