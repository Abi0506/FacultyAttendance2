const bcrypt = require('bcryptjs');

async function password(password) {
    const saltRounds = 10;

    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Hashed password:', hash);
    return hash;
}
module.exports = password;