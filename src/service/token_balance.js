const web3 = require('@solana/web3.js');
const splToken = require('@solana/spl-token');

async function getTokenBalances(walletAddresses, tokenMintAddress) {
	const connection = new web3.Connection(web3.clusterApiUrl('mainnet-beta'));
	const tokenMint = new web3.PublicKey(tokenMintAddress);

	let totalBalance = 0;

    const token_data = await connection.getAccountInfo(tokenMint);

    // Batch requests if possible
	const tokenAccounts = walletAddresses.map(s => splToken.getAssociatedTokenAddressSync(tokenMint, new web3.PublicKey(s), true, token_data.owner));

	const ParsedTokenAccounts = await connection.getMultipleParsedAccounts(tokenAccounts);

	for (item of ParsedTokenAccounts.value) {
		if (item != null) totalBalance += item.data.parsed.info.tokenAmount.uiAmount;
	}
    
    return totalBalance;
}

module.exports = {
    getTokenBalances
}