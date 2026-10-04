# WEIG phone interface

The `/he/calls` and `/en/calls` routes use a dedicated mobile-first phone interface. The app's existing four main navigation destinations remain intact. Inside Calls, Keypad, Recents, Contacts and Wallet tabs provide the familiar telephone workflow.

- Keypad: direct typing or pasting, a conventional LTR 3×4 keypad in both languages, hold zero for a leading +, backspace, country selection and normalized international numbers.
- Contacts: create, edit, delete, search, favorite and select a contact for dialing. Contact records are stored only in this browser/device under the versioned `weig-phone-contacts-v1` key. No device address-book permissions or cloud synchronization are requested.
- Recents: an empty state until actual provider calls exist. Attempting a call while the provider is unavailable never fabricates a call record.
- Wallet: explicitly not activated; planned top-up amounts can be previewed. Checkout is disabled. No sample money balance, invented rates, payment request or charge is produced.
- My number: explicitly unassigned until a provider provisions a real number.

Actual WebRTC/SIP calls, incoming calls, provider-issued numbers, authenticated server-side wallet accounting, checkout and webhook-based billing still require a telephony/payment integration. No integration has been enabled by this UI update.

Validation covers international/local prefix handling, malformed contact storage, saving/favoriting/dialing contacts, and unavailable-provider behavior without calling a network service or claiming a charge.
