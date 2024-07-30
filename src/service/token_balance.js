const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff(fn, maxRetries = 5, initialDelay = 500) {
    let retries = 0;
    while (true) {
        try {
            return await fn();
        } catch (error) {
            if (error.message.includes('429 Too Many Requests') && retries < maxRetries) {
                retries++;
                const delay = initialDelay * Math.pow(2, retries);
                console.log(`Retrying after ${delay}ms delay...`);
                await sleep(delay);
            } else {
                throw error;
            }
        }
    }
}

async function getTokenBalances(walletAddresses, tokenMintAddress) {
    const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'));
    const tokenMint = new web3.PublicKey(tokenMintAddress);
    const balances = [];

    // Batch requests if possible
    const tokenAccounts = await Promise.all(walletAddresses.map(async (walletAddress) => {
        const walletPublicKey = new web3.PublicKey(walletAddress);
        return splToken.getAssociatedTokenAddress(tokenMint, walletPublicKey);
    }));

    // Get all account infos in one batch request
    const accountInfos = await retryWithBackoff(() => 
        connection.getMultipleAccountsInfo(tokenAccounts)
    );

    for (let i = 0; i < walletAddresses.length; i++) {
        const walletAddress = walletAddresses[i];
        const accountInfo = accountInfos[i];

        try {
            if (accountInfo === null) {
                balances.push({
                wallet: walletAddress,
                balance: 0
                });
            } else {
                // Fetch the token account balance
                const balance = await retryWithBackoff(() => 
                    connection.getTokenAccountBalance(tokenAccounts[i])
                );
                balances.push({
                    wallet: walletAddress,
                    balance: balance.value.uiAmount
                });
            }
        } catch (error) {
            console.error(`Error fetching balance for wallet ${walletAddress}:`, error);
            balances.push({
                wallet: walletAddress,
                balance: null
            });
        }
    }

    return balances;
}

module.exports = {
    getTokenBalances
}