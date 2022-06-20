# CryptPass

CryptPass is a library, written in TypeScript, for encrypting credentials into a data structure, named KeyPass, with a two ways protection (a master password and a numeric sequence).

For more technical and architectural details see [CryptPass website](https://giancarlomangiagli.it/en/CryptPass_password_manager.html).

## Installation

### From npm repository

You can add CryptPass library to your project just typing:

```Bash

npm i cryptpass

```

### Get from github

You can clone this project from github:

```Bash

git clone https://github.com/ossacolsale/CryptPass.git

cd CryptPass

```

## Compilation

The only useful compilation is the one made to get the bundled version of the library, in pure javascript.

### Bundle in pure javascript

```Bash

npm update

npm run build

npm run bundle

```

And you can find the resulting bundled js library on `dist/LibCryptPass.js`.

## Usage

If you use TypeScript with the CryptPass bundled version, you can import the file `TypesForBundle.d.ts` that contains the most useful type definitions.

There are two main data structures that are managed by CryptPass: the `KeyPassObj` (where all credentials are stored) and the `SequenceObj` (where the secret sequence number is stored); they are simply two javascript objects.

We can distinguish two main classes:

* `ConfigCryptPass` (to initialize and configure CryptPass)
* `CryptPass` (to manage credentials)

The class `CryptPass` is efficient only in a native node.js context. If you want to adopt CryptPass bundled, in pure javascript, you should use `CryptPassCached` instead. So, for completeness, if you adopt the bundled version you should use:

* `ConfigCryptPass` (to initialize and configure CryptPass)
* `CryptPassCached` (to get/set a static copy of credentials and master key)
* `EntriesManage` (to manage credentials)

Every class that contains the name `CryptPass` inside, needs three parameters in input: the `KeyPassObj` (even empty), the `SequenceObj` (even empty) and an instance of `StdWriters` class. That details of this last one are specified as follows: 

```Typescript

interface StdWriters {
    SequenceWriter: ObjWriter; //a function that writes in mass memory the SequenceObj (into a file or into a Database or whatever)
    KeyPassWriter: ObjWriter; //a function that writes in mass memory the KeyPassObj (into a file or into a Database  or whatever)
}

//the ObjWriter is that type:

type ObjWriter = (Obj: {}, KeepBackup?: boolean) => boolean | Promise<boolean>
/*
    it takes in input a javascript object and, optionally, a boolean to indicate when to keep a backup copy of the stored object
    it returns in output a boolean meaning that the object has been correctly stored or not
*/

```

### Class ConfigCryptPass

Here are the methods with the respective description:

* `constructor(ObjRW: StdWriters, KeyPassObj?: {}, SequenceObj?: {})`, constructor that requires the parameters described above
* `getLastChange(): Date`, it returns the last "master password" change date
* `restoreSeq(sequence: number[]): Promise<boolean>`, async method to restore the sequence number
* `getSequence(): number[]`, async method to return the sequence number
* `initSeqAndKey(password: string): Promise<boolean>`, async method to initialize both sequence number (it generates a pseudo-random one) and keypass object
* `refreshSequence(password: string): Promise<boolean>`, async method to change the sequence number (it generates a pseudo-random new one)
* `checkPwd(password: string): boolean`, it checks whether the master password is correct or not
* `chPwd(oldPassword: string, newPassword: string): Promise<boolean>`, async method to change the master password

The most important method is `initSeqAndKey` because you must use it to initialize the data structures of CryptPass.

### Class CryptPass

Here are the methods with the respective description:

* `constructor(password: string, ObjRW: StdWriters, KeyPassObj?: {}, SequenceObj?: {})`, constructor that requires the parameters described above
* `getPassDescription(): string`, to get the wallet description
* `setPassDescription(description: string): Promise<boolean>`, to set the wallet description (remember: that's the only information not being encrypted)
* `addEntry(entry: EntryView): Promise<boolean>`, it adds an entry to the wallet
* `getEntry(name: string): false | EntryView`, it gets an entry from the wallet by its name
* `getEntryNames(): string[]`, it gets the list of every entry name from the wallet
* `updateEntry(entry: EntryView): Promise<boolean>`, it updates an entry data (except for the name)
* `updateEntryName(oldName: string, newName: string): Promise<boolean>`, it updates an entry name
* `deleteEntry(name: string): Promise<boolean>`, it deletes an entry

### Class CryptPassCached

Here are the methods with the respective description:

* `constructor(ObjRW: StdWriters, KeyPassObj?: {}, SequenceObj?: {})`, constructor that requires the parameters described above
* `getPassDescription(): string`, the same as `CryptPass` class
* `setPassDescription(description: string): Promise<boolean>`, the same as `CryptPass` class;
* `SetEntries(entries: Entries, passwordOrK: string, isK?: boolean): Promise<boolean>`, it sets the entire `Entries` object and needs the master password or the master key to be passed in input (if you pass the master key, the parameter `isK` must be `true`)
* `GetEntriesManage(passwordOrK: string, isK?: boolean): EntriesManage`, returns an `EntriesManage` object
* `GetK(password: string): string | false`, returns the master key

### Class EntriesManage

Here are the methods with the respective description:

* `constructor(entries: Entries)`, it needs an `Entries` object to be managed as input
* `set Entries(entries: Entries)`, it's a setter to set `Entries` object

*(actually there is no need to use the two preceding methods)*

* `AddEntry(Value: EntryView): boolean`, it adds an entry to the wallet
* `GetEntry(Name: string): EntryView | false`, it gets an entry from the wallet by its name
* `GetEntryNames(): string[]`, it gets the list of every entry name from the wallet
* `UpdateEntry(Value: EntryView): boolean`, it updates an entry data (except for the name)
* `UpdateEntryName(Name: string, NewName: string): boolean`, it updates an entry name
* `DeleteEntry(Name: string): boolean`, it deletes an entry
* `Export(): Entries`, it returns the `Entries` object to be eventually stored with `SetEntries()` method of `CryptPassCached` class

### Interface EntryView

This interface is pretty self-explaining. The only thing to know is that, when you pass it as an input to a method, **you must fill at least the `Name` property**.

```Typescript

interface EntryValue {
    Description?: string;
    Tags?: string;
    Username?: string;
    Password?: string;
    PIN?: string;
    Other?: {
        [Name: string]: string;
    };
}

interface EntryView extends EntryValue {
    Name?: string;
    Date?: Date;
    DateStr?: string;
}

```


### Sample code (node.js)

```Typescript

//suppose to have two custom methods for reading and writing text files

const writeToAFile = (filePath: string, fileContent: string): boolean => {
    ///here your custom code that writes "fileContent" to "filePath"
    ///and returns true on success or false on failure
    return true;
};

const readFileContent = (filePath: string): string => {
    ///here your custom code that reads the content of "filePath"
    ///and returns that content as string
    return 'file content...';
};

//define the object writers

const KeyPassWriter = async (kp: {}): Promise<boolean> => {
    return writeToAFile('pathToMyKeyPassFile.json',JSON.stringify(kp)); //for example write it to a file (but you can write it to a database or to a variable etc.)
};

const SequenceWriter = async (seq: {}): Promise<boolean> => {
    return writeToAFile('pathToMySequenceFile.json',JSON.stringify(seq)); //for example write it to a file (but you can write it to a database or to a variable etc.)
};

//define the Standard writer object

const StandardW = {
    SequenceWriter: SequenceWriter,
    KeyPassWriter: KeyPassWriter
};

//declare a new ConfigCryptPass class

const Config = new ConfigCryptPass(StandardW, {}, {});

//initialize a new sequence and keypass

await Config.initSeqAndKey('myVeryVery...ReallyStrongPassword');

//declare a CryptPass class (in production put it inside try/catch block to handle wrong password error)

const Cryptpass = new CryptPass('myVeryVery...ReallyStrongPassword', StandardW, JSON.parse(readFileContent('pathToMyKeyPassFile.json')), JSON.parse(readFileContent('pathToMySequenceFile.json')));

//add an entry

await CryptPass.addEntry({
    Name: 'Bank account',
    Description: 'My bank account on HSBC',
    Tags: 'me, bank',
    Username: '551238899',
    Password: 'mySuperStrongBankreadyPassword?!?!?',
    PIN: '999999',
    Other: {
        'Recovery answer': 'Mom'
    }
} as EntryView);

//get all entry names

console.log(CryptPass.getEntryNames());
/*output:

['Bank account']

*/

//get an entry
console.log(CryptPass.getEntry('Bank account'));
/*output:

{
    Name: 'Bank account',
    Description: 'My bank account on HSBC',
    Tags: 'me, bank',
    Username: '551238899',
    Password: 'mySuperStrongBank-readyPassword?!?!?',
    PIN: '999999',
    Other: {
        'Recovery answer': 'Mom'
    },
    Date: Mon Jun 20 2022 17:00:31
}
*/

```


### Sample code (bundled pure javascript)

```Typescript

//suppose to have two custom methods for reading and writing text files

const writeToAFile = (filePath: string, fileContent: string): boolean => {
    ///here your custom code that writes "fileContent" to "filePath"
    ///and returns true on success or false on failure
    return true;
};

const readFileContent = (filePath: string): string => {
    ///here your custom code that reads the content of "filePath"
    ///and returns that content as string
    return 'file content...';
};

//define the object writers

const KeyPassWriter = async (kp: {}): Promise<boolean> => {
    return writeToAFile('pathToMyKeyPassFile.json',JSON.stringify(kp)); //for example write it to a file (but you can write it to a database or to a variable etc.)
};

const SequenceWriter = async (seq: {}): Promise<boolean> => {
    return writeToAFile('pathToMySequenceFile.json',JSON.stringify(seq)); //for example write it to a file (but you can write it to a database or to a variable etc.)
};

//define the Standard writer object

const StandardW = {
    SequenceWriter: SequenceWriter,
    KeyPassWriter: KeyPassWriter
};

//declare a new ConfigCryptPass class

const Config = new LibCryptPass.ConfigCryptPass(StandardW, {}, {});

//initialize a new sequence and keypass

await Config.initSeqAndKey('myVeryVery...ReallyStrongPassword');

//declare a CryptPassCached class

const Cryptpass = new LibCryptPass.CryptPassCached(StandardW, JSON.parse(readFileContent('pathToMyKeyPassFile.json')), JSON.parse(readFileContent('pathToMySequenceFile.json')));

//get the master key

const K = Cryptpass.GetK('myVeryVery...ReallyStrongPassword');

//get the EntriesManage instance (in production put it inside try/catch block to handle wrong password error)

const EM = Cryptpass.GetEntriesManage(K, true);

//add an entry

EM.AddEntry({
    Name: 'Bank account',
    Description: 'My bank account on HSBC',
    Tags: 'me, bank',
    Username: '551238899',
    Password: 'mySuperStrongBankreadyPassword?!?!?',
    PIN: '999999',
    Other: {
        'Recovery answer': 'Mom'
    }
} as EntryView);

//save the changes! because you are managing credentials wallet externally, through EntriesManage class

await Cryptpass.SetEntries(EM.Export(), K, true);

//get all entry names

console.log(EM.GetEntryNames());
/*output:

['Bank account']

*/

//get an entry
console.log(EM.GetEntry('Bank account'));
/*output:

{
    Name: 'Bank account',
    Description: 'My bank account on HSBC',
    Tags: 'me, bank',
    Username: '551238899',
    Password: 'mySuperStrongBank-readyPassword?!?!?',
    PIN: '999999',
    Other: {
        'Recovery answer': 'Mom'
    },
    Date: Mon Jun 20 2022 17:00:31
}
*/


```
