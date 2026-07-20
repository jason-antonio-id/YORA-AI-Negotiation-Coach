import { google } from 'googleapis';

let sheetsClient: any = null;

function getSheets() {
  if (!sheetsClient) {
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
    if (!clientEmail || !privateKey) {
      console.warn("GOOGLE_SHEETS_CLIENT_EMAIL or GOOGLE_SHEETS_PRIVATE_KEY is missing from env. Skipping Google Sheets client initialization.");
      return null;
    }
    try {
      // Clean up the private key: remove surrounding quotes and handle nested \n
      const formattedKey = privateKey
        .replace(/^"|"$/g, '')
        .replace(/\\n/g, '\n');

      const auth = new google.auth.JWT({
        email: clientEmail,
        key: formattedKey,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      sheetsClient = google.sheets({ version: 'v4', auth });
    } catch (err) {
      console.error("Failed to initialize Google Sheets client:", err);
      return null;
    }
  }
  return sheetsClient;
}

/**
 * Ensures that a sheet tab with the given name exists in the Google Spreadsheet.
 * If not, it will attempt to create the tab and populate the header row.
 */
async function ensureSheetExists(sheets: any, spreadsheetId: string, sheetName: string, headers: string[]) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = meta.data.sheets || [];
    const sheetExists = existingSheets.some((s: any) => s.properties?.title === sheetName);

    if (!sheetExists) {
      console.log(`Sheet tab "${sheetName}" not found. Auto-creating tab in Google Sheets...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName
                }
              }
            }
          ]
        }
      });

      // Write the header row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers]
        }
      });
      console.log(`Successfully created sheet tab "${sheetName}" with headers in Google Sheets.`);
    }
  } catch (err: any) {
    console.warn(`Could not verify or auto-create sheet tab "${sheetName}" (might already exist or have restricted read permissions):`, err.message || err);
    // We don't throw here; we'll let the subsequent append call try anyway, which can succeed if permissions allow write but not get
  }
}

export interface SignupProfile {
  email: string;
  fullName: string;
  businessName: string;
  businessType: string;
  originCity: string;
  province: string;
  instagram: string;
  aiLang: string;
  aiStyle: string;
  aiTone: string;
  aiDepth: string;
}

// Logs a completed onboarding profile to the "signups" sheet tab.
// Column order must exactly match the header row in the sheet:
// timestamp | fullName | email | businessName | businessType | originCity | province | instagram | aiLang | aiStyle | aiTone | aiDepth
export async function appendSignup(data: SignupProfile) {
  try {
    const sheets = getSheets();
    if (!sheets) {
      console.warn("Google Sheets client is not configured. Skipping appendSignup.");
      return;
    }
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.warn("GOOGLE_SHEET_ID is not configured. Skipping appendSignup.");
      return;
    }

    const headers = [
      'timestamp', 'fullName', 'email', 'businessName', 'businessType',
      'originCity', 'province', 'instagram', 'aiLang', 'aiStyle', 'aiTone', 'aiDepth'
    ];
    await ensureSheetExists(sheets, spreadsheetId, 'signups', headers);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'signups!A:L',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          new Date().toISOString(),
          data.fullName,
          data.email,
          data.businessName,
          data.businessType,
          data.originCity,
          data.province,
          data.instagram,
          data.aiLang,
          data.aiStyle,
          data.aiTone,
          data.aiDepth,
        ]]
      }
    });
    console.log(`Successfully appended completed profile for ${data.email} to Google Sheets`);
  } catch (error) {
    console.error("Failed to append signup to Google Sheets:", error);
  }
}

// Updates an existing profile's Name and Instagram in Google Sheets
export async function updateSignupInSheets(email: string, fullName: string, instagram: string) {
  try {
    const sheets = getSheets();
    if (!sheets) {
      console.warn("Google Sheets client is not configured. Skipping updateSignupInSheets.");
      return false;
    }
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.warn("GOOGLE_SHEET_ID is not configured. Skipping updateSignupInSheets.");
      return false;
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Fetch all rows in the signups sheet to find the row index of the user
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'signups!A:L',
    });

    const rows = response.data.values || [];
    // Find the row where the email (Column C, index 2) matches cleanEmail
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][2] && rows[i][2].trim().toLowerCase() === cleanEmail) {
        rowIndex = i + 1; // 1-based index for Google Sheets
        break;
      }
    }

    if (rowIndex !== -1) {
      console.log(`Found user ${cleanEmail} at row ${rowIndex}. Updating fullName and instagram in Google Sheets...`);
      // Update Column B (fullName)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `signups!B${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[fullName]]
        }
      });

      // Update Column H (instagram)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `signups!H${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[instagram]]
        }
      });
      console.log(`Successfully updated profile in Google Sheets for ${cleanEmail}`);
      return true;
    } else {
      console.log(`User ${cleanEmail} not found in Google Sheets signups tab.`);
      return false;
    }
  } catch (error) {
    console.error("Failed to update signup in Google Sheets:", error);
    return false;
  }
}

