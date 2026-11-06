import { PDFDocument } from 'pdf-lib'

export async function appendPdfPages(reportBytes, attachmentBytes) {
  const report = await PDFDocument.load(reportBytes)
  const attachment = await PDFDocument.load(attachmentBytes)
  const pages = await report.copyPages(attachment, attachment.getPageIndices())
  pages.forEach((page) => report.addPage(page))
  return report.save()
}
