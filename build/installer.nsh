; Custom NSIS installer script for Restaurant POS
; Shows Update vs Fresh Install dialog when existing data is detected

!include "LogicLib.nsh"

; Suppress "variable not referenced" warning - variable IS used across macros
!pragma warning disable 6001

; Track whether user chose fresh install
Var PosDoFreshInstall

; --- customInit runs during .onInit, before any install pages ---
!macro customInit
  StrCpy $PosDoFreshInstall "0"

  ; Check if existing database exists in AppData
  IfFileExists "$APPDATA\restaurant-pos\data\pos_orders.db" 0 posCheckAlt
    Goto posFoundExisting

  posCheckAlt:
  IfFileExists "$APPDATA\Restaurant POS\data\pos_orders.db" 0 posNoExisting
    Goto posFoundExisting

  posFoundExisting:
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "An existing Restaurant POS installation with saved data was detected.$\n$\n\
      Would you like to keep your existing data?$\n$\n\
      YES = Update (keep all sales data, settings, menu items)$\n\
      NO  = Fresh Install (wipe everything and start clean)" \
      IDYES posKeepData

    ; User clicked NO — wants fresh install, confirm it
    MessageBox MB_YESNO|MB_ICONEXCLAMATION \
      "WARNING: Fresh Install will PERMANENTLY delete:$\n$\n\
      - All sales & order history$\n\
      - All settings & preferences$\n\
      - All menu items & categories$\n\
      - All customer data$\n\
      - All floor plan layouts$\n$\n\
      This CANNOT be undone. Are you absolutely sure?" \
      IDYES posConfirmFresh

    ; User clicked NO on confirmation — keep data
    Goto posKeepData

  posConfirmFresh:
    StrCpy $PosDoFreshInstall "1"

  posKeepData:
  posNoExisting:
!macroend

; --- customInstall runs AFTER files are extracted ---
!macro customInstall
  ${If} $PosDoFreshInstall == "1"
    ; Wipe all user data for a clean start
    RMDir /r "$APPDATA\restaurant-pos\data"
    RMDir /r "$APPDATA\restaurant-pos\Local Storage"
    RMDir /r "$APPDATA\restaurant-pos\Session Storage"
    RMDir /r "$APPDATA\restaurant-pos\IndexedDB"
    RMDir /r "$APPDATA\Restaurant POS\data"
    RMDir /r "$APPDATA\Restaurant POS\Local Storage"
    RMDir /r "$APPDATA\Restaurant POS\Session Storage"
    RMDir /r "$APPDATA\Restaurant POS\IndexedDB"
  ${EndIf}
!macroend
