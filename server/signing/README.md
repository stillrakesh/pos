# QZ Tray Signing Files

Place your QZ Tray signing files here:

## How to generate:

1. Open **QZ Tray** on your Mac (click the QZ icon in menu bar)
2. Go to **Advanced → Site Manager**
3. Click the **+** (plus) button to create new keys
4. Accept all prompts
5. QZ Tray will generate two files (usually saved to Desktop):
   - `digital-certificate.txt`
   - `private-key.pem`
6. **Copy both files into this folder** (`server/signing/`)
7. **Restart the POS server** (`npm run server`)

After this, the "Action Required" popup will show **"Remember this decision"** as ENABLED.
Check it once, click Allow, and you'll **never see the popup again**.
