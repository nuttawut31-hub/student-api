const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SALT_ROUNDS = 10;

// 1. ฟังก์ชันแฮชรหัสผ่านก่อนบันทึกลงฐานข้อมูล
async function hashPassword(plainPassword) {
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

// 2. ฟังก์ชันตรวจสอบรหัสผ่านตอน Login (เทียบ Plain text กับ Hash ใน DB)
async function verifyPassword(plainPassword, hashedPassword) {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

// 3. ฟังก์ชันออก JWT Token โดยนำข้อมูล id, email, role ใส่ลงใน Payload
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN },
  );
}

module.exports = { hashPassword, verifyPassword, generateToken };
