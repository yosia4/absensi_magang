export async function exportAttendanceExcel({ rows, summary, requests, fileKey }) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  const attendanceSheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
    Tanggal: row.date, Nama: row.name, Universitas: row.university,
    Jurusan: row.major, "Jam Masuk": row.in, "Jam Pulang": row.out, Status: row.status,
  })));
  const summarySheet = XLSX.utils.json_to_sheet(summary.map((row) => ({
    Nama: row.name, Hadir: row.hadir, Terlambat: row.terlambat,
    Sakit: row.sakit, Alpa: row.alpa,
  })));
  const sicknessSheet = XLSX.utils.json_to_sheet(requests.map((item) => ({
    Nama: item.name, Jenis: item.type, "Tanggal Mulai": item.date_from,
    "Tanggal Selesai": item.date_to, Alasan: item.reason, Status: item.status,
  })));
  XLSX.utils.book_append_sheet(book, attendanceSheet, "Absensi");
  XLSX.utils.book_append_sheet(book, summarySheet, "Rekap per peserta");
  [attendanceSheet, summarySheet].forEach((sheet) => {
    sheet["!autofilter"] = { ref: sheet["!ref"] };
    sheet["!cols"] = Array.from({ length: 7 }, () => ({ wch: 18 }));
  });
  if (requests.length) {
    sicknessSheet["!autofilter"] = { ref: sicknessSheet["!ref"] };
    sicknessSheet["!cols"] = Array.from({ length: 6 }, () => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(book, sicknessSheet, "Sakit disetujui");
  }
  XLSX.writeFile(book, `laporan-absensi-${fileKey}.xlsx`);
}

export async function exportAttendancePdf({ rows, summary, requests, label, fileKey }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text("LAPORAN ABSENSI ANAK MAGANG", 14, 16);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Periode: ${label}`, 14, 23);
  let y = 32;
  const section = (title, headers, values, widths) => {
    const drawHead = () => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(title, 14, y); y += 6;
      doc.setFillColor(24, 139, 94); doc.rect(14, y, 182, 8, "F");
      doc.setTextColor(255, 255, 255); doc.setFontSize(8);
      let x = 14; headers.forEach((header, index) => { doc.text(header, x + 2, y + 5); x += widths[index]; });
      doc.setTextColor(30, 45, 62); y += 8;
    };
    if (y > 250) { doc.addPage(); y = 18; }
    drawHead();
    values.forEach((value, rowIndex) => {
      const cells = value.map((cell, index) => doc.splitTextToSize(String(cell || "-"), widths[index] - 4));
      const height = Math.max(8, ...cells.map((cell) => cell.length * 4 + 3));
      if (y + height > 280) { doc.addPage(); y = 18; drawHead(); }
      if (rowIndex % 2 === 0) { doc.setFillColor(245, 249, 247); doc.rect(14, y, 182, height, "F"); }
      doc.setDrawColor(224, 231, 235); doc.rect(14, y, 182, height);
      let x = 14; cells.forEach((cell, index) => { doc.text(cell, x + 2, y + 5); x += widths[index]; });
      y += height;
    });
    y += 8;
  };
  section("Rekap per peserta", ["Nama", "Hadir", "Terlambat", "Sakit", "Alpa"], summary.map((x) => [x.name, x.hadir, x.terlambat, x.sakit, x.alpa]), [102, 20, 20, 20, 20]);
  section("Data absensi", ["Tanggal", "Nama", "Masuk", "Pulang", "Status"], rows.map((x) => [x.date, x.name, x.in, x.out, x.status]), [34, 72, 25, 25, 26]);
  doc.save(`laporan-absensi-${fileKey}.pdf`);
}
