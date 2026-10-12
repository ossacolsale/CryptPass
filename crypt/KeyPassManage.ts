import { CommonSymEnc } from './Common';
import { SequenceManage } from './SequenceManage';
import { KeyPass } from './Models/KeyPass';
import { Entries, EntriesManage, EntryView } from './EntriesManage';



export class KeyPassManage {

    private _KeyPass: KeyPass;
    private _SeqManage: SequenceManage;
    private _EntriesManage: EntriesManage;

    constructor (keypass: KeyPass, seqManage: SequenceManage) {
        this._KeyPass = keypass;
        this._SeqManage = seqManage;
        this._EntriesManage = new EntriesManage({});
    }

    /*
    private async Benchmark(funcName: string, func: () => Promise<any> | any): Promise<{ bench: string, res: any }> {
        const a = new Date();
        const val = await func();
        const b = new Date();
        return { bench: funcName + ': '+Math.ceil((b.getTime()- a.getTime())/1000)+' seconds', res: val };
    }

    public async BenchmarkCrypt(): Promise<string> {
        const rk = await this.Benchmark('GenerateRandomKey',() => CommonSymEnc.GenerateRandomKey());
        const sa = await this.Benchmark('GenerateSalt',() => CommonSymEnc.GenerateSalt());
        const sc = await this.Benchmark('Scrypt',() => CommonSymEnc.Scrypt('xxxxxxxxxxxxxxxxxxxxxxx','xxxxxxxxxxxxxxxxxxxx',32));
        const iv = await this.Benchmark('GenerateIV',() => CommonSymEnc.GenerateIV());
        const txt = 'ciaoooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo';
        const en = await this.Benchmark('SymEncr',() => CommonSymEnc.SymEncrypt(rk.res,iv.res,txt));
        const de = await this.Benchmark('SymDecr',() => CommonSymEnc.SymDecrypt(rk.res,iv.res,en.res));
        return `
bench results:

${rk.bench + `(${rk.res})`}
${sa.bench + `(${sa.res})`}
${sc.bench + `(${sc.res.toString('hex')})`}
${iv.bench + `(${iv.res})`}
${en.bench + `(${en.res})`}
${de.bench + `(${de.res})`}
        `;
    }
    */
//#region key manage
    public get LastChange (): Date {
        return this._KeyPass.LastChange;
    }

