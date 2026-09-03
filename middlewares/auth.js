const jwt = require("jsonwebtoken");

// 1. ตรวจสอบว่ามี Token แนบมาใน Header หรือไม่ และ Token ถูกต้องหรือไม่
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  // ดึง token หลังจากคำว่า "Bearer "
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: { code: "NO_TOKEN", message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" },
    });
  }

  try {
    // ถอดรหัสและตรวจ Signature ด้วย JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // เก็บข้อมูลผู้ใช้ (id, email, role) ไว้ใน req.user
    next();
  } catch (err) {
    return res.status(401).json({
      error: { code: "INVALID_TOKEN", message: "Token ไม่ถูกต้องหรือหมดอายุ" },
    });
  }
}

// 2. ตรวจสอบสิทธิ์ (Role) ว่าตรงกับบทบาทที่ได้รับอนุญาตหรือไม่
function authorizeRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: "NO_TOKEN", message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "คุณไม่มีสิทธิ์เข้าถึงทรัพยากรนี้",
        },
      });
    }
    next();
  };
}

module.exports = { authenticateToken, authorizeRole };
