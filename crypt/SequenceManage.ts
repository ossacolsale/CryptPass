import { cryptoXt } from './Helpers/crypto-extensions';
import { Sequence } from './Models/Sequence';

export class SequenceManage {

    private _Sequence: Sequence;
    private readonly _NChunks = 26;

    constructor (sequence: Sequence) {
        this._Sequence = sequence;
    }

    public get NChunks(): number {
        return this._NChunks;
    }

    public get Sequence(): Sequence {
        return this._Sequence;
    }

    public async Initialize (): Promise<boolean> {
        const sequence = new Array<number>(this._NChunks);
        for (let i=0; i<this._NChunks; ++i) {
            sequence[i] = i;
        }
        this._Sequence.Sequence = cryptoXt.arrayShuffle<number>(sequence);
        return this._Sequence.Export();
    }

    public async RestoreSequence (sequence: Array<number>): Promise<boolean> {
        if (!Sequence.IsValid(sequence)) return false;
        const previous = this._Sequence.Sequence.slice();
        try { this._Sequence.Sequence = sequence; const saved = await this._Sequence.Export(); if (!saved) this._Sequence.Sequence = previous; return saved; }
        catch (_) { this._Sequence.Sequence = previous; return false; }
    }
}
