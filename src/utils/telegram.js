async function safeEdit(ctx, text, extra) {
  try { return await ctx.editMessageText(text, extra); }
  catch (error) {
    if (error.description?.includes('message is not modified')) return undefined;
    throw error;
  }
}
async function safeAnswerCallback(ctx, text, extra) {
  try { return await ctx.answerCbQuery(text, extra); }
  catch (error) { console.warn(`Gagal menjawab callback Telegram: ${error.message}`); return undefined; }
}
module.exports = { safeEdit, safeAnswerCallback };
