//import { Encoding } from "crypto";
//import { existsSync, readFileSync } from "fs";


export type ObjWriter = (Obj: {}, KeepBackup?: boolean) => boolean | Promise<boolean>;
export type ObjReader = () => {} | Promise<{}>;

export abstract class GenericObj<ObjectInterface> {

    protected _Obj: ObjectInterface;
    protected _writer: ObjWriter;

    public get ObjToJSON (): string {
        return JSON.stringify(this.Obj);
    }

    public get Obj(): ObjectInterface {
        return this._Obj;
    }

    protected abstract Save(): ObjectInterface;

    public async Export(KeepBackup?: boolean): Promise<boolean> {
        return this._writer(this.Save(), KeepBackup);
    }

    constructor (writer: ObjWriter, importObj?: {}) {
        if (importObj === undefined)
            this._Obj = {} as ObjectInterface;
        else this._Obj = importObj as ObjectInterface;
        this._writer = writer;
    }
/*        if (JSONobj.trim() != '') {
            try {
                this._Obj = JSON.parse(JSONobj);
            } catch (e) {
                    console.log(`Error (${(e as Error).message}) parsing :

${JSONobj}

                    `);
            }
        }
    }

    protected IsEmpty () {
        return this._Obj === undefined;
    }
*/
}