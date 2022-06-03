import { GenericObj as GenericObj, ObjWriter } from "./AbstrObj";

export interface keypass {
    Key: key,
    Pass: pass
}

export interface key {
    Salt: string,
    MasterKChunks: string[],
    //IV: string,
    LastChange: string
}

export interface pass {
    Description: string,
    /*IV: string,
    EncKey: string,*/
    Entries: string
}

export class KeyPass extends GenericObj<keypass>{

    private _Salt!: string;
    //private _IV!: string;
    private _LastChange!: Date;
    private _MasterKChunks: string[] = new Array<string>();;

    /*private _EntriesIV!: string;
    private _EntriesEncKey!: string;*/

    public get Salt(): string {
        return this._Salt;
    }
    public set Salt(salt: string) {
        salt = salt.trim();
        if (salt != '') this._Salt = salt;
    }

    public get MasterKChunks(): Array<string> {
        return this._MasterKChunks;
    }
    public set MasterKChunks(chunks: Array<string>) {
        let right = false;
        for (let chun of chunks) {
            if (chun.trim() != '') right = true;
        }
        if (right)
            this._MasterKChunks = chunks;
    }

    /*
    public get IV(): string {
        return this._IV;
    }
    public set IV(iv) {
        iv = iv.trim();
        if (iv != '') this._IV = iv;
    }*/

    public get LastChange(): Date {
        return this._LastChange;
    }
    public set LastChange(lastchange) {
        this._LastChange = lastchange;
    }

    /*
    public get EntriesIV(): string {
        return this._EntriesIV;
    }
    public set EntriesIV(iv) {
        iv = iv.trim();
        if (iv != '') this._EntriesIV = iv;
    }

    public get EntriesEncKey(): string {
        return this._EntriesEncKey;
    }
    public set EntriesEncKey(key) {
        key = key.trim();
        if (key != '') this._EntriesEncKey = key;
    }*/

    constructor(writer: ObjWriter, importObj?: {}) {
        super(writer, importObj);
        if (this._Obj.Key === undefined) this._Obj.Key = {} as key;
        if (this._Obj.Pass === undefined) this._Obj.Pass = { Description: '', Entries: '' };
        if (importObj !== undefined) {
            this._Salt = this._Obj.Key.Salt;
            this._MasterKChunks = this._Obj.Key.MasterKChunks;
            //this._IV = this._Obj.Key.IV;
            this._LastChange = new Date(this._Obj.Key.LastChange);
            /*this._EntriesEncKey = this._Obj.Pass.EncKey;
            this._EntriesIV = this._Obj.Pass.IV;*/
        }
    }

    public async SetDescription (description: string): Promise<boolean> {
        this._Obj.Pass.Description = description;
        return this.Export();
    }

    public GetDescription (): string {
        return this._Obj.Pass.Description;
    }

    public async SetEntries (entries: string): Promise<boolean> {
        this._Obj.Pass.Entries = entries;
        return this.Export();
    }

    public GetEntries (): string {
        return this._Obj.Pass.Entries;
    }

    public Save(): keypass {
        this._Obj.Key.Salt = this._Salt;
        this._Obj.Key.MasterKChunks = this._MasterKChunks;
        //this._Obj.Key.IV = this._IV;
        this._Obj.Key.LastChange = this._LastChange.toISOString();
        /*this._Obj.Pass.EncKey = this.EntriesEncKey;
        this._Obj.Pass.IV = this.EntriesIV;*/
        return this._Obj;
    }

    
}