export async function exportAttendanceExcel({
  rows,
  summary,
  requests,
  fileKey,
  note,
}) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  const attendanceSheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      Tanggal: row.date,
      Nama: row.name,
      Universitas: row.university,
      Jurusan: row.major,
      "Jam Masuk": row.in,
      "Jam Pulang": row.out,
      Status: row.status,
    })),
  );
  const summarySheet = XLSX.utils.json_to_sheet(
    summary.map((row) => ({
      Nama: row.name,
      Hadir: row.hadir,
      Terlambat: row.terlambat,
      Izin: row.izin,
      Sakit: row.sakit,
      Alpa: row.alpa,
      "Tanpa catatan": row.missing ?? "—",
    })),
  );
  const sicknessSheet = XLSX.utils.json_to_sheet(
    requests.map((item) => ({
      Nama: item.name,
      Jenis: item.type,
      "Tanggal Mulai": item.date_from,
      "Tanggal Selesai": item.date_to,
      Alasan: item.reason,
      Status: item.status,
    })),
  );
  XLSX.utils.book_append_sheet(book, attendanceSheet, "Absensi");
  XLSX.utils.book_append_sheet(book, summarySheet, "Rekap per peserta");
  [attendanceSheet, summarySheet].forEach((sheet) => {
    if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] };
    sheet["!cols"] = Array.from({ length: 7 }, () => ({ wch: 18 }));
  });
  if (requests.length) {
    sicknessSheet["!autofilter"] = { ref: sicknessSheet["!ref"] };
    sicknessSheet["!cols"] = Array.from({ length: 6 }, () => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(
      book,
      sicknessSheet,
      "Izin dan sakit disetujui",
    );
  }
  if (note)
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([["Aturan perhitungan"], [note]]),
      "Keterangan",
    );
  XLSX.writeFile(book, `laporan-absensi-${fileKey}.xlsx`);
}

export async function exportAttendancePdf({
  rows,
  summary,
  requests,
  label,
  fileKey,
  note,
}) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("LAPORAN ABSENSI ANAK MAGANG", 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Periode: ${label}`, 14, 23);
  let y = 32;
  if (note) {
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(note.replaceAll("—", "-"), 182);
    doc.text(lines, 14, y);
    y += lines.length * 4 + 8;
  }
  const section = (title, headers, values, widths) => {
    const drawHead = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(title, 14, y);
      y += 6;
      doc.setFillColor(24, 139, 94);
      doc.rect(14, y, 182, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      let x = 14;
      headers.forEach((header, index) => {
        doc.text(header, x + 2, y + 5);
        x += widths[index];
      });
      doc.setTextColor(30, 45, 62);
      y += 8;
    };
    if (y > 250) {
      doc.addPage();
      y = 18;
    }
    drawHead();
    values.forEach((value, rowIndex) => {
      const cells = value.map((cell, index) =>
        doc.splitTextToSize(
          String(cell ?? "-").replaceAll("—", "-"),
          widths[index] - 4,
        ),
      );
      const height = Math.max(8, ...cells.map((cell) => cell.length * 4 + 3));
      if (y + height > 280) {
        doc.addPage();
        y = 18;
        drawHead();
      }
      if (rowIndex % 2 === 0) {
        doc.setFillColor(245, 249, 247);
        doc.rect(14, y, 182, height, "F");
      }
      doc.setDrawColor(224, 231, 235);
      doc.rect(14, y, 182, height);
      let x = 14;
      cells.forEach((cell, index) => {
        doc.text(cell, x + 2, y + 5);
        x += widths[index];
      });
      y += height;
    });
    y += 8;
  };
  section(
    "Rekap per peserta",
    ["Nama", "Hadir", "Terlambat", "Izin", "Sakit", "Alpa", "Tanpa catatan"],
    summary.map((x) => [
      x.name,
      x.hadir,
      x.terlambat,
      x.izin,
      x.sakit,
      x.alpa,
      x.missing ?? "-",
    ]),
    [62, 17, 21, 17, 17, 17, 31],
  );
  section(
    "Data absensi",
    ["Tanggal", "Nama", "Masuk", "Pulang", "Status"],
    rows.map((x) => [x.date, x.name, x.in, x.out, x.status]),
    [34, 72, 25, 25, 26],
  );
  if (requests.length)
    section(
      "Pengajuan izin dan sakit disetujui",
      ["Nama", "Jenis", "Mulai", "Selesai", "Alasan"],
      requests.map((x) => [x.name, x.type, x.date_from, x.date_to, x.reason]),
      [42, 20, 30, 30, 60],
    );
  doc.save(`laporan-absensi-${fileKey}.pdf`);
}