    public async InitializeKey(password: string, InitializeSeq: boolean = false): Promise<boolean> {
        if (!password) return false;
        if (InitializeSeq && !(await this._SeqManage.Initialize())) return false;
        const prev = { salt: this._KeyPass.Salt, chunks: this._KeyPass.MasterKChunks, version: this._KeyPass.FormatVersion, kdf: this._KeyPass.Kdf, entries: this._KeyPass.GetEntries() };
        try {
            const salt = CommonSymEnc.GenerateSalt();
            const key = CommonSymEnc.GenerateRandomKey();
            const encEntries = CommonSymEnc.EncryptAead(Buffer.from(key, 'hex'), JSON.stringify({}), 'CryptPass:entries:v2');
            const chunks = this.Chunk(this.EncryptMaster(password, salt, key));
            this._KeyPass.Salt = salt; this._KeyPass.FormatVersion = 2;
            this._KeyPass.Kdf = { name: 'scrypt', ...CommonSymEnc.KdfParams };
            this._KeyPass.MasterKChunks = chunks;
            this._KeyPass.LastChange = new Date();
            if (await this._KeyPass.SetEntries(JSON.stringify(encEntries))) return true;
        } catch (_) { /* restore the previous in-memory state */ }
        if (prev.salt) this._KeyPass.Salt = prev.salt;
        if (Array.isArray(prev.chunks) && prev.chunks.length === 26 && prev.chunks.every(c => typeof c === 'string' && c.length)) this._KeyPass.MasterKChunks = prev.chunks;
        this._KeyPass.FormatVersion = prev.version; this._KeyPass.Kdf = prev.kdf;
        await this._KeyPass.SetEntries(prev.entries);
        return false;
    }
    public set SeqManage(sm: SequenceManage) { this._SeqManage = sm; }
    public get KeyPass(): KeyPass { return this._KeyPass; }
    public async RefreshSequence(password: string): Promise<boolean> {
        const oldKey = this.GetK(password); if (oldKey === false) return false;
        let entries: Entries;
        try { entries = this.decryptEntries(oldKey); } catch (_) { return false; }
        const previousSeq = this._SeqManage.Sequence.Sequence.slice();
        const previous = { salt: this._KeyPass.Salt, chunks: this._KeyPass.MasterKChunks, version: this._KeyPass.FormatVersion, kdf: this._KeyPass.Kdf, data: this._KeyPass.GetEntries() };
        try {
            if (!(await this._SeqManage.Initialize())) return false;
            const salt = this._KeyPass.FormatVersion === 2 ? this._KeyPass.Salt : CommonSymEnc.GenerateSalt();
            const key = this._KeyPass.FormatVersion === 2 ? oldKey : CommonSymEnc.GenerateRandomKey();
            this._KeyPass.Salt = salt; this._KeyPass.FormatVersion = 2;
            this._KeyPass.Kdf = { name: 'scrypt', ...CommonSymEnc.KdfParams };
            this._KeyPass.MasterKChunks = this.Chunk(this.EncryptMaster(password, salt, key));
            if (await this._KeyPass.SetEntries(JSON.stringify(CommonSymEnc.EncryptAead(Buffer.from(key, 'hex'), JSON.stringify(entries), 'CryptPass:entries:v2')))) return true;
        } catch (_) { /* restore below */ }
        await this._SeqManage.RestoreSequence(previousSeq);
        this._KeyPass.Salt = previous.salt; this._KeyPass.MasterKChunks = previous.chunks; this._KeyPass.FormatVersion = previous.version; this._KeyPass.Kdf = previous.kdf; await this._KeyPass.SetEntries(previous.data);
        return false;
    }
    public BackupRecover(_password: string): boolean { return true; }
    public CheckPassword(password: string): boolean { return this.GetK(password) !== false; }
    public async ChangePassword(oldPassword: string, newPassword: string): Promise<boolean> {
        if (!newPassword) return false;
        const oldK = this.GetK(oldPassword); if (oldK === false) return false;
        try {
            const entries = this.decryptEntries(oldK);
            const salt = CommonSymEnc.GenerateSalt(), key = CommonSymEnc.GenerateRandomKey();
            const newChunks = this.Chunk(this.EncryptMaster(newPassword, salt, key));
            const newEntries = JSON.stringify(CommonSymEnc.EncryptAead(Buffer.from(key, 'hex'), JSON.stringify(entries), 'CryptPass:entries:v2'));
            const previous = { salt: this._KeyPass.Salt, chunks: this._KeyPass.MasterKChunks, version: this._KeyPass.FormatVersion, kdf: this._KeyPass.Kdf, data: this._KeyPass.GetEntries() };
            this._KeyPass.Salt = salt; this._KeyPass.MasterKChunks = newChunks; this._KeyPass.FormatVersion = 2;
            this._KeyPass.Kdf = { name: 'scrypt', ...CommonSymEnc.KdfParams }; this._KeyPass.LastChange = new Date();
            if (await this._KeyPass.SetEntries(newEntries)) return true;
            this._KeyPass.Salt = previous.salt; this._KeyPass.MasterKChunks = previous.chunks; this._KeyPass.FormatVersion = previous.version; this._KeyPass.Kdf = previous.kdf; await this._KeyPass.SetEntries(previous.data);
            return false;
        } catch (_) { return false; }
    }
    public MasterEncrypt(passwordOrK: string, txt: string, isK: boolean = false): string {
        const key = isK ? passwordOrK : this.GetK(passwordOrK);
        if (key === false) return '';
        if (key.indexOf(':') >= 0) { const parts = key.split(':'); return JSON.stringify(CommonSymEnc.EncryptAead(Buffer.from(parts[0], 'utf8'), txt, 'CryptPass:entries:v2')); }
        return JSON.stringify(CommonSymEnc.EncryptAead(Buffer.from(key, 'hex'), txt, 'CryptPass:entries:v2'));
    }
    public MasterDecrypt(passwordOrK: string, txt: string, isK: boolean = false): string {
        const key = isK ? passwordOrK : this.GetK(passwordOrK);
        if (key === false) throw new Error('Decryption failed');
        if (key.indexOf(':') >= 0) { const parts = key.split(':'); return CommonSymEnc.LegacyDecrypt(parts[0], parts[1], txt); }
        try { return CommonSymEnc.DecryptAead(Buffer.from(key, 'hex'), JSON.parse(txt), 'CryptPass:entries:v2'); } catch (_) { throw new Error('Decryption failed'); }
    }
    public SymEncrypt(password: string, plainText: string): string { return CommonSymEnc.EncryptWithPassword(password, this._KeyPass.Salt, plainText); }
    public SymDecrypt(password: string, encText: string): string {
        if (this._KeyPass.FormatVersion === 2) return CommonSymEnc.DecryptWithPassword(password, this._KeyPass.Salt, encText);
        return CommonSymEnc.LegacyDecryptByPassword(password, this._KeyPass.Salt, encText);
    }
    private EncryptMaster(password: string, salt: string, key: string): string { return CommonSymEnc.EncryptWithPassword(password, salt, key); }
    private Chunk(value: string): string[] {
        const n = this._SeqManage.NChunks, chunks = new Array<string>(n);
        if (value.length < n) throw new Error('Invalid encrypted payload');
        for (let i=0;i<n;i++) chunks[this._SeqManage.Sequence.Sequence[i]] = value.substring(Math.floor(i*value.length/n), Math.floor((i+1)*value.length/n));
        return chunks;
    }
    public GetK(password: string): string | false {
        try {
            const seq = this._SeqManage.Sequence.Sequence;
            if (!Array.isArray(this._KeyPass.MasterKChunks) || this._KeyPass.MasterKChunks.length !== 26 || this._KeyPass.MasterKChunks.some(c => typeof c !== 'string' || !c.length)) return false;
            const joined = new Array<string>(26);
            if (this._KeyPass.FormatVersion === 2) {
                for (let i=0;i<26;i++) { const part = this._KeyPass.MasterKChunks[seq[i]]; if (typeof part !== 'string') return false; joined[i] = part; }
            } else {
                const inverse = new Array<number>(26);
                for (let i=0;i<26;i++) inverse[seq[i]] = i;
                for (let i=0;i<26;i++) { const part = this._KeyPass.MasterKChunks[inverse[i]]; if (typeof part !== 'string') return false; joined[i] = part; }
            }
            const ciphertext = joined.join('');
            if (this._KeyPass.FormatVersion === 2) {
                const kdf = this._KeyPass.Kdf;
                if (!kdf || kdf.name !== 'scrypt' || !CommonSymEnc.ValidateKdfParams(kdf)) return false;
                const key = CommonSymEnc.DecryptWithPassword(password, this._KeyPass.Salt, ciphertext, kdf);
                if (!/^[0-9a-f]{64}$/i.test(key)) return false;
                return key;
            }
            return CommonSymEnc.LegacyDecryptByPassword(password, this._KeyPass.Salt, ciphertext);
        } catch (_) { return false; }
    }
    private decryptEntries(key: string): Entries {
        const ciphertext = this._KeyPass.GetEntries();
        if (key.indexOf(':') >= 0) return JSON.parse(this.MasterDecrypt(key, ciphertext, true)) as Entries;
        return JSON.parse(this.MasterDecrypt(key, ciphertext, true)) as Entries;
    }

