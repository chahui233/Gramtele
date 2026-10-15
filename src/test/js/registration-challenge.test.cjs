const {test} = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('../../main/webapp/js/registration-challenge.js');
const native = text => crypto.createHash('sha256').update(text,'utf8').digest('hex');

test('browser SHA-256 agrees with standard vectors and Node across padding boundaries and Unicode',()=>{
  assert.equal(RegistrationChallenge.sha256(''),'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(RegistrationChallenge.sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  for(const text of ['中文😀e\u0301','\ud800','\udc00','\ud800\udc00','\ud800x\udc00',
    ...[1,54,55,56,57,63,64,65,127,128,1024].map(n=>'x'.repeat(n))]){
    assert.equal(RegistrationChallenge.sha256(text),native(text),JSON.stringify(text).slice(0,80));
  }
});

test('48-bit target is exact, time bounded, and binds the original password and salt',()=>{
  const password='V-VII-may-2024-6-29aaaaaaaaa😀';
  const salt='0123456789abcdef0123456789abcdef';
  const hash=native(salt+'\n'+password);
  const challenge={salt,prefix:hash.slice(0,12),expiresAt:10000};
  assert.equal(RegistrationChallenge.evaluate(password,challenge,9999).passes,true);
  assert.equal(RegistrationChallenge.evaluate(password,challenge,10000).passes,false);
  assert.equal(RegistrationChallenge.evaluate(password+' ',challenge,9999).passes,false);
  assert.equal(RegistrationChallenge.evaluate(password,{...challenge,salt:'f'.repeat(32)},9999).passes,false);
  assert.equal(RegistrationChallenge.evaluate(password,{...challenge,prefix:''},9999).passes,false);
  assert.equal(RegistrationChallenge.evaluate(password,{...challenge,prefix:hash.slice(0,11)},9999).passes,false);
  assert.equal(RegistrationChallenge.evaluate(password,null,9999).passes,false);
});
