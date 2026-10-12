const assert = require('assert');
const crypto = require('crypto');
const { CommonSymEnc } = require('../dist/Common');
const { Sequence } = require('../dist/Models/Sequence');
const { SequenceManage } = require('../dist/SequenceManage');
const { KeyPass } = require('../dist/Models/KeyPass');
const { KeyPassManage } = require('../dist/KeyPassManage');
const { cryptoXt } = require('../dist/Helpers/crypto-extensions');

(async () => {
  const injected = [Buffer.from('ffffffff', 'hex'), Buffer.from('00000000', 'hex')];
  const previousRandom = cryptoXt.RandomBytesGenerator;
  cryptoXt.RandomBytesGenerator = () => injected.shift();
  assert.strictEqual(cryptoXt.randomInt(26), 0); // uint32 max is rejected, then zero maps in range
  cryptoXt.RandomBytesGenerator = previousRandom;
  const key = CommonSymEnc.RandomKey();
  assert.strictEqual(key.length, 32);
  const one = CommonSymEnc.EncryptAead(key, 'ciao 🌍');
  const two = CommonSymEnc.EncryptAead(key, 'ciao 🌍');
  assert.strictEqual(Buffer.from(one.nonce, 'hex').length, 12);
  assert.notStrictEqual(one.nonce, two.nonce);
  assert.strictEqual(CommonSymEnc.DecryptAead(key, one), 'ciao 🌍');
  assert.strictEqual(CommonSymEnc.DecryptAead(key, CommonSymEnc.EncryptAead(key, 'x'.repeat(100000))), 'x'.repeat(100000));
  assert.throws(() => CommonSymEnc.DecryptAead(CommonSymEnc.RandomKey(), one), /Decryption failed/);
  const aadEnvelope = CommonSymEnc.EncryptAead(key, 'bound', 'scope-a');
  assert.throws(() => CommonSymEnc.DecryptAead(key, aadEnvelope, 'scope-b'), /Decryption failed/);
  for (const edit of [e => e.tag = '00'.repeat(16), e => e.nonce = '00'.repeat(12), e => e.ciphertext = '00']) {
    const corrupt = { ...one }; edit(corrupt);
    assert.throws(() => CommonSymEnc.DecryptAead(key, corrupt), /Decryption failed/);
  }
  assert.strictEqual(CommonSymEnc.EncryptAead(key, '').ciphertext, '');
  const salt = '01'.repeat(16);
  const d1 = CommonSymEnc.DeriveKey('pāssword', salt);
  assert.strictEqual(d1.length, 32);
  assert.notDeepStrictEqual(d1, CommonSymEnc.DeriveKey('pāssword', '02'.repeat(16)));
  assert.throws(() => CommonSymEnc.DeriveKey('pāssword', salt, {N: 16384, r: 8, p: 1}), /Invalid cryptographic input/);
  const legacySalt = '00112233445566778899aabbccddeeff';
  const legacyPassword = 'old-password';
  const legacyMaterial = Buffer.from(require('scrypt-js').syncScrypt(Buffer.from(legacyPassword.normalize('NFKC')), Buffer.from(legacySalt), 16384, 8, 1, 48)).toString('hex').slice(0,48);
  const legacyKey = legacyMaterial.substring(0,32), legacyIv = legacyMaterial.substring(32,16);
  const c = crypto.createCipheriv('aes-256-cbc', legacyKey, legacyIv);
  const legacy = c.update('legacy master key', 'utf8', 'hex') + c.final('hex');
  assert.strictEqual(CommonSymEnc.LegacyDecryptByPassword(legacyPassword, legacySalt, legacy), 'legacy master key');
  assert.throws(() => CommonSymEnc.LegacyDecryptByPassword('wrong', legacySalt, legacy), /Decryption failed/);
  const writer = () => true;
  const seq = new Sequence(writer, {Sequence: Array.from({length:26}, (_,i)=>i)});
  const sm = new SequenceManage(seq);
  for (const invalid of [[...Array(26).keys()].slice(1).concat(1), Array(25).fill(0), Array.from({length:26},(_,i)=>i).map((v,i)=>i===0?-1:v), Array.from({length:26},(_,i)=>i).map((v,i)=>i===0?26:v), Array.from({length:26},(_,i)=>i).map((v,i)=>i===0?1.5:v), ['0',...Array.from({length:25},(_,i)=>i+1)], null]) {
    assert.strictEqual(await sm.RestoreSequence(invalid), false);
  }
  assert.strictEqual(await sm.RestoreSequence(Array.from({length:26},(_,i)=>25-i)), true);

  const state = {};
  const vaultWriter = obj => { Object.assign(state, JSON.parse(JSON.stringify(obj))); return true; };
  const freshSeq = new Sequence(() => true);
  const freshManage = new SequenceManage(freshSeq);
  const kp = new KeyPass(vaultWriter, {});
  const manager = new KeyPassManage(kp, freshManage);
  assert.strictEqual(await manager.InitializeKey('correct horse battery', true), true);
  assert.strictEqual(kp.FormatVersion, 2);
  assert.deepStrictEqual(kp.Kdf, { name: 'scrypt', N: 65536, r: 8, p: 1 });
  assert.strictEqual(manager.CheckPassword('wrong password'), false);
  assert.throws(() => { kp.MasterKChunks = ['malformed']; }, /Invalid key data/);
  assert.strictEqual(manager.CheckPassword('correct horse battery'), true);
  const savedKdf = kp.Kdf; kp.Kdf = { name: 'unknown', N: 1, r: 8, p: 1 };
  assert.strictEqual(manager.CheckPassword('correct horse battery'), false); kp.Kdf = savedKdf;
  // Rejected metadata must not reach scrypt, even for the largest previously accepted values.
  const scryptModule = require('scrypt-js');
  const originalSyncScrypt = scryptModule.syncScrypt;
  let scryptCalls = 0;
  scryptModule.syncScrypt = (...args) => { scryptCalls++; return originalSyncScrypt(...args); };
  const rejectedProfiles = [
    {N: 1048576, r: 32, p: 16}, // former maximum hostile profile (~4 GiB principal array)
    {N: 16384, r: 8, p: 1}, {N: 131072, r: 8, p: 1},
    {N: 65536, r: 1, p: 1}, {N: 65536, r: 9, p: 1},
    {N: 65536, r: 8, p: 0}, {N: 65536, r: 8, p: 2},
    {N: '65536', r: 8, p: 1}, {N: true, r: 8, p: 1},
    {N: 65536.5, r: 8, p: 1}, {N: 65536, r: '8', p: 1},
    {N: 65536, r: 8, p: false}, {N: 0, r: 8, p: 1},
    {N: -65536, r: 8, p: 1}, null
  ];
  for (const profile of rejectedProfiles) {
    kp.Kdf = { name: 'scrypt', ...profile };
    assert.strictEqual(manager.CheckPassword('correct horse battery'), false);
    assert.throws(() => CommonSymEnc.DeriveKey('correct horse battery', kp.Salt, profile), /Invalid cryptographic input/);
  }
  assert.strictEqual(scryptCalls, 0, 'invalid KDF profiles must be rejected before syncScrypt');
  assert.strictEqual(CommonSymEnc.DeriveKey('correct horse battery', kp.Salt, {N: 65536, r: 8, p: 1}).length, 32);
  assert.strictEqual(scryptCalls, 1, 'the syncScrypt spy must observe a valid profile');
  scryptModule.syncScrypt = originalSyncScrypt;
  kp.Kdf = savedKdf;
  const orderedMaster = () => freshManage.Sequence.Sequence.map(i => kp.MasterKChunks[i]).join('');
  JSON.parse(orderedMaster());
  assert.strictEqual(await manager.AddEntry('correct horse battery', { Name: 'mail', Username: 'user', Password: 'secret' }), true);
  assert.strictEqual(manager.GetEntry('correct horse battery', 'mail').Password, 'secret');
  const reopen = password => new KeyPassManage(
    new KeyPass(() => true, JSON.parse(JSON.stringify(state))),
    new SequenceManage(new Sequence(() => true, {Sequence: freshManage.Sequence.Sequence.slice()}))
  );
  assert.strictEqual(reopen('correct horse battery').GetEntry('correct horse battery', 'mail').Password, 'secret');
  const firstEntriesEnv = JSON.parse(kp.GetEntries());
  assert.strictEqual(await manager.UpdateEntry('correct horse battery', { Name: 'mail', Username: 'user', Password: 'new-secret' }), true);
  const secondEntriesEnv = JSON.parse(kp.GetEntries());
  assert.notStrictEqual(firstEntriesEnv.nonce, secondEntriesEnv.nonce);
  assert.strictEqual(reopen('correct horse battery').GetEntry('correct horse battery', 'mail').Password, 'new-secret');
  assert.strictEqual(await manager.UpdateEntryName('correct horse battery', 'mail', 'renamed'), true);
  assert.strictEqual(reopen('correct horse battery').GetEntry('correct horse battery', 'renamed').Password, 'new-secret');
  const renamedEntriesEnv = JSON.parse(kp.GetEntries());
  await kp.SetEntries(JSON.stringify({ ...renamedEntriesEnv, tag: '00'.repeat(16) }));
  assert.throws(() => manager.GetEntry('correct horse battery', 'renamed'), /Decryption failed/);
  await kp.SetEntries(JSON.stringify(renamedEntriesEnv));
  assert.throws(() => CommonSymEnc.DecryptWithPassword('correct horse battery', kp.Salt, JSON.stringify({ ...JSON.parse(orderedMaster()), ciphertext: 'abc' })), /Decryption failed/);
  assert.strictEqual(await manager.ChangePassword('correct horse battery', 'new password'), true);
  assert.strictEqual(manager.CheckPassword('new password'), true);
  assert.strictEqual(manager.GetEntry('new password', 'renamed').Password, 'new-secret');
  assert.strictEqual(reopen('new password').GetEntry('new password', 'renamed').Password, 'new-secret');
  assert.strictEqual(await manager.RefreshSequence('new password'), true);
  assert.strictEqual(manager.GetEntry('new password', 'renamed').Password, 'new-secret');
  assert.strictEqual(reopen('new password').GetEntry('new password', 'renamed').Password, 'new-secret');
  assert.strictEqual(await manager.DeleteEntry('new password', 'renamed'), true);
  assert.strictEqual(reopen('new password').GetEntry('new password', 'renamed'), false);

  // A single entry mutation must finish with exactly one completed persistence write.
  let recordWrites = false;
  const writes = [];
  let activeWrites = 0, maxActiveWrites = 0, persistedAsyncVault, activeCaller = 'setup';
  const asyncWriter = obj => {
    if (!recordWrites) return true;
    const payload = JSON.parse(JSON.stringify(obj));
    const call = { number: writes.length + 1, timestamp: Date.now(), caller: activeCaller, payload, payloadHash: crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'), completed: false };
    writes.push(call);
    activeWrites++;
    maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
    return new Promise(resolve => setTimeout(() => {
      call.completed = true;
      call.completedAt = Date.now();
      persistedAsyncVault = call.payload;
      activeWrites--;
      resolve(true);
    }, writes.length === 1 ? 50 : 5));
  };
  const asyncSeq = new Sequence(() => true);
  const asyncManagerSequence = new SequenceManage(asyncSeq);
  const asyncKeyPass = new KeyPass(asyncWriter, {});
  const asyncManager = new KeyPassManage(asyncKeyPass, asyncManagerSequence);
  assert.strictEqual(await asyncManager.InitializeKey('async writer password', true), true);
  recordWrites = true;
  activeCaller = 'AddEntry';
  assert.strictEqual(await asyncManager.AddEntry('async writer password', { Name: 'async', Password: 'first' }), true);
  activeCaller = 'UpdateEntry';
  assert.strictEqual(await asyncManager.UpdateEntry('async writer password', { Name: 'async', Password: 'updated' }), true);
  await new Promise(resolve => setTimeout(resolve, 55));
  assert.strictEqual(writes.length, 2, 'AddEntry and UpdateEntry should each invoke persistence exactly once');
  assert.strictEqual(maxActiveWrites, 1, 'entry mutations should not overlap persistence writes');
  assert(writes.every(write => write.completed && write.completedAt >= write.timestamp && /^[0-9a-f]{64}$/.test(write.payloadHash)));
  assert.deepStrictEqual(writes.map(write => write.caller), ['AddEntry', 'UpdateEntry']);
  const reopenedAsync = new KeyPassManage(
    new KeyPass(() => true, persistedAsyncVault),
    new SequenceManage(new Sequence(() => true, {Sequence: asyncManagerSequence.Sequence.Sequence.slice()}))
  );
  assert.strictEqual(reopenedAsync.GetEntry('async writer password', 'async').Password, 'updated');

  // A historical vault fixture: password-wrapped CBC master string and CBC entry payload.
  const legacySeq = Array.from({length:26}, (_,i)=>i);
  for (let i=legacySeq.length-1;i>0;i--) { const j=(i*7+3)%(i+1); [legacySeq[i],legacySeq[j]]=[legacySeq[j],legacySeq[i]]; }
  const oldWrap = crypto.createCipheriv('aes-256-cbc', legacyKey, legacyIv);
  const wrappedMaster = oldWrap.update(`${legacyKey}:${legacyIv}`, 'utf8', 'hex') + oldWrap.final('hex');
  const oldEntriesCipher = crypto.createCipheriv('aes-256-cbc', legacyKey, legacyIv);
  const legacyEntries = oldEntriesCipher.update(JSON.stringify({old: {Name:'old', Password:'legacy'}}), 'utf8', 'hex') + oldEntriesCipher.final('hex');
  const oldChunk = (value) => { const len=Math.ceil(value.length/26), parts=new Array(26); for(let i=0;i<26;i++) parts[i]=value.substring(legacySeq[i]*len,legacySeq[i]*len+len); return parts; };
  const legacyObject = { Key:{Salt:legacySalt,MasterKChunks:oldChunk(wrappedMaster),LastChange:new Date().toISOString()}, Pass:{Description:'',Entries:legacyEntries} };
  const legacyKeyPass = new KeyPass(() => true, legacyObject);
  const legacyManager = new KeyPassManage(legacyKeyPass, new SequenceManage(new Sequence(() => true, {Sequence:legacySeq})));
  assert.strictEqual(legacyManager.CheckPassword(legacyPassword), true);
  assert.strictEqual(legacyManager.GetEntry(legacyPassword, 'old').Password, 'legacy');
  assert.strictEqual(await legacyManager.AddEntry(legacyPassword, {Name:'new', Password:'migrated'}), true);
  assert.strictEqual(legacyKeyPass.FormatVersion, 2);
  assert.strictEqual(legacyManager.GetEntry(legacyPassword, 'old').Password, 'legacy');
  assert.strictEqual(legacyManager.GetEntry(legacyPassword, 'new').Password, 'migrated');
  const reopenedLegacy = new KeyPassManage(new KeyPass(() => true, legacyObject), new SequenceManage(new Sequence(() => true, {Sequence:legacySeq})));
  assert.strictEqual(reopenedLegacy.GetEntry(legacyPassword, 'old').Password, 'legacy');
  assert.strictEqual(reopenedLegacy.GetEntry(legacyPassword, 'new').Password, 'migrated');
  console.log('security tests passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
