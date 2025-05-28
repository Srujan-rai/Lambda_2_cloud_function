const Crypto = require('crypto');

/**
 * Encrypts provided text
 * @param {String} text the string ready for encryption
 * @param {String} key the key for the encoding
 * @returns {String} Encrypted text
 */
const encryptText = (text, key) => {
    console.log('Started encryption of text:', text);
    const algorithm = 'aes-256-ctr';
    const cipher = Crypto.createCipher(algorithm, key);
    let crypted = cipher.update(text, 'utf8', 'base64');
    crypted += cipher.final('base64');
    console.log('Text encrypted successfully.');
    return crypted.toString();
};

/**
 * Decrypts provided text
 * @param {String} text the string ready for decryption
 * @param {String} key the key for the decoding
 * @returns {String} Decrypted text
 */
const decryptText = (text, key) => {
    console.log('Started decryption of text:', text);
    const algorithm = 'aes-256-ctr';
    const decipher = Crypto.createDecipher(algorithm, key);
    let dec = decipher.update(text, 'base64', 'utf8');
    dec += decipher.final('utf8');
    console.log('Text decrypted successfully.');
    return dec.toString();
};

module.exports = {
    encryptText,
    decryptText,
};
