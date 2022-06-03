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

    public async InitializeKey (password: string, InitializeSeq: boolean = false): Promise<boolean> {
        if (InitializeSeq) await this._SeqManage.Initialize();
        const MasterKey = CommonSymEnc.GenerateRandomKey()+':'+CommonSymEnc.GenerateIV();
        this._KeyPass.LastChange = new Date();
        this._KeyPass.Salt = CommonSymEnc.GenerateSalt();
        this._KeyPass.MasterKChunks = this.GetChunkedEncK(password, MasterKey);
        this.setEntries(MasterKey, true);
        return this._KeyPass.Export();
    }

    public set SeqManage (sm: SequenceManage) {
        this._SeqManage = sm;
    }

    public get KeyPass(): KeyPass {
        return this._KeyPass;
    }

    public async RefreshSequence (password: string): Promise<boolean> {
        const K = this.GetK(password);
        if (K !== false) {
            await this._SeqManage.Initialize();
            this._KeyPass.MasterKChunks = this.GetChunkedEncK(password, K);
            return this._KeyPass.Export();
        } else return false;
    }

    public BackupRecover (password: string): boolean {
        ///TODO!
        //tento di recuperare la PrK abbinando vecchio file con vecchia sequenza o nuovo file con vecchia sequenza o vecchio file con nuova sequenza
        return true;
    }
    
    public CheckPassword (password: string): boolean {
        return this.GetK(password) !== false;
    }

    public async ChangePassword (oldPassword: string, newPassword: string): Promise<boolean> {
        const K = this.GetK(oldPassword);
        if (K !== false) {
            this.getEntries(K, true);
            //generate new MasterKey & Salt
            const MasterKey = CommonSymEnc.GenerateRandomKey()+':'+CommonSymEnc.GenerateIV();
            this._KeyPass.Salt = CommonSymEnc.GenerateSalt();
            this._KeyPass.MasterKChunks = this.GetChunkedEncK(newPassword, MasterKey);
            this._KeyPass.LastChange = new Date();
            this.setEntries(MasterKey, true);
            return this._KeyPass.Export();
        }
        else return false;
    }

    //given the assumption password already checked
    public MasterEncrypt (passwordOrK: string, txt: string, isK: boolean = false): string {
        const K = isK ? passwordOrK : this.GetK(passwordOrK);
        if (K !== false) {
            const SepMK = K.split(':');
            return CommonSymEnc.SymEncrypt(SepMK[0],SepMK[1],txt);
        } else return '';
    }

    //given the assumption password already checked
    public MasterDecrypt (passwordOrK: string, txt: string, isK: boolean = false): string {
        const K = isK ? passwordOrK : this.GetK(passwordOrK);
        if (K !== false) {
            const SepMK = K.split(':');
            return CommonSymEnc.SymDecrypt(SepMK[0],SepMK[1],txt);
        } else return '';
    }

    public SymEncrypt (password: string, PlainTxt: string) {
        return CommonSymEnc.SymEncryptByPwd(password, this._KeyPass.Salt, PlainTxt);
    }

    public SymDecrypt (password: string, EncTxt: string) {
        return CommonSymEnc.SymDecryptByPwd(password, this._KeyPass.Salt, EncTxt);
    }

    private GetChunkedEncK (password: string, Key: string): string[] {
        try {
            const enc = this.SymEncrypt(password, Key);
            
            const chunkLen = Math.ceil(enc.length / this._SeqManage.NChunks);
            const chunkedSeq = new Array<string>(this._SeqManage.NChunks);
            for (let i=0; i<this._SeqManage.NChunks;++i) {
                chunkedSeq[i] = enc.substring(
                    this._SeqManage.Sequence.Sequence[i] * chunkLen,
                    this._SeqManage.Sequence.Sequence[i] * chunkLen + chunkLen
                )
            }
            return chunkedSeq;
        } catch (e) {
            console.log('GetChunkedEncK() error: ' + (e as Error).message);
            return [];
        }
    }

    public GetK (password: string): string | false {
        try {
            let encM: string = '';
            const buildSeq = new Array<number>(this._SeqManage.NChunks);
            for (let i=0; i<this._SeqManage.NChunks; ++i) {
                buildSeq[this._SeqManage.Sequence.Sequence[i]] = i;
            }
            for (let i=0; i<this._SeqManage.NChunks; ++i) {
                encM += this._KeyPass.MasterKChunks[ buildSeq[i] ];
            }
            const MK = this.SymDecrypt(password, encM);
            //if (refreshIV) this.RefreshIV(password, MK);          
            return MK;
        } catch (e) {
            console.log('GetK() error: ' + (e as Error).message);
            return false;
        }
    }
    /*
    private async RefreshIV (password: string, masterKey: string): Promise<boolean> {
        this._KeyPass.IV = CommonSymEnc.GenerateIV();
        this._KeyPass.MasterKChunks = this.GetChunkedEncK(password, masterKey);
        return this._KeyPass.Export();
    }
    */
//#endregion


//#region pass manage:



    /* manage Entries externally: */
    
    public async SetEntries(entries: Entries, password: string, isK: boolean = false): Promise<boolean> {
        this._EntriesManage.Entries = entries;
        await this.setEntries(password, isK);
        return this._KeyPass.Export();
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

    protected async setEntries(passwordOrK: string, isK: boolean = false) {
        this._KeyPass.SetEntries(this.MasterEncrypt(passwordOrK, JSON.stringify(this._EntriesManage.Export()),isK));
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
            this.setEntries(password);
            return this._KeyPass.Export();
        }
        return false;
    }

    public async UpdateEntry (password: string, Value: EntryView): Promise<boolean> {
        this.getEntries(password);
        if (this._EntriesManage.UpdateEntry(Value)) {
            this.setEntries(password);
            return this._KeyPass.Export();
        }
        return false;
    }

    public async DeleteEntry (password: string, Name: string): Promise<boolean> {
        this.getEntries(password);
        if (this._EntriesManage.DeleteEntry(Name)) {
            this.setEntries(password);
            return this._KeyPass.Export();
        }
        return false;
    }

    public async AddEntry (password: string, Value: EntryView): Promise<boolean> {
        this.getEntries(password);
        if (this._EntriesManage.AddEntry(Value)) {
            this.setEntries(password);
            return this._KeyPass.Export();
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
