require("dotenv").config();
const pool = require("./db");

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

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

// === REST Endpoints สำหรับนักศึกษา ===

// 1. GET /api/v1/students (ดึงรายการนักศึกษาทั้งหมด)
app.get("/api/v1/students", async (req, res, next) => {
  try {
    const [rows] = await pool.query("SELECT * FROM students");
    res.status(200).json({ message: "สำเร็จ", data: rows });
  } catch (err) {
    next(err);
  }
});

// 2. GET /api/v1/students/:id (ดึงข้อมูลนักศึกษารายบุคคล รองรับ query parameter ?include=courses)
app.get("/api/v1/students/:id", async (req, res, next) => {
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
app.post("/api/v1/students", createStudentLimiter, async (req, res, next) => {
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
app.put("/api/v1/students/:id", async (req, res, next) => {
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
app.patch("/api/v1/students/:id", async (req, res, next) => {
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
app.delete("/api/v1/students/:id", async (req, res, next) => {
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
});

// 7. POST /api/v1/students/:id/enrollments (ลงทะเบียนเรียนด้วย Transaction)
app.post("/api/v1/students/:id/enrollments", async (req, res, next) => {
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

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่พอร์ต ${PORT} (${process.env.NODE_ENV})`);
});
