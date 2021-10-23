const assert = require("assert");
const BufferLayout = require("buffer-layout");
const anchor = require("@project-serum/anchor");
const common = require("@project-serum/common");
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  u64,
  NATIVE_MINT,
} = require("@solana/spl-token");
const {
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  Connection,
  LAMPORTS_PER_SOL,
} = require("@solana/web3.js");
const { utils } = require("@project-serum/anchor");
const { token } = require("@project-serum/common");
const { decode } = require("./layout");
const { SystemProgram, Keypair } = anchor.web3;
const { BN } = anchor;

// The stream recipient main wallet
const recipient = Keypair.generate();
const NOW = Date.now();
describe("timelock", () => {
  const provider = anchor.Provider.local(); //todo use env()
  anchor.setProvider(provider);

  const program = anchor.workspace.Timelock;
  const sender = provider.wallet;
  const metadata = Keypair.generate();
  const metadata_non_cancellable = Keypair.generate();
  const metadata_non_transferable = Keypair.generate();
  const MINT_DECIMALS = 8;
  let escrowTokens;
  let escrowTokens_non_cancellable;
  let escrowTokens_non_transferable;
  let recipientTokens;
  let nonce;
  let mint;
  let senderTokens;

  //Account structs
  let accountsCreate;

  // Divide by 1000 since Unix timestamp is in seconds
  const now = new BN(+new Date() / 1000); //Now.
  const start = now.addn(5); //Add just enough seconds to pass time validation.
  const start_too_early = now;
  const start_past = now.subn(10); //Time in past.
  const end = new BN(+new Date() / 1000 + 60); //Add 1 minute
  const end_before_start = start.subn(1);
  const end_past = start_past;
  const period = new BN(2); // In seconds
  const period_1_min = new BN(60); // In seconds
  const period_1_hr = new BN(60 * 60); // In seconds
  const period_1_day = new BN(60 * 60 * 24); // In seconds
  const depositedAmount = new BN(1 * LAMPORTS_PER_SOL);
  const is_cancelable_by_sender_true = true;
  const is_cancelable_by_sender_false = false;
  const is_cancelable_by_recipient_true = true;
  const is_cancelable_by_recipient_false = false;
  const is_withdrawal_public_true = true;
  const is_withdrawal_public_false = false;
  const is_transferable_true = true;
  const is_transferable_false = false;

  //TODO: Test wSOL!
  it("Initialize test state", async () => {
    [mint, senderTokens] = await common.createMintAndVault(
      provider,
      new anchor.BN(100_000_000_000),
      undefined,
      MINT_DECIMALS
    );
    mint = NATIVE_MINT;
    //senderTokens = await Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, NATIVE_MINT, sender.publicKey);
    const oldBalance = await provider.connection.getBalance(sender.publicKey);
    senderTokens = await Token.createWrappedNativeAccount(
      provider.connection,
      TOKEN_PROGRAM_ID,
      sender.publicKey,
      sender.payer,
      10 * LAMPORTS_PER_SOL
    );
    const senderTokensData = common.token.parseTokenAccountData(
      (await program.provider.connection.getAccountInfo(senderTokens)).data
    );
    const newBalance = await provider.connection.getBalance(sender.publicKey);
    // console.log(
    //   "spent for creating wrapped SOL account\n",
    //   oldBalance - newBalance
    // );
    //
    // console.log("Sender Tokens:");
    // console.log(
    //   "account",
    //   senderTokens.toBase58(),
    //   "mint",
    //   senderTokensData.mint.toBase58(),
    //   "amount",
    //   senderTokensData.amount / LAMPORTS_PER_SOL,
    //   "owner",
    //   senderTokensData.owner.toBase58(),
    //   senderTokensData.owner.toBase58() === sender.publicKey.toBase58()
    // );

    [escrowTokens, nonce] = await PublicKey.findProgramAddress(
      [metadata.publicKey.toBuffer()],
      program.programId
    );
    [escrowTokens_non_transferable, nonce] = await PublicKey.findProgramAddress(
      [metadata_non_transferable.publicKey.toBuffer()],
      program.programId
    );
    [escrowTokens_non_cancellable, nonce] = await PublicKey.findProgramAddress(
      [metadata_non_cancellable.publicKey.toBuffer()],
      program.programId
    );

    recipientTokens = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint,
      recipient.publicKey
    );

    // console.log("Accounts:");
    // console.log("sender wallet:", sender.publicKey.toBase58());
    // console.log("sender tokens:", senderTokens.toBase58());
    // console.log("escrow (metadata):", metadata.publicKey.toBase58());
    // console.log("escrow tokens:", escrowTokens.toBase58());
    // console.log("recipient wallet:", recipient.publicKey.toBase58());
    // console.log("recipient tokens:", recipientTokens.toBase58());
    // console.log("mint:", mint.toBase58());

    accountsCreate = {
      sender: sender.publicKey,
      senderTokens,
      recipient: recipient.publicKey,
      recipientTokens,
      metadata: metadata.publicKey,
      escrowTokens,
      mint,
      rent: SYSVAR_RENT_PUBKEY,
      timelockProgram: program.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    };
  });

  it("Creates vesting contract with missing params", async () => {
    try {
      const tx = await program.rpc.create(
        // Order of the parameters must match the ones in the program
        depositedAmount,
        start,
        end,
        period,
        new BN(0), //cliff
        new BN(0), //cliff amount
        {
          accounts: accountsCreate,
          signers: [metadata],
        }
      );
    } catch (e) {
      console.log("ERROR: ", e.toString());
      assert.ok(e.toString().indexOf("Error:") !== -1);
    }
  });

  it("Create Vesting Contract", async () => {
    console.log("\n");
    // console.log("metadata:", metadata.publicKey.toBase58());
    // console.log("buffer:", metadata.publicKey.toBuffer());

    const tx = await program.rpc.create(
      // Order of the parameters must match the ones in the program
      depositedAmount,
      start,
      end,
      period,
      new BN(0), //cliff
      new BN(0), //cliff amount,
      is_cancelable_by_sender_false,
      is_cancelable_by_recipient_false,
      is_withdrawal_public_false,
      is_transferable_true,
      //"", // title,
      {
        accounts: accountsCreate,
        signers: [metadata],
      }
    );

    const _escrowTokens = await program.provider.connection.getAccountInfo(
      escrowTokens
    );
    const _senderTokens = await program.provider.connection.getAccountInfo(
      senderTokens
    );

    const _metadata = await program.provider.connection.getAccountInfo(
      metadata.publicKey
    );
    const _escrowTokensData = common.token.parseTokenAccountData(
      _escrowTokens.data
    );
    const _senderTokensData = common.token.parseTokenAccountData(
      _senderTokens.data
    );

    let strm_data = decode(_metadata.data);
    console.log("Raw data:\n", _metadata.data);
    console.info("Stream Data:\n", strm_data);

    console.log(
      "deposited during contract creation: ",
      depositedAmount.toNumber(),
      _escrowTokensData.amount
    );

    assert.ok(depositedAmount.toNumber() === _escrowTokensData.amount);
  });

  it("Withdraws from a contract", async () => {
    while (Date.now() < NOW + 10500) {}
    console.log("Recipient withdraws:");
    const _metadata = await program.provider.connection.getAccountInfo(
      metadata.publicKey
    );

    // console.log("Raw data:\n", _metadata.data);
    // console.info("Stream Data:\n", decode(_metadata.data));
    // console.log("recipient tokens", recipientTokens.toBase58());
    const oldEscrowAta = await program.provider.connection.getAccountInfo(
      escrowTokens
    );
    const oldEscrowAmount = common.token.parseTokenAccountData(
      oldEscrowAta.data
    ).amount;
    const oldRecipientAta = await program.provider.connection.getAccountInfo(
      recipientTokens
    );
    const oldRecipientAmount = common.token.parseTokenAccountData(
      oldRecipientAta.data
    ).amount;
    const withdrawAmount = new BN(0); //0 == MAX

    // console.log(
    //   "metadata",
    //   metadata.publicKey.toBase58(),
    //   "escrow_ata",
    //   escrowTokens.toBase58()
    // );
    console.log("seed", metadata.publicKey.toBuffer());
    console.log("metadata", metadata.publicKey.toBase58());
    await program.rpc.withdraw(withdrawAmount, {
      accounts: {
        signer: recipient.publicKey,
        recipient: recipient.publicKey,
        recipientTokens,
        metadata: metadata.publicKey,
        escrowTokens,
        mint,
        tokenProgram: TOKEN_PROGRAM_ID,
      },
      signers: [recipient],
    });

    const newEscrowAta = await program.provider.connection.getAccountInfo(
      escrowTokens
    );
    const newEscrowAmount = common.token.parseTokenAccountData(
      newEscrowAta.data
    ).amount;
    const newRecipientAta = await program.provider.connection.getAccountInfo(
      recipientTokens
    );
    const newRecipientAmount = common.token.parseTokenAccountData(
      newRecipientAta.data
    ).amount;
    const escrow = await program.provider.connection.getAccountInfo(
      metadata.publicKey
    );
    const data = decode(escrow.data);

    console.log(
      "depositedAmount",
      depositedAmount.toNumber(),
      "withdrawn_amount",
      withdrawAmount
    );
    console.log(
      "Escrow token balance: previous: ",
      oldEscrowAmount,
      "after: ",
      newEscrowAmount
    );
    console.log(
      "Recipient token balance: previous: ",
      oldRecipientAmount,
      "after: ",
      newRecipientAmount
    );
    assert.ok(newRecipientAmount > oldRecipientAmount);
    assert.ok(oldEscrowAmount === newRecipientAmount + newEscrowAmount);
    if (!withdrawAmount.eqn(0)) {
      //0 == MAX
      //todo: some other test
    }
  });

  // it("Public withdraw from a contract", async () => {
  //      while (Date.now() < NOW + 13500) {}
  //     console.log("Public withdraw: \n");
  //     const oldEscrowAta = await program.provider.connection.getAccountInfo(
  //       escrowTokens
  //     );
  //     const oldEscrowAmount = common.token.parseTokenAccountData(
  //       oldEscrowAta.data
  //     ).amount;
  //     const oldRecipientAta = await program.provider.connection.getAccountInfo(
  //       recipientTokens
  //     );
  //     const oldRecipientAmount = common.token.parseTokenAccountData(
  //       oldRecipientAta.data
  //     ).amount;
  //     const withdrawAmount = new BN(0); //0 == MAX
  //
  //     const signer = Keypair.generate();
  //     await program.rpc.withdraw(withdrawAmount, {
  //       accounts: {
  //         signer: signer.publicKey,
  //         recipient: recipient.publicKey,
  //         recipientTokens,
  //         metadata: metadata.publicKey,
  //         escrowTokens,
  //         mint,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //       },
  //       //signers: [recipient],
  //     });
  //
  //     const newEscrowAta = await program.provider.connection.getAccountInfo(
  //       escrowTokens
  //     );
  //     const newEscrowAmount = common.token.parseTokenAccountData(
  //       newEscrowAta.data
  //     ).amount;
  //     const newRecipientAta = await program.provider.connection.getAccountInfo(
  //       recipientTokens
  //     );
  //     const newRecipientAmount = common.token.parseTokenAccountData(
  //       newRecipientAta.data
  //     ).amount;
  //     const escrow = await program.provider.connection.getAccountInfo(
  //       metadata.publicKey
  //     );
  //     const data = decode(escrow.data);
  //
  //     console.log(
  //       "depositedAmount",
  //       depositedAmount.toNumber(),
  //       "withdrawn_amount",
  //       withdrawAmount
  //     );
  //     console.log(
  //       "Escrow token balance: previous: ",
  //       oldEscrowAmount,
  //       "after: ",
  //       newEscrowAmount
  //     );
  //     console.log(
  //       "Recipient token balance: previous: ",
  //       oldRecipientAmount,
  //       "after: ",
  //       newRecipientAmount
  //     );
  //     assert.ok(withdrawAmount.eq(new BN(oldEscrowAmount - newEscrowAmount)));
  //     assert.ok(
  //       withdrawAmount.eq(new BN(newRecipientAmount - oldRecipientAmount))
  //     );
  //     assert.ok(data.withdrawn_amount.eq(withdrawAmount));
  // });

  // while(Date.now() < NOW + 7500)
  // it("Cancels the stream", async () => {
  //     console.log("\n\n");
  //     const oldSenderAta = await program.provider.connection.getAccountInfo(
  //       senderTokens
  //     );
  //     const oldSenderAmount = common.token.parseTokenAccountData(
  //       oldSenderAta.data
  //     ).amount;
  //     const oldEscrowAta = await program.provider.connection.getAccountInfo(
  //       escrowTokens
  //     );
  //     const oldEscrowAmount = common.token.parseTokenAccountData(
  //       oldEscrowAta.data
  //     ).amount;
  //     const oldRecipientAta = await program.provider.connection.getAccountInfo(
  //       recipientTokens
  //     );
  //     const oldRecipientAmount = common.token.parseTokenAccountData(
  //       oldRecipientAta.data
  //     ).amount;
  //
  //     await program.rpc.cancel({
  //       accounts: {
  //         sender: sender.publicKey,
  //         senderTokens,
  //         recipient: recipient.publicKey,
  //         recipientTokens,
  //         metadata: metadata.publicKey,
  //         escrowTokens,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         mint,
  //       },
  //       signers: [sender.payer],
  //     });
  //
  //     const newEscrowAta = await program.provider.connection.getAccountInfo(
  //       escrowTokens
  //     );
  //     const newEscrowAmount = common.token.parseTokenAccountData(
  //       newEscrowAta.data
  //     ).amount;
  //     const newRecipientAta = await program.provider.connection.getAccountInfo(
  //       recipientTokens
  //     );
  //     const newRecipientAmount = common.token.parseTokenAccountData(
  //       newRecipientAta.data
  //     ).amount;
  //     const newSenderAta = await program.provider.connection.getAccountInfo(
  //       senderTokens
  //     );
  //     const newSenderAmount = common.token.parseTokenAccountData(
  //       newSenderAta.data
  //     ).amount;
  //     const escrow = await program.provider.connection.getAccountInfo(
  //       metadata.publicKey
  //     );
  //
  //     console.log("cancel:");
  //     console.log(
  //       "deposited",
  //       depositedAmount.toNumber(),
  //       "old sender",
  //       oldSenderAmount,
  //       "old recipient",
  //       oldRecipientAmount,
  //       "old escrow",
  //       oldEscrowAmount
  //     );
  //     console.log(
  //       "deposited",
  //       depositedAmount.toNumber(),
  //       "sender",
  //       newSenderAmount,
  //       "recipient",
  //       newRecipientAmount,
  //       "escrow",
  //       newEscrowAmount
  //     );
  //     assert.ok(newEscrowAmount === 0);
  //     assert.ok(decode(escrow.data).amount.eq(0));
  //     assert.ok(newRecipientAmount.add(newSenderAmount).eq(depositedAmount));
  // });

  // it("Transfers vesting contract recipient", async () => {
  //   console.log("\n\n");
  //   let escrow = await program.provider.connection.getAccountInfo(
  //     metadata.publicKey
  //   );
  //   const oldRecipient = decode(escrow.data).recipient;
  //   const newRecipient = Keypair.generate();
  //   const newRecipientTokens = await Token.getAssociatedTokenAddress(
  //     ASSOCIATED_TOKEN_PROGRAM_ID,
  //     TOKEN_PROGRAM_ID,
  //     mint,
  //     newRecipient.publicKey
  //   );
  //
  //   //airdrop
  //   const tx = await program.provider.connection.requestAirdrop(
  //     recipient.publicKey,
  //     2 * LAMPORTS_PER_SOL
  //   );
  //   console.log(
  //     "balance: ",
  //     await program.provider.connection.getBalance(recipient.publicKey)
  //   );
  //   console.log("tx: ", tx);
  //   console.log("Transfer:");
  //
  //   //wait for the airdrop
  //   setTimeout(async () => {
  //     console.log(
  //       "balance: ",
  //       await program.provider.connection.getBalance(recipient.publicKey)
  //     );
  //     console.log(
  //       "new recipient",
  //       newRecipient.publicKey.toBase58(),
  //       "new recipient ata:",
  //       newRecipientTokens.toBase58()
  //     );
  //
  //     await program.rpc.transfer_recipient({
  //       accounts: {
  //         existingRecipient: recipient.publicKey,
  //         newRecipient: newRecipient.publicKey,
  //         newRecipientTokens,
  //         metadata: metadata.publicKey,
  //         escrowTokens,
  //         mint,
  //         rent: SYSVAR_RENT_PUBKEY,
  //         tokenProgram: TOKEN_PROGRAM_ID,
  //         associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  //         system: SystemProgram.programId,
  //         // timelockProgram: program.programId,
  //       },
  //       signers: [recipient],
  //     });
  //     console.log("Update recipient success.");
  //     escrow = await program.provider.connection.getAccountInfo(
  //       metadata.publicKey
  //     );
  //     console.log("parsed", decode(escrow.data));
  //     const escrowNewRecipient = decode(escrow.data).recipient;
  //     console.log(
  //       "Transfer: old recipient:",
  //       oldRecipient.toBase58(),
  //       "new recipient: ",
  //       escrowNewRecipient.toBase58()
  //     );
  //     console.log(
  //       "Transfer: old recipient:",
  //       recipient.publicKey.toBase58(),
  //       "new recipient: ",
  //       newRecipient.publicKey.toBase58()
  //     );
  //     console.log(
  //       "old recipient tokens:",
  //       recipientTokens.toBase58(),
  //       "new recipient tokens: ",
  //       newRecipientTokens.toBase58(),
  //       "new recipient tokens",
  //       escrowNewRecipient.recipient_tokens.toBase58()
  //     );
  //     assert.ok(oldRecipient !== escrowNewRecipient);
  //     assert.ok(
  //       escrowNewRecipient.toBase58() === newRecipient.publicKey.toBase58()
  //     );
  //     await provider.connection.getBalance(sender.publicKey);
  //   }, 4000);
  // });
});
