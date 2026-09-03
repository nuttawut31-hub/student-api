require("dotenv").config();
const pool = require("./db");
const { redisClient, connectRedis } = require("./cache");

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const {
  hashPassword,
  verifyPassword,
  generateToken,
} = require("./auth-helpers");
const { authenticateToken, authorizeRole } = require("./middlewares/auth");
const { parsePagination, parseSort } = require("./middlewares/query-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// ลำดับ middleware มีความสำคัญ: security header → CORS → logger → body parser
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));

// แบบฝึกหัดที่ 1: เขียน Middleware ตรวจสอบ Content-Type
function requireJson(req, res, next) {
  const methodsWithBody = ["POST", "PUT", "PATCH"];
  const contentType = req.headers["content-type"];
  if (
    methodsWithBody.includes(req.method) &&
    (!contentType || !contentType.includes("application/json"))
  ) {
    return res.status(415).json({
      error: {
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "กรุณาส่งข้อมูลในรูปแบบ application/json",
      },
    });
  }
  next();
}
app.use(requireJson);

// แบบฝึกหัดที่ 2: จำกัดจำนวนคำขอด้วย Rate Limiting เบื้องต้น (POST /api/v1/students ได้ไม่เกิน 5 ครั้ง/นาที)
const createStudentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "คุณส่งคำขอมากเกินไป กรุณาลองใหม่อีกครั้งในภายหลัง",
      },
    });
  },
});

app.get("/", (req, res) => {
  res.status(200).json({ message: "Student API พร้อมใช้งาน" });
});

let courses = [
  { id: 101, courseName: "การเขียนโปรแกรมเบื้องต้น", credit: 3 },
  { id: 102, courseName: "โครงสร้างข้อมูล", credit: 3 },
];

const v1Router = express.Router();

// === REST Endpoints สำหรับนักศึกษา ===

// 1. GET /api/v1/students (ดึงรายการนักศึกษา รองรับ Pagination, Filtering, Sorting)
v1Router.get(
  "/students",
  parsePagination,
  parseSort,
  async (req, res, next) => {
    const { major } = req.query;
    const { page, limit, offset } = req.pagination;
    const { field, order } = req.sort;

    let baseQuery = "SELECT * FROM students";
    let countQuery = "SELECT COUNT(*) AS total FROM students";
    const params = [];

    if (major) {
      baseQuery += " WHERE major = ?";
      countQuery += " WHERE major = ?";
      params.push(major);
    }

    // แทรก field/order ลง SQL ได้โดยตรงเฉพาะเพราะผ่าน allowlist ใน parseSort มาแล้ว
    // ห้ามนำรูปแบบนี้ไปใช้กับค่าจาก req อื่นที่ไม่ได้ผ่าน allowlist
    baseQuery += ` ORDER BY ${field} ${order} LIMIT ? OFFSET ?`;

    try {
      const [rows] = await pool.query(baseQuery, [...params, limit, offset]);
      const [[{ total }]] = await pool.query(countQuery, params);

      res.status(200).json({
        message: "สำเร็จ",
        data: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

// 2. GET /api/v1/students/:id (ดึงข้อมูลนักศึกษารายบุคคล รองรับ query parameter ?include=courses)
v1Router.get("/students/:id", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM students WHERE id = ?", [
      req.params.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
      });
    }

    const student = rows[0];
    const shouldIncludeCourses = req.query.include === "courses";

    if (shouldIncludeCourses) {
      const [courses] = await pool.query(
        `SELECT c.id, c.course_name AS courseName, c.credit 
         FROM courses c
         JOIN enrollments e ON c.id = e.course_id
         WHERE e.student_id = ?`,
        [req.params.id],
      );
      return res.status(200).json({
        message: "สำเร็จ",
        data: { ...student, courses },
      });
    }

    res.status(200).json({ message: "สำเร็จ", data: student });
  } catch (err) {
    next(err);
  }
});

