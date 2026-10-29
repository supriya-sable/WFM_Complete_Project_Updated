document.addEventListener('DOMContentLoaded', () => {
    // Use links relative to Welcome_page.html, so navigation works when the
    // frontend server is started from the WFM project root.
    document.querySelectorAll('.btn-ngo, .btn-hotel').forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const type = link.classList.contains('btn-ngo') ? 'ngo' : 'hotel';
            window.location.href = `../Registration/Registration_page.html?type=${type}`;
        });
    });
});
