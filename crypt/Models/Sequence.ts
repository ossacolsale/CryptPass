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
        let right = true;
        for (let num of sequence) {
            if (typeof(num) !== 'number') { right = false; break }
        }
        if (right)
            this._Sequence = sequence;
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