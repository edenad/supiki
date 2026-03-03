const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    let logs = [];
    page.on('console', msg => {
        logs.push(`[${msg.type()}] ${msg.text()}`);
        console.log(`PAGE LOG: ${msg.text()}`);
    });
    page.on('pageerror', err => {
        console.log(`PAGE ERROR: ${err.message}`);
    });

    await page.goto('http://localhost:5500', { waitUntil: 'networkidle2' });

    // Wait a bit to see if interaction happens and throwing error
    console.log("Waiting 10 seconds for interactions to happen...");
    await page.waitForTimeout(10000);

    // Try to force interaction
    await page.evaluate(() => {
        if (window.state && window.state.mates.length >= 2) {
            console.log("Forcing mates to interact...");
            const mate1 = window.state.mates[0];
            const mate2 = window.state.mates[1];
            mate1.x = 200; mate1.z = 100; mate1.interactionCooldown = 0; mate1.state = window.STATES.IDLE;
            mate2.x = 220; mate2.z = 100; mate2.interactionCooldown = 0; mate2.state = window.STATES.IDLE;
        }
    });

    await page.waitForTimeout(5000);

    await browser.close();
})();
