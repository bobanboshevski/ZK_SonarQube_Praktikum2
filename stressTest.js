const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs'); // Required for reading the file path

(async () => {
    // Launch Electron app
    const electronApp = await electron.launch({
        args: [path.join(__dirname, 'main.js')] // Path to Electron main.js file
    });

    // Get the first window in Electron
    const page = await electronApp.firstWindow();

    // Wait for the input element to be available (based on its ID or name)
    const fileInput = await page.locator('#file-upload-helper-text');
    await fileInput.waitFor({ state: 'visible', timeout: 30000 }); // Wait for the element to be visible


    // Prepare the file path (ensure the file exists in the given path)
    const filePath = path.join('/Users/bobanboshevski/FERI IPT/Drugi letnik/2 SEMESTAR/Praktikum/pdfs/Butterfly Test_1.pdf'); // Replace with the path to the file you want to upload

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }

    // Upload the file
    await fileInput.setInputFiles(filePath);

    console.log('File uploaded successfully!');

    // Optionally, wait for any other response or page updates (like a success message)
    // You can wait for a response from the app (e.g., check if a result is visible or an element changes)
    await page.waitForSelector('.result'); // Replace '.result' with a selector for the response element
    console.log('Result found!');

    // Perform more interactions or assertions as needed

    // Close the Electron app after tests
    await electronApp.close();
})();
