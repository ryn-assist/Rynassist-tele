class PaymentProvider {
  async createPayment() { throw new Error('createPayment harus diimplementasikan provider pembayaran asli.'); }
  async verifyPayment() { throw new Error('verifyPayment harus diimplementasikan provider pembayaran asli.'); }
}
module.exports = PaymentProvider;
