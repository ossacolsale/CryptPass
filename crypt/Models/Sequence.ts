import { GenericObj, ObjReader, ObjWriter } from './AbstrObj';

export interface sequence {
    Sequence: Array<number>
}

export class Sequence extends GenericObj<sequence> {

    private _Sequence!: Array<number>;
    
    public get Sequence(): Array<number> {
        return this._Sequence;
    }
    public set Sequence(sequence: Array<number>) {
        if (!Sequence.IsValid(sequence)) throw new Error('Invalid sequence');
        this._Sequence = sequence.slice();
    }
    public static IsValid(sequence: unknown): sequence is number[] {
        if (!Array.isArray(sequence) || sequence.length !== 26) return false;
        const seen = new Set<number>();
        for (const n of sequence) {
            if (!Number.isInteger(n) || n < 0 || n >= 26 || seen.has(n)) return false;
            seen.add(n);
        }
        return seen.size === 26;
    }


    constructor(writer: ObjWriter, importObj?: {}) {
        super(writer, importObj);
        if (importObj !== undefined)
            this.Sequence = this._Obj.Sequence;
    }

    public Save(): sequence {
        this._Obj.Sequence = this._Sequence;
        return this._Obj;
    }

}