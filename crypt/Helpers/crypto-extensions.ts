const randomBytes: (size: number) => Buffer = require("randombytes");


export class cryptoXt {

    public static RandomBytesGenerator: (n: number) => Buffer = (n: number) => randomBytes(n);
    public static secureMathRandom (): number {
        return this.RandomBytesGenerator(4).readUInt32LE() / 0x100000000;
    }
    private static randomInt(max: number): number {
        const range = 0x100000000;
        const limit = Math.floor(range / max) * max;
        let value: number;
        do { value = this.RandomBytesGenerator(4).readUInt32LE(); } while (value >= limit);
        return value % max;
    }

    public static arrayShuffle<T> (array: Array<T>, minDistance: number = 4): Array<T> {
        if (!Array.isArray(array)) {
            throw new TypeError(`Expected an array, got ${typeof array}`);
        }
        minDistance = array.length <= 3 ? 0 : Math.min(array.length, minDistance);
        let orig_array = [...array];
        let reverse_array = [...array].reverse();
        
        while (true) {
            for (let index = array.length - 1; index > 0; index--) {
                const newIndex = this.randomInt(index + 1);
                [array[index], array[newIndex]] = [array[newIndex], array[index]];
            }
            if (this.arrayDistance(array, orig_array) >= minDistance && this.arrayDistance(array, reverse_array) >= minDistance)
                return array;
        }
    }

    //suppose array same length
    protected static arrayDistance(arr1: any[], arr2: any[]): number {
        if (arr1.length != arr2.length) return 0;
        else {
            let distance = 0;
            for (let i = 0; i<arr1.length; ++i) {
                if (arr1[i] != arr2[i]) ++distance;
            }
            return distance;
        }
    }
}