export interface SupplierLog {
  userEmail: string;
  id?: string;
  chineseName: string;
  englishName: string;
  wechatId: string;
  url: string;
  province: string;
  city: string;
  discoverySource: string;
  cooperationHistory: string;
  status: string;
  productName: string;
  productChineseName: string;
  category: string;
  specs: string;
  targetPrice: string;
  currentPrice: string;
  walkAwayPrice: string;
  moq: string;
  targetMOQ: string;
  incoterms: string;
  negotiationGoal: string;
  paymentTarget: string;
  urgencyLevel: string;
  notes: string;
}

// Logs every supplier a user adds to the "suppliers_added" sheet tab.
// Column order must exactly match the header row in the sheet.
export async function appendSupplier(data: SupplierLog) {
  try {
    const sheets = getSheets();
    if (!sheets) {
      console.warn("Google Sheets client is not configured. Skipping appendSupplier.");
      return;
    }
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.warn("GOOGLE_SHEET_ID is not configured. Skipping appendSupplier.");
      return;
    }

    const headers = [
      'timestamp', 'userEmail', 'chineseName', 'englishName', 'wechatId', 'url',
      'province', 'city', 'discoverySource', 'cooperationHistory', 'status',
      'productName', 'productChineseName', 'category', 'specs', 'targetPrice',
      'currentPrice', 'walkAwayPrice', 'moq', 'targetMOQ', 'incoterms',
      'negotiationGoal', 'paymentTarget', 'urgencyLevel', 'notes', 'id'
    ];
    await ensureSheetExists(sheets, spreadsheetId, 'suppliers_added', headers);

    const cleanEmail = data.userEmail.trim().toLowerCase();
    const cleanId = data.id ? data.id.trim() : '';

    // 1. Fetch existing suppliers to see if this one already exists
    let rowIndex = -1;
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'suppliers_added!A:Z',
      });
      const rows = response.data.values || [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;
        const rowEmail = row[1] ? row[1].trim().toLowerCase() : '';
        if (rowEmail !== cleanEmail) continue;

        // Match by unique ID if present
        const rowId = row[25] ? row[25].trim() : '';
        if (cleanId && rowId === cleanId) {
          rowIndex = i + 1;
          break;
        }

        // Fallback: match by names if ID is empty or not matching
        const rowChinese = row[2] ? row[2].trim() : '';
        const rowEnglish = row[3] ? row[3].trim() : '';
        const matchChinese = data.chineseName && rowChinese === data.chineseName.trim();
        const matchEnglish = data.englishName && rowEnglish === data.englishName.trim();
        if (matchChinese || matchEnglish) {
          rowIndex = i + 1;
          break;
        }
      }
    } catch (readErr: any) {
      console.warn("Could not read suppliers_added sheet tab for duplication check:", readErr.message || readErr);
    }

    const rowValues = [
      new Date().toISOString(),
      cleanEmail,
      data.chineseName,
      data.englishName,
      data.wechatId,
      data.url,
      data.province,
      data.city,
      data.discoverySource,
      data.cooperationHistory,
      data.status,
      data.productName,
      data.productChineseName,
      data.category,
      data.specs,
      data.targetPrice,
      data.currentPrice,
      data.walkAwayPrice,
      data.moq,
      data.targetMOQ,
      data.incoterms,
      data.negotiationGoal,
      data.paymentTarget,
      data.urgencyLevel,
      data.notes,
      cleanId,
    ];

    if (rowIndex !== -1) {
      console.log(`Supplier already exists in Google Sheets at row ${rowIndex}. Updating in place...`);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `suppliers_added!A${rowIndex}:Z${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowValues]
        }
      });
      console.log(`Successfully updated supplier ${data.englishName || data.chineseName} in Google Sheets`);
    } else {
      console.log(`Adding new supplier to Google Sheets...`);
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'suppliers_added!A:Z',
        valueInputOption: 'RAW',
        requestBody: {
          values: [rowValues]
        }
      });
      console.log(`Successfully appended added supplier ${data.englishName || data.chineseName} to Google Sheets`);
    }
  } catch (error) {
    console.error("Failed to append or update supplier in Google Sheets:", error);
  }
}

// Logs a star rating + optional comment to the "feedback" sheet tab.
export async function appendFeedback(email: string, rating: number, comment: string) {
  try {
    const sheets = getSheets();
    if (!sheets) return;
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) return;

    const headers = ['timestamp', 'email', 'rating', 'comment'];
    await ensureSheetExists(sheets, spreadsheetId, 'feedback', headers);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'feedback!A:D',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[new Date().toISOString(), email.trim().toLowerCase(), rating, comment || '']]
      }
    });
    console.log(`Successfully appended feedback for ${email} to Google Sheets`);
  } catch (error) {
    console.error("Failed to append feedback to Google Sheets:", error);
  }
}
