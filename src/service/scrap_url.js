const puppeteer = require('puppeteer');

const helius_url = `https://api.helius.xyz/v0/transactions/?api-key=${process.env.HELIUS_API_KEY}`;

const parseTransaction = async (tx_ids) => {
    const response = await fetch(helius_url, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        },
        body: JSON.stringify({
        transactions: tx_ids,
        }),
    });

    const data = await response.json();
    let wallet_list = [];
    data.map(tx => {
        if(wallet_list.lastIndexOf(tx.feePayer) == -1) wallet_list.push(tx.feePayer);
    })

    return wallet_list;
};

exports.scrapeWebsite = async (url) => {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();

        console.log('Navigating to page...');
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
        console.log('Page loaded');

        console.log('Waiting for .bg-card element...');
        await page.waitForSelector('.bg-card', { timeout: 60000 });
        console.log('.bg-card element found');

        console.log('Clicking the specified element...');
        await page.evaluate(() => {
            const element = document.querySelectorAll('.bg-card')[0]?.children[0]?.children[1];

            if (element) {
                element.click();
            } else {
                throw new Error('Element not found for clicking');
            }
        });
        console.log('Element clicked');

        // Wait for the new content to load
        console.log('Waiting for new content to load...');
        await page.waitForSelector('.min-w-min section', { timeout: 60000 });
        console.log('New content loaded');

        console.log('Extracting links...');
        const links = await page.evaluate(() => {

            return Array.from(document.querySelectorAll('.min-w-min section')).map(target => {
                const link = target.children[5]?.querySelector('a')?.href;
                return link || null;
            }).filter(Boolean);
        });
        console.log(`Extracted ${links.length} links`);

        let token_name = await page.evaluate(() => {
            return document.querySelector('.text-xl')?.textContent;
        });

        token_name = (token_name.split('('))[0].trim();

        let dex_url = await page.evaluate(() => {
            return document.querySelector('#dexscreener-embed iframe')?.src;
        })

        dex_url = (dex_url.split('?'))[0];

        const mint_address = (dex_url.split('/'))[dex_url.split('/').length - 1];

        let txIds = [];
        links.map(link => {
            let parsed_link = link.split('/');
            txId = parsed_link[parsed_link.length - 1];
            txIds.push(txId);
        });

        const wallet_list = await parseTransaction(txIds);

        return { token_name, mint_address, wallet_list };
    } catch (error) {
        console.error('An error occurred while scraping:', error);
        throw error;
    } finally {
        if (browser) {
        await browser.close();
        }
    }
}