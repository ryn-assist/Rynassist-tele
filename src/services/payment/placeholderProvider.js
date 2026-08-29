const PaymentProvider = require('./baseProvider');
class PlaceholderProvider extends PaymentProvider {
  async createPayment() {
    return { available: false, message: 'Payment gateway belum dikonfigurasi. Silakan gunakan saldo atau hubungi admin.' };
  }
}
module.exports = new PlaceholderProvider();
