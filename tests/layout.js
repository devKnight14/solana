const BufferLayout = require("buffer-layout");
const { PublicKey } = require("@solana/web3.js");
const anchor = require("@project-serum/anchor");
const { BN } = anchor;

const StreamInstructionLayout = BufferLayout.struct([
  BufferLayout.blob(8, "start_time"),
  BufferLayout.blob(8, "end_time"),
  BufferLayout.blob(8, "deposited_amount"),
  BufferLayout.blob(8, "total_amount"),
  BufferLayout.blob(8, "period"),
  BufferLayout.blob(8, "cliff"),
  BufferLayout.blob(8, "cliff_amount"),
  BufferLayout.blob(1, "is_cancelable_by_sender"),
  BufferLayout.blob(1, "is_cancelable_by_recipient"),
  BufferLayout.blob(1, "is_withdrawal_public"),
  BufferLayout.blob(1, "is_transferable"),
]);

// function decodeInstruction(buf) {
//   let raw = StreamInstructionLayout.decode(buf);
//   return {
//     start_time: new BN(raw.start_time),
//     end_time: new BN(raw.end_time),
//     deposited_amount: new BN(raw.deposited_amount),
//     total_amount: new BN(raw.total_amount),
//     period: new BN(raw.period),
//     cliff: new BN(raw.cliff),
//     cliff_amount: new BN(raw.cliff_amount),
//      //TODO: add boolean is_... params
//   };
// }

const TokenStreamDataLayout = BufferLayout.struct([
  BufferLayout.blob(8, "magic"),
  BufferLayout.blob(8, "created_at"),
  BufferLayout.blob(8, "withdrawn_amount"),
  BufferLayout.blob(8, "canceled_at"),
  BufferLayout.blob(8, "cancellable_at"),
  BufferLayout.blob(32, "sender"),
  BufferLayout.blob(32, "sender_tokens"),
  BufferLayout.blob(32, "recipient"),
  BufferLayout.blob(32, "recipient_tokens"),
  BufferLayout.blob(32, "mint"),
  BufferLayout.blob(32, "escrow_tokens"),
  //ix comes at the end
  BufferLayout.blob(8, "start_time"),
  BufferLayout.blob(8, "end_time"),
  BufferLayout.blob(8, "deposited_amount"),
  BufferLayout.blob(8, "total_amount"),
  BufferLayout.blob(8, "period"),
  BufferLayout.blob(8, "cliff"),
  BufferLayout.blob(8, "cliff_amount"),
  BufferLayout.blob(1, "is_cancelable_by_sender"),
  BufferLayout.blob(1, "is_cancelable_by_recipient"),
  BufferLayout.blob(1, "is_withdrawal_public"),
  BufferLayout.blob(1, "is_transferable"),
  //todo: add Title string
]);

function decode(buf) {
  let raw = TokenStreamDataLayout.decode(buf);
  return {
    magic: new BN(raw.magic),
    created_at: new BN(raw.created_at),
    withdrawn_amount: new BN(raw.withdrawn_amount),
    canceled_at: new BN(raw.canceled_at),
    cancellable_at: new BN(raw.cancellable_at),
    sender: new PublicKey(raw.sender),
    sender_tokens: new PublicKey(raw.sender_tokens),
    recipient: new PublicKey(raw.recipient),
    recipient_tokens: new PublicKey(raw.recipient_tokens),
    mint: new PublicKey(raw.mint),
    escrow_tokens: new PublicKey(raw.escrow_tokens),
    start_time: new BN(raw.start_time),
    end_time: new BN(raw.end_time),
    deposited_amount: new BN(raw.deposited_amount),
    total_amount: new BN(raw.total_amount),
    period: new BN(raw.period),
    cliff: new BN(raw.cliff),
    cliff_amount: new BN(raw.cliff_amount),
    is_cancelable_by_sender: Boolean(raw.is_cancelable_by_sender.readUInt8()),
    is_cancelable_by_recipient: Boolean(
      raw.is_cancelable_by_recipient.readUInt8()
    ),
    is_withdrawal_public: Boolean(raw.is_withdrawal_public.readUInt8()),
    is_transferable: Boolean(raw.is_transferable.readUInt8()),
  };
}

exports.decode = decode;
