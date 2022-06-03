import { Entries, EntriesManage, EntryView } from './EntriesManage';
import { KeyPassManage } from './KeyPassManage';
import { ObjWriter } from './Models/AbstrObj';
import { KeyPass } from './Models/KeyPass';
import { Sequence } from './Models/Sequence';
import { SequenceManage } from './SequenceManage';

export class ConfigCryptPass {
    
    private _SM: SequenceManage;
    private _KPM: KeyPassManage;

    /*public SetScryptFunction (ScryptFunction: (Password: string, Salt: string, KeyLen: number) => Buffer) {
        CommonSymEnc.Scrypt = ScryptFunction;
    }*/

    public getLastChange(): Date {
        return this._KPM.LastChange;
    }

    public async restoreSeq (sequence: number[]): Promise<boolean> {
        return this._SM.RestoreSequence(sequence);
    }

    public getSequence (): number[] {
        return this._SM.Sequence.Sequence;
    }

    public async initSeqAndKey (password: string): Promise<boolean> {
        return this._KPM.InitializeKey(password, true);
    }

    public async refreshSequence (password: string): Promise<boolean> {
        return this._KPM.RefreshSequence(password);
    }

    public checkPwd (password: string): boolean {
        return this._KPM.CheckPassword(password);
    }

    public async chPwd (oldPassword: string, newPassword: string): Promise<boolean> {
        return this._KPM.ChangePassword(oldPassword,newPassword);
    }
/*
    public initPassfile (description: string): boolean {
        return this._KPM.InitializePass(description);
    }
*/
    constructor(ObjRW: StdWriters, KeyPassObj?: {}, SequenceObj?: {}) {
        this._SM = new SequenceManage(
            new Sequence(ObjRW.SequenceWriter, SequenceObj));
        this._KPM = new KeyPassManage(
            new KeyPass(ObjRW.KeyPassWriter, KeyPassObj), this._SM
        );
        
    }
}

export interface StdWriters {
    SequenceWriter: ObjWriter,
    //SequenceReader: ObjReader,
    KeyPassWriter: ObjWriter,
    //KeyPassReader: ObjReader,
}

export class CryptPassCached {
    private _KPM: KeyPassManage;

    constructor(ObjRW: StdWriters, KeyPassObj?: {}, SequenceObj?: {}) {
        this._KPM = new KeyPassManage(
            new KeyPass(ObjRW.KeyPassWriter, KeyPassObj),
            new SequenceManage(
                new Sequence(ObjRW.SequenceWriter, SequenceObj)
            )
        );
    }

    public getPassDescription (): string {
        return this._KPM.getPassDescription();
    }
    
    public async setPassDescription (description: string): Promise<boolean> {
        return this._KPM.setPassDescription(description);
    }

    public async SetEntries(entries: Entries, passwordOrK: string, isK: boolean = false): Promise<boolean> {
        return this._KPM.SetEntries(entries, passwordOrK, isK);
    }

    public GetEntriesManage(passwordOrK: string, isK: boolean = false): EntriesManage {
        return this._KPM.GetEntriesManage(passwordOrK, isK);
    }

    public GetK(password: string): string | false {
        return this._KPM.GetK(password);
    }
/*
    public async BenchMark() {
        return this._KPM.BenchmarkCrypt();
    }
*/
}

export class CryptPass {
    private _Password: string;
    private _KPM: KeyPassManage;

    constructor(password: string, ObjRW: StdWriters, KeyPassObj?: {}, SequenceObj?: {}) {
        this._Password = password;
        this._KPM = new KeyPassManage(
            new KeyPass(ObjRW.KeyPassWriter, KeyPassObj),
            new SequenceManage(
                new Sequence(ObjRW.SequenceWriter, SequenceObj)
            )
        );
    }

    public getPassDescription (): string {
        return this._KPM.getPassDescription();
    }
    
    public async setPassDescription (description: string): Promise<boolean> {
        return this._KPM.setPassDescription(description);
    }

    public async addEntry (entry: EntryView): Promise<boolean> {
        return this._KPM.AddEntry(this._Password, entry);
    }

    public getEntry (name: string): false | EntryView {
        return this._KPM.GetEntry(this._Password, name);
    }

    public getEntryNames (): string[] {
        return this._KPM.GetEntryNames(this._Password);
    }

    public async updateEntry (entry: EntryView): Promise<boolean> {
        return this._KPM.UpdateEntry(this._Password, entry);
    }

    public async updateEntryName (oldName: string, newName: string): Promise<boolean> {
        return this._KPM.UpdateEntryName(this._Password, oldName, newName);
    }

    public async deleteEntry (name: string): Promise<boolean> {
        return this._KPM.DeleteEntry(this._Password,name);
    }
}