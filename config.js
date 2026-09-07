window.STUWIES_CONFIG = {
  webAppUrl: "https://script.google.com/macros/s/AKfycbxWzNJaHxmiTWEeFEmUt9OrhnyF-q30RZcZoKLGq_6B2RsPIo_Z36D9LdPVwhy0A4TO/exec",
  // Only enable a provider after setting its salon-approved merchant ID.
  // Empty IDs disable initiation. Never put a test merchant number here.
  payment: { providers: {
    mtn: { name: "MTN Mobile Money", merchantId: "", merchantConfigured: false, logo: "assets/images/payment/mtn-momo-logo.png" },
    airtel: { name: "Airtel Money", merchantId: "", merchantConfigured: false, logo: "assets/images/payment/airtel-money-logo.png" }
  } },
  confirmPageUrl: "http://stuwies-salon.vercel.app/confirm.html"
};
