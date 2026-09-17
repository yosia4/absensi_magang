export function loginErrorMessage(error) {
  const message = String(error?.message || "");
  if (
    error?.name === "AuthRetryableFetchError" ||
    /fetch|network|timeout|timed out|koneksi/i.test(message)
  ) {
    return "Koneksi bermasalah. Periksa internet Anda, lalu coba masuk kembali.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "Email atau kata sandi tidak sesuai. Periksa kembali dan coba lagi.";
  }
  if (/email not confirmed/i.test(message)) {
    return "Email akun belum dikonfirmasi. Periksa email Anda atau hubungi pembimbing.";
  }
  if (error?.status === 429 || /rate limit|too many requests/i.test(message)) {
    return "Terlalu banyak percobaan masuk. Tunggu sebentar, lalu coba lagi.";
  }
  return message || "Belum berhasil masuk. Silakan coba lagi.";
}
