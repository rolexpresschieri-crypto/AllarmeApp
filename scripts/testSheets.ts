import {google} from 'googleapis';

async function main() {
  const keyFile = `${process.cwd()}/google-service-account.json`;

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({
    version: 'v4',
    auth,
  });

  const spreadsheetId = '10IQz-bgFIb0oAl2Kv-ZHGw6bzN88_cqymF8HWBuCGE4';

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'VOLUNTEERS!A1:F10',
  });

  console.log(JSON.stringify(res.data.values, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