    /* manage Entries externally: */
    
    public async SetEntries(entries: Entries, password: string, isK: boolean = false): Promise<boolean> {
        this._EntriesManage.Entries = entries;
        return this.setEntries(password, isK);
    }

    public GetEntriesManage(password: string, isK: boolean = false): EntriesManage {
        this.getEntries(password, isK);
        return this._EntriesManage;
    }



    /* manage Entries internally: */

    public async setPassDescription (description: string): Promise<boolean> {
        return this._KeyPass.SetDescription(description);
    }

    public getPassDescription (): string {
        return this._KeyPass.GetDescription();
    }

    protected getEntries(passwordOrK: string, isK: boolean = false) {        
        this._EntriesManage.Entries = JSON.parse(this.MasterDecrypt(passwordOrK, this._KeyPass.GetEntries(),isK)) as Entries;
    }

    protected async setEntries(passwordOrK: string, isK: boolean = false): Promise<boolean> {
        try {
            if (this._KeyPass.FormatVersion !== 2 && !isK) {
                const salt = CommonSymEnc.GenerateSalt(), key = CommonSymEnc.GenerateRandomKey();
                this._KeyPass.Salt = salt; this._KeyPass.FormatVersion = 2;
                this._KeyPass.Kdf = { name: 'scrypt', ...CommonSymEnc.KdfParams };
                this._KeyPass.MasterKChunks = this.Chunk(this.EncryptMaster(passwordOrK, salt, key));
                return await this._KeyPass.SetEntries(JSON.stringify(CommonSymEnc.EncryptAead(Buffer.from(key, 'hex'), JSON.stringify(this._EntriesManage.Export()), 'CryptPass:entries:v2')));
            }
            return await this._KeyPass.SetEntries(this.MasterEncrypt(passwordOrK, JSON.stringify(this._EntriesManage.Export()), isK));
        } catch (_) { throw new Error('Vault update failed'); }
    }

    public GetEntryNames (password: string): string [] {
        this.getEntries(password);
        return this._EntriesManage.GetEntryNames();
    }

    public GetEntry(password: string, name: string): EntryView | false {
        this.getEntries(password);
        return this._EntriesManage.GetEntry(name);
    }

    public async UpdateEntryName (password: string, Name: string, NewName: string): Promise<boolean> {
        this.getEntries(password);
        if (this._EntriesManage.UpdateEntryName(Name,NewName)) {
            return this.setEntries(password);
        }
        return false;
    }

    public async UpdateEntry (password: string, Value: EntryView): Promise<boolean> {
        this.getEntries(password);
        if (this._EntriesManage.UpdateEntry(Value)) {
            return this.setEntries(password);
        }
        return false;
    }

    public async DeleteEntry (password: string, Name: string): Promise<boolean> {
        this.getEntries(password);
        if (this._EntriesManage.DeleteEntry(Name)) {
            return this.setEntries(password);
        }
        return false;
    }

    public async AddEntry (password: string, Value: EntryView): Promise<boolean> {
        this.getEntries(password);
        if (this._EntriesManage.AddEntry(Value)) {
            return this.setEntries(password);
        }
        return false;
    }

    /*
    private EncrValue (password: string, IV: string, EncKey: string, value: Entries): string {
        return CommonSymEnc.SymEncrypt(this.MasterDecrypt(password,EncKey), this.MasterDecrypt(password,IV),JSON.stringify(value));
    }

    private DecrValue (password: string, IV: string, EncKey: string, Value: string): Entries {
        return JSON.parse(CommonSymEnc.SymDecrypt(this.MasterDecrypt(password,EncKey), this.MasterDecrypt(password,IV),Value)) as Entries;
    }
    */
//#endregion
}
