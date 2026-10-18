# Backend Configuration

## Firebase Service Account Setup

**IMPORTANT**: You need to place your Firebase service account JSON file in this directory.

### Steps:

1. Download the service account JSON from Firebase Console:
   - Go to Project settings → Service accounts
   - Click "Generate new private key"
   - Save the downloaded JSON file

2. Rename the file to `firebase-service-account.json`

3. Place it in this directory:
   ```
   backend/config/firebase-service-account.json
   ```

4. **NEVER commit this file to git!** It contains sensitive credentials.

5. The file is already in `.gitignore` for security.

### Expected File Structure:

```json
{
  "type": "service_account",
  "project_id": "fayshaa-5cac6",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...",
  "client_id": "...",
  ...
}
```

### Security Notes:

- ✅ File is in `.gitignore`
- ✅ File permissions should be 600 (read/write for owner only)
- ❌ NEVER share this file publicly
- ❌ NEVER commit to version control
- ❌ NEVER expose in client-side code
