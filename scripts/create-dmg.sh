#!/bin/bash

set -e

APP_NAME="Restaurant POS"
APP_BUNDLE="$APP_NAME.app"
VERSION=$(node -p "require('./package.json').version")
VOLUME_NAME="$APP_NAME $VERSION"
DMG_OUTPUT="release/Restaurant-POS-v${VERSION}-Installer.dmg"
SOURCE_APP="release/mac/$APP_BUNDLE"
BACKGROUND_IMG="build/background.png"
TMP_DMG="release/tmp_rw.dmg"
MOUNT_DIR="/Volumes/$VOLUME_NAME"

echo "📦 Building DMG for $APP_NAME v$VERSION"
echo "   Source:  $SOURCE_APP"
echo "   Output:  $DMG_OUTPUT"

# Cleanup any previous DMG files
rm -f "$TMP_DMG"
rm -f "$DMG_OUTPUT"

# Unmount any stale volume with same name
hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true

# Calculate required size — use actual du size + 250MB buffer for safety
APP_SIZE_KB=$(du -sk "$SOURCE_APP" | awk '{print $1}')
REQUIRED_MB=$(( (APP_SIZE_KB / 1024) + 250 ))
echo "   App size: ${APP_SIZE_KB}KB  →  DMG size: ${REQUIRED_MB}MB"

# 1. Create a blank writable DMG
echo "🔨 Creating empty writable DMG..."
hdiutil create \
  -volname "$VOLUME_NAME" \
  -size "${REQUIRED_MB}m" \
  -fs HFS+ \
  "$TMP_DMG"

# 2. Mount the writable DMG
echo "📂 Mounting DMG..."
DEVICE=$(hdiutil attach -readwrite -noverify -noautoopen "$TMP_DMG" | \
  grep '^/dev/' | sed 1q | awk '{print $1}')
echo "   Device: $DEVICE  →  $MOUNT_DIR"
sleep 2

# 3. Copy app into the volume using ditto (preserves symlinks, xattrs, frameworks)
echo "📋 Copying app bundle (this may take a moment)..."
ditto "$SOURCE_APP" "$MOUNT_DIR/$APP_BUNDLE"

# 4. Set up the background image
echo "🖼️  Setting up background image..."
mkdir -p "$MOUNT_DIR/.background"
if [ -f "$BACKGROUND_IMG" ]; then
  cp "$BACKGROUND_IMG" "$MOUNT_DIR/.background/background.png"
  HAS_BG=true
else
  echo "   (No background image found, skipping)"
  HAS_BG=false
fi

# 5. Create Applications symlink
echo "🔗 Creating Applications symlink..."
ln -sf /Applications "$MOUNT_DIR/Applications"

# 6. Use AppleScript to set the Finder window appearance
echo "🎨 Configuring Finder layout..."
if [ "$HAS_BG" = true ]; then
osascript <<APPLESCRIPT
tell application "Finder"
    tell disk "$VOLUME_NAME"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {200, 100, 740, 480}
        set theViewOptions to the icon view options of container window
        set arrangement of theViewOptions to not arranged
        set icon size of theViewOptions to 96
        set background picture of theViewOptions to file ".background:background.png"
        set position of item "$APP_BUNDLE" of container window to {130, 220}
        set position of item "Applications" of container window to {410, 220}
        close
        open
        update without registering applications
        delay 3
    end tell
end tell
APPLESCRIPT
else
osascript <<APPLESCRIPT
tell application "Finder"
    tell disk "$VOLUME_NAME"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        set the bounds of container window to {200, 100, 740, 480}
        set theViewOptions to the icon view options of container window
        set arrangement of theViewOptions to not arranged
        set icon size of theViewOptions to 96
        set position of item "$APP_BUNDLE" of container window to {130, 220}
        set position of item "Applications" of container window to {410, 220}
        close
        open
        update without registering applications
        delay 3
    end tell
end tell
APPLESCRIPT
fi

# 7. Make invisible files hidden
echo "🧹 Cleaning up hidden files..."
SetFile -a V "$MOUNT_DIR/.background" 2>/dev/null || true

# 8. Sync and unmount
echo "💾 Syncing and unmounting..."
sync
hdiutil detach "$DEVICE" -quiet
sleep 2

# 9. Convert to final compressed read-only DMG
echo "📦 Converting to compressed DMG..."
hdiutil convert "$TMP_DMG" \
  -format UDZO \
  -imagekey zlib-level=9 \
  -o "$DMG_OUTPUT"

# 10. Cleanup temp DMG
rm -f "$TMP_DMG"

echo ""
echo "✅ Done! DMG created at: $DMG_OUTPUT"
ls -lh "$DMG_OUTPUT"
