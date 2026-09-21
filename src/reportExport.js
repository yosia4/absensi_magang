import { dateLabel } from "./attendanceVisuals.js";

const printedAt = (date) =>
  new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date) + " WIB";

export async function exportAttendanceExcel({
  rows,
  summary,
  requests,
  fileKey,
  note,
  label,
  search,
  participantName,
}) {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();
  const append = (name, data, headers, widths) => {
    const sheet = XLSX.utils.json_to_sheet(data, { header: headers });
    if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] };
    sheet["!cols"] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(book, sheet, name);
  };
  append(
    "Rekap per peserta",
    summary.map((row) => ({
      Nama: row.name,
      Universitas: row.university,
      Hadir: row.hadir,
      Terlambat: row.terlambat,
      Izin: row.izin,
      Sakit: row.sakit,
      Alpa: row.alpa,
    })),
    ["Nama", "Universitas", "Hadir", "Terlambat", "Izin", "Sakit", "Alpa"],
    [28, 32, 12, 14, 12, 12, 12],
  );
  append(
    "Absensi",
    rows.map((row) => ({
      Tanggal: row.date,
      Nama: row.name,
      Universitas: row.university,
      Jurusan: row.major,
      "Jam Masuk": row.in,
      "Jam Pulang": row.out,
      Status: row.status,
    })),
    [
      "Tanggal",
      "Nama",
      "Universitas",
      "Jurusan",
      "Jam Masuk",
      "Jam Pulang",
      "Status",
    ],
    [16, 28, 32, 24, 14, 14, 16],
  );
  if (requests.length)
    append(
      "Izin dan sakit disetujui",
      requests.map((item) => ({
        Nama: item.name,
        Jenis: item.type,
        "Tanggal Mulai": item.date_from,
        "Tanggal Selesai": item.date_to,
        Alasan: item.reason,
        Status: item.status,
      })),
      ["Nama", "Jenis", "Tanggal Mulai", "Tanggal Selesai", "Alasan", "Status"],
      [28, 14, 18, 18, 48, 18],
    );
  const info = XLSX.utils.aoa_to_sheet([
    ["Laporan Kehadiran", "Rawuh Pustaka"],
    ["Periode", label],
    ["Waktu cetak", printedAt(new Date())],
    ["Pencarian peserta", search || "Semua peserta"],
    ["Pilihan peserta", participantName || "Semua peserta"],
    ["Jumlah peserta", summary.length],
    ["Satuan", "Hadir, Terlambat, Izin, Sakit, Alpa: jumlah catatan absensi."],
    ["Zona waktu jam absensi", "WIB"],
    ["Aturan perhitungan", note || ""],
  ]);
  info["!cols"] = [{ wch: 26 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(book, info, "Keterangan");
  XLSX.writeFile(
    book,
    `laporan-absensi-${fileKey}${search ? "-filter" : ""}.xlsx`,
  );
}

// Separate document construction from downloading to verify pagination with real data.
export async function buildAttendancePdf(
  { summary, label, signature, supervisorName = "" },
  { logoData, now = new Date() } = {},
) {
  const signer = supervisorName.trim();
  if (signature && !signer) throw new Error("Nama pembimbing wajib diisi.");
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setProperties({
    title: `Laporan Kehadiran - ${label}`,
    author: "Rawuh Pustaka",
  });
  const clean = (value) => String(value ?? "-").replace(/[—–]/g, "-");
  const timestamp = printedAt(now);
  let y;
  const header = () => {
    if (logoData) {
      const { width, height } = doc.getImageProperties(logoData);
      const scale = Math.min(18 / width, 18 / height);
      doc.addImage(
        logoData,
        "PNG",
        14,
        12,
        width * scale,
        height * scale,
        "brand",
      );
    }
    doc.setTextColor(24, 117, 80);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("RAWUH PUSTAKA", 37, 16);
    doc.setTextColor(30, 45, 62);
    doc.setFontSize(15);
    doc.text("Laporan Kehadiran", 37, 23);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const lines = doc.splitTextToSize(clean(`Periode: ${label}`), 159);
    doc.text(lines, 37, 29);
    y = 29 + lines.length * 4;
    doc.setTextColor(90, 105, 119);
    doc.text(`Dicetak: ${timestamp}`, 14, y + 4);
    doc.setDrawColor(212, 227, 219);
    doc.line(14, y + 8, 196, y + 8);
    y += 15;
  };
  const newPage = () => {
    doc.addPage();
    header();
  };
  header();
  const section = (
    title,
    headers,
    values,
    widths,
    { numericColumns = [], totalRow = false } = {},
  ) => {
    const drawHead = () => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(30, 45, 62);
      doc.text(title, 14, y);
      y += 6;
      doc.setFontSize(8);
      const cells = headers.map((cell, index) =>
        doc.splitTextToSize(cell, widths[index] - 4),
      );
      const height = Math.max(...cells.map((cell) => cell.length)) * 4 + 4;
      doc.setFillColor(24, 117, 80);
      doc.rect(14, y, 182, height, "F");
      doc.setTextColor(255, 255, 255);
      let x = 14;
      cells.forEach((cell, index) => {
        doc.text(
          cell,
          numericColumns.includes(index) ? x + widths[index] / 2 : x + 3,
          y + 5,
          { align: numericColumns.includes(index) ? "center" : "left" },
        );
        x += widths[index];
      });
      y += height;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(30, 45, 62);
    };
    if (y + 35 > 275) newPage();
    drawHead();
    if (!values.length) {
      doc.text("Tidak ada catatan pada periode ini.", 16, y + 6);
      y += 12;
    }
    values.forEach((value, rowIndex) => {
      const isTotal = totalRow && rowIndex === values.length - 1;
      doc.setFont("helvetica", isTotal ? "bold" : "normal");
      const cells = value.map((cell, index) =>
        doc.splitTextToSize(clean(cell), widths[index] - 6),
      );
      const lineCount = Math.max(1, ...cells.map((cell) => cell.length));
      let offset = 0;
      while (offset < lineCount) {
        let capacity = Math.floor((275 - y - 6) / 4);
        if (capacity < 1 || y + 11 > 275) {
          newPage();
          drawHead();
          capacity = Math.floor((275 - y - 6) / 4);
        }
        doc.setFont("helvetica", isTotal ? "bold" : "normal");
        const take = Math.min(capacity, lineCount - offset);
        const height = Math.max(11, take * 4 + 6);
        if (isTotal || rowIndex % 2 === 0) {
          doc.setFillColor(...(isTotal ? [226, 240, 233] : [245, 249, 247]));
          doc.rect(14, y, 182, height, "F");
        }
        doc.setDrawColor(224, 231, 235);
        doc.rect(14, y, 182, height);
        let x = 14;
        cells.forEach((cell, index) => {
          const fragment = cell.slice(offset, offset + take);
          if (fragment.length)
            doc.text(
              fragment,
              numericColumns.includes(index) ? x + widths[index] / 2 : x + 3,
              y + 6,
              { align: numericColumns.includes(index) ? "center" : "left" },
            );
          x += widths[index];
        });
        offset += take;
        y += height;
        if (offset < lineCount) {
          newPage();
          drawHead();
        }
      }
    });
    y += 10;
  };
  const statuses = [
    ["hadir", "Hadir"],
    ["terlambat", "Terlambat"],
    ["izin", "Izin"],
    ["sakit", "Sakit"],
    ["alpa", "Alpa"],
  ];
  const total = (row) =>
    statuses.reduce((sum, [field]) => sum + (row[field] || 0), 0);
  const internship = (row) =>
    `${row.internship_start ? dateLabel(row.internship_start) : "Belum diisi"} s.d. ${row.internship_end ? dateLabel(row.internship_end) : "Belum diisi"}`;
  if (summary.length === 1) {
    const person = summary[0];
    section(
      "Identitas peserta",
      ["Keterangan", "Data peserta"],
      [
        ["Nama lengkap", person.name],
        ["Universitas", person.university || "-"],
        ["Jurusan", person.major || "-"],
        ["Masa magang", internship(person)],
      ],
      [42, 140],
    );
    section(
      "Rekap per peserta",
      ["No.", "Status kehadiran", "Jumlah"],
      [
        ...statuses.map(([field, title], index) => [
          index + 1,
          title,
          person[field] || 0,
        ]),
        ["", "Total absensi tercatat", total(person)],
      ],
      [14, 132, 36],
      { numericColumns: [0, 2], totalRow: true },
    );
  } else {
    const totals = statuses.map(([field]) =>
      summary.reduce((sum, row) => sum + (row[field] || 0), 0),
    );
    section(
      "Rekap per peserta",
      [
        "No.",
        "Peserta / Universitas",
        "Hadir",
        "Terlambat",
        "Izin",
        "Sakit",
        "Alpa",
        "Total",
      ],
      [
        ...summary.map((row, index) => [
          index + 1,
          `${row.name}\n${row.university || "-"}\nJurusan: ${row.major || "-"}\nMagang: ${internship(row)}`,
          ...statuses.map(([field]) => row[field] || 0),
          total(row),
        ]),
        ...(summary.length
          ? [
              [
                "",
                "Total",
                ...totals,
                totals.reduce((sum, count) => sum + count, 0),
              ],
            ]
          : []),
      ],
      [10, 66, 20, 22, 16, 16, 16, 16],
      { numericColumns: [0, 2, 3, 4, 5, 6, 7], totalRow: summary.length > 0 },
    );
  }
  if (signature) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const nameLines = doc.splitTextToSize(clean(signer), 78);
    if (y + 40 + nameLines.length * 4 > 275) newPage();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 45, 62);
    doc.text("Mengetahui,", 150, y + 5, { align: "center" });
    doc.text("Pembimbing Magang", 150, y + 11, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(nameLines, 150, y + 39, { align: "center" });
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(212, 227, 219);
    doc.line(14, 283, 196, 283);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90, 105, 119);
    doc.text("Rawuh Pustaka | Laporan Kehadiran", 14, 289);
    doc.text(`Halaman ${page} dari ${pages}`, 196, 289, { align: "right" });
  }
  return doc;
}

export async function exportAttendancePdf(payload) {
  const response = await fetch(
    `${import.meta.env.BASE_URL}logo-rawuh-pustaka.png`,
  );
  if (!response.ok) throw new Error("Logo laporan gagal dimuat.");
  const logoData = new Uint8Array(await response.arrayBuffer());
  const doc = await buildAttendancePdf(payload, { logoData });
  doc.save(
    `laporan-absensi-${payload.fileKey}${payload.search ? "-filter" : ""}.pdf`,
  );
}
