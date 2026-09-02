export async function exportAttendanceExcel(rows, date) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((row) => ({
      Nama: row.name,
      Divisi: row.dept,
      "Jam Masuk": row.in,
      "Jam Pulang": row.out,
      Status: row.status,
    })),
  );
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Absensi");
  XLSX.writeFile(book, `laporan-absensi-${date}.xlsx`);
}

export async function exportAttendancePdf(rows, dateLabel, date) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const columns = [14, 24, 78, 119, 143, 167];
  const widths = [8, 50, 37, 20, 20, 29];
  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("LAPORAN ABSENSI ANAK MAGANG", 14, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Tanggal: ${dateLabel}`, 14, 23);
    doc.text(`Jumlah data: ${rows.length}`, 196, 23, { align: "right" });
    doc.setFillColor(24, 139, 94);
    doc.rect(14, 28, 182, 9, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    ["No", "Nama", "Divisi", "Masuk", "Pulang", "Status"].forEach(
      (label, index) => doc.text(label, columns[index] + 1.5, 34),
    );
    doc.setTextColor(20, 35, 55);
    return 37;
  };
  let y = drawHeader();
  rows.forEach((row, index) => {
    const values = [
      String(index + 1),
      row.name,
      row.dept,
      row.in,
      row.out,
      row.status,
    ];
    const cells = values.map((value, cellIndex) =>
      doc.splitTextToSize(String(value || "-"), widths[cellIndex]),
    );
    const rowHeight = Math.max(8, ...cells.map((cell) => cell.length * 4 + 3));
    if (y + rowHeight > 282) {
      doc.addPage();
      y = drawHeader();
    }
    if (index % 2 === 0) {
      doc.setFillColor(245, 249, 247);
      doc.rect(14, y, 182, rowHeight, "F");
    }
    doc.setDrawColor(225, 231, 235);
    doc.rect(14, y, 182, rowHeight);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    cells.forEach((cell, cellIndex) =>
      doc.text(cell, columns[cellIndex] + 1.5, y + 5),
    );
    y += rowHeight;
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(110, 120, 135);
    doc.text(`Dibuat oleh Hadirin · Halaman ${page} dari ${pages}`, 105, 290, {
      align: "center",
    });
  }
  doc.save(`laporan-absensi-${date}.pdf`);
}
