import { Encoding } from "crypto";
import { copyFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "fs";

export class fsXt {

    public static SafeWrite (path: string, content: string, encoding: Encoding = 'utf8', KeepBackup: boolean | (() => boolean) = false): boolean {
        try {
            const exists = existsSync(path);
            const bk = path + 'bk';
            if (exists) {    
                copyFileSync(path, bk);
            }
            writeFileSync(path, content, encoding);
            if (readFileSync(path, encoding) == content) {
                if (exists)
                    if (this.CheckKeepBackup(KeepBackup)) unlinkSync(bk);
            } else {
                if (exists) {
                    copyFileSync(bk, path);
                    if (this.CheckKeepBackup(KeepBackup)) unlinkSync(bk);
                }
                throw new Error('not correctly written');
            }
            return true;
        } catch (e) {
            console.log('Error writing file ' + path + '('+ (e as Error).message +')');
            return false;
        }
    }

    private static CheckKeepBackup (KeepBackup: boolean | (() => boolean)): boolean {
        return (typeof(KeepBackup) === 'boolean' && !KeepBackup) || (typeof(KeepBackup) !== 'boolean' && !KeepBackup());
    }

}