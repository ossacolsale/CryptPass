import { syncScrypt } from "scrypt-js";
const { createCipheriv, createDecipheriv } = require("browserify-aes") as typeof import("crypto");
const randomBytes: (size: number) => Buffer = require("randombytes");

export interface AeadEnvelope { v: 2; alg: 'A256GCM'; nonce: string; ciphertext: string; tag: string; }
export interface ScryptParams { N: number; r: number; p: number; }

export class CommonSymEnc {
    public static readonly _EncAlg = 'aes-256-cbc'; // legacy reader only
    public static readonly _SymKeyLen = 48;
    public static readonly KdfParams = { N: 65536, r: 8, p: 1 };
    /**
     * V2 is capped at 64 MiB (128*N*r) and N*r*p = 524288; the legacy reader
     * retains its fixed 16 MiB, N*r*p = 131072 profile. Exact profiles keep
     * untrusted metadata from expanding either resource budget.
     */
    public static ValidateKdfParams(params: unknown, allowLegacy: boolean = false): params is ScryptParams {
        if (params === null || typeof params !== 'object') return false;
        const p = params as Record<string, unknown>;
        if (!Number.isInteger(p.N) || !Number.isInteger(p.r) || !Number.isInteger(p.p)) return false;
        const current = p.N === 65536 && p.r === 8 && p.p === 1;
        const legacy = allowLegacy && p.N === 16384 && p.r === 8 && p.p === 1;
        return current || legacy;
    }
    public static RandomBytesGenerator: (NBytes: number) => Buffer = (n: number) => randomBytes(n);
    public static Scrypt: (Password: string, Salt: string, KeyLen: number) => Buffer = (Password, Salt, KeyLen) => {
        const password = Buffer.from(Password.normalize('NFKC'));
        const salt = Buffer.from(Salt.normalize('NFKC'));
        const p = this.KdfParams;
        if (!this.ValidateKdfParams(p)) throw new Error('Invalid cryptographic input');
        return Buffer.from(syncScrypt(password, salt, p.N, p.r, p.p, KeyLen));
    };
    public static RandomKey(): Buffer { return this.RandomBytesGenerator(32); }
    public static RandomNonce(): Buffer { return this.RandomBytesGenerator(12); }
    public static DeriveKey(password: string, saltHex: string, params = this.KdfParams): Buffer {
        if (!password || typeof password !== 'string' || typeof saltHex !== 'string' || !/^[0-9a-f]{32,128}$/i.test(saltHex) || !this.ValidateKdfParams(params)) throw new Error('Invalid cryptographic input');
        const normalized = Buffer.from(password.normalize('NFKC'));
        return Buffer.from(syncScrypt(normalized, Buffer.from(saltHex, 'hex'), params.N, params.r, params.p, 32));
    }
    public static EncryptAead(key: Buffer, plainText: string, aad?: string): AeadEnvelope {
        if (key.length !== 32) throw new Error('Invalid cryptographic input');
        const nonce = this.RandomNonce();
        const cipher = createCipheriv('aes-256-gcm', key, nonce);
        if (aad !== undefined) cipher.setAAD(Buffer.from(aad, 'utf8'));
        const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
        return { v: 2, alg: 'A256GCM', nonce: nonce.toString('hex'), ciphertext: ciphertext.toString('hex'), tag: cipher.getAuthTag().toString('hex') };
    }
    public static DecryptAead(key: Buffer, envelope: AeadEnvelope, aad?: string): string {
        try {
            if (key.length !== 32 || envelope.v !== 2 || envelope.alg !== 'A256GCM' || !/^[\da-f]{24}$/i.test(envelope.nonce) || !/^[\da-f]*$/i.test(envelope.ciphertext) || !/^[\da-f]{32}$/i.test(envelope.tag)) throw new Error();
            const dec = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.nonce, 'hex'));
            if (aad !== undefined) dec.setAAD(Buffer.from(aad, 'utf8'));
            dec.setAuthTag(Buffer.from(envelope.tag, 'hex'));
            return Buffer.concat([dec.update(Buffer.from(envelope.ciphertext, 'hex')), dec.final()]).toString('utf8');
        } catch (_) { throw new Error('Decryption failed'); }
    }
    public static EncryptWithPassword(password: string, saltHex: string, plainText: string): string {
        const envelope = this.EncryptAead(this.DeriveKey(password, saltHex), plainText, 'CryptPass:v2');
        return JSON.stringify(envelope);
    }
    public static DecryptWithPassword(password: string, saltHex: string, cipherText: string, params = this.KdfParams): string {
        try { return this.DecryptAead(this.DeriveKey(password, saltHex, params), JSON.parse(cipherText) as AeadEnvelope, 'CryptPass:v2'); }
        catch (_) { throw new Error('Decryption failed'); }
    }
    // Exact legacy derivation and CBC behavior, read-only compatibility path.
    public static LegacyGetEncKey(password: string, salt: string): { key: string; iv: string } {
        const d = this.legacyScrypt(password, salt, 48).toString('hex').slice(0, 48);
        return { key: d.substring(0, 32), iv: d.substring(32, 16) };
    }
    private static legacyScrypt(password: string, salt: string, len: number): Buffer {
        const params = { N: 16384, r: 8, p: 1 };
        if (!this.ValidateKdfParams(params, true)) throw new Error('Invalid cryptographic input');
        return Buffer.from(syncScrypt(Buffer.from(password.normalize('NFKC')), Buffer.from(salt.normalize('NFKC')), params.N, params.r, params.p, len));
    }
    public static LegacyDecryptByPassword(password: string, salt: string, cipherText: string): string {
        try { const k = this.LegacyGetEncKey(password, salt); const d = createDecipheriv('aes-256-cbc', k.key, k.iv); return d.update(cipherText, 'hex', 'utf8') + d.final('utf8'); }
        catch (_) { throw new Error('Decryption failed'); }
    }
    public static LegacyDecrypt(key: string, iv: string, cipherText: string): string {
        try { const d = createDecipheriv('aes-256-cbc', key, iv); return d.update(cipherText, 'hex', 'utf8') + d.final('utf8'); }
        catch (_) { throw new Error('Decryption failed'); }
    }
    public static GenerateSalt(): string { return this.RandomBytesGenerator(16).toString('hex'); }
    public static GenerateIV(): string { return this.RandomBytesGenerator(12).toString('hex'); }
    public static GenerateRandomKey(): string { return this.RandomKey().toString('hex'); }
}
