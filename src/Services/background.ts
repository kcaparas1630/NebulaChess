// Listen for Chrome Extension installation or update
chrome.runtime.onInstalled.addListener(() => {
    console.log("Chess Assistant for Lichess is installed");

    // Initialize default settings
    chrome.storage.sync.set({
        analysisDepth: 5,
        preferedStrategy: "balanced",
        autoAnalyze: true,
    });
});
