require("dotenv").config();

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
  })
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

let students = [
  {
    id: 1,
    name: "สมชาย ใจดี",
    major: "วิทยาการคอมพิวเตอร์",
    email: "somchai@example.com",
    phone: "080-000-0001",
    courseIds: [101, 102],
  },
  {
    id: 2,
    name: "สมหญิง รักเรียน",
    major: "เทคโนโลยีสารสนเทศ",
    email: "somying@example.com",
    phone: "080-000-0002",
    courseIds: [102],
  },
];

let courses = [
  { id: 101, courseName: "การเขียนโปรแกรมเบื้องต้น", credit: 3 },
  { id: 102, courseName: "โครงสร้างข้อมูล", credit: 3 },
];
let nextId = 3;

// === REST Endpoints สำหรับนักศึกษา ===

// 1. GET /api/v1/students (ดึงรายการนักศึกษาทั้งหมด)
app.get("/api/v1/students", (req, res) => {
  res.status(200).json({ message: "สำเร็จ", data: students });
});

// 2. GET /api/v1/students/:id (ดึงข้อมูลนักศึกษารายบุคคล รองรับ query parameter ?include=courses)
app.get("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
    });
  }

  const shouldIncludeCourses = req.query.include === "courses";

  if (shouldIncludeCourses) {
    const studentCourses = courses.filter((c) =>
      student.courseIds && student.courseIds.includes(c.id)
    );
    return res.status(200).json({
      message: "สำเร็จ",
      data: { ...student, courses: studentCourses },
    });
  }

  res.status(200).json({ message: "สำเร็จ", data: student });
});

// 3. POST /api/v1/students (เพิ่มนักศึกษาใหม่)
app.post("/api/v1/students", createStudentLimiter, (req, res) => {
  const { name, major, email, phone, courseIds } = req.body;

  if (!name || !major || !email) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ name, major และ email ให้ครบถ้วน",
      },
    });
  }

  // แบบฝึกหัดที่ 3: ปรับปรุง route POST /api/v1/students ให้ปฏิเสธคำขอที่ name มีความยาวเกิน 100 ตัวอักษร
  if (typeof name === "string" && name.length > 100) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "ชื่อ (name) ต้องมีความยาวไม่เกิน 100 ตัวอักษร",
      },
    });
  }

  const duplicated = students.find((s) => s.email === email);
  if (duplicated) {
    return res.status(409).json({
      error: {
        code: "DUPLICATE_EMAIL",
        message: "อีเมลนี้มีอยู่ในระบบแล้ว",
      },
    });
  }

  const newStudent = {
    id: nextId++,
    name,
    major,
    email,
    phone: phone || "",
    courseIds: courseIds || [],
  };
  students.push(newStudent);
  return res
    .status(201)
    .json({ message: "เพิ่มข้อมูลสำเร็จ", data: newStudent });
});

// 4. PUT /api/v1/students/:id (แก้ไขข้อมูลนักศึกษาทั้งระเบียน)
app.put("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
    });
  }

  const { name, major, email, phone, courseIds } = req.body;

  if (!name || !major || !email) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "กรุณาระบุ name, major และ email ให้ครบถ้วน",
      },
    });
  }

  student.name = name;
  student.major = major;
  student.email = email;
  if (phone !== undefined) student.phone = phone;
  if (courseIds !== undefined) student.courseIds = courseIds;

  return res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ", data: student });
});

// 5. PATCH /api/v1/students/:id (แก้ไขข้อมูลนักศึกษาบางส่วน)
app.patch("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const student = students.find((s) => s.id === id);

  if (!student) {
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
    });
  }

  const { name, major, email, phone, courseIds } = req.body;
  if (name !== undefined) student.name = name;
  if (major !== undefined) student.major = major;
  if (email !== undefined) student.email = email;
  if (phone !== undefined) student.phone = phone;
  if (courseIds !== undefined) student.courseIds = courseIds;

  res.status(200).json({ message: "แก้ไขข้อมูลสำเร็จ", data: student });
});

// 6. DELETE /api/v1/students/:id (ลบข้อมูลนักศึกษา)
app.delete("/api/v1/students/:id", (req, res) => {
  const id = Number(req.params.id);
  const index = students.findIndex((s) => s.id === id);

  if (index === -1) {
    return res.status(404).json({
      error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลนักศึกษา" },
    });
  }

  students.splice(index, 1);
  return res.status(200).json({ message: "ลบข้อมูลสำเร็จ" });
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
      message: statusCode === 500 ? "เกิดข้อผิดพลาดที่ไม่คาดคิดภายในระบบ" : err.message,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server กำลังทำงานที่พอร์ต ${PORT} (${process.env.NODE_ENV})`);
});

