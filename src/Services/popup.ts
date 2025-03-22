document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('toggleButton');
    
    // Update button text based on current state
    chrome.storage.sync.get('isActive', (result) => {
        if (toggleButton) {
            toggleButton.textContent = result.isActive ? 'Disable Assistant' : 'Enable Assistant';
        }
    });

    // Handle toggle button click
    toggleButton?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'TOGGLE_ASSISTANT' }, (response) => {
            if (response && response.success) {
                if (toggleButton) {
                    toggleButton.textContent = response.isActive ? 'Disable Assistant' : 'Enable Assistant';
                }
            }
        });
    });
}); 