// 3. POST /api/v1/students (เพิ่มนักศึกษาใหม่)
v1Router.post("/students", createStudentLimiter, async (req, res, next) => {
  const { name, major, email } = req.body;

  if (!name || !major || !email) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ name, major และ email ให้ครบถ้วน",
      },
    });
  }

  if (typeof name === "string" && name.length > 100) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "ชื่อ (name) ต้องมีความยาวไม่เกิน 100 ตัวอักษร",
      },
    });
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO students (name, major, email) VALUES (?, ?, ?)",
      [name, major, email],
    );

    await redisClient.del("students:all"); // ล้างแคชเนื่องจากข้อมูลเปลี่ยนแปลงแล้ว

    res.status(201).json({
      message: "เพิ่มข้อมูลสำเร็จ",
      data: { id: result.insertId, name, major, email },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: { code: "DUPLICATE_EMAIL", message: "อีเมลนี้มีอยู่ในระบบแล้ว" },
      });
    }
    next(err);
  }
});

// 4. PUT /api/v1/students/:id (แก้ไขข้อมูลนักศึกษาทั้งระเบียน)
v1Router.put("/students/:id", async (req, res, next) => {
  const id = req.params.id;
  const { name, major, email } = req.body;

  if (!name || !major || !email) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ name, major และ email ให้ครบถ้วน",
      },
    });
  }

  try {
    const [result] = await pool.query(
      "UPDATE students SET name = ?, major = ?, email = ? WHERE id = ?",
      [name, major, email, id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
      });
    }

    res.status(200).json({
      message: "แก้ไขข้อมูลสำเร็จ",
      data: { id: Number(id), name, major, email },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: { code: "DUPLICATE_EMAIL", message: "อีเมลนี้มีอยู่ในระบบแล้ว" },
      });
    }
    next(err);
  }
});

// 5. PATCH /api/v1/students/:id (แก้ไขข้อมูลนักศึกษาบางส่วน)
v1Router.patch("/students/:id", async (req, res, next) => {
  const id = req.params.id;
  const { name, major, email } = req.body;

  try {
    const [rows] = await pool.query("SELECT * FROM students WHERE id = ?", [
      id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
      });
    }

    const current = rows[0];
    const newName = name !== undefined ? name : current.name;
    const newMajor = major !== undefined ? major : current.major;
    const newEmail = email !== undefined ? email : current.email;

    await pool.query(
      "UPDATE students SET name = ?, major = ?, email = ? WHERE id = ?",
      [newName, newMajor, newEmail, id],
    );

    res.status(200).json({
      message: "แก้ไขข้อมูลสำเร็จ",
      data: { id: Number(id), name: newName, major: newMajor, email: newEmail },
    });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: { code: "DUPLICATE_EMAIL", message: "อีเมลนี้มีอยู่ในระบบแล้ว" },
      });
    }
    next(err);
  }
});

// 6. DELETE /api/v1/students/:id (ลบข้อมูลนักศึกษา)
v1Router.delete("/students/:id",
  authenticateToken,
  authorizeRole("admin"),
  async (req, res, next) => {
    const id = req.params.id;
    try {
      const [result] = await pool.query("DELETE FROM students WHERE id = ?", [
        id,
      ]);

      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
        });
      }

      res.status(200).json({ message: "ลบข้อมูลสำเร็จ" });
    } catch (err) {
      next(err);
    }
  },
);

// 7. POST /api/v1/students/:id/enrollments (ลงทะเบียนเรียนด้วย Transaction)

v1Router.post("/students/:id/enrollments", async (req, res, next) => {
  const studentId = req.params.id;
  const { courseId } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [courseRows] = await connection.query(
      "SELECT * FROM courses WHERE id = ? FOR UPDATE",
      [courseId],
    );

    if (courseRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        error: { code: "COURSE_NOT_FOUND", message: "ไม่พบรายวิชาที่ระบุ" },
      });
    }

    if (courseRows[0].seat_available <= 0) {
      await connection.rollback();
      return res.status(409).json({
        error: { code: "SEAT_FULL", message: "ที่นั่งเต็มแล้ว" },
      });
    }

    await connection.query(
      "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)",
      [studentId, courseId],
    );

    await connection.query(
      "UPDATE courses SET seat_available = seat_available - 1 WHERE id = ?",
      [courseId],
    );

    await connection.commit();
    res.status(201).json({ message: "ลงทะเบียนสำเร็จ" });
  } catch (err) {
    await connection.rollback();
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "ALREADY_ENROLLED",
          message: "นักศึกษาลงทะเบียนรายวิชานี้ไปแล้ว",
        },
      });
    }
    next(err);
  } finally {
    connection.release();
  }
});

