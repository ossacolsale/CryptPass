import { createCipheriv, createDecipheriv } from "crypto";
import randomBytes from "randombytes-pure";
import { syncScrypt } from "scrypt-js";


export class CommonSymEnc {

    //#region  sym enc helpers

    public static readonly _EncAlg = 'aes-256-cbc';
    public static readonly _SymKeyLen = 48; //32 key + 16 iv

    public static RandomBytesGenerator: (NBytes: number) => Buffer = randomBytes;
    public static Scrypt: (Password: string, Salt: string, KeyLen: number) => Buffer
         = (Password: string, Salt: string, KeyLen: number) => {
            const password = Buffer.from(Password.normalize('NFKC'));
            const salt = Buffer.from(Salt.normalize('NFKC'));
            const N = 16384, r = 8, p = 1;
             return Buffer.from(syncScrypt(password, salt, N, r, p, KeyLen).buffer);
            }
    public static SymEncrypt: (Key: string, IV: string, PlainText: string) => string 
        = (Key: string, IV: string, PlainText: string) => { const cip = createCipheriv(this._EncAlg, Key, IV); return cip.update(PlainText, 'utf8', 'hex') + cip.final('hex'); };
    public static SymDecrypt: (Key: string, IV: string, CypherText: string) => string 
        = (Key: string, IV: string, CypherText: string) => { const dec = createDecipheriv(this._EncAlg, Key, IV); return dec.update(CypherText, 'hex', 'utf8') + dec.final('utf8'); };
    

    public static SymEncryptByPwd (Password: string, Salt: string, PlainText: string) {
        const ek = this.GetEncKey(Password, Salt);
        return this.SymEncrypt(ek.key, ek.iv, PlainText);
    }

    public static SymDecryptByPwd (Password: string, Salt: string, CipherText: string) {
        const ek = this.GetEncKey(Password, Salt)
        return this.SymDecrypt(ek.key, ek.iv, CipherText);
    }

    public static GetEncKey (password: string, salt: string): { key:string, iv: string } {
        //return scryptSync(password, salt, this._SymKeyLen).toString('hex').slice(0, this._SymKeyLen);
        const r = this.Scrypt(password, salt, this._SymKeyLen).toString('hex').slice(0, this._SymKeyLen);
        return { key: r.substring(0,32), iv: r.substring(32,16) };
    }
    /*
    
    public static Decipher(dec: Decipher, Msg: string) {
        return dec.update(Msg, 'hex', 'utf-8') + dec.final('utf8');
    }

    public static Cipher(cip: Cipher, Msg: string) {
        return cip.update(Msg, 'utf8', 'hex') + cip.final('hex');
    }

    public static GetCipher(password: string, salt: string, iv: string): Cipher {
        return createCipheriv(this._EncAlg, this.GetEncKey(password, salt), iv);
    }

    public static GetCipherByKey(key: string, iv: string): Cipher {
        return createCipheriv(this._EncAlg, key, iv);
    }

    public static GetDecipher(password: string, salt: string, iv: string): Decipher {
        return createDecipheriv(this._EncAlg, this.GetEncKey(password, salt), iv);
    }

    public static GetDecipherByKey(key: string, iv: string): Decipher {
        return createDecipheriv(this._EncAlg, key, iv);
    }*/

    public static GenerateIV (): string {
        return this.RandomBytesGenerator(16).toString('hex').slice(0,16);
    }

    public static GenerateSalt (): string {
        return this.RandomBytesGenerator(16).toString('hex');
    }

    public static GenerateRandomKey (): string {
        return this.RandomBytesGenerator(32).toString('hex').slice(0,32);
    }

    //#endregion
}

/*
export class CommonAsymEnc {
    //#region asym enc helpers

    public static CreatePairwise () {
        //return { publicKey: 'x', privateKey: 'y'}
        return generateKeyPairSync('rsa', {
            modulusLength: 2048, // the length of your key in bits
            publicKeyEncoding: {
              type: 'spki', // recommended to be 'spki' by the Node.js docs
              format: 'pem',
            },
            privateKeyEncoding: {
              type: 'pkcs8', // recommended to be 'pkcs8' by the Node.js docs
              format: 'pem',
            },
        });
    }

    public static Decrypt (EncTxt: string, privateKey: string): string {
        return privateDecrypt(
            privateKey,
            Buffer.from(EncTxt,'hex')
          ).toString('utf-8');
    }
    
    public static Encrypt (Txt: string, publicKey: string): string {
        return publicEncrypt(
            publicKey,
            Buffer.from(Txt,'utf-8')
        ).toString('hex');
    }

    //#endregion
}*/