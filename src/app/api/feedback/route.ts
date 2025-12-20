import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/env/server';

interface FeedbackPayload {
  timestamp: string;
  wallet_address: string;
  tx_type: string;
  status: 'yes' | 'average' | 'no';
  txhash?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: FeedbackPayload = await request.json();

    // Validate required fields
    if (!body.timestamp || !body.wallet_address || !body.tx_type || !body.status) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate status enum
    if (!['slow', 'normal', 'fast'].includes(body.status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }

    // Get Google Sheets configuration from environment
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
      console.error('Google Sheets configuration missing');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Import googleapis dynamically (only on server)
    let googleModule;
    try {
      googleModule = await import('googleapis');
    } catch (error) {
      console.error('googleapis package not installed. Run: npm install googleapis');
      return NextResponse.json(
        { error: 'Server configuration error: googleapis not installed' },
        { status: 500 }
      );
    }

    const { google } = googleModule;

    // Create JWT client for service account
    const auth = new google.auth.JWT({
      email: serviceAccountEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Append row to the sheet
    // Sheet has headers: timestamp, wallet_address, tx_type, status, txhash
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:E', // Adjust range as needed
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          body.timestamp,
          body.wallet_address,
          body.tx_type,
          body.status,
          body.txhash || '',
        ]],
      },
    });

    return NextResponse.json(
      { success: true, message: 'Feedback submitted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error submitting feedback:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('credentials')) {
        return NextResponse.json(
          { error: 'Authentication failed' },
          { status: 500 }
        );
      }
      if (error.message.includes('spreadsheet')) {
        return NextResponse.json(
          { error: 'Spreadsheet not found or inaccessible' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