// Route ดูข้อมูลของตนเอง (ต้อง Login เท่านั้น)
v1Router.get("/auth/me", authenticateToken, (req, res) => {
  res.status(200).json({ message: "สำเร็จ", data: req.user });
});

// นำเข้าและตั้งค่า GraphQL
const { graphqlHTTP } = require("express-graphql");
const schema = require("./schema");
const resolvers = require("./resolvers");

app.use(
  "/graphql",
  graphqlHTTP({
    schema: schema,
    rootValue: resolvers,
    graphiql: true,
  }),
);
// === Authentication Endpoints ===

// 1. สมัครสมาชิก
v1Router.post("/auth/register", async (req, res, next) => {
  const { email, password } = req.body;

  // ตรวจสอบความครบถ้วนของข้อมูล
  if (!email || !password) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ email และ password",
      },
    });
  }

  try {
    // แฮชรหัสผ่านก่อนบันทึก
    const passwordHash = await hashPassword(password);

    // บังคับ role เป็น 'student' เสมอ ป้องกันการส่ง role: 'admin' มาทาง body (Mass Assignment)
    const [result] = await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'student')",
      [email, passwordHash],
    );

    res.status(201).json({
      message: "สมัครสมาชิกสำเร็จ",
      data: { id: result.insertId, email, role: "student" },
    });
  } catch (err) {
    // ดักจับกรณีอีเมลซ้ำ (MySQL error code ER_DUP_ENTRY)
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: { code: "DUPLICATE_EMAIL", message: "อีเมลนี้มีอยู่ในระบบแล้ว" },
      });
    }
    next(err);
  }
});

// 2. เข้าสู่ระบบ
v1Router.post("/auth/login", async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ email และ password",
      },
    });
  }

  try {
    // ค้นหาผู้ใช้จาก email
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        },
      });
    }

    const user = rows[0];

    // ตรวจสอบความถูกต้องของรหัสผ่าน
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
        },
      });
    }

    // ออก JWT Token
    const token = generateToken(user);
    res.status(200).json({ message: "เข้าสู่ระบบสำเร็จ", token });
  } catch (err) {
    next(err);
  }
});

// แบบฝึกหัดที่ 1: GET /api/v1/students/:id/courses (ดึงวิชาเรียนที่นักศึกษาลงทะเบียน)
v1Router.get("/students/:id/courses", async (req, res, next) => {
  // ดึงรหัสประจำตัวนักศึกษาจาก parameter ของ URL
  const studentId = req.params.id;

  try {
    // 1. กำหนดตัวแปรสตริงเพื่อเก็บคำสั่ง SQL JOIN ด้านบน
    const sql = `
      SELECT c.id, c.course_name AS courseName, c.credit 
      FROM courses c
      JOIN enrollments e ON c.id = e.course_id
      WHERE e.student_id = ?
    `;

    // 2. รันคำสั่งคิวรีไปยังฐานข้อมูล (ส่งค่า studentId เข้าไปแทนที่เครื่องหมาย ?)
    const [rows] = await pool.query(sql, [studentId]);

    // 3. ส่งข้อมูลผลลัพธ์กลับไปยัง Client ในรูปแบบ JSON
    res.status(200).json({
      message: "สำเร็จ",
      data: rows,
    });
  } catch (err) {
    // 4. ส่งต่อข้อผิดพลาดไปให้ Error Handling Middleware จัดการ
    next(err);
  }
});

