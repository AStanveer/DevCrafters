import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

export const generateReceiptPDF = async (
  data: any
): Promise<string | null> => {
  try {
    // 1️⃣ Create HTML content for PDF
    const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color:#0f172a;">Receipt #${data.receiptNumber}</h2>
          <p><strong>Date:</strong> ${data.date}</p>

          <h3 style="color:#0f172a;">Pharmacy</h3>
          <p>${data.pharmacy.name}</p>
          <p>${data.pharmacy.address}</p>

          <h3 style="color:#0f172a;">Items</h3>
          ${data.items
            .map(
              (item: any, i: number) =>
                `<p>${i + 1}. ${item.medicineName} - ${item.quantity} x RM ${item.unitPrice.toFixed(
                  2
                )} = RM ${item.total.toFixed(2)}</p>`
            )
            .join("")}

          <h3 style="color:#0ea5e9;">
            Total Paid: RM ${data.summary.total.toFixed(2)}
          </h3>
        </body>
      </html>
    `;

    // 2️⃣ Generate PDF (Expo auto temp name)
    const pdfResult = await Print.printToFileAsync({ html: htmlContent });

    if (!pdfResult?.uri) {
      throw new Error("PDF generation failed");
    }

    console.log("Generated temp PDF:", pdfResult.uri);

    // 3️⃣ Create FULL custom filename
    const fileName = `receipt_${data.receiptNumber}.pdf`;
    const newPath = FileSystem.documentDirectory + fileName;

    // 4️⃣ Copy temp PDF → renamed PDF
    await FileSystem.copyAsync({
      from: pdfResult.uri,
      to: newPath,
    });

    console.log("Renamed PDF:", newPath);

    // 5️⃣ Share renamed PDF
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(newPath, {
        mimeType: "application/pdf",
        dialogTitle: `Receipt #${data.receiptNumber}`,
        UTI: "com.adobe.pdf",
      });

      return newPath; // ✅ returns renamed file
    } else {
      alert("Sharing is not available on this device.");
      return null;
    }
  } catch (err) {
    console.error("PDF generation failed:", err);
    alert(
      `Failed to generate PDF. ${
        err instanceof Error ? err.message : ""
      }`
    );
    return null;
  }
};
