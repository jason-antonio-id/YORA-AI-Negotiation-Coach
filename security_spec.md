# Security Specification for YORA Firebase

## Data Invariants
1. A User document can only be read/written by the owner of that UID.
2. A Supplier document must belong to a User (ownerId matches userId) and can only be accessed by that user.
3. A ChatMessage must belong to a Supplier that belongs to the user.
4. Timestamps (createdAt) must be set using request.time.
5. IDs must be valid (isValidId).

## The Dirty Dozen (Attacks to Block)
1. **Identity Spoofing**: Attempt to update another user's profile.
2. **Identity Spoofing (Supplier)**: Create a supplier with another user's UID as ownerId.
3. **Supplier Injection**: Attempt to create a supplier under another user's path.
4. **Message Hijacking**: Attempt to read/write messages of a supplier that belongs to another user.
5. **Ghost Field Injection**: Adding `isAdmin: true` to a User profile during registration.
6. **Immutable Field Tampering**: Changing `email` after registration.
7. **Type Poisoning**: Sending a number for `fullName`.
8. **Size Attack**: Sending a 1MB string for `chineseName`.
9. **Status Shortcut**: Jumping from 'Pending' to 'Active' without the required negotiation steps (if logic enforced, but here we just have a status field).
10. **ID Poisoning**: Using a document ID like `/.../.../` or very long strings.
11. **Orphans**: Creating a supplier without a parent user document (exists check).
12. **PII Leak**: A signed-in user trying to list all users to scrape emails.

## Test Strategy
I will create `firestore.rules.test.ts` using `@firebase/rules-unit-testing` or similar. Since I cannot run tests easily in this environment without setup, I will focus on generating the rules and performing a manual logic audit (Red Team).