// แบบฝึกหัดที่ 2: POST /api/v1/students/:id/enrollments-unsafe (ทดลองแบบไม่ใช้ Transaction)
v1Router.post("/students/:id/enrollments-unsafe", async (req, res, next) => {
  const studentId = req.params.id;
  const { courseId } = req.body;

  try {
    const [courseRows] = await pool.query(
      "SELECT * FROM courses WHERE id = ?",
      [courseId],
    );

    if (courseRows.length === 0) {
      return res.status(404).json({
        error: { code: "COURSE_NOT_FOUND", message: "ไม่พบรายวิชาที่ระบุ" },
      });
    }

    if (courseRows[0].seat_available <= 0) {
      return res.status(409).json({
        error: { code: "SEAT_FULL", message: "ที่นั่งเต็มแล้ว" },
      });
    }

    // 1. เพิ่มการลงทะเบียน
    await pool.query(
      "INSERT INTO enrollments (student_id, course_id) VALUES (?, ?)",
      [studentId, courseId],
    );

    // 2. ลดที่นั่งลง 1 (หากพังตรงนี้ จะเกิด Data Inconsistency)
    await pool.query(
      "UPDATE courses SET seat_available = seat_available - 1 WHERE id = ?",
      [courseId],
    );

    res.status(201).json({ message: "ลงทะเบียนสำเร็จ (แบบไม่ปลอดภัย)" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        error: {
          code: "ALREADY_ENROLLED",
          message: "นักศึกษาลงทะเบียนรายวิชานี้ไปแล้ว",
        },
      });
    }
    next(err);
  }
});

// แบบฝึกหัดที่ 3: DELETE /api/v1/students/:id/enrollments/:courseId (ยกเลิกการลงทะเบียนด้วย Transaction)
v1Router.delete("/students/:id/enrollments/:courseId",
  async (req, res, next) => {
    const { id: studentId, courseId } = req.params;
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. ลบข้อมูลการลงทะเบียน
      const [deleteResult] = await connection.query(
        "DELETE FROM enrollments WHERE student_id = ? AND course_id = ?",
        [studentId, courseId],
      );

      if (deleteResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({
          error: {
            code: "ENROLLMENT_NOT_FOUND",
            message: "ไม่พบข้อมูลการลงทะเบียนเรียนนี้",
          },
        });
      }

      // 2. คืนที่นั่งว่างกลับ 1 ที่นั่ง
      await connection.query(
        "UPDATE courses SET seat_available = seat_available + 1 WHERE id = ?",
        [courseId],
      );

      await connection.commit();
      res.status(200).json({ message: "ยกเลิกการลงทะเบียนสำเร็จ" });
    } catch (err) {
      await connection.rollback();
      next(err);
    } finally {
      connection.release();
    }
  },
);

app.use("/api/v1", v1Router);

const v2Router = express.Router();

v2Router.get("/students", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM students");
    // v2 ปรับโครงสร้างผลลัพธ์ใหม่ ไม่มี wrapper "message" เหมือน v1
    res.status(200).json({ items: rows, count: rows.length });
  } catch (err) {
    next(err);
  }
});

app.use("/api/v2", v2Router);

// 404: ไม่พบ route ที่ร้องขอ (ต้องอยู่หลัง route ทั้งหมด)
app.use((req, res) => {
  res.status(404).json({
    error: { code: "ROUTE_NOT_FOUND", message: "ไม่พบเส้นทางที่ร้องขอ" },
  });
});

// Error-handling middleware (ต้องมีพารามิเตอร์ 4 ตัวเสมอ)
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    error: {
      code: statusCode === 500 ? "INTERNAL_SERVER_ERROR" : err.type || "ERROR",
      message:
        statusCode === 500
          ? "เกิดข้อผิดพลาดที่ไม่คาดคิดภายในระบบ"
          : err.message,
    },
  });
});
connectRedis()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server กำลังทำงานที่พอร์ต ${PORT} (${process.env.NODE_ENV})`);
    });
  })
  .catch((err) => {
    console.error("เชื่อมต่อ Redis ไม่สำเร็จ เซิร์ฟเวอร์จะไม่เริ่มทำงาน:", err);
    process.exit(1);
  });
