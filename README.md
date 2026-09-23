# CryptPass

CryptPass is a TypeScript library for storing credential entries in an application-managed vault. The vault data and the 26-number sequence are persisted separately through writer callbacks supplied by the application.

For background on the project, see the [CryptPass project page](https://giancarlomangiagli.it/en/CryptPass_password_manager.html).

## What's new in 0.1.0 (from 0.0.8)

- New vaults and rewritten data use **format version 2**, with AES-256-GCM authenticated encryption, a fresh random nonce for every encryption, and a 32-byte random master key.
- Password-based key derivation uses scrypt with `N=65536`, `r=8`, and `p=1`. The parameters and format version are stored with the vault so they can be changed in a future format.
- Existing 0.0.8 vaults remain readable through a legacy CBC decryption path. When a legacy vault is successfully unlocked and then changed through a password-based entry save, password change, or sequence refresh, CryptPass writes it in format 2.
- The sequence must now be exactly a permutation of the integers `0` through `25`. Malformed sequences and malformed master-key chunks are rejected.
- The browser bundle is built with esbuild. `npm audit` currently reports no known dependency vulnerabilities.

The serialized `KeyPass` object is still passed to the application writer, but its contents are not an application-level API. In format 2, the `Key.MasterKChunks` and `Pass.Entries` values have new contents. Do not parse, edit, or construct those fields yourself. The internal value returned by `CryptPassCached.GetK()` also differs between legacy and version 2 vaults; treat it as an opaque secret and do not depend on its representation.

### Upgrading an existing vault

1. Back up **both** the stored `KeyPass` object and the sequence object before upgrading.
2. Load them with the 0.1.0 library and verify the password with `ConfigCryptPass.checkPwd()`.
3. Trigger a password-based change, such as `refreshSequence(password)`, `chPwd(oldPassword, newPassword)`, or saving an entry through `CryptPass`. Check that the operation returns `true` and that the application persisted the updated objects.
4. Keep the backup until you have reopened the saved vault and verified that its entries are readable.

A 0.0.8 library cannot read a vault after it has been rewritten in format 2. The library calls the key-pass and sequence writers separately; applications that store these objects separately should retain backups or provide a transaction/versioning mechanism so a failed or interrupted update cannot leave mismatched files. Do not run `initSeqAndKey()` on an existing vault: it initializes a new vault and replaces its key material.

## Security and data handling

New encryption uses AES-256-GCM. Authentication failure, a wrong password, or corrupted ciphertext causes decryption to fail; the library does not return unauthenticated plaintext. Legacy CBC is used only to read old vault data.

The default scrypt parameters are `N=65536`, `r=8`, and `p=1`. They require approximately 64 MiB for the main scrypt memory array, plus implementation overhead. Actual unlock time depends on the device and JavaScript engine. The repository includes a browser benchmark; see [Browser KDF benchmark](#browser-kdf-benchmark).

The sequence is required to reconstruct the stored master-key data. Keep it available and back it up together with the vault. It is not a substitute for a strong master password or for authenticated encryption.

`Pass.Description` is stored in plaintext. The salt, KDF settings, format version, last-change time, sequence object, and ciphertext metadata are also visible to whoever can read the stored files. Credential fields and entry names are encrypted.

In a browser, encryption protects stored vault data while it is locked. It cannot protect passwords from malicious scripts, browser extensions, or an XSS vulnerability in the application while the vault is unlocked. Avoid logging passwords, decrypted entries, or values returned by `GetK()`; clear references to unlocked vault objects when they are no longer needed.

## Installation

Install the package from npm:

```sh
npm install cryptpass
```

## Build from source

```sh
npm ci
npm test
npm run build
npm run bundle
```

The browser bundle is generated at `dist/LibCryptPass.js`. Generated `dist/` files are not committed. The package also provides TypeScript declarations for the source API.

## Storage model and writer callbacks

The application owns persistence. CryptPass works with two objects:

- `KeyPassObj`: vault metadata, encrypted master-key chunks, the vault description, and encrypted entries.
- `SequenceObj`: an object with a `Sequence` property containing a permutation of `[0, 1, ..., 25]`.

Pass both objects back to the library when reopening a vault. Keep them paired: a vault object with the wrong sequence cannot be unlocked.

Every writer receives the complete object to store and may return either a boolean or a promise for a boolean:

```ts
import { StdWriters } from 'cryptpass';

const writers: StdWriters = {
    KeyPassWriter: async (obj) => {
        // Persist JSON.stringify(obj), returning true only after a successful write.
        return saveKeyPassObject(obj);
    },
    SequenceWriter: async (obj) => {
        // Persist JSON.stringify(obj), returning true only after a successful write.
        return saveSequenceObject(obj);
    }
};
```

`saveKeyPassObject` and `saveSequenceObject` above represent application-specific storage functions. Use atomic writes and backups where the storage system supports them. Since there are two separate writer calls, a pair of independent file writes is not automatically a transaction.

## Main API

### `ConfigCryptPass`

Use this class to create a vault and manage its password or sequence.

```ts
const config = new ConfigCryptPass(writers, keyPassObj, sequenceObj);
```

- `initSeqAndKey(password): Promise<boolean>` creates a new sequence and initializes a new format 2 vault. Call it only when creating a new vault.
- `checkPwd(password): boolean` checks whether the password unlocks the current vault.
- `refreshSequence(password): Promise<boolean>` generates and stores a new sequence and rewrites the vault data. Back up both objects first.
- `chPwd(oldPassword, newPassword): Promise<boolean>` changes the master password and rewrites the vault.
- `restoreSeq(sequence): Promise<boolean>` stores a valid 26-number permutation; invalid input returns `false`.
- `getSequence(): number[]` returns the current sequence synchronously.
- `getLastChange(): Date` returns the recorded master-password change date.

Check each promise result. A `false` result means the operation or a writer did not report success. Decryption and corrupted-data errors from credential operations can throw; handle them at the application boundary and show users a generic unlock/error message.

### `CryptPass`

This is the direct interface for adding and editing entries. It retains the supplied password in the instance and uses it for each operation.

```ts
const vault = new CryptPass(password, writers, keyPassObj, sequenceObj);
```

- `addEntry(entry): Promise<boolean>` adds an entry. `Name` is required at runtime.
- `getEntry(name): false | EntryView` returns an entry or `false` if no entry has that name.
- `getEntryNames(): string[]` returns the entry names.
- `updateEntry(entry): Promise<boolean>` updates an existing entry; pass its `Name`.
- `updateEntryName(oldName, newName): Promise<boolean>` renames an entry.
- `deleteEntry(name): Promise<boolean>` deletes an entry.
- `getPassDescription()` and `setPassDescription(description)` read and write the plaintext vault description.

### `CryptPassCached`

Use this interface when the application wants to manage an `EntriesManage` instance itself or work with the master key directly. The master key is sensitive: keep it in memory only as long as necessary, never log it, and do not parse or store its string representation as an application contract.

- `GetK(password): string | false` unlocks the master key.
- `GetEntriesManage(passwordOrK, isK?)` returns an `EntriesManage` instance. Set `isK` to `true` only when passing a value returned by `GetK()`.
- `SetEntries(entries, passwordOrK, isK?)` encrypts and writes the complete entries object. Check its returned promise.
- `getPassDescription()` and `setPassDescription(description)` access the plaintext description.

For legacy vaults, use a password-based save or first call `refreshSequence()`/`chPwd()` to migrate. Do not use a legacy `GetK()` value to write entries with `isK: true` before migration.

### `EntriesManage` and `EntryView`

`EntriesManage` offers synchronous in-memory operations: `AddEntry`, `GetEntry`, `GetEntryNames`, `UpdateEntry`, `UpdateEntryName`, `DeleteEntry`, and `Export`. Changes made through this class are not persisted until you pass `Export()` to `CryptPassCached.SetEntries()`.

`EntryView` supports these optional fields:

```ts
interface EntryValue {
    Description?: string;
    Tags?: string;
    Username?: string;
    Password?: string;
    PIN?: string;
    Other?: { [name: string]: string };
}

interface EntryView extends EntryValue {
    Name?: string;
    Date?: Date;
    DateStr?: string;
}
```

Although `Name` is optional in the TypeScript interface, it is required by `AddEntry` and `UpdateEntry` at runtime. The library records a `DateStr` when an entry is added or updated; `GetEntry` also supplies a `Date` value.

## Browser example

The generated bundle exposes a global named `LibCryptPass`. In a TypeScript project that loads this global bundle, include `TypesForBundle.d.ts` so TypeScript knows its API and the `StdWriters` interface. This example uses `localStorage` only to demonstrate the writer interface; for production, choose storage and backup behavior appropriate to your application.

```ts
const readObject = (key: string): {} | undefined => {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as {} : undefined;
};

const writers: StdWriters = {
    KeyPassWriter: (obj) => {
        try {
            localStorage.setItem('cryptpass-key', JSON.stringify(obj));
            return true;
        } catch (_) { return false; }
    },
    SequenceWriter: (obj) => {
        try {
            localStorage.setItem('cryptpass-sequence', JSON.stringify(obj));
            return true;
        } catch (_) { return false; }
    }
};

async function example() {
    const password = 'use a strong password from your application UI';
    const config = new LibCryptPass.ConfigCryptPass(
        writers,
        readObject('cryptpass-key'),
        readObject('cryptpass-sequence')
    );

    // Run this initialization only for a new vault.
    if (!readObject('cryptpass-key')) {
        if (!(await config.initSeqAndKey(password))) throw new Error('Vault creation failed');
    } else if (!config.checkPwd(password)) {
        throw new Error('Unable to unlock vault');
    }

    const vault = new LibCryptPass.CryptPass(
        password,
        writers,
        readObject('cryptpass-key'),
        readObject('cryptpass-sequence')
    );
    const saved = await vault.addEntry({
        Name: 'Email account',
        Username: 'user@example.com',
        Password: 'example only'
    });
    if (!saved) throw new Error('Entry could not be saved');
}
```

The example's password is a placeholder. Obtain the real password from a secure application flow; do not hard-code it.

## Browser KDF benchmark

To measure scrypt on a browser and device, run:

```sh
npm run benchmark:browser
```

Open the local URL printed by the command (by default `http://127.0.0.1:8089/`) and select **Avvia benchmark**. The page measures `N=16384`, `32768`, and `65536` in a Web Worker, reporting the median, minimum, and maximum. Stop the local server with `Ctrl+C` when finished. This benchmark helps compare supported devices; it does not automatically change the library's KDF settings.
