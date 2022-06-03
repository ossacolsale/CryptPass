export type Entries = {[Name: string]: EntryView};

export interface EntryValue {
    Description?: string,
    Tags?: string,
    Username?: string,
    Password?: string,
    PIN?: string,
    Other?: {[Name: string]: string}
}

export interface EntryView extends EntryValue {
    Name?: string,
    Date?: Date,
    DateStr?: string
}

export class EntriesManage {

    private _entries: Entries;

    constructor(entries: Entries) {
        this._entries = entries;
    }

    public set Entries(entries: Entries) {
        this._entries = entries;
    }

    public GetEntryNames (): string [] {
        let Names = new Array<string>();
        for (let N in this._entries) Names.push(N);
        return Names;
    }

    public GetEntry(Name: string): EntryView | false {
        const entry = this._entries[Name];
        if (entry !== undefined && entry !== null) {
            entry.Name = Name;
            entry.Date = new Date(entry.DateStr as string);
            return entry;
        }
        return false;
    }

    public UpdateEntryName (Name: string, NewName: string): boolean {
        const entry = this.GetEntry(Name);
        if (entry !== false && this.GetEntry(NewName) === false) {
            this._entries[NewName] = entry;
            delete this._entries[Name];
            return true;
        }
        return false;
    }

    public UpdateEntry (Value: EntryView): boolean {
        if (Value.Name !== undefined) {
            const name = Value.Name;
            delete Value.Name;
            const entry = this.GetEntry(name);
            if (entry !== false) {
                Value.DateStr = new Date().toISOString();
                this._entries[name] = Value;
                return true;
            }
            return false;
        } return false;
    }

    public DeleteEntry (Name: string): boolean {
        const entry = this.GetEntry(Name);
        if (entry !== false) {
            delete this._entries[Name];
            return true;
        } return false;
    }

    public AddEntry (Value: EntryView): boolean {
        if (Value.Name !== undefined) {
            const name = Value.Name;
            delete Value.Name;
            const entry = this.GetEntry(name);
            if (entry === false) {
                Value.DateStr = new Date().toISOString();
                this._entries[name] = Value;
                return true;
            } return false;
        } return false;
    }

    public Export(): Entries {
        return this._entries;
    }
}