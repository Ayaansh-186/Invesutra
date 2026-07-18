"use client";

import type { ReportPdfData } from "./ReportDocument";

/**
 * Renders a portfolio report to a PDF Blob and triggers a browser download.
 *
 * @react-pdf/renderer pulls in a sizeable rendering engine, so it's loaded
 * dynamically here rather than at module scope — this keeps it out of the
 * initial bundle for every page and only pays the cost when a Premium user
 * actually exports a PDF.
 */
export async function downloadReportPdf(report: ReportPdfData) {
  const [{ pdf }, { ReportDocument }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./ReportDocument"),
  ]);

  const blob = await pdf(<ReportDocument report={report} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${report.id}-invesutra-report.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
